# Short teaser (lead ACTION, 2026-10-16)

Output: `video/teaser-short.mp4` (11.0 s, 1920x1080, 30 fps, H.264 + AAC stereo, -16.5 LUFS, -1.6 dBTP; full decode
with `ffmpeg -xerror`: clean) and `video/teaser-short.jpg` (1920x1080, the 10 : 7 snap at 3.55 s).
Project: `video/teaser-short/`. Rebuild: `sh tools/build.sh teaser-short` from `video/film`.

| t (s) | Picture | Sound |
|---|---|---|
| 0-0.5 | black | a low sine drone fades in |
| 0.5 | dark tunnel; the IR beam flickers on (on/off/on/off/on) | a tick on each "on" |
| 1.55-2.5 | the ball's shadow comes up the tunnel and breaks the beam; receiver ring | roll, then ux's Goal earcon at 2.05 |
| 2.75 | a tilted sliver of e-paper: 9 : 7 | |
| 3.2-3.5 | full refresh: inverted, black, white; 10 : 7 | three refresh ticks, a thud on the snap |
| 4.3 | a row of keys, cropped; the middle key is pressed, its light comes on | key click, a soft rising swell |
| 5.5 | a badge slides onto the plate; the target glows | ux's Scan, then Joined |
| 6.85 | hard cut to black | 0.5 s of silence (drone cut) |
| 7.35 | "Soon, the table keeps score." with a short beam under it | a thud |
| 9.2-11 | crest + "MMR PROJECT" (the project's own icon), fade to black | a soft ding |

Choices:
- The line: "Soon, the table keeps score." (5 words) instead of "Something is coming to the foosball table." (7 words,
  over the ≤ ~6 words rule). One-string change in `index.html` if lead prefers the original.
- Loudness -16.5 LUFS, not the long teaser's -14.5: the mix is sparse with a peaky Goal earcon, and the -1.5 dBTP
  ceiling sets the level. (The sounds preview is at -16.2.)
- The whole device is never shown: tunnel, a slit of the screen, one key, the badge plate. No hostnames, URLs or
  credentials in the project; the only URL is the pinned gsap CDN script.
- No music bed, no VO. All sound is generated (AUDIO-CREDITS.md).
