"""Perfboard layouts (70 x 30 mm, 2.54 mm grid). Run: uvx --from matplotlib python perfboard.py
-> perfboard.{svg,png} (goal device), perfboard-scoreboard.{svg,png} (scoreboard main board) and
keystrip.{svg,png} (scoreboard keys). Left = TOP (parts), right = UNDERSIDE (mirrored, wires).

Cut from a standard 50 x 70 mm protoboard (24 x 18 holes, ~5.8 mm end margins): keep the 70 mm edges,
cut the width to 30 mm. Hole (c, r) sits at x = 5.8 + 2.54*c, y = 3.4 + 2.54*r from the USB-end /
bottom-edge corner (c 0..23, r 0..10).
"""
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, Rectangle

W, H, P, X0, Y0 = 70.0, 30.0, 2.54, 5.8, 3.4
COLS, ROWS = 24, 11
MOUNT = [(66.5, 3.5), (66.5, 26.5)]   # drill both Ø3.2; the sled pins only (66.5, 3.5), the other rests on a boss
# Support keep-outs (assembly-review B4): no joints, parts or wires on the UNDERSIDE here.
# End rail x 0.5-4.0 (left of column 0), both long-edge strips and the two pin bosses.
KEEP_RECT = [(0.5, 0.0, 3.5, 30.0),                       # end rail (x, y, w, h)
             (0.0, 0.0, 70.0, 1.5), (0.0, 28.5, 70.0, 1.5)]   # outer 1.5 mm strips of both long edges
KEEP_CIRC = [(66.5, 3.5, 3.5), (66.5, 26.5, 3.5)]             # (x, y, r)


def xy(c, r):
    return X0 + P * c, Y0 + P * r


# XIAO pins: bottom row r=2, top row r=8, columns 0..6 (USB at the left edge)
XIAO = {**{f"D{i}": (i, 2) for i in range(7)},
        **dict(zip(["5V", "GND", "3V3", "D10", "D9", "D8", "D7"], [(c, 8) for c in range(0, 7)]))}
# SparkFun LIS3DH rotated 180 deg: J1 (GND VCC SDA SCL SA0 CS) on r=3, J2 (GND ADC1-3 INT1 INT2) on r=7
LIS = {**dict(zip(["GND", "VCC", "SDA", "SCL", "SA0", "CS"], [(c, 3) for c in range(12, 18)])),
       **dict(zip(["GND2", "ADC1", "ADC2", "ADC3", "INT1", "INT2"], [(c, 7) for c in range(12, 18)]))}

# Two-lead parts on top: (label, (c,r) lead1, (c,r) lead2, colour). Review 2 (2026-10-18): the buzzer driver left the
# LIS3DH outline (body keep-out asserted below), keyed J_OLED, J_BAT a JST-PH pigtail (round 3), the role strap went, the status LEDs' resistors
# moved into their lead (R_S protects GPIO5 here), 1k in series with both beam inputs, 100n across the button.
PARTS = [
    ("R2 1M", (0, 0), (1, 0), "tan"), ("C2 100n", (2, 0), (3, 0), "gold"), ("R1 1M", (4, 0), (5, 0), "tan"),
    ("J_PT", (10, 0), (11, 0), "dimgray"), ("J_LED", (14, 0), (15, 0), "dimgray"),
    ("J_BAT", (17, 0), (19, 0), "dimgray"),            # JST-PH 2-pin pigtail soldered in: + (17,0), − (19,0); (18,0) empty
    ("D1 1N5817", (20, 2), (20, 3), "black"), ("C1", (21, 5), (21, 6), "steelblue"),
    ("R_LED", (19, 9), (20, 9), "orange"), ("R_PU", (21, 9), (22, 9), "orange"),
    # beam health (2026-10-16): LED boost socket under R_LED, 2nd pull-up under R_PU, ADC hold cap at J_PT
    ("R_LED_B", (19, 8), (20, 8), "orange"), ("R_PU_B 68k", (21, 8), (22, 8), "tan"), ("C_RX 1n", (10, 1), (11, 1), "gold"),
    # input protection: node -> 1k -> GPIO19 / GPIO2; ≥ 5 mm from the XIAO's far (antenna) edge (round 3)
    ("R_S8 1k", (10, 8), (10, 7), "tan"), ("R_S2 1k", (12, 1), (12, 2), "tan"),
    ("R_VB1 6k8", (1, 9), (2, 9), "tan"), ("R_VB2 10k", (3, 9), (4, 9), "tan"),   # USB sense: 5V -> 6.8k -> MTCK -> 10k -> GND
    # phase 1 (2026-10-17): undo button on MTMS (GPIO4, 100k pull-up, 100n to GND; its 1k sits at the switch) and the
    # buzzer driver on MTDO (GPIO7), right of the LIS3DH outline
    ("R_BTN 100k", (14, 2), (13, 2), "tan"), ("C_BTN 100n", (16, 0), (16, 1), "gold"), ("J_BTN", (20, 0), (21, 0), "dimgray"),
    ("R_BS 1k", (19, 1), (20, 1), "orange"),   # review round 3 (S6): 1k at the board end of the button lead too
    ("J_BZ", (21, 3), (22, 3), "dimgray"), ("D3", (22, 1), (22, 2), "black"), ("R_BD 100k", (23, 7), (22, 7), "tan"),
    ("Q2 BC337", (23, 6), (23, 4), "#333"), ("R_B 470", (23, 2), (23, 3), "orange"),
    # 0.91" status OLED: keyed 5-way header, pin 5 pulled, order SCL G SDA V (V only next to SDA), 100 Ω in SCL and SDA
    # so no wrong plug can pull a bus pin hard (check_plugs.py)
    ("J_OLED", (10, 9), (14, 9), "dimgray"), ("R_SCL 100", (9, 8), (9, 9), "orange"), ("R_SDA 100", (15, 9), (15, 8), "orange"),
    # status LEDs (2026-10-18): 3V3 / S / GND, the LEDs' resistors are in the lead; R_S 100 limits GPIO5 if a wrong plug lands here
    ("J_STAT", (16, 9), (18, 9), "dimgray"), ("R_S 100", (17, 1), (18, 1), "orange"),
    ("R_R 680", (16, 8), (17, 8), "orange"),   # round 3 (opus R2-N1): the red LED's resistor at the board end, so the lead carries no raw 3V3
]
PULLED = {(14, 9)}    # header positions with the pin pulled (keys)
NOPIN = {(18, 0)}     # empty holes inside a part's span (J_BAT's pigtail wires sit either side)
PIN_NOTES = {(10, 0): "RX", (11, 0): "−", (14, 0): "A", (15, 0): "−", (17, 0): "+", (19, 0): "−",
             (20, 2): "A", (20, 3): "K|", (21, 5): "+", (21, 6): "−", (5, 5): "BAT+", (5, 6): "BAT−",
             (20, 0): "−", (21, 0): "BTN", (22, 1): "K|", (21, 3): "+", (22, 3): "−", (23, 6): "C", (23, 5): "B", (23, 4): "E",
             (10, 9): "SCL", (11, 9): "G", (12, 9): "SDA", (13, 9): "V", (16, 9): "RA", (17, 9): "S", (18, 9): "−"}

