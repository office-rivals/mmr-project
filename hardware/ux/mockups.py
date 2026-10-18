# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10.1", "matplotlib", "segno"]   # matplotlib: DejaVu fonts; segno: QR for the mockups
# ///
"""Scoreboard mockups: 1-bit PNGs at the panel's real resolution, one per screen in SCOREBOARD-UI.md.

    uv run mockups.py     # self-check (every text fits its box, min font size) + PNGs into out/

The LAYOUT block is the contract firmware imports (firmware/tools/make_fonts.py): pixel boxes,
font sizes, key zones. Fonts: DejaVu Sans Bold, with FIT_SLACK px spare because GFX doesn't kern.
Names are examples. Left/right = the halves of the screen (which team goes left is a server value).
"""
from pathlib import Path

import matplotlib
import segno
from PIL import Image, ImageDraw, ImageFont

# ---- LAYOUT (px, panel 400x300, 4.2" 84.8x63.6 mm -> 0.212 mm/px) ------------------------
W, H = 400, 300
KEYS = 4
KEY_W = 96                                 # = key pitch 20.32 mm (8 perfboard holes) / 0.212 mm/px
KEY_CX = [W // 2 + (i * 2 - KEYS + 1) * KEY_W // 2 for i in range(KEYS)]   # 56/152/248/344, centred
LABEL = (248, 298)                         # label box y0..y1 (2 lines of F_LABEL fit), right above the keys
LABEL_PAD, LABEL_BORDER, LABEL_R = 3, 2, 6
STATUS = (0, 30)                           # top strip: state word left, icons right
HALF = W // 2                              # left team | right team
SCORE_BOX = (36, 200)                      # score digits y0..y1 when no names
SCORE_BOX_NAMES = (34, 186)                # ...when names sit under them
NAMES_Y = (196, 240)                       # 1-2 names per side, one line each
F_DIGITS_MAX, F_LABEL, F_NAME, F_STATUS, F_HEAD, F_MIN = 170, 20, 20, 18, 34, 16
F_GOAL = F_STATUS + 4                      # "GOAL!  Who scored?" strip
ICON_Q = (90, 100, 90)                     # screen 17's "?": font size, box w, h
DIGIT_MAX_W = HALF - 24                    # "10" must fit
STALE_STROKE = 3                           # hollow digits = score may be out of date
FIT_SLACK = 2                              # px spare in every text box: GFX can't kern
# QR screens 01, 02, 12 only while state.claim_url != null (a short /t/{code} link). QR bottom centre, score moves up
QR_BOX = (138, 177, 123)                   # x0, y0, size px incl. a 4-module quiet zone (keys K2/K3 are unused there)
QR_QUIET = 4                               # modules each side (ISO 18004)
QR_MODULE_PX = (3, 2)                      # largest that fits QR_BOX, else no QR: 3 px <= version 4, 2 px <= version 9
QR_ECC = ("m", "l")                       # M at 3 px (a <= ~60-char short link = version 4); L only for the 2 px fallback
SCORE_BOX_QR = (34, 146)                   # digits when the QR is shown
NAMES_Y_QR = (148, 172)                    # names / end labels when the QR is shown
HINT_Y = (180, 244)                        # hint text either side of the QR, above the K1/K4 labels
HINT_CX = (68, 332)                        # hint centres; box width HINT_W
HINT_W = 128
# Finished (12/12b/12c): one summary line in the strip over the half that did NOT win (WINNER sits
# over the other); centred when winner is null. state.summary {duration_s, mvp_name|null}
SUMMARY_F = F_STATUS
# Auto-submit (linked match won on score): a note centred in the label row over the empty K2/K3, between
# the K1/K4 boxes. Countdown from match.submit_in_s, redrawn in steps (e-paper): 10 s steps above 10, then 2 s
SUBMIT_NOTE_W = 2 * KEY_W - 8
SUBMIT_STEP_S = (10, 2)
ALREADY_SAVED = "Already saved. Fix it in the app."   # undo answered 422 (the submit won the race): 3 s strip
SAVED = "Saved to MMR ✓"                   # Finished with match.needs_claim == false: the match is rated
TIMEOUTS_S = dict(scorer_window=15, scorer_confirm=3, confirm=8, toast=3, same_badge=3, leds_steady=10, lobby_awake=300, reader_finished=60)
# Scan-in (badge reader). Lobby = Ready with no linked roster: heading, join slots, "n more to start"
# v5 (end shelf): the badge target is on the face, in the wing beside the screen, on the rail-end side
BADGE_SIDE = "right"                       # lead: the board sits at the RIGHT end of the rail; the mirrored build sets "left"
BADGE_ARROW = {"right": "→", "left": "←"}[BADGE_SIDE]
PHONE_SIDE = {"right": "left", "left": "right"}[BADGE_SIDE]   # the phone tag: the inner wall, above the bead counter (lead)
HINT_TEXT = ("Log this\ngame:", f"scan, or tap\nthe {PHONE_SIDE} side")   # QR = claim_url (claim or confirm)
IDLE_HINT = f"Press a key, then tap your badge {BADGE_ARROW}"   # 01b: empty label row (a badge can't wake the board)
LOBBY_HEAD = f"Tap your badge {BADGE_ARROW}"
PHONE_TOAST = f"Phone? Tap the {PHONE_SIDE} side."   # a phone held to the badge target (random UID 0x08...)
LOBBY_HEAD_Y = (48, 92)                    # "Tap your badge"
LOBBY_SLOT_CX = (100, 300)                 # 2 columns; 2v2 = 2 rows (join order: row 1 left, right, row 2 ...)
LOBBY_SLOT_Y = ((105, 145), (150, 190))    # 1v1 uses the middle of the two
LOBBY_MORE_Y = (209, 235)                  # "2 more to start" / "All in!"
LOBBY_EMPTY = "·  ·  ·"                    # an open slot
# Lobby while state.roster.link != null (unknown badge): names move up, QR + hints as on screen 12
LOBBY_SLOT_Y_QR = ((38, 74), (78, 114))
LOBBY_MORE_Y_QR = (122, 148)
LINK_HINT_TEXT = ("Link this\nbadge:", "you or any\ncolleague\ncan scan")   # any signed-in colleague can link it (user)

FONT = Path(matplotlib.__file__).parent / "mpl-data/fonts/ttf/DejaVuSans-Bold.ttf"
OUT = Path(__file__).parent / "out"
_fonts = {}


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
        size -= 2
        assert size >= min_size, f"{text!r} does not fit {max_w}x{max_h}"


def text_c(d, cx, cy, text, max_w, max_h, size, fill=0, **kw):
    """Centre text on (cx, cy) by its ink box; shrinks to fit (asserts the minimum)."""
    stroke = kw.pop("stroke", 0)
    text, f = fit(d, text, max_w - 2 * stroke, max_h - 2 * stroke, size, **kw)
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    xy = (cx - (l + r) / 2, cy - (t + b) / 2)
    if stroke:
        d.text(xy, text, font=f, fill=1, stroke_width=stroke, stroke_fill=0, align="center")
    else:
        d.text(xy, text, font=f, fill=fill, align="center")


def labels(d, keys, pressed=None):
    """keys: 4 strings ('' = no label, no box: the key does nothing visible here)."""
    for i, k in enumerate(keys):
        if not k:
            continue
        box = (KEY_CX[i] - KEY_W // 2 + LABEL_PAD, LABEL[0], KEY_CX[i] + KEY_W // 2 - LABEL_PAD, LABEL[1])
        inv = i == pressed
        d.rounded_rectangle(box, LABEL_R, fill=0 if inv else 1, outline=0, width=LABEL_BORDER)
        text_c(d, (box[0] + box[2]) / 2, (box[1] + box[3]) / 2, k, box[2] - box[0] - 8,
               box[3] - box[1] - 8, F_LABEL, fill=1 if inv else 0)


def status(d, left="", icons=()):
    if left:
        text_c(d, 6 + 90, 15, left, 180, 24, F_STATUS)   # left-aligned enough at this length
    x = W - 8
    for icon in icons:
        x = icon(d, x) - 8


def wifi(d, x_right, crossed=False, dots=False):
    cx, by = x_right - 14, 24
    for r in (6, 12, 18):
        d.arc((cx - r, by - r, cx + r, by + r), 225, 315, fill=0, width=3)
    d.ellipse((cx - 2, by - 3, cx + 2, by + 1), fill=0)
    if crossed:
        d.line((cx - 14, 4, cx + 14, 26), fill=0, width=3)
    if dots:
        for i in range(3):
            d.ellipse((x_right - 44 + i * 7, 20, x_right - 40 + i * 7, 24), fill=0)
        return x_right - 46
    return cx - 16


def battery(d, x_right, bars=1, big=False):
    s = 4 if big else 1
    w, h = 30 * s, 14 * s
    x0, y0 = (x_right - w, 8) if not big else ((W - w) // 2, 60)
    d.rectangle((x0, y0, x0 + w, y0 + h), outline=0, width=2 * s)
    d.rectangle((x0 + w, y0 + h // 4, x0 + w + 3 * s, y0 + 3 * h // 4), fill=0)
    for i in range(bars):
        d.rectangle((x0 + 4 * s + i * 8 * s, y0 + 4 * s, x0 + 9 * s + i * 8 * s, y0 + h - 4 * s), fill=0)
    return x0


def score(d, left, right, names=None, stale=False, winner=None, qr=None):
    """Two halves; names = ([left players], [right players]) or None. qr = URL: after-game layout with a QR."""
    y0, y1 = SCORE_BOX_QR if qr else SCORE_BOX_NAMES if names else SCORE_BOX
    names_y = NAMES_Y_QR if qr else NAMES_Y
    bottom = QR_BOX[1] - 4 if qr else LABEL[0] - 10
    d.line((HALF, STATUS[1] + 8, HALF, bottom - 4), fill=0, width=2)
    for side, value in enumerate((left, right)):
        cx = HALF // 2 + side * HALF
        win = winner == side
        if win:
            d.rectangle((side * HALF + 4, 2, (side + 1) * HALF - 4, bottom), fill=0)
            text_c(d, cx, 17, "WINNER", HALF - 20, 22, F_STATUS, fill=1)
        text_c(d, cx, (y0 + y1) / 2, str(value), DIGIT_MAX_W, y1 - y0, F_DIGITS_MAX,
               fill=1 if win else 0, stroke=STALE_STROKE if stale else 0)
        if names:
            text_c(d, cx, sum(names_y) / 2, " · ".join(names[side]), HALF - 20,
                   names_y[1] - names_y[0], F_NAME, fill=1 if win else 0, ellipsis=True)
    if qr:
        qr_hints(d, qr, HINT_TEXT)


def qr_hints(d, url, hints):
    draw_qr(d, url)
    for cx, h in zip(HINT_CX, hints):
        text_c(d, cx, sum(HINT_Y) / 2, h, HINT_W, HINT_Y[1] - HINT_Y[0], F_STATUS)


def qr_symbol(url):
    """(symbol, module px): ECC M at 3 px if it fits, else ECC L at 2 px; StopIteration = no QR."""
    for ecc, px in zip(QR_ECC, QR_MODULE_PX):
        q = segno.make_qr(url, error=ecc, boost_error=False)
        if q.symbol_size(border=QR_QUIET)[0] * px <= QR_BOX[2]:
            return q, px
    raise StopIteration(url)


def draw_qr(d, url):
    """Largest QR_MODULE_PX that fits QR_BOX with the quiet zone, centred in the box."""
    q, px = qr_symbol(url)
    n = q.symbol_size(border=QR_QUIET)[0]
    x0 = QR_BOX[0] + (QR_BOX[2] - n * px) // 2 + QR_QUIET * px
    y0 = QR_BOX[1] + (QR_BOX[2] - n * px) // 2 + QR_QUIET * px
    for r, row in enumerate(q.matrix):
        for c, dark in enumerate(row):
            if dark:
                d.rectangle((x0 + c * px, y0 + r * px, x0 + c * px + px - 1, y0 + r * px + px - 1), fill=0)


def message(d, head, sub="", icon=None):
    if icon:
        icon(d)
    text_c(d, W / 2, 160, head, W - 30, 50, F_HEAD)
    if sub:
        text_c(d, W / 2, 205, sub, W - 30, 30, F_NAME)


def strip(d, text, inverted=False):
    """Full-width strip message (toasts, errors); inverted = black."""
    if inverted:
        d.rectangle((0, 0, W, STATUS[1]), fill=0)
    text_c(d, W / 2, 15, text, W - 20, 24, F_STATUS, fill=1 if inverted else 0)


def lobby(d, joined, needed=4, toast=None, keys=None, link=None):
    """Who's playing? = state.roster with no teams yet. Names in join order (= LED order K1..K4)."""
    if toast:
        strip(d, toast)
    else:
        status(d, "Badge not known" if link else "Who's playing?")
    slots, more = (LOBBY_SLOT_Y_QR, LOBBY_MORE_Y_QR) if link else (LOBBY_SLOT_Y, LOBBY_MORE_Y)
    if not link:
        text_c(d, W / 2, sum(LOBBY_HEAD_Y) / 2, LOBBY_HEAD, W - 30, LOBBY_HEAD_Y[1] - LOBBY_HEAD_Y[0], F_HEAD)
    rows = slots if needed > 2 else ((slots[0][0] + 20, slots[1][1] - 20),)
    for i in range(needed):
        (y0, y1), cx = rows[i // 2], LOBBY_SLOT_CX[i % 2]
        name = joined[i] if i < len(joined) else LOBBY_EMPTY
        text_c(d, cx, (y0 + y1) / 2, name, HALF - 20, y1 - y0, F_NAME + 4, ellipsis=True)
    full = len(joined) == needed                  # = state.roster.can_generate
    text_c(d, W / 2, sum(more) / 2, "All in!" if full else f"{needed - len(joined)} more to start",
           W - 30, more[1] - more[0], F_STATUS)
    if link:
        qr_hints(d, link, LINK_HINT_TEXT)
    if keys is None:
        keys = [REMOVE if joined else ""] + (MODES if full and needed > 2 else ["", "", MAKE if full else ""])
    labels(d, keys)


def screen(name, draw):
    img = Image.new("1", (W, H), 1)
    draw(ImageDraw.Draw(img))
    img.save(OUT / f"{name}.png")
    return name, img


ROSTER = (["Alice", "Bob"], ["Carol", "Dave"])
ROSTER_1V1 = (["Alice"], ["Christopher-Long"])        # long name -> ellipsis check
URL_SHORT = "https://foosball-scores.example.invalid/t/7KQ2XD"   # placeholder, 47 chars
URL_LONG = "https://scores.example.invalid/acme-office/foosball-league/tables/3f2b9c1e-8d4a-4f7e-9b61-2c5d8e0a7f13"
ENDS = (["Window"], ["Door"])                       # unclaimed match: the table's end labels instead of names
URL_LINK = "https://foosball-scores.example.invalid/t/Q4M8ZT"    # placeholder: roster.link.url (backend: same /t/ short links)
UNDO, NEW, SWAP = "↶ Undo", "New\ngame", "⇄ Swap\nsides"
REMATCH, REMOVE, MAKE = "Rematch", "Remove\nplayer", "Make\nteams"
MODES = ["Choose", "Random", "Fair"]       # All in (18d), K2-K4 -> generate_teams {mode: manual | random | fair}; 1v1 = K4 MAKE only
AGAIN = "Again"                            # Teams (19c), K3: re-draw while match.teams_mode == "random" (same key as Random)
TEAMS_STRIP = {"fair": "Fair teams", "random": "Random teams", "manual": "Teams chosen", None: "Teams made"}   # 1v1: always "Teams made"
LOBBY = ["Alice", "Bob"]
FULL = ["Alice", "Bob", "Carol", "Dave"]


def duration(s):
    """m:ss, or h:mm:ss from an hour on."""
    h, m = divmod(s // 60, 60)
    return f"{h}:{m:02}:{s % 60:02}" if h else f"{m}:{s % 60:02}"


def summary(d, duration_s, mvp=None, winner=None):
    """'9:26 · MVP Alice'; either part may be null (mvp: server sends it only at >= 70 % scorer coverage).
    Both null -> no line."""
    text = " · ".join(p for p in (duration(duration_s) if duration_s is not None else "",
                                  f"MVP {mvp}" if mvp else "") if p)
    if not text:
        return
    cx, w = (W / 2, W - 20) if winner is None else (HALF // 2 + (1 - winner) * HALF, HALF - 16)
    text_c(d, cx, 15, text, w, 24, SUMMARY_F, ellipsis=True)


def submit_shown(s):
    """Countdown value on screen for submit_in_s = s (rounded UP to the step, so it never shows less time)."""
    step = SUBMIT_STEP_S[0] if s > 10 else SUBMIT_STEP_S[1]
    return -(-s // step) * step


def submit_note(d, text):
    text_c(d, W / 2, sum(LABEL) / 2, text, SUBMIT_NOTE_W, LABEL[1] - LABEL[0], F_STATUS)


def goal_screen(d, picked=None, own_goal=False):
    """The live screen, with the names moved onto the keys (each side's players above that side's keys).
    One story for 08/09/09b: the RIGHT team (Carol, Dave) just went 7 -> 8. Carol scoring = normal (09);
    Alice (left) picked = she put it in her own goal (09b)."""
    d.rectangle((0, 0, W, STATUS[1]), fill=0)
    head = f"Oops! Own goal, {ROSTER[0][0]}" if own_goal else "GOAL!  Who scored?"
    text_c(d, W / 2, 15, head, W - 20, 26, F_GOAL, fill=1)
    score(d, 5, 8)
    keys = ROSTER[0] + ROSTER[1]
    if picked is not None:
        keys = [("✓ " if i == picked else "") + k for i, k in enumerate(keys)]
    labels(d, keys, pressed=picked)


SCREENS = [
    ("01-idle", lambda d: (status(d, "Last game"), score(d, 10, 7, ENDS, qr=URL_SHORT))),
    ("01b-idle-claimed", lambda d: (status(d, "Last game"), score(d, 10, 7, ROSTER),
                                    text_c(d, W / 2, sum(LABEL) / 2, IDLE_HINT, W - 20, LABEL[1] - LABEL[0], F_STATUS))),
    ("02-waking", lambda d: (status(d, "Last game", [lambda d, x: wifi(d, x, dots=True)]),
                             score(d, 10, 7, ENDS, qr=URL_SHORT))),
    ("03-ready", lambda d: (score(d, 0, 0, ROSTER), labels(d, ["", SWAP, "", ""]))),   # swap: roster only
    ("04-live", lambda d: (score(d, 7, 5, ROSTER), labels(d, [UNDO, "", "", NEW]))),
    ("05-live-1v1", lambda d: (score(d, 3, 2, ROSTER_1V1), labels(d, [UNDO, "", "", NEW]))),
    ("06-live-no-roster", lambda d: (score(d, 7, 5, ENDS), labels(d, [UNDO, "", "", NEW]))),   # end labels
    ("07-pressed", lambda d: (score(d, 7, 5, ROSTER), labels(d, [UNDO, "", "", NEW], pressed=0))),
    ("08-goal-who-scored", goal_screen),
    ("09-goal-picked", lambda d: goal_screen(d, picked=2)),          # right side scored, Carol picked
    ("09b-goal-own-goal", lambda d: goal_screen(d, picked=0, own_goal=True)),   # right side scored, Alice picked
    ("10-confirm-undo", lambda d: (message(d, "Undo last goal?", "5 : 8   →   5 : 7"),
                                   labels(d, ["Cancel", "", "", UNDO]))),
    ("11-confirm-new-game", lambda d: (message(d, "End this game?", "7 : 5"),
                                       labels(d, ["Save", "Discard", "", "Cancel"]))),
    ("12-finished", lambda d: (score(d, 10, 7, ENDS, winner=0, qr=URL_SHORT), summary(d, 566, winner=0),
                               labels(d, [UNDO, "", "", NEW]))),          # no players -> no MVP
    ("12b-finished-long-url", lambda d: (score(d, 10, 7, ENDS, winner=0, qr=URL_LONG), summary(d, 566, winner=0),
                                         labels(d, [UNDO, "", "", NEW]))),
    ("12c-finished-claimed", lambda d: (score(d, 10, 7, ROSTER, winner=0), summary(d, 566, "Alice", winner=0),
                                        labels(d, ["", "", "", REMATCH]), submit_note(d, SAVED))),   # can_undo false once rated
    ("12d-finished-saving", lambda d: (score(d, 10, 7, ROSTER, winner=0), summary(d, 566, "Alice", winner=0),
                                       labels(d, [UNDO, "", "", ""]), submit_note(d, f"Saving to MMR\nin {submit_shown(7)} s"))),
    ("10b-confirm-undo-saving", lambda d: (message(d, "Undo last goal?", "10 : 7   →   9 : 7"),
                                           labels(d, ["Cancel", "", "", UNDO]), submit_note(d, f"Saving\nin {submit_shown(4)} s"))),
    ("13b-already-saved", lambda d: (score(d, 10, 7, ROSTER, winner=0), strip(d, ALREADY_SAVED, inverted=True),
                                     labels(d, ["", "", "", REMATCH]), submit_note(d, SAVED))),   # strip drawn over WINNER
    ("13-not-sent", lambda d: (d.rectangle((0, 0, W, STATUS[1]), fill=0),
                               text_c(d, W / 2, 15, "✗  Not sent. Try again.", W - 20, 24, F_STATUS, fill=1),
                               score(d, 7, 5, ROSTER), labels(d, [UNDO, "", "", NEW]))),
    ("14-offline", lambda d: (status(d, "No connection", [lambda d, x: wifi(d, x, crossed=True)]),
                              score(d, 7, 5, ROSTER, stale=True))),
    ("15-low-battery", lambda d: (status(d, "", [battery]), score(d, 7, 5, ROSTER),
                                  labels(d, [UNDO, "", "", NEW]))),
    ("16-change-batteries", lambda d: message(d, "Change batteries", "3 × AA",
                                              icon=lambda d: battery(d, 0, bars=0, big=True))),
    ("17-not-set-up", lambda d: message(d, "Not set up", "ID fb-0a1b2c3d4e5f",
                                        icon=lambda d: text_c(d, W / 2, 80, "?", *ICON_Q[1:], ICON_Q[0]))),
    ("18-lobby-empty", lambda d: lobby(d, [])),
    ("18b-lobby-joined", lambda d: lobby(d, LOBBY, toast="✓  Bob joined")),
    ("18c-lobby-1v1", lambda d: lobby(d, ["Christopher-Long"], needed=2)),
    ("18d-lobby-all-in", lambda d: lobby(d, FULL)),
    ("18e-lobby-all-in-1v1", lambda d: lobby(d, ["Alice", "Christopher-Long"], needed=2)),
    ("23-choose-partner", lambda d: (strip(d, "Choose teams  (or wait)"),     # K2 Choose on 18d; 8 s -> back to 18d
                                     text_c(d, W / 2, 120, f"Who plays\nwith {FULL[0]}?", W - 30, 130, F_HEAD),
                                     labels(d, [""] + FULL[1:]))),             # = join order; LEDs in their colours
    ("19-teams", lambda d: (status(d, TEAMS_STRIP["fair"]), score(d, 0, 0, ROSTER), labels(d, [REMOVE, SWAP, "", ""]))),
    ("19c-teams-random", lambda d: (status(d, TEAMS_STRIP["random"]), score(d, 0, 0, (["Alice", "Dave"], ["Bob", "Carol"])),
                                    labels(d, [REMOVE, SWAP, AGAIN, ""]))),
    ("19d-teams-chosen", lambda d: (status(d, TEAMS_STRIP["manual"]), score(d, 0, 0, (["Alice", "Carol"], ["Bob", "Dave"])),
                                    labels(d, [REMOVE, SWAP, "", ""]))),       # picked Carol on 23: Alice's team on the left
    ("19b-teams-1v1", lambda d: (status(d, "Teams made"), score(d, 0, 0, ROSTER_1V1), labels(d, [REMOVE, SWAP, "", ""]))),
    ("20-remove-who", lambda d: (strip(d, "Remove who?  (or wait)"), score(d, 0, 0),
                                 labels(d, ["✗ " + n for n in ROSTER[0] + ROSTER[1]]))),
    ("20b-remove-who-lobby", lambda d: lobby(d, LOBBY + ["Carol"], toast="Remove who?  (or wait)",
                                              keys=["✗ " + n for n in LOBBY + ["Carol"]] + [""])),
    ("21-unknown-badge", lambda d: lobby(d, LOBBY, link=URL_LINK)),
    ("21b-unknown-badge-1v1", lambda d: lobby(d, ["Alice"], needed=2, link=URL_LINK)),
    ("22-teams-full", lambda d: (strip(d, "Full. Remove a player first."), score(d, 0, 0, ROSTER),
                                 labels(d, [REMOVE, SWAP, "", ""]))),
]


def contact_sheet(imgs, cols=3, pad=24):
    rows = -(-len(imgs) // cols)
    sheet = Image.new("L", (cols * (W + pad) + pad, rows * (H + pad + 22) + pad), 200)
    d = ImageDraw.Draw(sheet)
    for i, (name, img) in enumerate(imgs):
        x, y = pad + (i % cols) * (W + pad), pad + (i // cols) * (H + pad + 22)
        d.text((x, y), name, font=font(16), fill=0)
        sheet.paste(img.convert("L"), (x, y + 22))
        d.rectangle((x - 1, y + 21, x + W, y + 22 + H), outline=0)
    sheet.save(OUT / "all.png")


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    imgs = [screen(n, f) for n, f in SCREENS]      # fit() asserts every text fits at >= F_MIN
    for n, img in imgs:
        assert img.mode == "1" and img.size == (W, H), n
    assert KEY_CX == [56, 152, 248, 344] and KEY_CX[-1] + KEY_W // 2 <= W and LABEL[1] < H
    assert QR_BOX[1] + QR_BOX[2] <= H and KEY_CX[1] - KEY_W // 2 <= QR_BOX[0] and QR_BOX[0] + QR_BOX[2] <= KEY_CX[2] + KEY_W // 2
    assert LOBBY_MORE_Y_QR[1] < QR_BOX[1] and LOBBY_MORE_Y[1] < LABEL[0]
    for url, px in ((URL_SHORT, 3), (URL_LINK, 3), ("x" * 60, 3), (URL_LONG, 2), ("x" * 150, 2)):   # 60 = lead's short-link target
        assert qr_symbol(url)[1] == px, url
    assert [submit_shown(x) for x in (10, 9, 8, 7, 2, 1, 11, 25, 60)] == [10, 10, 8, 8, 2, 2, 20, 30, 60]
    assert duration(566) == "9:26" and duration(59) == "0:59" and duration(3735) == "1:02:15"
    d = ImageDraw.Draw(Image.new("1", (W, H), 1))
    summary(d, 3735, "Christopher-Longname", winner=1)   # worst case still fits (ellipsis), or asserts
    summary(d, 3735, "Christopher-Longname")
    summary(d, None, "Alice", winner=0)                   # "MVP Alice"
    summary(d, None, None, winner=0)                      # nothing drawn
    contact_sheet(imgs)
    print(f"ok: {len(imgs)} screens -> {OUT}/")
