#!/usr/bin/env python3
"""Mock of the device API (openapi.yaml) for LAN bench tests and demos. Stdlib only.

    uv run tools/mock_server.py --token <enrolment-token> [--devices tools/mock_devices.example.json]
                                [--port 8000] [--idle 300] [--to 10] [--fail 0.3] [--reject 0.1] [--unassigned]

Keeps score per table: goal events score (a match ends when a team reaches --to; the next goal starts
a new one). With --devices, devices are mapped to tables and goals, and any other keys of a device's
entry (e.g. beam_mode) go into its config. Without it, any device is a goal device on table-1, "home".

Undo button (ux/goal-counter-phase1-2026-10-17.md B1): POST /undo-events undoes the goal named by
undoes_event_id when this device sent it, its match is still live, and it arrived at most
--undo-window-s (10) before the undo did. A seen undo event_id is 409 before any other check; refusals
are 422 with code not_yours / too_late / already_undone / closed.

Also a tiny OTLP/HTTP (JSON) receiver for the telemetry (INTERFACES §10): point OTLP_ENDPOINT at this
server. It checks the payload shape, prints log records, keeps the latest metrics per device
(--telemetry FILE appends everything as JSON lines) and prints the alerts the README recommends:
battery below the warn level, and no telemetry from a device for --stale-s (36 h; e.g. 120 on the bench).

Point secrets.h at it: API_BASE_URL "http://<your-laptop-ip>:8000"
--fail 0.3 answers 30% of goal/undo events with 503 (retry path); --reject 0.1 goals with 422 (drop path).
"""
import argparse
import json
import random
import re
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULT_DEVICE = {"role": "goal", "table_id": "table-1", "goal": "home"}


def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Table:
    """Goals per match. A ball into the "home" goal is a point for "away" and vice versa."""

    def __init__(self, table_id, spec):
        self.id, self.sound_volume = table_id, spec.get("sound_volume", 2)  # 0 off .. 3 high
        self.match, self.goals, self.n = 0, [], 0  # match 0 = none live
        self.by_event = {}  # goal event_id -> (goal, match, device id): the undo button's lookups
        self.lock = threading.Lock()

    def score(self, team):
        return sum(1 for g in self.goals if g["team"] == team)

    def _changed(self):
        log("SCORE", self.id, f"m-{self.match}" if self.match else "finished",
            *[f"{t} {self.score(t)}" for t in ("home", "away")])

    def goal_into(self, goal_key, event_id, device_id):
        with self.lock:
            if not self.match:
                self.n += 1
                self.match, self.goals = self.n, []
            g = {"team": "away" if goal_key == "home" else "home", "t": time.monotonic()}
            self.goals.append(g)
            self.by_event[event_id] = (g, self.match, device_id)
            if self.score(g["team"]) >= args.to:
                self.match = 0  # finished: its goals can't be undone any more
            self._changed()

    def undo_event(self, device_id, target):
        """(http code, refusal code or None). Server arrival times only."""
        with self.lock:
            g, match, dev = self.by_event.get(target, (None, None, None))
            if not g or dev != device_id:
                return 422, "not_yours"
            if g.get("undone"):
                return 422, "already_undone"
            if match != self.match:
                return 422, "closed"
            if time.monotonic() - g["t"] > args.undo_window_s:
                return 422, "too_late"
            g["undone"] = True
            self.goals.remove(g)
            self._changed()
            return 201, None


secrets_seen = {}  # device_id -> secret (a real backend stores only a hash)
WARN_V = 3.5  # alert level, V
last_seen = {}  # device.id -> (monotonic time, already alerted)
metrics = {}    # device.id -> {metric name: latest value}


def alert(*a):
    log("ALERT", *a)


def otlp_attrs(lst):
    """OTLP attribute list -> dict; raises unless it is [{"key", "value": {"<type>Value": ...}}]."""
    out = {}
    for a in lst:
        (kind, v), = a["value"].items()
        assert kind.endswith("Value"), kind
        out[a["key"]] = int(v) if kind == "intValue" else v
    return out