# Underside wires: net -> list of holes, wired in order
NETS = {
    "GND": [[(5, 6), "X:GND", (0, 0), (3, 0),    # (5,6) = wire from the XIAO BAT− pad
             "L:GND", "L:GND2", (11, 0), (15, 0), (19, 0), (20, 0)],
            [(4, 9), "X:GND"], [(11, 0), (11, 1)], [(15, 0), (16, 1)], ["L:GND2", (11, 9)], ["L:GND2", (18, 9)],
            [(20, 0), (21, 6)], [(21, 6), (23, 4)], [(21, 6), (22, 7)]],
    "VPACK": [(5, 0), (17, 0), (20, 2)],
    "VSYS": [[(5, 5), (21, 5)], [(21, 5), (20, 3), (21, 3)], [(21, 3), (22, 1)]],   # (5,5) = wire from the XIAO BAT+ pad
    "VSENSE": ["X:D0", (1, 0), (2, 0), (4, 0)],
    "INT1": ["X:D1", "L:INT1"],
    "BEAM_RX": [[(10, 8), (10, 0), ("w", 20.5, 7.5), (22, 9), (22, 8)], [(12, 1), (10, 1), (10, 0)]],   # the node
    "RX_D8": ["X:D8", (10, 7)], "RX_D2": ["X:D2", (12, 2)],   # D8/GPIO19 counts, D2/GPIO2 reads (ADC), each through 1k
    "5V": ["X:5V", (1, 9)], "VBUS_S": [(4, 7), (3, 9), (2, 9)],   # (4,7) = wire from the XIAO MTCK pad (GPIO6)
    "BEAM_PWR": ["X:D3", ("w", 20.5, 7.5), (21, 9)],              # R_PU 220k (receiver pull-up A)
    "BEAM_PU_B": ["X:D6", (21, 8)],             # R_PU_B 68k (pull-up B: daylight mode + linear reads)
    "BEAM_LED": ["X:D9", (19, 9)], "BEAM_LED_B": ["X:D10", (19, 8)],
    "LED_A": [(20, 9), (20, 8), (14, 0)],
    "SDA": [["X:D4", "L:SDA"], ["L:SDA", (15, 8)]], "SDA_O": [(15, 9), (12, 9)],   # through R_SDA to J_OLED
    "SCL": [["X:D5", "L:SCL"], ["L:SCL", (9, 8)]], "SCL_O": [(9, 9), (10, 9)],     # through R_SCL to J_OLED
    "3V3": [["X:3V3", "L:VCC"], ["L:VCC", (13, 2)], ["L:VCC", (13, 9)], [(13, 9), (17, 8)]],
    "STAT_RA": [(16, 8), (16, 9)],                 # R_R 680 -> J_STAT pin 1 (red anode)
    "BTN": [(2, 6), (14, 2), (19, 1), (16, 0)],     # (2,6) = wire from the XIAO MTMS pad (GPIO4)
    "BTN_J": [(21, 0), (20, 1)],                  # J_BTN BTN -> R_BS 1k
    "SND": [(3, 4), (23, 2)],                     # (3,4) = wire from the XIAO MTDO pad (GPIO7)
    "BZ−": [(22, 3), (22, 2), (23, 6)], "BASE": [(23, 3), (23, 5), (23, 7)],
    "STAT": [(2, 5), (18, 1)], "STAT_O": [(17, 1), (17, 9)],   # (2,5) = wire from the XIAO MTDI pad (GPIO5) -> R_S 100 -> J_STAT
}
VSYS_BASE = [(5, 5), (22, 4), (22, 1)]   # the parked scoreboard's own power chain (its D1/C1 stay where they were)
COLOURS = {"GND": "black", "VPACK": "red", "VSYS": "darkred", "VSENSE": "olive", "INT1": "darkorange",
           "BEAM_RX": "green", "BEAM_PWR": "magenta", "LED_A": "purple",
           "BEAM_PU_B": "teal", "BEAM_LED": "brown", "BEAM_LED_B": "navy", "SDA": "blue", "SCL": "deepskyblue",
           "3V3": "crimson", "5V": "orange", "VBUS_S": "mediumpurple",
           "BTN": "hotpink", "SND": "gold", "BZ−": "slategray", "BASE": "yellowgreen",
           "STAT": "limegreen", "BTN_J": "palevioletred", "RX_D8": "lime", "RX_D2": "darkgreen", "SDA_O": "royalblue", "SCL_O": "cyan", "STAT_O": "springgreen", "STAT_RA": "tomato"}

