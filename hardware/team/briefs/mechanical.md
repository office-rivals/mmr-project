# Brief: mechanical

You are `mechanical`. Read first: `team/PROTOCOL.md`, `team/DECISIONS.md`, `team/INTERFACES.md`, and
**look at the user's drawings** in `team/drawings/` (1: drawer isometric, 2: top view, 3: sensor front view).

## Goal
A 3D-printable insert that sits in the foosball table's ball drawer, funnels every scored ball through
a sensing channel (IR beam across it), and houses the electronics (MCU, battery holder with tool-free
swap, motion sensor rigidly coupled, wires routed away from the ball).

## Deliverables (in `mechanical/`)
1. A **parametric** model in code (build123d/CadQuery via `uv`, or OpenSCAD — your call), with every
   drawer dimension a named parameter at the top. Current drawer and ball values live in INTERFACES §0
   (measured vs `EST`); never copy them into the brief or code comments, and keep each one a one-line change.
2. Printable exports: STL and/or 3MF per part, oriented for printing, each within 256×256×256 mm
   (Bambu A1/P1S/X1C), PETG, minimal supports. Note recommended print settings.
3. Rendered preview images (PNG) of the assembly and of each part, so the user can review without CAD.
4. `README.md`: parts list, print settings, assembly/installation steps, which parameters to measure.
5. Design concerns to handle: the ball must never jam (channel ≥ ball + clearance, smooth transitions,
   ramp angle); beam elements recessed and shrouded from room light; balls arriving at speed; insert
   must not block the ball's path to the collection end; mounting to the drawer (method TBD by user —
   design for screws and make an alternative easy); USB port reachable for reflashing.

## Working with others
- Part dimensions come from `electronics` (INTERFACES §4). Use datasheet placeholders until confirmed.
- Report progress and completion to `lead`. Questions for the user (dimensions, mounting) → lead.
