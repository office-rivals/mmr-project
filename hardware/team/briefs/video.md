# Brief: video

You are `video`. Read first: `team/PROTOCOL.md`, `team/DECISIONS.md`, `team/INTERFACES.md`, and skim
`electronics/README.md`, `firmware/README.md`, `mechanical/README.md` and `firmware/openapi.yaml`
(when present) for facts.

## Goal
A short, polished **presentation video** of the foosball goal counter, made with the
**`/hyperframes` skill** (invoke it via the Skill tool before you start building).

## Story to tell (in roughly this order)
1. The problem: counting goals automatically on our foosball tables (Garlando G-5000, several per room).
2. How it works: a 31–36 mm (INTERFACES §0) ball rolls through a funnel into a 40 mm gate and breaks an infrared beam → goal.
3. Hardware: Seeed XIAO ESP32-C6, IR LED + phototransistor beam, LIS3DH motion sensor that wakes the
   device when the table is played, all on one small perfboard; one device per goal, two per table.
4. 3D-printed parts: the insert that sits in the ball drawer (funnel, sensor gate, electronics bay,
   tool-free magnetic battery hatch), taped into the drawer, printed on a Bambu Lab printer.
   Use the renders in `mechanical/out/` (ask `mechanical` for fresh/extra renders or angles you need —
   the model is being shortened right now, so use the latest; `out/preview.png` is coming).
5. Internet: Wi-Fi only, talks only to the REST server (no device-to-device radio); on a goal it wakes
   Wi-Fi, POSTs a goal event (device id, time, battery), and the backend works out the match and score.
   Device pulls its config from the server. Survives power loss without losing goals.
6. Battery: 3 × AA, swappable without tools, sleeps at µA levels between matches, months per set.

## Constraints
- Length ~60–90 s unless lead says otherwise. 16:9, 1080p.
- Only claim what the docs say; numbers must match `team/INTERFACES.md`. Mark estimates as estimates.
- Public repo: no real server URLs, hostnames or credentials on screen.
- Output in `video/` (source + rendered MP4 + a poster frame PNG). No commits.
- Questions for the user → lead. Report progress (storyboard first, then render) and completion to lead.