SB = "--scoreboard" in sys.argv
if SB:
    # Same board as the goal device without the beam parts; keys on J_KEY, an 8-pin header to the e-paper adapter
    EPD = ["BUSY", "RST", "DC", "CS", "SCK", "SDI", "GND", "3V3"]   # DESPI-C02 header order
    # Assembly-review B9: J_KEY and J_BAT sit at the XIAO end (x 4-28) so their plugs stand beside the battery,
    # and the VBAT divider (R2, C2, R1) takes their old place under the battery shelf.
    PARTS = [p for p in PARTS if p[0].split()[0] in ("R_VB1", "R_VB2")] + [
        ("D1 1N5817", (18, 1), (22, 1), "black"), ("C1 470µ", (22, 4), (23, 4), "steelblue"),
        ("J_KEY", (0, 0), (1, 0), "dimgray"), ("J_BAT", (3, 0), (4, 0), "dimgray"),
        ("R2 1M", (11, 0), (12, 0), "tan"), ("C2 100n", (13, 0), (14, 0), "gold"), ("R1 1M", (15, 0), (16, 0), "tan"),
        ("R_KEY 100k", (20, 9), (21, 9), "tan"), ("J_EPD", (11, 9), (18, 9), "dimgray"),
        # SOUND OPTION B (buzzer): driver in the free strip between the LIS3DH and C1 (under the 14 mm shelf)
        ("R_SND", (20, 2), (21, 2), "orange"), ("D3", (20, 3), (20, 4), "black"), ("J_SND", (21, 3), (21, 5), "dimgray"),
        ("R_B 1k", (21, 6), (22, 6), "orange"),
        # SOUND OPTION A (speaker): RC filter from GPIO7 to the amp, between the XIAO and the LIS3DH.
        # R_A1 and R_B are both 2-pin sockets: the one 1 k resistor plugged into one of them picks the option.
        ("R_A1 1k", (8, 8), (8, 7), "orange"), ("C_A1 10n", (9, 7), (10, 7), "gold"),
        ("R_A2 10k", (8, 6), (8, 5), "tan"), ("C_A2 1n", (9, 5), (10, 5), "gold"), ("J_AMP", (8, 4), (10, 4), "dimgray"), ("Q2 BC337", (21, 7), (23, 7), "#333"), ("R_BD 100k", (21, 8), (22, 8), "tan"),
        # USB sense (R_VB1/R_VB2, as on the goal board, but to MTCK) and solder points for the card reader and the LED board
        ("J_RFID", (5, 0), (10, 0), "dimgray"), ("J_LEDS", (6, 9), (9, 9), "dimgray")]
    PULLED, NOPIN = set(), set()
    PIN_NOTES = {(18, 1): "A", (22, 1): "K|", (22, 4): "+", (23, 4): "−", (5, 5): "BAT+", (5, 6): "BAT−"}
    PIN_NOTES.update({(0, 0): "KEY", (1, 0): "−", (3, 0): "+", (4, 0): "−",
                      **{(11 + i, 9): n for i, n in enumerate(EPD)},
                      (20, 3): "K", (21, 3): "+", (21, 5): "−", (8, 4): "IN", (9, 4): "−", (10, 4): "+"})
    NETS = {
        "GND": [[(5, 6), "X:GND", (1, 0), (4, 0), (11, 0), (14, 0), "L:GND", "L:GND2", (23, 4), (17, 9),
                 (21, 8), (23, 7)], [(4, 9), "X:GND"], ["L:GND", (9, 9)], [(4, 0), (6, 0)],
                [(10, 7), (10, 5), (9, 4), "L:GND"]],
        "VPACK": [(3, 0), (16, 0), (18, 1)], "VSYS": [VSYS_BASE + [(20, 2)], [(5, 5), (10, 4)]],   # amp on VSYS (after D1)
        "SND": [[(3, 4), (21, 6)], [(3, 4), (8, 8)]],   # (3,4) = wire from the XIAO MTDO pad (GPIO7)
        "AF1": [(9, 7), (8, 7), (8, 6)], "AF2": [(9, 5), (8, 5), (8, 4)],
        "BZ+": [(21, 2), (21, 3), (20, 3)], "BZ−": [(21, 5), (20, 4), (21, 7)], "BASE": [(22, 6), (22, 7), (22, 8)],
        "VSENSE": ["X:D0", (12, 0), (13, 0), (15, 0)], "INT1": NETS["INT1"],
        "KEYS": ["X:D2", (0, 0), (21, 9)],
        "3V3": [["X:3V3", "L:VCC", (18, 9), (20, 9)], ["L:VCC", (8, 9)], ["X:3V3", (5, 0)]],
        "EPD_BUSY": ["X:D3", (11, 9)], "EPD_RST": ["X:D6", (12, 9)], "EPD_DC": ["X:D7", (13, 9)],
        "EPD_CS": ["X:D9", (14, 9)], "EPD_SCK": [["X:D8", (15, 9)], ["X:D8", (7, 0)]],
        "EPD_MOSI": [["X:D10", (16, 9)], ["X:D10", (8, 0)]],
        "RFID_MISO": [(2, 6), (9, 0)], "RFID_CS": [(2, 5), (10, 0)],   # wires from the XIAO MTMS / MTDI pads
        "5V": ["X:5V", (1, 9)], "VBUS_S": [(4, 7), (3, 9), (2, 9)],    # (4,7) = wire from the XIAO MTCK pad
        "SDA": [["X:D4", "L:SDA"], ["L:SDA", (6, 9)]], "SCL": [["X:D5", "L:SCL"], ["L:SCL", (7, 9)]],
    }
    COLOURS.update({"KEYS": "green", "EPD_BUSY": "magenta", "EPD_RST": "purple", "EPD_DC": "teal",
                    "EPD_CS": "brown", "EPD_SCK": "deepskyblue", "EPD_MOSI": "navy", "SCL": "cyan",
                    "SND": "gold", "BZ+": "orangered", "BZ−": "slategray", "BASE": "yellowgreen", "AF1": "goldenrod", "AF2": "darkkhaki",
                    "RFID_MISO": "hotpink", "RFID_CS": "chocolate", "5V": "orange", "VBUS_S": "mediumpurple"})


