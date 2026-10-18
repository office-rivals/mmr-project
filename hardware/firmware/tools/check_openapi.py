"""Check that the firmware's payloads match openapi.yaml.

    uvx --with jsonschema --with pyyaml --with rfc3339-validator python tools/check_openapi.py

Two checks against the schemas, exits non-zero on any mismatch:
1. The native tests assert api::goalEventJson / api::statusJson output byte-for-byte against JSON
   literals. Those literals (and the spec's own examples) must validate, so a field added,
   removed or retyped on either side fails here.
2. tools/mock_server.py is driven through a goal counter's session (config, goals, the undo button's
   201 / 409 / 422 codes, status, OTLP, device auth): every request must validate and behave as documented.
The scoreboard's schemas stay in the contract (backend) but no longer have a firmware producer.
"""
import json
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import jsonschema
import yaml

root = Path(__file__).resolve().parent.parent
spec = yaml.safe_load((root / "openapi.yaml").read_text())
test_src = "\n".join(p.read_text() for p in sorted((root / "test").glob("*/test_main.cpp")))


def validator(name):
    schema = {"$ref": f"#/components/schemas/{name}", "components": spec["components"]}
    return jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())


# Every run of adjacent raw literals R"(...)" R"(...)" that is a JSON object, classified by shape.
# The tests assert these byte-for-byte against the firmware's output (or feed them to its parser).
SHAPES = [("undoes_event_id", "UndoEvent"), ("event_id", "GoalEvent"), ("queued_events", "DeviceStatus")]
cases, otlp_payloads = [], []
for m in re.finditer(r'(?:R"\(.*?\)"\s*)+', test_src, re.S):
    if "spec-invalid" in test_src[max(0, m.start() - 120):m.start()]:
        continue  # robustness input, deliberately outside the schema
    text = "".join(re.findall(r'R"\((.*?)\)"', m.group(0), re.S))
    try:
        doc = json.loads(text)
    except ValueError:
        continue
    if isinstance(doc, dict) and ("resourceLogs" in doc or "resourceMetrics" in doc):
        otlp_payloads.append(doc)  # OTel's schema, not ours: the mock's OTLP receiver checks them
        continue
    name = next((n for key, n in SHAPES if isinstance(doc, dict) and key in doc), None)
    if name:
        cases.append((name, doc, "test"))
for name in ("GoalEvent", "UndoEvent", "DeviceStatus", "DeviceConfig"):
    cases += [(name, ex, "spec example") for ex in spec["components"]["schemas"][name].get("examples", [])]



