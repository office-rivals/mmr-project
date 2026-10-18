"""Schematics. Nets with the same name are connected.

  uvx --from schemdraw python schematic.py                    -> schematic.svg (goal device)
  uvx --from schemdraw python schematic.py --scoreboard       -> schematic-scoreboard.svg
  (a .png output path as the last argument needs: --with matplotlib)
"""
import sys

import schemdraw
import schemdraw.elements as elm

SB = "--scoreboard" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]
OUT = args[0] if args else ("schematic-scoreboard.svg" if SB else "schematic.svg")
schemdraw.use("matplotlib" if OUT.endswith(".png") else "svg")


def tag(name, side="right"):
    """Net label: the flag points away from the wire."""
    return elm.Tag().label(name, fontsize=10) if side == "right" else elm.Tag().left().label(name, fontsize=10)


def usb_sense(x, y, gpio):
    # ---------------- VBUS sense: USB plugged in -> pin HIGH (wakes from deep sleep, firmware stays awake to flash)
    elm.Label().at((x, y)).label(f"USB SENSE ({gpio})", fontsize=13, halign="left")
    elm.Line().left(1).at((x + 2, y - 2))
    tag("5V", side="left")
    elm.Resistor().down().at((x + 2, y - 2)).label("R_VB1\n6.8 kΩ 1 %", loc="bottom")
    vb = elm.Dot()
    elm.Resistor().down().label("R_VB2\n10 kΩ 1 %", loc="bottom")
    elm.Ground()
    elm.Line().right(1.5).at(vb.center)
    tag("VBUS_S")
    elm.Label().at((x, y - 9.5)).label("2.8–3.1 V on USB, 0 V on batteries", fontsize=9, halign="left")


def beam_block():
    # ---------------- Beam: IR LED + phototransistor. Pull-ups and LED on separate pins (beam health, 2026-10-16):
    # LED off with the pull-up on = ambient; both pull-ups = linear reads + daylight mode; ADC on D2.
    elm.Label().at((0, -9)).label("GOAL BEAM  (R_LED, R_LED_B, R_PU socketed: calibration knobs)", fontsize=13, halign="left")
    elm.Line().left(1).at((1, -11.5))
    tag("BEAM_LED", side="left")
    elm.Resistor().down().at((1, -11.5)).label("R_LED\n2.2 kΩ\n1.0 mA", loc="bottom")
    la = elm.Dot()
    elm.Resistor().down().label("R_LS 47 Ω\n(in the lead)", loc="bottom")
    elm.LED().down().label("D2  TSAL6200\n940 nm IR LED", loc="bottom")
    elm.Ground()
    elm.Line().right(3).at(la.center)
    elm.Resistor().up().label("R_LED_B\n270 Ω\n+5.3 mA", loc="bottom")
    elm.Line().right(1)
    tag("BEAM_LED_B")
    elm.Line().left(1).at((10, -11.5))
    tag("BEAM_PWR", side="left")
    elm.Resistor().down().at((10, -11.5)).label("R_PU\n220 kΩ\n(→470k, 100k)", loc="bottom")
    rx = elm.Dot()
    elm.Line().right(3)
    rb = elm.Dot()
    elm.Resistor().up().label("R_PU_B\n68 kΩ", loc="bottom")
    elm.Line().right(1)
    tag("BEAM_PU_B")
    elm.Line().right(2.5).at(rb.center)
    tag("BEAM_RX")
    for i, (r, net) in enumerate((("R_S8", "RX_D8"), ("R_S2", "RX_D2"))):   # input protection, 1k per GPIO
        elm.Line().left(1).at((30, -12 - 3 * i))
        tag("BEAM_RX", side="left")
        elm.Resistor().right().at((30, -12 - 3 * i)).label(f"{r} 1 kΩ", loc="top")
        tag(net)
    q = elm.NpnPhoto().anchor("collector").at(rx.center).label("Q1  TEFT4300\nphototransistor", loc="left")
    elm.Ground().at(q.emitter)
    elm.Capacitor().down().at(rb.center).label("C_RX\n1 nF", loc="bottom")
    elm.Ground()
    elm.Label().at((19, -13)).label(
        "lit → Q1 on → BEAM_RX LOW\nball blocks beam → BEAM_RX HIGH\n(blocked = HIGH; edge times: bench-measured)",
        fontsize=10, halign="left")
    elm.Label().at((19, -17)).label(
        "Emitter and receiver face each other across the\n40 mm ball channel, 17 mm above the floor, Ø3 apertures.\n"
        "BEAM_RX: D8/GPIO19 counts (digital edges), D2/GPIO2 reads it (ADC, beam health), each through 1 kΩ.\n"
        "Modes: a = D3+D9 (220k, 1 mA; default) · a_boost = + D10 (220k, ≈ 6 mA; per table if needed) · b = all four (52k, ≈ 6 mA).",
        fontsize=10, halign="left")
    usb_sense(40, -9, "MTCK pad / GPIO6")
    buzzer_block(56, "BUZZER  (phase 1, the scoreboard's option B)", False)
    button_block(74)
    oled_block(88)
    status_led_block(102)