# Body keep-out (review 2): component BODIES, not just holes, must clear the two modules and each other.
# Standing 2-lead parts carry their body over the FIRST hole listed; ceramics sit between their leads.
MODULES = {"XIAO": (X0 - 2.88, xy(0, 5)[1] - 8.9, X0 - 2.88 + 21.0, xy(0, 5)[1] + 8.9),
           "LIS3DH": (xy(12, 0)[0] - 3.81, xy(0, 5)[1] - 6.35, xy(12, 0)[0] - 3.81 + 22.86, xy(0, 5)[1] + 6.35)}


def body(label, a, b):
    (x1, y1), (x2, y2) = xy(*a), xy(*b)
    name = label.split()[0]
    if name.startswith("J_") or name in ("R_LED", "R_LED_B", "R_PU"):    # housings, plugs, machined sockets
        return ("r", min(x1, x2) - 1.2, min(y1, y2) - 1.2, max(x1, x2) + 1.2, max(y1, y2) + 1.2)
    if name == "Q2":    # TO-92 standing in a column, flat side towards the USB end (−x)
        return ("r", x1 - 1.25, min(y1, y2) - 0.25, x1 + 2.6, max(y1, y2) + 0.25)
    if name == "C1":
        return ("c", (x1 + x2) / 2, (y1 + y2) / 2, 3.2)
    if name.startswith("C"):    # 2.54 mm ceramic, ≈ 3.8 × 2.5
        hx, hy = (1.9, 1.25) if y1 == y2 else (1.25, 1.9)
        return ("r", (x1 + x2) / 2 - hx, (y1 + y2) / 2 - hy, (x1 + x2) / 2 + hx, (y1 + y2) / 2 + hy)
    return ("c", x1, y1, 1.35 if name.startswith("D") else 1.15)    # standing resistor / DO-41


