"""Drift check (review round 3, R2-S2): the goal-counter build documents must not mention parts or values that were
dropped. Run: python3 check_drift.py   (exit 1 and a list on any hit)

Scope: the goal-counter parts of each document (the parked scoreboard's sections, dated studies and the bom's
superseded lists are history and are not checked).
"""
import re
import sys

DROPPED = [r"keyed J_BAT", r"keyed 3-pin (housing|plug) on J_BAT", r"\bpogo\b", r"drop-in", r"LM66100", r"3\.45 V cutoff",
           r"Adafruit 261\b", r"nickel", r"R_STRAP", r"12 × 12 tactile", r"Keystone 2487 (fits|fallback)", r"drawer out = off",
           r"pulling the drawer is the off switch"]
ALLOW = re.compile(r"was |withdrawn|dropped|not a |isn't|no pogo|superseded|instead of|deleted|gone|not bought|never|is a 100 mm|D1 stays|does not reliably")
# (file, first line that starts the checked part, first line that ends it)
SCOPE = [("../ASSEMBLY.md", "# Building a goal counter", "## S1. Print the enclosure"),
         ("README.md", "## Block diagram", "## Role strap: deleted"),
         ("dimensions.md", "# ", None),
         ("wiring.yml", "connectors:", None),
         ("bom.md", "## First table (review 2)", "## Lean first table"),
         ("../team/INTERFACES.md", "## 0.", "## 5.")]
hits = []
for path, start, end in SCOPE:
    lines = open(path).read().split("\n")
    i0 = next(i for i, l in enumerate(lines) if l.startswith(start))
    i1 = next((i for i, l in enumerate(lines) if end and i > i0 and l.startswith(end)), len(lines))
    for n, line in enumerate(lines[i0:i1], i0 + 1):
        for pat in DROPPED:
            if re.search(pat, line, re.I) and not ALLOW.search(line):
                hits.append(f"{path}:{n}: '{pat}' in: {line.strip()[:110]}")
for h in hits:
    print(h)
print(f"{len(hits)} drift hits" if hits else "drift check: no dropped part or value in the goal-counter documents")
sys.exit(1 if hits else 0)