def buzzer_block(x0, title, rsnd):
    # ---------------- Sound: magnetic transducer, low-side NPN from VSYS; volume = PWM duty (sound_volume)
    elm.Label().at((x0, -9.4)).label(title, fontsize=13, halign="left")
    elm.Line().left(1).at((x0 + 2, -11))
    tag("VSYS", side="left")
    if rsnd:
        elm.Resistor().down().at((x0 + 2, -11)).label("R_SND\n0 Ω link\n(→10, 22 Ω)", loc="bottom")
    else:
        elm.Line().down(1).at((x0 + 2, -11))
    top = elm.Dot()
    elm.Inductor2(loops=3).down(3.5).label("LS1  CMT-1209-390T\nbuzzer, 12 mm magnetic\n16 Ω, 2048 Hz\n85–90 dBA @10 cm", loc="top")
    bot = elm.Dot()
    elm.Line().right(3.5).at(top.center)
    elm.Schottky().down().toy(bot.center).reverse().label("D3\n1N5817\nflyback", loc="bottom")
    elm.Line().left(3.5)
    q = elm.BjtNpn().right().anchor("collector").at(bot.center).label("Q2  BC337-40", loc="right")
    elm.Ground().at(q.emitter)
    elm.Line().left(1).at(q.base)
    bb = elm.Dot()
    elm.Resistor().left().label("R_B 1 kΩ\n(socket)" if rsnd else "R_B 470 Ω", loc="top")
    elm.Line().left(1)
    tag("SND", side="left")
    elm.Resistor().down().at(bb.center).label("R_BD\n100 kΩ\n(base side)", loc="bottom")
    elm.Ground()
    elm.Label().at((x0, -22)).label(
        "SND = XIAO MTDO back pad (GPIO7), wire pre-soldered.\nLEDC square, notes 1–2 kHz, HIGH = coil on.\n"
        "sound_volume 3/2/1 = 50/12/3 % duty, 0 = LOW.\n≈65–80 mA at 50 %, from VSYS (not 3V3).",
        fontsize=9, halign="left")