def overlap(p, q, cl=0.05):
    if p[0] == "r" and q[0] == "r":
        return not (p[3] + cl <= q[1] or q[3] + cl <= p[1] or p[4] + cl <= q[2] or q[4] + cl <= p[2])
    if p[0] == "c" and q[0] == "c":
        return ((p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2) ** 0.5 < p[3] + q[3] + cl
    c, r = (p, q) if p[0] == "c" else (q, p)
    nx, ny = min(max(c[1], r[1]), r[3]), min(max(c[2], r[2]), r[4])
    return ((c[1] - nx) ** 2 + (c[2] - ny) ** 2) ** 0.5 < c[3] + cl


def body_clashes():
    bodies = [(lab, body(lab, a, b)) for lab, a, b, _ in PARTS]
    bad = [(lab, m) for lab, bd in bodies for m, r in MODULES.items() if overlap(bd, ("r",) + r)]
    bad += [(p, q) for i, (p, bp) in enumerate(bodies) for q, bq in bodies[i + 1:] if overlap(bp, bq)]
    return bad


def hole(p):
    if isinstance(p, str):
        part, pin = p.split(":")
        return (XIAO if part == "X" else LIS)[pin]
    return p[1:] if p[0] == "w" else p      # ("w", c, r): a bend in the wire between holes, no joint


def chains_of(chains):
    return chains if isinstance(chains[0], list) else [chains]   # a net may be several wire runs


def used_holes():
    used = {hole(p) for p in list(XIAO.values()) + list(LIS.values())}
    for label, a, b, _ in PARTS:
        used |= {a, b}
        if label.split()[0] in ("J_EPD", "J_RFID", "J_LEDS", "J_AMP", "Q2", "J_OLED"):   # every hole along the row is a joint
            used |= {(c, a[1]) for c in range(a[0], b[0] + 1)}
    for chains in NETS.values():
        used |= {hole(p) for ch in chains_of(chains) for p in ch if p[0] != "w"}
    return used


def in_keepout(c, r):
    x, y = xy(c, r)
    return (any(x0 - 0.8 <= x <= x0 + w + 0.8 and y0 - 0.8 <= y <= y0 + h + 0.8 for x0, y0, w, h in KEEP_RECT)   # 0.8: half a Ø1 wire + 0.3
            or any((x - cx) ** 2 + (y - cy) ** 2 <= (rr + 0.8) ** 2 for cx, cy, rr in KEEP_CIRC))


def clear(a, b, used):
    """Straight wire a -> b passes no other joint (0.45 pitch) and no support keep-out."""
    (x1, y1), (x2, y2) = a, b
    L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 or 1e-9
    for hx, hy in used - {a, b}:
        t = max(0.0, min(1.0, ((hx - x1) * (x2 - x1) + (hy - y1) * (y2 - y1)) / L2))
        if (hx - x1 - t * (x2 - x1)) ** 2 + (hy - y1 - t * (y2 - y1)) ** 2 < 0.45 ** 2:
            return False
    return not any(in_keepout(x1 + (x2 - x1) * k / 20, y1 + (y2 - y1) * k / 20) for k in range(21))


BENDS = [(c + 0.5, r + 0.5) for c in range(-1, COLS) for r in range(-1, ROWS - 1) if not in_keepout(c + 0.5, r + 0.5)]


def route(a, b, used):
    """Shortest path a -> b with at most 2 bends on the half-grid (between holes) that crosses no other joint."""
    d = lambda p, q: ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) ** 0.5
    if clear(a, b, used):
        return [a, b]
    one = [p for p in BENDS if clear(a, p, used) and clear(p, b, used)]
    if one:
        return [a, min(one, key=lambda p: d(a, p) + d(p, b)), b]
    fa = [p for p in BENDS if clear(a, p, used)]
    fb = [q for q in BENDS if clear(q, b, used)]
    best = min(((p, q) for p in fa for q in fb if clear(p, q, used)), key=lambda pq: d(a, pq[0]) + d(*pq) + d(pq[1], b))
    return [a, *best, b]


def wire_paths():
    """{net: [polyline, ...]} with every segment routed round the joints it doesn't connect to."""
    used, out = used_holes(), {}
    for net, chains in NETS.items():
        out[net] = []
        for ch in chains_of(chains):
            pts = [hole(p) for p in ch]
            path = [pts[0]]
            for a, b in zip(pts, pts[1:]):
                path += route(a, b, used)[1:]
            out[net].append((path, [hole(p) for p in ch if p[0] != "w"]))
    return out


def board(ax, title, mirror):
    fx = (lambda x: W - x) if mirror else (lambda x: x)
    ax.add_patch(Rectangle((0, 0), W, H, fc="#d9c27a" if not mirror else "#c9b26a", ec="k", lw=1.5))
    for c in range(COLS):
        for r in range(ROWS):
            x, y = xy(c, r)
            ax.add_patch(Circle((fx(x), y), 0.45, fc="#8a6d1f", ec="none"))
    for x, y, w, h in KEEP_RECT:
        x0 = fx(x + w) if mirror else x
        ax.add_patch(Rectangle((x0, y), w, h, fc="none", ec="red", hatch="///", lw=0.8, alpha=0.6))
    for x, y, r in KEEP_CIRC:
        ax.add_patch(Circle((fx(x), y), r, fc="none", ec="red", hatch="///", lw=0.8, alpha=0.6))
    for x, y in MOUNT:
        ax.add_patch(Circle((fx(x), y), 1.6, fc="white", ec="k"))
    ax.text(fx(-1), H / 2, "USB-C", rotation=90, ha="center", va="center", fontsize=8)
    ax.set_title(title, fontsize=10)
    ax.set_xlim(-4, W + 2), ax.set_ylim(-9, H + 2), ax.set_aspect("equal"), ax.axis("off")
    return fx