def otlp(path, body):
    """Validates and records one OTLP JSON export. Returns an error string, or None."""
    try:
        key, inner, items = (("resourceLogs", "scopeLogs", "logRecords") if path.endswith("/v1/logs")
                             else ("resourceMetrics", "scopeMetrics", "metrics"))
        for rs in body[key]:
            res = otlp_attrs(rs["resource"]["attributes"])
            dev = res["device.id"]
            assert res["service.name"] == "foosball-goal-counter", res["service.name"]
            last_seen[dev] = (time.monotonic(), False)
            for sc in rs[inner]:
                for it in sc[items]:
                    if items == "logRecords":
                        assert isinstance(it["severityNumber"], int) and it["timeUnixNano"].isdigit()
                        attrs = otlp_attrs(it.get("attributes", []))
                        ns = int(it["timeUnixNano"])  # the device's NTP time (batches arrive >= 60 s later)
                        at = datetime.fromtimestamp(ns / 1e9).strftime("%H:%M:%S.%f")[:-3] if ns else "unsynced"
                        log("LOG", dev, f"at={at}", it["severityText"], attrs.pop("foosball.tag", "-"),
                            it["body"]["stringValue"], attrs)
                        continue
                    (data,) = [v for k, v in it.items() if k in ("gauge", "sum")]
                    p = data["dataPoints"][0]
                    assert p["timeUnixNano"].isdigit()
                    v = p["asDouble"] if "asDouble" in p else int(p["asInt"])
                    metrics.setdefault(dev, {})[it["name"]] = v
                    if it["name"] == "foosball.battery.voltage" and v < WARN_V:
                        alert(dev, f"battery {v:.2f} V < {WARN_V} V: replace the cells")
            if items == "metrics":
                log("METRICS", dev, metrics.get(dev))
        if args.telemetry:
            with open(args.telemetry, "a") as f:
                f.write(json.dumps({"path": path, "body": body}) + "\n")
        return None
    except (KeyError, IndexError, TypeError, ValueError, AssertionError, AttributeError) as e:
        return f"bad OTLP payload: {e!r}"


