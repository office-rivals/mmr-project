#!/bin/sh
# Coach re-audit: who replied 'updated:' since a time, and where old values still live.
# usage: coach/reaudit.sh [since 'YYYY-MM-DD HH:MM', default 2026-10-15 19:29]
set -u
cd "$(dirname "$0")/.."           # hardware/
since=${1:-2026-10-15 19:29}

echo "== 'updated:' replies since $since (rule 10)"
awk -v s="$since" '/^## /{t=$2" "$3; hdr=$0; next} t>=s && /^updated:/{print hdr}' team/log.md \
  | awk '{print $4}' | sort | uniq -c
echo "== owners with NO 'updated:' since $since"
for a in electronics mechanical firmware ux twin backend admin-ui presenter analytics video assembly-review observability; do
  awk -v s="$since" -v a="$a" '/^## /{t=$2" "$3; f=$4; next} t>=s && f==a && /^updated:/{x=1} END{exit !x}' team/log.md || echo "  $a"
done

# Old values (coach/AUDIT.md 2026-10-15). Hits need a human look: some are history notes ("was 35").
echo "== old values still in docs"
grep -rnIE \
  -e 'submit\?table=' \
  -e '190 days|about 6 months|~ ?6 months|4\.6 months|4\.7 months|3–4 months|3-4 months' \
  -e '(Ø|ø)3[05]\b|\b3[05] ?mm (ball|balls)|ball[^.]{0,20}\b3[05] ?mm' \
  -e 'Bearer|buck-boost|150 ?[×x] ?80' \
  --include='*.md' --include='*.html' --include='*.h' --include='*.yaml' --include='*.yml' \
  --exclude-dir=out --exclude-dir=build --exclude-dir=managed_components --exclude-dir=.pio \
  --exclude-dir=node_modules --exclude-dir=coach --exclude=log.md --exclude=DECISIONS.md \
  . ../api/docs ../docs/src 2>/dev/null

# Prices: diff against INTERFACES §0, not a fixed list (§0 changes). Flags a total-cost line that
# names a kr figure §0 doesn't have.
echo "== cost totals not matching INTERFACES §0"
python3 - <<'PY'
import re, pathlib
num = lambda t: set(re.findall(r"\d{1,2},\d{3}|\b\d{3}\b", t))
s0 = pathlib.Path("team/INTERFACES.md").read_text().split("## 1.")[0]
ok = num(" ".join(l for l in s0.splitlines() if "kr" in l))
pat = re.compile(r"(first table|per scoreboard|scoreboard\b.{0,30}kr|three tables|per table|total)", re.I)
for f in [*pathlib.Path(".").rglob("*.md"), *pathlib.Path(".").rglob("*.html")]:
    if any(x in f.parts for x in ("out", "build", "coach", "node_modules")) or f.name in ("log.md", "DECISIONS.md", "INTERFACES.md"):
        continue
    for i, l in enumerate(f.read_text(errors="ignore").splitlines(), 1):
        if "kr" in l and pat.search(l) and (bad := {n for n in re.findall(r"(\d{1,2},\d{3}|\b\d{3})\s?(?:–\s?\d[\d,]*\s?)?kr", l)} - ok):
            print(f"./{f}:{i}: {sorted(bad)} | {l.strip()[:140]}")
PY