fig, (top, bot) = plt.subplots(1, 2, figsize=(17, 5.2))

# ---- TOP view: modules and parts
fx = board(top, "TOP (component side) — place parts here", mirror=False)
XC = xy(0, 5)[1]   # XIAO centre line (y)
top.add_patch(FancyBboxPatch((X0 - 2.88, XC - 8.9), 21.0, 17.8, boxstyle="round,pad=0,rounding_size=1.5",
                             fc="#2f6f3e", ec="k", alpha=0.85))
top.add_patch(Rectangle((X0 - 4.38, XC - 4.5), 3.0, 9.0, fc="silver", ec="k"))
top.text(X0 + 7.6, XC, "XIAO ESP32-C6\n(USB-C left)", ha="center", va="center", color="w", fontsize=8)
lx0, ly = xy(12, 0)[0] - 3.81, xy(0, 5)[1]
top.add_patch(Rectangle((lx0, ly - 6.35), 22.86, 12.7, fc="#b5172b", ec="k", alpha=0.8))
top.text(lx0 + 11.4, ly, "LIS3DH clone, glued flat,\n5 wires by name (3.2)\nor SparkFun on these pins", ha="center",
         va="center", color="w", fontsize=7)
for name, (c, r) in list(XIAO.items()) + list(LIS.items()):
    x, y = xy(c, r)
    top.add_patch(Rectangle((x - 0.9, y - 0.9), 1.8, 1.8, fc="#222", ec="none"))
    top.text(x, y + (1.6 if r in (8, 7) else -1.6), name.replace("GND2", "GND"), ha="center",
             va="center", fontsize=5.5)
for label, a, b, col in PARTS:
    (x1, y1), (x2, y2) = xy(*a), xy(*b)
    top.plot([x1, x2], [y1, y2], color=col, lw=6 if "J_EPD" not in label else 9, solid_capstyle="round", alpha=0.9)
    for (x, y) in ((x1, y1), (x2, y2)):
        top.add_patch(Circle((x, y), 0.55, fc="silver", ec="k", lw=0.5))
    if a[0] == b[0]:   # standing vertically: label to the left
        top.text(x1 - 1.0, (y1 + y2) / 2, label, ha="right", va="center", fontsize=5.5)
        continue
    small = (a[0] >= 20 and 2 <= a[1] <= 8) or (8 <= a[0] <= 10 and 3 <= a[1] <= 8)   # crowded sound strips
    ty = y1 - 2.2 if a[1] == 0 else y1 + (0.9 if small else 1.9)
    top.text((x1 + x2) / 2, ty, label, ha="center", fontsize=5 if small else 6.5)
for (c, r), t in PIN_NOTES.items():
    x, y = xy(c, r)
    top.text(x, y + 1.3, t, ha="center", fontsize=6, color="darkred")
for c, r in PULLED:    # key: pin pulled out of the header, cavity plugged in the housing
    x, y = xy(c, r)
    top.plot([x - 0.7, x + 0.7], [y - 0.7, y + 0.7], color="red", lw=1.2)
    top.plot([x - 0.7, x + 0.7], [y + 0.7, y - 0.7], color="red", lw=1.2)
if not SB:
    assert not body_clashes(), body_clashes()
