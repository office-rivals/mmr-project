# Receiver cartridge: the lead side (agreed with mechanical, 2026-10-16)

Lead's ask: the TEFT4300 goes into a separate printed **cartridge** and is wired on the bench, then the cartridge slides into
R's pod. Mechanical owns the cartridge and pod geometry. This file sets the lead side: wire, joints, strain relief and plug.
Values marked EST are unmeasured (rule 11). Measure them on the user's jumpers before mechanical fixes the grooves.

## Why the legs still bend (but now on the bench)

In R as printed, the pod is 12 deep and the flange's back face is only **3.9 mm** from the skin
(`roll_test.py`: tip 4 behind the aperture, 3.5 flange top → tip, 0.6 flange). Straight legs need about 8.5 mm behind the
flange: ≥ 2 to the joint, a 3 mm lap joint, then the wire's bend (R ≈ 2 + Ø1.3). That means a pod about 17 deep, which
costs the 8° lead-in margin and needs an R reprint. So the **legs bend 90° toward the lead exit**, and that happens **on
the bench, with the cartridge in your hand and both sides open**. The user's problem was bending and soldering
blind inside the pod, not the bend itself. If mechanical would rather deepen the pod, straight legs work with the same
joint spec below. The stiff zone is then 8.5 mm behind the flange, along the beam axis.

## Lead spec

| Item | Value |
|---|---|
| Wire | The **30 cm Dupont jumper** itself: no extra splice. The cart's Adafruit 1949 is **28 AWG** (7 × 36 AWG); Adafruit gives no OD, ≈ 1.2 EST. AliExpress packs can be 26 AWG ≈ 1.5. Mechanical sizes the stacked groove for **2 × Ø1.6**, so any 26–28 AWG jumper fits without measuring. Green = collector, black = emitter |
| Polarity before cutting | The collector is the **shorter leg, on the flange-flat side**. Mark it (marker dot) **before** trimming, because trimming makes the legs equal |
| Bend | Both legs 90° to the same side, toward the cartridge's lead exit, **≥ 2 mm behind the flange**. Hold the legs with pliers between the flange and the bend. Leg centreline ≈ 2.6 behind the flange |
| Joint | Cut the legs **6 mm past the bend**. Strip the wire 4 mm and tin it, then lap-solder it over the leg's last 3 mm (≥ 2 mm from the case, per Vishay) |
| Insulation | Each joint gets **Ø1.5 heat-shrink, 10 mm** long (bend → 5 mm onto the jacket). Recovered OD ≤ **1.8 EST**. The pair is ≤ **4.4 wide** (2.54 pitch + 1.8) and ≤ **3.5 deep behind the flange** (fits the 3.9 there). Use black shrink: no light path from behind |
| Stiff zone (for the groove) | From the flange's back face: 2.6 to the leg, then **≈ 11 along the leg** (6 leg + 5 shrink over the jacket). Past that, the wire bends at **R ≥ 2** |
| Strain relief | Hot glue on the **wire jackets** in the cartridge's vertical groove **above the stiff zone (z 28–31)** and along its side groove (~10 mm), never on the joints. Tug test: a firm pull on the plug end must not move the joints. Fix the TEFT4300 flange with a dot of hot glue |
| Route to the front | Mechanical (user's markup, 2026-10-16): legs up the cartridge's back groove, then sideways out of the cartridge at the channel's height (z 31–34.6), through a back-open notch in the pod's end wall straight into R's U-channel. No ramp, nothing threaded. The pair lies **stacked** (groove sized for 2 × Ø1.6), untwisted; twist it only where it leaves the channel |
| Length | Measure on the printed R, from the cartridge's exit to R's front end, then add **≤ 100 mm to J_PT** + 20 mm slack. Cut the jumper from its cut end, so the factory crimp stays at the plug end |
| Plug | **2-pin Dupont housing** fitted **on the bench**: the whole route is open, so nothing is threaded. Flag it **SENSOR** and mark the **green** side on the housing. Green goes on J_PT **RX**; ASSEMBLY §6 step 5 confirms it |

## Agreed with mechanical

The bench-bent envelope fits. No pod deepening, and the ball path is unchanged. The cartridge loads from **R's back** (user's markup, 2026-10-16;
first drafted as a top drop-in). The groove behind the flange is 4.8 wide × 3.8 deep, and the skin closes it.
**R needs a reprint** (mechanical's writeup to lead).