def watch_stale():
    while True:
        time.sleep(min(60, args.stale_s / 4))
        for dev, (t, alerted) in list(last_seen.items()):
            if not alerted and time.monotonic() - t > args.stale_s:
                alert(dev, f"no telemetry for > {args.stale_s} s: battery dead or device gone?")
                last_seen[dev] = (t, True)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"  # keep-alive: the device reuses one connection per lane

    def _send(self, code, body=None):
        data = json.dumps(body).encode() if body is not None else b""
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authed(self):
        """Device auth (openapi.yaml, INTERFACES §11): a known device must present its secret; an
        unknown one registers with a valid enrolment token (--token) and its secret."""
        dev, auth = self.headers.get("X-Device-Id", ""), self.headers.get("Authorization", "")
        secret = auth[len("Device "):] if auth.startswith("Device ") else ""
        if dev and re.fullmatch(r"[0-9a-f]{64}", secret):
            if dev in secrets_seen:
                if secrets_seen[dev] == secret:
                    return True
            elif self.headers.get("X-Enrolment-Token") == args.token:
                secrets_seen[dev] = secret
                log("ENROLLED", dev, "(unclaimed unless it is in --devices)")
                return True
        log("401", dev or "-", self.path)
        self._send(401, {"error": "bad device credentials"})
        return False

    def _device(self, dev):
        if args.unassigned:
            return None
        d = devices.get(dev)
        return d if d else (None if args.devices else DEFAULT_DEVICE)

    def _table(self, body):
        d = self._device(body.get("device_id"))
        return tables.get(d.get("table_id")) if d and d.get("role") == "goal" else None, d

    def do_GET(self):
        if not self._authed():
            return
        if m := re.search(r"/devices/([^/]+)/config$", self.path):
            d = self._device(m.group(1))
            log("config", m.group(1), d)
            if not d:
                return self._send(404)
            return self._send(200, {**d, "config_version": 1, "idle_timeout_s": args.idle, "min_block_ms": 5,
                                    "lockout_ms": 1500, "stuck_after_s": 10, "undo_window_s": args.undo_window_s,
                                    "sound_volume": getattr(tables.get(d.get("table_id")), "sound_volume", 2)})
        self._send(404)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        if self.path.endswith(("/v1/logs", "/v1/metrics")):  # OTLP: its own auth header, not checked here
            err = otlp(self.path, body)
            if err:
                log("OTLP 400", err)
            return self._send(400, {"error": err}) if err else self._send(200, {})
        if not self._authed():
            return
        if self.path.endswith(("/goal-events", "/undo-events")) and random.random() < args.fail:
            log("503 (injected)", body.get("event_id"))
            return self._send(503)
        eid = body.get("event_id")
        if self.path.endswith("/goal-events"):
            if random.random() < args.reject:
                log("422 (injected)", eid)
                return self._send(422)
            dup = eid in seen
            seen.add(eid)
            log("GOAL dup" if dup else "GOAL", json.dumps(body))
            t, d = self._table(body)
            if not dup and t:
                t.goal_into(d["goal"], eid, body.get("device_id"))
            return self._send(409 if dup else 201)
        if self.path.endswith("/undo-events"):
            if eid in seen:  # dedupe first: a retried good undo is done, never "too late"
                log("UNDO dup", eid)
                return self._send(409)
            t, _ = self._table(body)
            code, why = t.undo_event(body.get("device_id"), body.get("undoes_event_id")) if t else (422, "not_yours")
            if code == 201:
                seen.add(eid)  # a refused undo isn't stored: its retry is judged again
            log("UNDO", json.dumps(body), "->", code, why or "")
            return self._send(code, {"code": why} if why else None)
        if re.search(r"/devices/[^/]+/status$", self.path):
            log("status", json.dumps(body))
            if body.get("low_batt"):
                alert(body.get("device_id"), f"low_batt ({body.get('battery_mv')} mV): replace the cells")
            return self._send(204)
        self._send(404)

    def log_message(self, *a):  # quiet default access log
        pass


def log(*a):
    print(datetime.now().strftime("%H:%M:%S.%f")[:-3], *a, flush=True)


def setup(argv=None):
    """Parse args and build state; returns the server (also used by tools/check_openapi.py)."""
    global args, devices, tables, seen
    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=8000)
    p.add_argument("--token", required=True)
    p.add_argument("--devices", help="JSON map of devices to tables (see tools/mock_devices.example.json)")
    p.add_argument("--fail", type=float, default=0.0)
    p.add_argument("--reject", type=float, default=0.0)
    p.add_argument("--idle", type=int, default=300, help="idle_timeout_s to hand out (use 30 on the bench)")
    p.add_argument("--to", type=int, default=10, help="a match ends when a team reaches this many goals")
    p.add_argument("--undo-window-s", type=int, default=10, help="the goal counter's undo window (undo_window_s)")
    p.add_argument("--unassigned", action="store_true", help="answer every device as unassigned (404)")
    p.add_argument("--telemetry", help="append every OTLP export to this JSON-lines file")
    p.add_argument("--stale-s", type=int, default=36 * 3600, help="alert when a device sends no telemetry this long")
    args = p.parse_args(argv)
    cfg = json.load(open(args.devices)) if args.devices else {"devices": {}, "tables": {"table-1": {}}}
    devices, seen = cfg["devices"], set()
    secrets_seen.clear()
    last_seen.clear()
    metrics.clear()
    tables = {tid: Table(tid, spec) for tid, spec in cfg["tables"].items()}
    server = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    server.daemon_threads = True
    return server


if __name__ == "__main__":
    srv = setup()
    threading.Thread(target=watch_stale, daemon=True).start()
    log(f"mock server on :{args.port}")
    srv.serve_forever()
