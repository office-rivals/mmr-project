# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10.1", "matplotlib"]   # matplotlib only for its bundled DejaVu fonts
# ///
"""Scoreboard mockups (colour IPS TFT): one PNG per screen in SCOREBOARD-UI.md, at the panel's real resolution.

    uv run mockups.py     # self-check (every text fits its box, min font size) + PNGs into out/

The LAYOUT and COLOURS blocks are the contract firmware imports (firmware/tools/make_fonts.py).
Fonts: DejaVu Sans Bold, rendered 1-bit (as Adafruit GFX will), with FIT_SLACK px spare because GFX
doesn't kern. Names and team colours are examples; left/right = the halves of the screen.
Also writes out/all-dim.png: a rough look at the idle backlight in a lit room at 45 deg (simulate()).
"""
from pathlib import Path

import matplotlib
from PIL import Image, ImageDraw, ImageFont

# ---- LAYOUT (px, panel 320x240: 2.8" IPS ST7789 landscape, 57.6x43.2 mm -> 0.18 mm/px) ------
W, H = 320, 240
KEYS = 4
KEY_W = W // KEYS                          # label zones = screen quarters, centres 40/120/200/280 px
KEY_CX = [KEY_W // 2 + i * KEY_W for i in range(KEYS)]   # switches at 15.24 mm (6 holes): <= 1.3 mm off
LABEL = (186, 238)                         # label box y0..y1 (2 lines of F_LABEL fit)
LABEL_PAD, LABEL_BORDER, LABEL_R = 2, 2, 6
STATUS = (0, 24)                           # top strip: state word, GOAL banner, errors; icons right
COUNTDOWN = (24, 27)                       # who-scored time-left bar, right under the GOAL strip
ACCENT = (28, 32)                          # team-colour bar on top of each half
HALF = W // 2                              # left team | right team
SCORE_BOX = (34, 178)                      # score digits y0..y1 when no names
SCORE_BOX_NAMES = (34, 152)                # ...when names sit under them
NAMES_Y = (155, 179)                       # 1-2 names per side, one line each
F_DIGITS_MAX, F_LABEL, F_NAME, F_STATUS, F_HEAD, F_MIN = 160, 17, 18, 16, 28, 15
F_GOAL = F_STATUS + 2                      # "GOAL!  Who scored?" strip
ICON_Q = (80, 80, 70)                      # screen 17's "?": font size, box w, h
DIGIT_MAX_W = HALF - 16                    # "10" must fit
STALE_STROKE = 3                           # hollow digits = score may be out of date
FIT_SLACK = 2                              # px spare in every text box: GFX can't kern
TIMEOUTS_S = dict(scorer_window=15, scorer_confirm=3, confirm=8, toast=3, undone_toast=2)

# ---- COLOURS (RGB888 hex, each exactly representable in RGB565) -----------------------------
BG, FG = 0x000000, 0xFFFFFF
LINE = 0x585858                            # decoration only (divider); never carries meaning
OK, ERR, WARN = 0x38DC78, 0xF84848, 0xF8BC00
TEAM = (0xF85858, 0x50A4F8)                # left/right defaults; real = the table's rod colours (server)
TEAM_DIM = (0x481818, 0x183048)            # winner half background
BACKLIGHT_PCT = dict(idle=20, boost=100, fade_ms=400, boost_s=5)   # ux minimums; electronics owns the budget

FONT = Path(matplotlib.__file__).parent / "mpl-data/fonts/ttf/DejaVuSans-Bold.ttf"
OUT = Path(__file__).parent / "out"
_fonts = {}


def rgb(c):
    return (c >> 16, c >> 8 & 0xFF, c & 0xFF)


def font(size):
    return _fonts.setdefault(size, ImageFont.truetype(str(FONT), size))


def fit(d, text, max_w, max_h, size, min_size=F_MIN, ellipsis=False):
    """Largest font <= size where text fits (with FIT_SLACK); names get an ellipsis instead of shrinking."""
    while True:
        l, t, r, b = d.textbbox((0, 0), text, font=font(size))
        if r - l <= max_w - FIT_SLACK and b - t <= max_h - FIT_SLACK:
            return text, font(size)
        if ellipsis and size <= F_NAME and len(text) > 2:
            text = text.rstrip("…")[:-1] + "…"
            continue
        size -= 1
        assert size >= min_size, f"{text!r} does not fit {max_w}x{max_h}"


def text_c(d, cx, cy, text, max_w, max_h, size, fill=FG, **kw):
    """Centre text on (cx, cy) by its ink box; shrinks to fit (asserts the minimum)."""
    stroke = kw.pop("stroke", 0)
    text, f = fit(d, text, max_w - 2 * stroke, max_h - 2 * stroke, size, **kw)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    xy = (cx - (l + r) / 2, cy - (t + b) / 2)
    if stroke:
        d.text(xy, text, font=f, fill=rgb(BG), stroke_width=stroke, stroke_fill=rgb(fill), align="center")
    else:
        d.text(xy, text, font=f, fill=rgb(fill), align="center")


def labels(d, keys, pressed=None, colors=None, picked=None):
    """keys: 4 strings ('' = no box: the key does nothing). Pressed = filled in its colour, picked = green."""
    for i, k in enumerate(keys):
        if not k:
            continue
        col = (colors or [FG] * KEYS)[i]
        box = (KEY_CX[i] - KEY_W // 2 + LABEL_PAD, LABEL[0], KEY_CX[i] + KEY_W // 2 - LABEL_PAD, LABEL[1])
        fill = OK if i == picked else col if i == pressed else None
        d.rounded_rectangle(box, LABEL_R, fill=rgb(fill if fill is not None else BG),
                            outline=rgb(fill if fill is not None else col), width=LABEL_BORDER)
        text_c(d, (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, k, box[2] - box[0] - 4, box[3] - box[1] - 6,
               F_LABEL, fill=BG if fill is not None else col)


def strip(d, text="", bg=None, fg=FG, icons=()):
    if bg is not None:
        d.rectangle((0, STATUS[0], W, STATUS[1] - 1), fill=rgb(bg))
    if text:
        text_c(d, W / 2, sum(STATUS) / 2, text, W - 12 - 44 * len(icons), STATUS[1] - 2,
               F_GOAL if bg is not None else F_STATUS, fill=fg)
    x = W - 6
    for icon in icons:
        x = icon(d, x) - 6


def wifi(color, crossed=False, dots=0):
    """dots = 1..3: 'connecting', the lit dot steps along (animation frame)."""
    def draw(d, x_right):
        cx, by = x_right - 12, 20
        for r in (5, 10, 15):
            d.arc((cx - r, by - r, cx + r, by + r), 225, 315, fill=rgb(color), width=3)
        d.ellipse((cx - 2, by - 3, cx + 2, by + 1), fill=rgb(color))
        if crossed:
            d.line((cx - 12, 4, cx + 12, 22), fill=rgb(color), width=3)
        for i in range(3 if dots else 0):
            x = cx - 38 + i * 7
            d.ellipse((x, by - 4, x + 4, by), fill=rgb(color if i == dots - 1 else LINE))
        return cx - (40 if dots else 16)
    return draw


def battery(color, bars=1, big=False):
    def draw(d, x_right):
        k = 3 if big else 1
        w, h = 26 * k, 12 * k
        x0, y0 = ((W - w) // 2, 40) if big else (x_right - w - 3, 6)
        d.rectangle((x0, y0, x0 + w, y0 + h), outline=rgb(color), width=2 * k)
        d.rectangle((x0 + w, y0 + h // 4, x0 + w + 3 * k, y0 + 3 * h // 4), fill=rgb(color))
        for i in range(bars):
            d.rectangle((x0 + 4 * k + i * 7 * k, y0 + 4 * k, x0 + 8 * k + i * 7 * k, y0 + h - 4 * k), fill=rgb(color))
        return x0
    return draw


def score(d, left, right, names=None, stale=False, winner=None, accent=True, roll=None):
    """Two halves; names = ([left players], [right players]) or None.
    roll = (side, old, t 0..1, +1 up / -1 down): a frame of the digit-roll animation on one side."""
    y0, y1 = SCORE_BOX_NAMES if names else SCORE_BOX
    d.line((HALF, ACCENT[0], HALF, LABEL[0] - 8), fill=rgb(LINE), width=2)
    for side, value in enumerate((left, right)):
        x0, cx = side * HALF, HALF // 2 + side * HALF
        if winner == side:
            d.rectangle((x0 + 3, 0, x0 + HALF - 3, LABEL[0] - 5), fill=rgb(TEAM_DIM[side]))
            text_c(d, cx, sum(STATUS) / 2, "WINNER", HALF - 16, STATUS[1] - 2, F_STATUS, fill=TEAM[side])
        if accent:
            d.rectangle((x0 + 8, ACCENT[0], x0 + HALF - 8, ACCENT[1] - 1), fill=rgb(TEAM[side]))
        kw = dict(stroke=STALE_STROKE if stale else 0)
        if roll and roll[0] == side:     # old digit leaves, new one enters, clipped to the digit box
            _, old, t, direction = roll
            layer = Image.new("RGB", (W, H), rgb(BG))
            ld, h, ease = ImageDraw.Draw(layer), y1 - y0, 1 - (1 - t) ** 3
            ld.fontmode = "1"
            for v, off in ((old, -direction * ease * h), (value, direction * (1 - ease) * h)):
                text_c(ld, cx, (y0 + y1) / 2 + off, str(v), DIGIT_MAX_W, h, F_DIGITS_MAX, **kw)
            d._image.paste(layer.crop((x0 + 3, y0, x0 + HALF - 3, y1)), (x0 + 3, y0))
        else:
            text_c(d, cx, (y0 + y1) / 2, str(value), DIGIT_MAX_W, y1 - y0, F_DIGITS_MAX, **kw)
        if names:
            text_c(d, cx, sum(NAMES_Y) / 2, " · ".join(names[side]), HALF - 12, NAMES_Y[1] - NAMES_Y[0],
                   F_NAME, fill=TEAM[side], ellipsis=True)


def message(d, head, sub="", color=FG, icon=None):
    if icon:
        icon(d, 0)
    text_c(d, W / 2, 124, head, W - 20, 40, F_HEAD, fill=color)
    if sub:
        text_c(d, W / 2, 158, sub, W - 20, 26, F_NAME)


def render(draw):
    img = Image.new("RGB", (W, H), rgb(BG))
    d = ImageDraw.Draw(img)
    d.fontmode = "1"                       # no anti-aliasing: what GFX fonts will show
    draw(d)
    return img


ROSTER = (["Alice", "Bob"], ["Carol", "Dave"])
ROSTER_1V1 = (["Alice"], ["Christopher-Long"])        # long name -> ellipsis check
UNDO, NEW = "↶ Undo", "New\ngame"
LIVE = [UNDO, "", "", NEW]
NAME_COLS = [TEAM[0], TEAM[0], TEAM[1], TEAM[1]]


def goal_screen(d, picked=None, left=1.0):
    """The live screen, the strip in the scoring team's colour, names on the keys over their own half."""
    strip(d, "GOAL!  Who scored?", bg=TEAM[0], fg=BG)
    d.rectangle((0, COUNTDOWN[0], round(W * left), COUNTDOWN[1] - 1), fill=rgb(FG))   # time left
    score(d, 8, 5, accent=False)
    keys = ROSTER[0] + ROSTER[1]
    if picked is not None:
        keys = [("✓ " if i == picked else "") + k for i, k in enumerate(keys)]
    labels(d, keys, colors=NAME_COLS, picked=picked)


SCREENS = [
    ("01-wake-cached", lambda d: (strip(d, icons=[wifi(FG, dots=2)]), score(d, 7, 5, ROSTER, stale=True))),
    ("02-wake-cold", lambda d: strip(d, icons=[wifi(FG, dots=2)])),
    ("03-ready", lambda d: score(d, 0, 0, ROSTER)),
    ("04-live", lambda d: (score(d, 7, 5, ROSTER), labels(d, LIVE))),
    ("05-live-1v1", lambda d: (score(d, 3, 2, ROSTER_1V1), labels(d, LIVE))),
    ("06-live-no-roster", lambda d: (score(d, 7, 5), labels(d, LIVE))),
    ("07-pressed", lambda d: (score(d, 7, 5, ROSTER), labels(d, LIVE, pressed=0))),
    ("08-goal-who-scored", lambda d: goal_screen(d, left=0.7)),
    ("09-goal-picked", lambda d: goal_screen(d, picked=2, left=0.4)),
    ("10-confirm-undo", lambda d: (message(d, "Undo last goal?", "8 : 5   →   7 : 5"),
                                   labels(d, ["Cancel", "", "", UNDO]))),
    ("11-confirm-new-game", lambda d: (message(d, "End this game?", "7 : 5"),
                                       labels(d, ["Save", "Discard", "", "Cancel"], colors=[OK, ERR, FG, FG]))),
    ("12-finished", lambda d: (score(d, 10, 7, ROSTER, winner=0), labels(d, LIVE))),
    ("13-not-sent", lambda d: (strip(d, "✗  Not sent. Try again.", bg=ERR, fg=BG),
                               score(d, 7, 5, ROSTER, accent=False), labels(d, LIVE))),
    ("14-offline", lambda d: (strip(d, "No connection", fg=WARN, icons=[wifi(WARN, crossed=True)]),
                              score(d, 7, 5, ROSTER, stale=True))),
    ("15-low-battery", lambda d: (strip(d, icons=[battery(WARN)]), score(d, 7, 5, ROSTER), labels(d, LIVE))),
    ("16-change-batteries", lambda d: message(d, "Change batteries", "", color=ERR,
                                              icon=battery(ERR, bars=0, big=True))),
    ("17-not-set-up", lambda d: message(d, "Not set up", "ID fb-0a1b2c3d4e5f", color=WARN,
                                        icon=lambda d, _: text_c(d, W / 2, 62, "?", *ICON_Q[1:], ICON_Q[0],
                                                                 fill=WARN))),
]

# motion accents as frames, t = 0..1 over ~300 ms (only the changed half + strip + key row are redrawn)
FILMS = [
    ("20-anim-goal", [lambda d, t=t: (strip(d, "GOAL!  Who scored?", bg=TEAM[0], fg=BG) if t else None,
                                      score(d, 8, 5, None if t else ROSTER, accent=not t,
                                            roll=(0, 7, t, 1) if t < 1 else None),
                                      labels(d, ROSTER[0] + ROSTER[1] if t else LIVE,
                                             colors=NAME_COLS if t else None))
                      for t in (0, .35, .7, 1)]),
    ("21-anim-undo", [lambda d, t=t: (strip(d, "↶  Undone") if t == 1 else None,
                                      score(d, 7, 5, ROSTER, roll=(0, 8, t, -1) if t < 1 else None),
                                      labels(d, LIVE)) for t in (0, .35, .7, 1)]),
]


def simulate(img, backlight=BACKLIGHT_PCT["idle"] / 100, peak=280, ambient=5, paper=120, angle=0.65):
    """Rough look at the idle backlight in a lit office at 45 deg, relative to white paper next to it
    (paper = full white on your monitor). L = ambient reflection + backlight * peak * angle loss * pixel.
    Assumptions, not measurements: 280 cd/m2 peak (electronics' 250-300 est.), ~5 cd/m2 reflected room
    light, IPS keeps ~65 % at 45 deg, paper ~120 cd/m2 (400-500 lux)."""
    def ch(v):
        out = (ambient + backlight * peak * angle * (v / 255) ** 2.2) / paper
        return round(255 * min(out, 1) ** (1 / 2.2))
    return img.point([ch(v) for v in range(256)] * 3)


def sheet(imgs, name, cols=3, pad=16):
    rows = -(-len(imgs) // cols)
    out = Image.new("RGB", (cols * (W + pad) + pad, rows * (H + pad + 20) + pad), (200, 200, 200))
    d = ImageDraw.Draw(out)
    for i, (n, img) in enumerate(imgs):
        x, y = pad + (i % cols) * (W + pad), pad + (i // cols) * (H + pad + 20)
        d.text((x, y), n, font=font(14), fill=(0, 0, 0))
        out.paste(img, (x, y + 20))
    out.save(OUT / name)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.png"):
        old.unlink()
    imgs = [(n, render(f)) for n, f in SCREENS]            # fit() asserts every text fits at >= F_MIN
    films = [(f"{n}-{i}", render(f)) for n, frames in FILMS for i, f in enumerate(frames)]
    for n, img in imgs + films:
        assert img.size == (W, H), n
        img.save(OUT / f"{n}.png")
    for c in (BG, FG, LINE, OK, ERR, WARN, *TEAM, *TEAM_DIM):  # RGB565-exact: R,B multiples of 8, G of 4
        r, g, b = rgb(c)
        assert r % 8 == b % 8 == 0 and g % 4 == 0 or c == FG, hex(c)
    pitch_px = 15.24 / (57.6 / W)                            # 6 perfboard holes, row centred on the screen
    assert all(abs(cx - (W / 2 + (i - 1.5) * pitch_px)) <= 8 for i, cx in enumerate(KEY_CX)), KEY_CX
    sheet(imgs, "all.png")
    sheet(films, "anim.png", cols=4)
    sheet([(n, simulate(img)) for n, img in imgs], "all-dim.png")
    live = dict(imgs)["04-live"]                               # the idle-backlight choice, side by side
    sheet([(f"backlight {p} %", simulate(live, p / 100)) for p in (5, 10, 20, 50)], "backlight.png", cols=4)
    print(f"ok: {len(imgs)} screens + {len(films)} animation frames -> {OUT}/")