top.text(0, -1.2, ("Standing parts (R1, R2, C2, C1, R_KEY, sound parts): leads 2.54 mm apart, body upright.  "
                 "J_EPD: no header - solder the 8 adapter wires\nstraight into these holes (stays under the 14 mm shelf).  "
                 "Solder points, left to right: J_RFID 3V3 GND SCK MOSI MISO CS · J_LEDS SDA SCL 3V3 GND ·\n"
                 "J_EPD as labelled. R_VB1 68k, R_VB2 100k (USB sense).\n"
                 "SOUND: fit ONE option. R_A1 and R_B are 2-pin female sockets; the one 1 kΩ plugs into R_A1 (A) or R_B (B).\n"
                 "  A speaker: R_A1, C_A1 10n, R_A2 10k, C_A2 1n, J_AMP (IN = amp A+, − = GND, + = amp VIN from VSYS, after D1).\n"
                 "  B buzzer: R_SND, D3, J_SND, R_B, Q2, R_BD. J_SND = buzzer leads (+ = marked pin). D3 stands, band (K) end\n"
                 "  nearer R_SND. R_SND = 2-pin female header + 0 Ω link. Q2 flat side facing the D0–D6 edge (C B E from the USB end).\n"
                 "  Both fitted is fine (bench A/B): the empty socket switches the other option off." if SB else
                 "Standing parts: leads 2.54 mm apart, body upright over the FIRST hole of each pair in perfboard.py (bodies clear the modules: asserted).\n"
                 "R_LED 2.2k (D9), R_LED_B 270 Ω (D10, boost), R_PU 220k (D3) in machined sockets; R_PU_B 68k (D6), C_RX 1 nF, R_S8 / R_S2 1k (node → D8 / D2).\n"
                 "USB sense: R_VB1 6.8k (5V side), R_VB2 10k, 1 %, to the MTCK pad.  Undo: R_BTN 100k, C_BTN 100n, R_BS 1k (board end), J_BTN (+1k at the switch), MTMS.\n"
                 "Buzzer: J_BZ (+ left), D3 stripe (K) in (22,1), Q2 BC337 in column 23, flat side to the USB end: C (23,6) B (23,5) E (23,4); R_B 470, R_BD 100k.\n"
                 "J_BAT: a JST-PH 2-pin pigtail soldered in, + (17,0), − (19,0). Keyed J_OLED SCL G SDA V, pin 5 pulled (red ×), R_SCL / R_SDA 100 Ω.\n"
                 "J_STAT RA S − (R_R 680 here at the board, R_G 220 in the lead), R_S 100 Ω in the MTDI (GPIO5) line. D1 standing, stripe (K) up in (20,3)."), fontsize=7, va="top")

# ---- UNDERSIDE view (mirrored left-right, exactly as you see it when you flip the board over)
fx = board(bot, "UNDERSIDE (board flipped left↔right) — solder these wires here", mirror=True)
# Each wire runs joint to joint in the listed order, bent round any joint it doesn't belong to, so the
# picture never shows a wire crossing another net's hole (assembly-review: a builder could short them).
USED = used_holes()
for net, runs in wire_paths().items():
    for i, (path, joints) in enumerate(runs):
        assert all(clear(a, b, USED) for a, b in zip(path, path[1:])), net
        pts = [xy(*p) for p in path]
        bot.plot([fx(x) for x, _ in pts], [y for _, y in pts], color=COLOURS[net], lw=1.8, alpha=0.9,
                 label=None if i else net)
        for c, r in joints:
            x, y = xy(c, r)
            bot.add_patch(Circle((fx(x), y), 0.6, fc=COLOURS[net], ec="k", lw=0.4))
for name, (c, r) in list(XIAO.items()) + list(LIS.items()):
    x, y = xy(c, r)
    bot.text(fx(x), y + (1.5 if r in (8, 7) else -1.6), name.replace("GND2", "GND"), ha="center",
             va="center", fontsize=5.5, color="#333")
# wires from the XIAO's underside pads: short tags next to their holes
PADS = [((5, 5), "BAT+"), ((5, 6), "BAT−"), ((4, 7), "MTCK"), ((3, 4), "MTDO"), ((2, 5), "MTDI"), ((2, 6), "MTMS")]
for (c, r), pad in PADS:
    bot.text(fx(xy(c, r)[0]), xy(c, r)[1] + 0.9, pad, fontsize=4.5, ha="center", color="#222",
             bbox=dict(boxstyle="round,pad=0.1", fc="white", ec="none", alpha=0.8))
bot.legend(loc="upper center", bbox_to_anchor=(0.5, -0.02), ncol=6, fontsize=7, frameon=False)
bot.text(0, -4.6, "Use insulated 26–30 AWG wire; bare tinned wire only for runs ≤ 3 holes. Trim every pin and lead "
         "≤ 2 mm. Red hatched = supports: keep wires OUT (route around them).\nDots are joints; a wire only "
         "connects where it has a dot. Bends show where to lead it round other joints. BAT±/MT…: wires from the XIAO's "
         "underside pads.", fontsize=7, va="top")

fig.tight_layout()
for ext in ("svg", "png"):
    fig.savefig(f"perfboard{'-scoreboard' if SB else ''}.{ext}", dpi=170)

