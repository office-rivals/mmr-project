# Brief: twin

You are `twin`. Read first: `team/PROTOCOL.md`, `team/DECISIONS.md`, `team/INTERFACES.md` (§1, §6–§10),
`firmware/README.md`, `firmware/openapi.yaml`, and skim `firmware/lib/core/` and `firmware/tools/`.

## Goal
A **digital twin** of the devices so the backend (not built yet; it will live in the parent MMR
project) can be developed and tested without any hardware: virtual tables, each with **2 goal counters
+ 1 scoreboard**, speaking exactly what real devices speak: the REST API (`openapi.yaml`) and the
OTLP/HTTP logs + metrics (§10).

## Key principle: run the real logic
Build the twin on the **firmware's own core** (`firmware/lib/core`: detector, event queue, payloads,
retry/drop policy, scoreboard state machine, heartbeat, log ring) compiled for the host, with a
simulated hardware layer (beam, motion, battery voltage, clock, NVS/RTC memory, power loss) and real
HTTP. Don't re-implement device behaviour in another language; that drifts. If you need a seam in the
firmware, ask `firmware` (they own `firmware/`); you own `twin/`.

## Deliverables (in `twin/`)
1. A CLI that starts N virtual tables against a configurable base URL + OTLP endpoint (default: the
   firmware mock server), with time acceleration.
2. Scenario scripts (repeatable, deterministic seed), each with expected outcomes it asserts:
   normal match to 10; undo + pick scorer + new game (save/discard); simultaneous goals on both ends;
   duplicate/resend after a power pull mid-POST (server must dedupe on event_id); offline → queue →
   drain; stuck ball (beam_blocked); low battery → warn/cutoff; device goes silent (missed heartbeat);
   config role mismatch; unassigned device (404 config); server errors (5xx/429/401) → retry/backoff;
   several tables at once.
3. A way to watch a virtual scoreboard: render its screens with firmware's host preview renderer
   (e.g. PNGs or a tiny live view), so backend devs see what players would see.
4. Usable in CI later (exit codes, no hardware, no secrets). README: how a backend dev runs it.

## Working with others
- `firmware` owns the device logic and the API spec; report any spec ambiguity or bug you find to
  `firmware` + `lead`.
- Report progress and completion to `lead`. Questions for the user → lead. No commits.
