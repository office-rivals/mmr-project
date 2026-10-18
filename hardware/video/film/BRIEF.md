---
workflow: general-video
flow: automation
storyboard: yes
message: "Drop it in the goal drawer and every goal is counted — battery-powered, months on AA"
destination: presentation
aspect: 1920x1080
language: en
length: 132s
audience: the team and colleagues who play on the tables
---

## Intent

A short presentation video of the foosball goal counter (Garlando G-5000, several tables per room).
Story per `team/briefs/video.md`: problem → IR beam → hardware → 3D-printed insert → Wi-Fi/REST → battery.
v4: one dry narrator (Kokoro bm_george, local), a generated pizzicato bed ducked under the VO, and sparse generated SFX (user, via lead). On-screen: one short line at a time.

## Assets

- assets/1_closed … 5_battery_swap.png — v2 insert renders from mechanical/out/video/ (regen: cd mechanical && uv run python insert.py --video)
- ../../electronics/schematic.svg — schematic, ghosted background in the hardware scene

## Notes

- Only claim what INTERFACES.md / READMEs say; estimates labelled "est.".
- Public repo: no real URLs/hostnames on screen; API shown as `POST /goal-events`.
- Storyboard to lead before render. No commits.

## Customizations

- Tone (user via lead, 2026-10-14): a bit funny. Pitch: "because we're lazy, and because we can". Frame 1 = lazy
  status quo (bead counter, squinting, typing the score into the MMR app from memory); close = the app pre-fills
  10–5, deadpan laziness line. Tech scenes accurate, with a wink. No voice-over (user confirmed).