if SB:
    # ---- Keys (mechanical v4): 4 MX switches hand-wired on a printed plate, and a separate LED-only strip
    fig, (ax, kx) = plt.subplots(2, 1, figsize=(10, 6.4), gridspec_kw={"height_ratios": [1, 1.6]})
    PITCH, KEYS_U = 20.32, (-30.48, -10.16, 10.16, 30.48)       # key centres from the middle, as players see them

    # LED strip: 98 x 8 perfboard, LEDs flush on the centre line at the key positions, Ø2.5 holes 1 below it
    SW, SH = 98.0, 8.0
    ax.add_patch(Rectangle((0, 0), SW, SH, fc="#d9c27a", ec="k", lw=1.5))
    for i, du in enumerate(KEYS_U):
        cx = SW / 2 + du
        ax.add_patch(FancyBboxPatch((cx - 2.5, 4 - 1.25), 5.0, 2.5, boxstyle="round,pad=0,rounding_size=1.25",
                                    fc="white", ec="k", lw=0.6))
        ax.add_patch(Circle((cx, 4), 2.95, fc="none", ec="k", lw=0.8, ls="--"))      # flange outline
        for j, (lead, col) in enumerate((("R", "red"), ("K", "black"), ("B", "blue"), ("G", "green"))):
            ax.add_patch(Circle((cx - 1.905 + 1.27 * j, 4), 0.3, fc=col, ec="k", lw=0.3))
            ax.text(cx - 1.905 + 1.27 * j, 0.4, lead, ha="center", fontsize=5.5)
        ax.text(cx, 8.6, f"LED{i + 1} (K{i + 1}): PWM {3 * i}/{3 * i + 1}/{3 * i + 2} = R/G/B", ha="center", fontsize=6)
    for hu in (-46.5, 46.5):
        ax.add_patch(Circle((SW / 2 + hu, 3), 1.25, fc="white", ec="k"))
        ax.text(SW / 2 + hu, 5.2, "Ø2.5", ha="center", fontsize=6)
    ax.text(0, -2.2, "Seen from the front. LEDs seated FLUSH, straight leads through a Ø2.5 slot (the 2 holes either side of "
            "the LED centre opened up),\nbent apart ≥ 1.5 mm behind the strip. Behind: the 4 common leads joined by the LED "
            "GND bus; 12 colour wires + 1 GND wire (~12 cm) to the PCA9685.", fontsize=7, va="top")
    ax.set_xlim(-2, SW + 2), ax.set_ylim(-7, SH + 3), ax.set_aspect("equal"), ax.axis("off")
    ax.set_title("SCOREBOARD LED STRIP (98 × 8 mm perfboard)", fontsize=10)

    # Key wiring: MX switches seen from the BACK (so K1 is on the right), pins at (−3.81, +2.54) and (+2.54, +5.08)
    # from the switch centre in front view; mirrored here. KEYS bus on pin 2, ladder resistor from pin 1 to GND bus.
    kx.add_patch(Rectangle((-48, -11.5), 96, 20, fc="#ddd", ec="k", lw=1.2))         # plate (rail to top edge)
    for i, du in enumerate(KEYS_U):
        u = -du                                                                        # mirror: back view
        kx.add_patch(Rectangle((u - 7, -7), 14, 14, fc="#444", ec="k"))
        kx.text(u, -4.5, f"K{i + 1}", ha="center", color="w", fontsize=9, weight="bold")
        p1, p2 = (u + 3.81, 2.54), (u - 2.54, 5.08)
        kx.add_patch(Circle(p1, 0.8, fc="gold", ec="k", lw=0.5, zorder=6))
        kx.add_patch(Circle(p2, 0.8, fc="gold", ec="k", lw=0.5, zorder=6))
        kx.text(p1[0] + 1.1, p1[1] - 1.6, "1", fontsize=6)
        kx.text(p2[0] - 1.9, p2[1] + 0.5, "2", fontsize=6)
        r = ("wire", "4.7 kΩ", "10 kΩ", "22 kΩ")[i]
        tap = (p1[0] - 8.5, 0.4)                                                      # bare window on the GND bus
        if i == 0:
            kx.plot([p1[0], p1[0]], [p1[1], 0.4], color="black", lw=1.5, zorder=5)
            kx.text(p1[0] + 1.0, -1.6, "direct", fontsize=6, color="w")
        else:
            kx.plot([p1[0], tap[0]], [p1[1], tap[1]], color="tan", lw=4, solid_capstyle="round", zorder=5)
            kx.add_patch(Circle(tap, 0.5, fc="silver", ec="k", lw=0.4, zorder=6))
            kx.text((p1[0] + tap[0]) / 2, -1.6, r, ha="center", fontsize=6.5, color="w")
    kx.plot([-40.5, 40.5], [5.08, 5.08], color="lime", lw=1.8, zorder=4)
    kx.plot([-40.5, 40.5], [0.4, 0.4], color="black", lw=1.8, zorder=4)
    kx.text(-48, 9.0, "KEYS bus (green, pin 2 of every switch) → J_KEY 'KEY'", fontsize=7, color="green")
    kx.text(-47, -10.5, "GND bus → J_KEY '−'   (K1 pin 1 straight on it; K2–K4 through their resistor to a bare "
            "window in the bus)", fontsize=7)
    kx.add_patch(Rectangle((-40.5, -2), 81, 9, fc="none", ec="red", ls=":", lw=1))
    kx.text(40.5, 7.6, "wiring zone: ±40.5 × v −2…+7, ≤ 3 mm behind the pins", ha="right", fontsize=6, color="red")
    kx.set_xlim(-50, 50), kx.set_ylim(-13, 10), kx.set_aspect("equal"), kx.axis("off")
    kx.set_title("KEYS: 4 MX switches on the printed plate, seen from the BACK (K1 is on the right here)", fontsize=10)
    fig.tight_layout()
    for ext in ("svg", "png"):
        fig.savefig(f"keystrip.{ext}", dpi=170)