def button_block(x0):
    # ---------------- Undo button (phase 1): active LOW, ext1 wake from deep sleep, 0 µA released
    elm.Label().at((x0, -9.4)).label("UNDO BUTTON  (hold 1 s)", fontsize=13, halign="left")
    elm.Line().left(1).at((x0 + 2, -11))
    tag("3V3", side="left")
    elm.Resistor().down().at((x0 + 2, -11)).label("R_BTN\n100 kΩ", loc="bottom")
    n = elm.Dot()
    elm.Line().right(1.5).at(n.center)
    tag("BTN")
    elm.Capacitor().down().at((n.center[0] + 1.5, n.center[1])).label("C_BTN\n100 nF", loc="right")
    elm.Ground()
    elm.Resistor().down().at(n.center).label("R_BS 1 kΩ (board)\n+ 1 kΩ at the\nswitch (lead)", loc="bottom")
    elm.Button().down().label("SW1  MX blue\n(J_BTN lead)", loc="bottom")
    elm.Ground()
    elm.Label().at((x0, -24)).label(
        "BTN = XIAO MTMS back pad (GPIO4), wire pre-soldered.\next1 wake on LOW (with INT1 / USB sense HIGH).\n"
        "The 1 kΩ at the switch makes a lead plugged\nonto the wrong header harmless.", fontsize=9, halign="left")


def oled_block(x0):
    # ---------------- Status OLED (user, 2026-10-17): on the LIS3DH's I²C bus, panel off (0xAE) except the status view
    elm.Label().at((x0, -9.4)).label("STATUS OLED  (J_OLED)", fontsize=13, halign="left")
    oled = elm.Ic(pins=[elm.IcPin(name=n, side="left", slot=f"{i + 1}/4") for i, n in enumerate(("GND", "VCC", "SCL", "SDA"))],
                  size=(4, 4.4), pinspacing=1.1, label="DS1\n0.91\" OLED\n128 × 32 white\nSSD1306\nI²C 0x3C",
                  lblsize=10).right().at((x0 + 4, -16)).anchor("GND")
    elm.Line().left(1).at(oled.GND)
    elm.Ground()
    elm.Line().left(1.5).at(oled.VCC)
    tag("3V3", side="left")
    for pin in ("SCL", "SDA"):    # 100 Ω at the board: a wrong plug can't pull a bus pin hard
        elm.Resistor().left(2.5).at(getattr(oled, pin)).label(f"R_{pin}\n100 Ω", loc="top")
        tag(pin, side="left")
    elm.Label().at((x0, -21)).label(
        "J_OLED order SCL G SDA V, pin 5 pulled (keyed).\nModule pins by its silk. Not power-gated;\n"
        "sleep = 0xAE, charge pump off: ≈ 5–20 µA with its LDO.\nNo power LED.", fontsize=9, halign="left")


def status_led_block(x0):
    # ---------------- Status LEDs (user, 2026-10-18): red + green on one pin. LOW = red, HIGH = green, Hi-Z = both off
    # (red AlInGaP + InGaN green in series need ≈ 4.1 V > 3V3, so no leak when the pin floats)
    elm.Label().at((x0, -9.4)).label("STATUS LEDs  (J_STAT)", fontsize=13, halign="left")
    elm.Line().left(1).at((x0 + 2, -11))
    tag("3V3", side="left")
    elm.Resistor().down().at((x0 + 2, -11)).label("R_R\n680 Ω\n(board)", loc="bottom")
    elm.LED().down().label("LED_R  WP710A10SURDK\nred 630 nm", loc="bottom")
    n = elm.Dot()
    elm.LED().down().label("LED_G  WP710A10ZGDK\nInGaN green 525 nm", loc="bottom")
    elm.Resistor().down().label("R_G\n220 Ω\n(in the lead)", loc="bottom")
    elm.Ground()
    elm.Resistor().left(2.5).at(n.center).label("R_S\n100 Ω", loc="top")
    tag("STAT", side="left")
    elm.Label().at((x0, -27)).label(
        "STAT = XIAO MTDI back pad (GPIO5), wire pre-soldered.\nJ_STAT RA / S / GND; R_R on the board, R_G at the green LED.\n"
        "Never a yellow-green: its lower Vf leaks + glows.", fontsize=9, halign="left")