def mock_scenario():
    sys.path.insert(0, str(root / "tools"))
    import mock_server

    srv = mock_server.setup(["--token", "t", "--port", "0", "--undo-window-s", "1", "--devices",
                             str(root / "tools/mock_devices.example.json")])
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    out = []
    goal_home = "fb-000000000001"

    def call(method, path, body=None, schema=None):
        dev = (re.search(r"/devices/(fb-[0-9a-f]+)", path) or [None, (body or {}).get("device_id", goal_home)])[1]
        req = urllib.request.Request(base + path, method=method,
                                     headers={"X-Device-Id": dev, "Authorization": "Device " + "ab" * 32,
                                              "X-Enrolment-Token": "t"},
                                     data=json.dumps(body).encode() if body is not None else None)
        if body is not None:
            req.add_header("Content-Type", "application/json")
            if schema:
                out.append((schema, body, "mock request"))
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                code, data = r.status, r.read()
        except urllib.error.HTTPError as e:
            code, data = e.code, e.read()
        doc = json.loads(data) if data else None
        return code, doc

    code, cfg = call("GET", f"/devices/{goal_home}/config")
    assert code == 200 and cfg["goal"] == "home" and cfg["undo_window_s"] == 1, cfg
    out.append(("DeviceConfig", cfg, "mock: goal config"))
    assert call("GET", "/devices/fb-0000000000ff/config")[0] == 404, "unassigned: 404"

    seq = iter(range(100))
    def goal(dev=goal_home):
        e = next(seq)
        ev = {"event_id": f"{dev}-0000000a-{e}", "device_id": dev, "seq": e, "occurred_at": None,
              "uptime_ms": 1, "table_id": "table-1", "goal": "home", "battery_mv": None, "firmware_version": "0.1.0"}
        assert call("POST", "/goal-events", ev, "GoalEvent")[0] == 201
        assert call("POST", "/goal-events", ev)[0] == 409, "a retried goal is a duplicate"
        return ev["event_id"]

    # the goal counter's undo button (ux phase 1 B1): its own goals, inside undo_window_s (1 s here), dedupe first
    useq = iter(range(1000, 1100))
    def undo(target, dev=goal_home, eid=None):
        e = next(useq)
        ev = {"event_id": eid or f"{dev}-0000000a-{e}", "device_id": dev, "seq": e, "occurred_at": None,
              "uptime_ms": 2, "table_id": "table-1", "goal": "home", "undoes_event_id": target, "battery_mv": None,
              "firmware_version": "0.1.0"}
        code, doc = call("POST", "/undo-events", ev, "UndoEvent")
        return code, (doc or {}).get("code"), ev["event_id"]
    t1 = mock_server.tables["table-1"]
    score = lambda: t1.score("away")
    g1 = goal()
    code, _, u1 = undo(g1)
    assert code == 201 and score() == 0, "own goal inside the window: undone"
    assert undo(g1, eid=u1)[0] == 409, "a retried good undo: 409 (dedupe before the window check)"
    assert undo(g1)[:2] == (422, "already_undone")
    g2 = goal()
    assert undo(g2, dev="fb-000000000002")[:2] == (422, "not_yours"), "the other counter can't undo it"
    time.sleep(1.3)
    assert undo(g2)[:2] == (422, "too_late") and score() == 1, "outside the window: the goal stands"
    for _ in range(9):  # first to 10 (mock default): the match is over
        last = goal()
    assert undo(last)[:2] == (422, "closed"), "a finished match's goal can't be undone"

    st = {"device_id": goal_home, "role": "goal", "reason": "sleep", "battery_mv": 3900}
    assert call("POST", f"/devices/{goal_home}/status", st)[0] == 204

    assert len(otlp_payloads) >= 2, "OTLP logs + metrics literals not found in the tests"
    for doc in otlp_payloads:  # the firmware's OTLP output is accepted by the receiver
        path = "/v1/logs" if "resourceLogs" in doc else "/v1/metrics"
        code, resp = call("POST", path, doc)
        assert code == 200, f"OTLP {path}: {code} {resp}"
    assert mock_server.metrics["fb-a0b1c2d3e4f5"]["foosball.goals"] == 412
    assert call("POST", "/v1/metrics", {"resourceMetrics": [{}]})[0] == 400, "malformed OTLP must be rejected"

    # device auth: a known device with another secret is rejected; an unknown one without the token too
    def raw(headers):
        req = urllib.request.Request(base + f"/devices/{goal_home}/config", headers=headers)
        try:
            return urllib.request.urlopen(req, timeout=5).status
        except urllib.error.HTTPError as e:
            return e.code
    assert raw({"X-Device-Id": goal_home, "Authorization": "Device " + "cd" * 32,
                "X-Enrolment-Token": "t"}) == 401, "known device, wrong secret (e.g. NVS wiped)"
    assert raw({"X-Device-Id": "fb-0000000000aa", "Authorization": "Device " + "cd" * 32,
                "X-Enrolment-Token": "nope"}) == 401, "unknown device, bad enrolment token"
    srv.shutdown()
    return out


try:
    cases += mock_scenario()
except AssertionError as e:
    print(f"FAIL mock scenario: {e}", file=sys.stderr)
    sys.exit(1)

failed = 0
for name, payload, src in cases:
    errors = list(validator(name).iter_errors(payload))
    for e in errors:
        print(f"FAIL {name} ({src}): {e.message}", file=sys.stderr)
    failed += bool(errors)

kinds = {n: sum(1 for c in cases if c[0] == n and c[2] == "test") for _, n in SHAPES}
assert min(kinds.values()) >= 1 and kinds["GoalEvent"] >= 2, f"test payloads not found: {kinds}"
print(f"{len(cases) - failed}/{len(cases)} payloads valid ({kinds} from tests; mock goal scenario passed)")
sys.exit(1 if failed else 0)