def scoreboard_blocks():
    # ---------------- E-paper: GDEY042T81 on a DESPI-C02 adapter (pins in the adapter's header order)
    elm.Label().at((0, -11)).label("E-PAPER  (GDEY042T81 4.2\" on DESPI-C02, RESE = 3 Ω)", fontsize=13, halign="left")
    epd = elm.Ic(
        pins=[elm.IcPin(name=n, side="left", slot=f"{8 - i}/8", anchorname=a) for i, (n, a) in enumerate(
            (("BUSY", "BUSY"), ("RES", "RES"), ("D/C", "DC"), ("CS", "CS"), ("SCK", "SCK"), ("SDI", "SDI"),
             ("GND", "GND"), ("3.3V", "V33")))],
        size=(4, 9), pinspacing=1.0, label="U3\nDESPI-C02\n+\nGDEY042T81", lblsize=10,
    ).right().at((4, -13)).anchor("BUSY")
    for pin, net in (("BUSY", "EPD_BUSY"), ("RES", "EPD_RST"), ("DC", "EPD_DC"), ("CS", "EPD_CS"),
                     ("SCK", "EPD_SCK"), ("SDI", "EPD_MOSI"), ("V33", "3V3")):
        elm.Line().left(1.5).at(getattr(epd, pin))
        tag(net, side="left")
    elm.Line().left(0.75).at(epd.GND)
    elm.Ground()

    # ---------------- Keys: one-pin resistor ladder, any key pulls KEYS below V_IL (ext1 wake), ADC decodes it
    elm.Label().at((17.5, -10.4)).label("SOFT KEYS  (4 MX switches, hand-wired, 2 wires)", fontsize=13, halign="left")
    elm.Line().left(1).at((15, -13))
    tag("3V3", side="left")
    elm.Resistor().right().at((15, -13)).label("R_KEY 100 kΩ", loc="top")
    k = elm.Dot()
    elm.Line().up(1).at(k.center)
    tag("KEYS")
    x = k.center[0]
    for i, (r, v) in enumerate((("0 Ω", "0 V"), ("4.7 kΩ", "0.15 V"), ("10 kΩ", "0.30 V"), ("22 kΩ", "0.60 V"))):
        if i:
            elm.Line().right(3.5).at((x, -13))
            x += 3.5
        elm.Button().down().at((x, -13)).label(f"K{i + 1}", loc="bottom")
        if r == "0 Ω":
            elm.Line().down(2.5)
        else:
            elm.Resistor().down().label(r, loc="bottom")
        elm.Ground()
        elm.Label().at((x, -20)).label(v, fontsize=9)
    elm.Label().at((0, -24)).label(
        "ROLE STRAP: none on the scoreboard - D7 (EPD DC) reads HIGH with the internal pull-up at boot = scoreboard.\n"
        "A missing strap therefore falls back to scoreboard, which only READS D3 (no contention with the goal's BEAM_PWR).",
        fontsize=9, halign="left")
    buzzer_block(33, "SOUND option B: buzzer  (R_SND socketed: max-volume knob)", True)
    # ---------------- Sound option A: GPIO7 as a 1-bit PDM DAC -> 2-pole RC -> PAM8302 class-D amp -> 8 Ω speaker
    elm.Label().at((50, -9.4)).label("SOUND option A: speaker  (fit ONE option: the 1 kΩ plugs into R_A1 or R_B)",
                                     fontsize=13, halign="left")
    elm.Line().left(1).at((52, -13))
    tag("SND", side="left")
    elm.Resistor().right().at((52, -13)).label("R_A1 1 kΩ\n(socket)", loc="top")
    n1 = elm.Dot()
    elm.Capacitor().down().at(n1.center).label("C_A1\n10 nF", loc="bottom")
    elm.Ground()
    elm.Resistor().right().at(n1.center).label("R_A2 10 kΩ", loc="top")
    n2 = elm.Dot()
    elm.Capacitor().down().at(n2.center).label("C_A2\n1 nF", loc="bottom")
    elm.Ground()
    amp = elm.Ic(
        pins=[elm.IcPin(name="A+", side="left", slot="4/4", anchorname="AP"),
              elm.IcPin(name="A−", side="left", slot="3/4", anchorname="AM"),
              elm.IcPin(name="VIN", side="left", slot="2/4", anchorname="VIN"),
              elm.IcPin(name="SD", side="right", slot="1/4", anchorname="SD"),
              elm.IcPin(name="OUT+", side="right", slot="4/4", anchorname="OP"),
              elm.IcPin(name="OUT−", side="right", slot="3/4", anchorname="OM"),
              elm.IcPin(name="GND", side="bottom", anchorname="GND")],
        size=(5, 7), pinspacing=1.6, label="U6\nPAM8302A\nclone, 24 dB", lblsize=10,
    ).right().at((62.5, -13)).anchor("AP")
    elm.Line().at(n2.center).to(amp.AP)
    elm.Line().left(1).at(amp.AM)
    elm.Ground()
    elm.Line().left(2).at(amp.VIN)
    v = elm.Dot()
    elm.Capacitor(polar=True).down().at(v.center).label("C_AMP 470 µF", loc="bottom")
    elm.Ground()
    elm.Line().left(1).at(v.center)
    tag("VSYS", side="left")
    elm.Line().right(1.5).at(amp.SD)
    tag("PWM15")
    elm.Ground().at(amp.GND)
    elm.Line().right(1.5).at(amp.OP)
    sp = elm.Speaker().anchor("in1").label("LS2  40 mm\n8 Ω 1 W", loc="right")
    elm.Line().at(amp.OM).to(sp.in2)
    elm.Label().at((50, -25)).label(
        "SND = GPIO7 (MTDO pad): I2S0 PDM TX, ONE_LINE_DAC, 16-bit 22.05 kHz × 128 = 2.8 MHz bitstream.\n"
        "RC poles ≈ 16 kHz. Amp VIN = VSYS (after D1: reverse-protected, powered whenever the MCU is); C_AMP on its pins.\n"
        "SD HIGH = on (PWM15 full ON); the amp board's SD pull-up REMOVED (else 0.5 mA always).\n"
        "Amp trim pot or attenuator = max-volume knob; sound_volume = digital gain −18/−9/0 dB. Muted while USB is present.",
        fontsize=9, halign="left")
    # ---------------- Card reader: RC522 module on the e-paper's SPI bus, own CS + MISO, RST tied high (soft power-down)
    elm.Label().at((0, -30)).label("CARD READER  (RFID-RC522 module, 13.56 MHz, power LED removed)", fontsize=13, halign="left")
    rf = elm.Ic(
        pins=[elm.IcPin(name=n, side="left", slot=f"{8 - i}/8", anchorname=a) for i, (n, a) in enumerate(
            (("SDA (NSS)", "NSS"), ("SCK", "SCK"), ("MOSI", "MOSI"), ("MISO", "MISO"), ("IRQ", "IRQ"),
             ("GND", "GND"), ("RST", "RST"), ("3.3V", "V33")))],
        size=(4, 9), pinspacing=1.0, label="U4\nRFID-RC522\n(MFRC522)", lblsize=10,
    ).right().at((4, -32)).anchor("NSS")
    for pin, net in (("NSS", "RFID_CS"), ("SCK", "EPD_SCK"), ("MOSI", "EPD_MOSI"), ("MISO", "RFID_MISO"), ("V33", "3V3")):
        elm.Line().left(1.5).at(getattr(rf, pin))
        tag(net, side="left")
    elm.Line().left(0.75).at(rf.GND)
    elm.Ground()
    elm.Line().left(0.5).at(rf.IRQ).label("n.c.", loc="left", fontsize=9)
    elm.Line().left(1.5).at(rf.RST)
    tag("3V3", side="left")
    elm.Label().at((0, -42.5)).label(
        "SPI shared with the e-paper (≤ 10 MHz, mode 0); MISO is its own pin\n"
        "(the MFRC522 doesn't release MISO). RST bridged to 3.3V at the module;\nsoft power-down when idle (≤ 10 µA).", fontsize=9, halign="left")

    usb_sense(14, -30, "GPIO6")

    # ---------------- Key LEDs: PCA9685 board on I2C (0x40), 4 common-cathode RGB LEDs, one above each key
    elm.Label().at((24, -30)).label("KEY LEDs  (PCA9685 board, I²C 0x40, power LED removed)", fontsize=13, halign="left")
    pca = elm.Ic(
        pins=[elm.IcPin(name=n, side="left", slot=f"{5 - i}/5", anchorname=a) for i, (n, a) in enumerate(
            (("VCC", "VCC"), ("SDA", "SDA"), ("SCL", "SCL"), ("OE", "OE"), ("GND", "GND")))]
        + [elm.IcPin(name=f"PWM{i}", side="right", slot=f"{3 - i}/3", anchorname=f"P{i}") for i in range(3)],
        size=(4.5, 5.5), pinspacing=1.2, label="U5\nPCA9685\nboard", lblsize=10,
    ).right().at((27, -33)).anchor("VCC")
    for pin, net in (("VCC", "3V3"), ("SDA", "SDA"), ("SCL", "SCL")):
        elm.Line().left(1.5).at(getattr(pca, pin))
        tag(net, side="left")
    elm.Line().left(0.75).at(pca.OE)
    elm.Ground()
    elm.Line().left(0.75).at(pca.GND)
    elm.Ground()
    ends = []
    for i, c in enumerate(("R", "G", "B")):
        elm.Resistor().right().at(getattr(pca, f"P{i}")).label("220 Ω (on board)" if i == 0 else "", loc="top", fontsize=8)
        elm.LED().right().label(f"{c}", loc="bottom", fontsize=9)
        ends.append(elm.Line().right(0.5).end)
    elm.Line().at(ends[0]).to(ends[2])
    elm.Dot().at(ends[1])
    elm.Line().down(1).at(ends[2])
    elm.Ground()
    elm.Label().at((36, -40.5)).label(
        "LED1 (K1)  Kingbright WP154A4SUREQBFZGW,\ncommon cathode. LED2–4 the same on\n"
        "PWM 3–5, 6–8, 9–11 (R, G, B each);\nLED5 (below the scan target) on 12–14.\n"
        "Totem-pole, HIGH = on; ≤ 20 mA in total.\n"
        "SLEEP whenever nothing is lit.\nPWM15 → U6 SD (sound option A).", fontsize=9, halign="left")
    elm.Label().at((14, -21.5)).label(
        "4 × MX-style switches, hand-wired. Pressed level < V_IL (0.83 V) → ext1 wake on D2 LOW;\n"
        "then ADC1_CH2 at 0 dB attenuation tells K1–K4 apart (K1 left … K4 right).", fontsize=9, halign="left")


with schemdraw.Drawing(file=OUT, show=False) as d:
    d.config(fontsize=11, unit=2.5)

    # ---------------- Power: 3xAA -> Schottky -> XIAO BAT pad; divider for VBAT sense
    elm.Label().at((0, 7.5)).label("POWER", fontsize=13, halign="left")
    bt = elm.Battery().up().at((0, 0)).label("BT1\n3×AA NiMH / alk.\n2.7–4.8 V" + ("" if SB else "\n(drawer, slack-loop\nlead, JST-PH J_BAT)"), loc="bottom", ofst=0.6).reverse()  # long plate (+) on top
    elm.Ground().at(bt.start)
    elm.Label().at((bt.end[0] - 0.4, bt.end[1] - 0.3)).label("+", fontsize=13)
    if SB:
        elm.Line().up(1).at(bt.end)
    else:   # goal counter: the moving drawer lead is always live, so a fuse at the holder (review round 3)
        elm.Fuse().up(2).at(bt.end).label("F1 2 A\n(at the holder)", loc="bottom")
    vpack = elm.Dot().label("VPACK", loc="left")
    d1 = elm.Schottky().right().label("D1 1N5817", loc="top")
    vsys = elm.Dot()
    elm.Line().right(1.5)
    tag("VSYS")
    elm.Capacitor(polar=True).down().at(vsys.center).label("C1\n470 µF\n10 V", loc="bottom")
    elm.Ground()
    # divider from the pack, before the diode
    elm.Line().up(1.5).at(vpack.center)
    elm.Line().left(2.5)
    elm.Resistor().down().label("R1\n1 MΩ", loc="bottom")
    vs = elm.Dot()
    elm.Resistor().down().label("R2\n1 MΩ", loc="bottom")
    elm.Ground()
    elm.Line().left(3).at(vs.center)
    c2 = elm.Capacitor().down().label("C2\n100 nF", loc="bottom")
    elm.Ground()
    elm.Line().left(1).at(c2.start)
    tag("VSENSE", side="left")

    # ---------------- MCU
    NR, NL = (11, 9) if SB else (10, 9)
    xiao = elm.Ic(
        pins=[
            elm.IcPin(name="BAT+", side="left", slot=f"1/{NL}", anchorname="BATP"),
            elm.IcPin(name="BAT−", side="left", slot=f"2/{NL}", anchorname="BATN"),
            elm.IcPin(name="D0 (GPIO0)", side="left", slot=f"3/{NL}", anchorname="D0"),
            elm.IcPin(name="D1 (GPIO1)", side="left", slot=f"4/{NL}", anchorname="D1"),
            elm.IcPin(name="D2 (GPIO2)", side="left", slot=f"5/{NL}", anchorname="D2"),
            elm.IcPin(name="D3 (GPIO21)", side="left", slot=f"6/{NL}", anchorname="D3"),
            elm.IcPin(name="3V3", side="right", slot=f"1/{NR}", anchorname="V33"),
            elm.IcPin(name="GND", side="right", slot=f"2/{NR}", anchorname="GND"),
            elm.IcPin(name="D4 (GPIO22)", side="right", slot=f"3/{NR}", anchorname="D4"),
            elm.IcPin(name="D5 (GPIO23)", side="right", slot=f"4/{NR}", anchorname="D5"),
        ] + [elm.IcPin(name=f"D{6 + i} (GPIO{g})", side="right", slot=f"{5 + i}/{NR}", anchorname=f"D{6 + i}")
             for i, g in enumerate((16, 17, 19, 20, 18)) if SB]
        + ([] if SB else [elm.IcPin(name="D6 (GPIO16)", side="right", slot="5/10", anchorname="D6"),
                          elm.IcPin(name="D8 (GPIO19)", side="right", slot="6/10", anchorname="D8"),
                          elm.IcPin(name="D9 (GPIO20)", side="right", slot="7/10", anchorname="D9"),
                          elm.IcPin(name="D10 (GPIO18)", side="right", slot="8/10", anchorname="D10"),
                          elm.IcPin(name="MTDO pad (GPIO7)", side="right", slot="9/10", anchorname="MTDO"),
                          elm.IcPin(name="5V (VBUS)", side="right", slot="10/10", anchorname="V5"),
                          elm.IcPin(name="MTCK pad (GPIO6)", side="left", slot="7/9", anchorname="MTCK"),
                          elm.IcPin(name="MTMS pad (GPIO4)", side="left", slot="8/9", anchorname="MTMS"),
                          elm.IcPin(name="MTDI pad (GPIO5)", side="left", slot="9/9", anchorname="MTDI")])
        + ([elm.IcPin(name="MTDO pad (GPIO7)", side="right", slot="10/11", anchorname="MTDO"),
            elm.IcPin(name="5V (VBUS)", side="right", slot="11/11", anchorname="V5"),
            elm.IcPin(name="MTMS pad (GPIO4)", side="left", slot="7/9", anchorname="MTMS"),
            elm.IcPin(name="MTDI pad (GPIO5)", side="left", slot="8/9", anchorname="MTDI"),
            elm.IcPin(name="MTCK pad (GPIO6)", side="left", slot="9/9", anchorname="MTCK")] if SB else []),
        size=(9, 13 if SB else 11.5),
        pinspacing=1.1,
        edgepadH=0.6,
    ).right().at((15, 0)).anchor("D3")
    elm.Label().at((xiao.center[0], xiao.center[1] + (6.2 if SB else 5.8))).label("U1  Seeed XIAO ESP32-C6", fontsize=12)
    elm.Label().at((xiao.center[0], xiao.center[1] - (6.4 if SB else 6.1))).label(
        "onboard: SGM6029C buck (BAT → 3V3), Li-ion charger on BAT (blocked by D1),\n"
        "user LED GPIO15 (active-LOW), RF-switch power GPIO3 (10k pull-up, LOW = on)", fontsize=9)
    # left-side nets
    left = ("KEYS", "EPD_BUSY") if SB else ("RX_D2", "BEAM_PWR")
    for pin, net in ((("BATP", "VSYS"), ("D0", "VSENSE"), ("D1", "INT1"), ("D2", left[0]), ("D3", left[1]),
                      ("MTCK", "VBUS_S")) + ((("MTMS", "RFID_MISO"), ("MTDI", "RFID_CS")) if SB else (("MTMS", "BTN"), ("MTDI", "STAT")))):
        elm.Line().left(1.5).at(getattr(xiao, pin))
        tag(net, side="left")
    elm.Line().left(1).at(xiao.BATN)
    elm.Ground()
    # ---------------- Accelerometer (wake sensor), wired straight across from the XIAO's right side
    acc = elm.Ic(
        pins=[
            elm.IcPin(name="VCC", side="left", slot="1/5"),
            elm.IcPin(name="GND", side="left", slot="2/5"),
            elm.IcPin(name="SDA", side="left", slot="3/5"),
            elm.IcPin(name="SCL", side="left", slot="4/5"),
            elm.IcPin(name="INT1", side="left", slot="5/5"),
        ],
        size=(4, 6),
        pinspacing=1.1,
        label="U2\nLIS3DH clone\n(chip C3H)\nor SparkFun\nSEN-13963\n\nI²C 0x19/0x18",
        lblsize=11,
    ).right().at((xiao.D5[0] + (10 if SB else 7), xiao.D5[1])).anchor("SCL")
    elm.Label().at((acc.center[0], acc.center[1] + 4)).label("MOTION WAKE", fontsize=12)
    elm.Line().at(xiao.D5).to(acc.SCL).label("SCL", loc="top", fontsize=9)
    elm.Line().at(xiao.D4).to(acc.SDA).label("SDA", loc="top", fontsize=9)
    elm.Line().at(xiao.V33).to(acc.VCC).label("3V3", loc="top", fontsize=9)
    elm.Line().at(xiao.GND).to(acc.GND)
    elm.Dot().at(((xiao.GND[0] + acc.GND[0]) / 2, xiao.GND[1]))
    elm.Ground()
    elm.Line().left(1.5).at(acc.INT1)
    tag("INT1", side="left")
    if not SB:
        for pin, net in (("D6", "BEAM_PU_B"), ("D8", "RX_D8"), ("D9", "BEAM_LED"), ("D10", "BEAM_LED_B"),
                         ("MTDO", "SND"), ("V5", "5V")):
            elm.Line().right(1.5).at(getattr(xiao, pin))
            tag(net)
    if SB:
        for pin, net in (("D6", "EPD_RST"), ("D7", "EPD_DC"), ("D8", "EPD_SCK"), ("D9", "EPD_CS"), ("D10", "EPD_MOSI"),
                         ("MTDO", "SND"), ("V5", "5V")):
            elm.Line().right(1.5).at(getattr(xiao, pin))
            tag(net)

    if SB:
        scoreboard_blocks()
    else:
        beam_block()
