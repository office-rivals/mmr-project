# Battery drawer: the electrical side, and the Li-ion alternative (study, nothing bought), 2026-10-17

Lead's ask (user, DECISIONS 2026-10-17): swap the cells **without taking the sled out**. Mechanical leads the drawer.
Electronics owns the drawer's connection (a slack-loop lead or mating contacts), reverse polarity, and what happens if
the drawer is pulled while the counter is running. Electronics also costs the alternative: a Li-ion pack charged in place over
the USB-C. Input: assembly-review's front-face budget (`assembly-review/2026-10-17-drawer-criteria.md`). Prices are kr incl.
moms, **est.** Everything is EST (rule 11).

**Status: DECIDED (user, DECISIONS 2026-10-18): AA cells in a pull-out drawer with pogo contacts (§4, final spec §5).**
Li-ion charged in place (§2) stays documented as an alternative only. The verdict below is the study as it was written.

## Verdict

**Recommendation: (B) Li-ion charged in place.** There is no drawer and no swap. You plug a USB-C cable in through the opening
about every **4 months** (≈ 2 months at the heavy budget), leave it ≈ 1 day, and the counter keeps counting meanwhile.
- **Cost:** ≈ +15–25 kr per counter from AliExpress, ≈ +95 from Nordic stock.
- **Front face:** unchanged plus the OLED, which avoids assembly-review's squeeze (§1 there).
- **Safety:** a protected 1S pack (PCM) charged at 120 mA, ≈ 0.06 C, is gentle in a closed printed pocket.

**If the user keeps AA cells in a drawer: (A1) the slack-loop lead, not contacts.** It costs 0 kr, has no new failure mode, and the polarity is fixed.

## 1. If it's a drawer: the connection

| | (A1) Slack loop: the lead stays plugged | (A2) Contacts that mate on insertion |
|---|---|---|
| What | The holder's lead (stranded silicone, 22–24 AWG) lengthened to **≈ 160–180** (≥ 105 travel + ≈ 40 to the JST-PH + slack), parked in its own chamber beside or under the drawer path (assembly-review §2) | 2 spring contacts (pogo pins, or a 2-pin magnetic pogo pair) in L's pocket back wall, landing on 2 plates on the drawer's back. The latch presses them home |
| Parts | 0 kr (the existing 150 lead, used uncut; or + 10 cm of wire) | ≈ 10–15 kr AliExpress magnetic pogo pair · ≈ 30–40 DK |
| During play | Nothing changes: a crimped, latched JST-PH, as today | Goal hits shake the sled. A gap **> ≈ 1 ms during a Wi-Fi burst browns out the board**: 470 µF falls ≈ 0.75 V per ms at 350 mA. It needs ≥ 1–2 N per contact, gold-plated, with the latch preloading it. Bench: a rubber mallet on L during TX |
| Wear | A bend about every 4 months: hundreds of cycles is nothing for silicone wire | Pogo pins are rated 10 k+ cycles; fine |
| Risk | The loop gets folded into the board, plugs or rails when it's pushed back by feel → it needs a chamber (mechanical) | Misalignment by feel; dirt on the plates; a second loose part that can fail |
| Off switch | The JST-PH stays as the off switch for service (sled out) | Pulling the drawer is the off switch |

**Reverse polarity: already safe in both.** D1 (1N5817, in series) blocks a reversed pack completely. The VBAT divider
then sees −4.5 V through 1 MΩ, so the ADC pin's clamp diode carries ≈ 4 µA: harmless.
- A drawer that goes in upside down, or a reversed contact pair, therefore can't hurt anything; the board just doesn't start.
- One cell inserted backwards gives a ≈ 1.5 V pack: the board doesn't start, and nothing is damaged.
- The holder's spring and flat contacts and its moulded +/− marks are the keying, so the drawer must show them face-up.

**Pulled while running (either option):** the power is cut, and so is the board, with no hardware damage.
- **Inrush on re-insertion:** 4.5 V into 470 µF through D1 and the cells' resistance, a few amps for µs. Fine for the JST or the pogo pins.
- **Data (firmware):**
  - ESP-IDF's NVS is power-loss safe.
  - **No queued goal is lost** (firmware, 2026-10-17): each goal and undo is written atomically to the NVS queue before it's sent, and goes
    out on the next wake. Only the undo ring in RAM is lost, and after a power cut no goal is inside the 10 s window anyway.
  - The LIS3DH is reconfigured at boot anyway.
- **Brown-out while inserting:** contact bounce gives 1–2 short starts; the ESP32's brown-out reset handles that.

## 2. The alternative: Li-ion charged in place over the USB-C

**How it works.** The XIAO's own **SGM40567** charger (4.2 V CV, **120 mA**, on the BAT pads) charges a 1S pack whenever USB is
plugged in, and USB powers the board meanwhile (the PMOS path). It is the part D1 blocks today, so:
- **Bridge D1** with a wire link (the board keeps its holes), and use J_BAT for the pack.
- Everything else stays: VBAT divider, 470 µF, buck, buzzer on VSYS (3.0–4.2 V instead of ≈ 3.6–4.5: a little quieter, within ux's
  range), USB sense on MTCK.

**The pack.** A **1S LiPo with a built-in PCM** (overcharge, over-discharge ≈ 3.0 V, short circuit) and a JST-PH lead, e.g. the Adafruit
2011 type: 2000 mAh, **60 × 36 × 7**. It fits the FIT0610's pocket (69 × 47 × 17) with room for foam padding.

| | Value (EST) |
|---|---|
| Daily use | ≈ 14.5 / 28 mAh/day: §3's 13.3 / 25.8 × ≈ 1.1, because the buck draws more current from 3.7 V than from ≈ 4 V |
| Usable | ≈ 90 % above the 3.45 V cutoff → **≈ 1,800 mAh** |
| **Per charge** | **≈ 4 months** (124 days) typical · **≈ 2 months** (64) at the heavy budget, like the NiMH set today |
| Charge time | 2000 mAh / 120 mA ≈ 17 h + the CV tail → **≈ 20 h** (one day or night; it counts meanwhile) |
| Self-discharge | ≈ 2–3 %/month, negligible next to the use |
| Life | ≈ 300–500 cycles = decades at 3 charges a year; calendar ≈ 4–5 years |

**Thresholds (firmware, provisional, same pins):**
- `LOW_BATT_WARN_MV` **3650**: ≈ 10 % left, ≈ 1–2 weeks.
- `LOW_BATT_CUTOFF_MV` stays **3450**: ≈ 3–5 % left.
- `LOW_BATT_RESUME_MV` **3700**.
- The PCM's ≈ 3.0 V cut is the backstop: in deep sleep after cutoff (≈ 20 µA) it would take years to reach it.
- At **≥ 4.0 V with USB present**, the phone page can say "charged".
- The C6 is happier on Li-ion than on NiMH: no diode drop and a lower internal resistance, so more TX headroom.

**Safety in a closed drawer:**
- **Charge rate:** 120 mA into 2000 mAh is 0.06 C, a tenth of the cell's 0.2 C standard rate. The charger dissipates ≈ 0.15 W, on the XIAO, not in the pack.
- **Protection:** the CV is the charger's job, and the PCM backs up overcharge and short circuit.
- **No NTC:** the XIAO has none. That's acceptable indoors (charge only at 0–45 °C; a table room is 15–30 °C).
- **Pocket (assembly-review, 2026-10-17):** the pack lies flat in a closed printed pocket, with no sharp edges and no screw tips or pins pointing at it.
  - The lid's 2 holder posts + foam (S26) would press on the pouch: replace them with a **foam-lined frame round the pack's edges** (or one flat pad spread over the whole face), keeping **≥ 2 mm swell room** above it.
  - The 60 × 36 pack in the 69 × 48 pocket would slide: **corner blocks or foam** hold it, so it can never reach the board's pins.
  - The lead is strain-relieved (a clip or a glue dot on the jacket), and the PCM end faces away from the board.
- **Failure mode:** a pouch can swell at end of life. Leave ≥ 2 mm above it, and replace the pack if it's puffy at a service.
- **Buying:** buy from a shop that names the cell and the PCM (Adafruit, Electrokit). AliExpress packs vary in capacity and **JST polarity**: a
  reversed Li-ion on the BAT pads with no D1 destroys the XIAO. So, both of these:
  - **a mandatory meter check** of + / − at the plug before the first plug-in (an ASSEMBLY step with a tick box);
  - **reverse protection that still lets it charge:** a P-MOSFET (AO3401A, SOT-23 on a ≈ 1 kr adapter, ≈ 2 kr) in place of D1. Its drain goes on the pack, its source on VSYS
    and its gate on GND. It's on at Vgs = −3…−4.2 V (≈ 60–90 mΩ, both directions, so the charger works), and off with its body diode blocking when the pack is reversed.
  Ship lithium inside the EU (DK/SE stock).
- **Never fit an AA pack to a Li-ion board** (D1 bridged, so USB would charge the AA cells). Label the board "Li-ion".

**Cost per counter:**

| | AliExpress | Nordic stock |
|---|---|---|
| 1S 2000 mAh LiPo, PCM, JST-PH | ≈ 30–45 *est.* | ≈ 115 (Electrokit, 169 SEK) |
| Saved: FIT0610 15 + D1 3 (the JST-PH cable stays: its board half takes the pack's plug) | −18 | −18 |
| Saved: the AA charger (order E, 40, only if none) · needed: a USB charger (own phone charger) | 0 | 0 |
| **Net** | **≈ +15 to +25** | **≈ +95** |

The drawer itself (print, latch, rails, slack-loop chamber) and assembly-review's squeeze both go away. The USB-C cut-out, the
cable reach (USB margin ≈ 13–18) and the reflash path already exist.

**Downsides:**
- The cable hangs out of the frame opening for ≈ 1 day per charge. Do it after the last game, or accept that the cable is in the
  way of ball pick-up for a day.
- It can't be topped up from a pile of charged NiMH in a minute. If a counter dies mid-game, it runs on USB at once from any power
  bank or charger.
- It's lithium in a printed box. With a PCM and 0.06 C it is low-risk, but higher than NiMH.

## 3. Bench (if picked)

- Charge one pack in the closed pocket from 3.5 V: the time to the charge LED going off, and the pack temperature (expect < 5 °C rise).
- Loaded rail at 3.45 V during TX + buzzer at High: ≥ 3.0 V.
- Unplug USB mid-TX: no reset (the PMOS hand-over).
- Read the VBAT divider against a meter at 4.2 / 3.7 / 3.45 V.

## 4. Mechanical's drawer + OLED proposal (`mechanical/reports/2026-10-17-drawer-oled-proposal.md`): electronics' answers

These apply if the user keeps the AA cells; the Li-ion choice is still with the user (lead).

1. **Connection: (a) contacts, accepted**, because the drawer comes fully out and nothing has to fold. The cells already sit on spring
   contacts in the FIT0610, so this is the same kind of joint, not a new one. Conditions:
   - **Spring-loaded pogo pins**, gold-plated, in the lane's back wall. (Corrected in §5: ≥ 0.6 N each at mid-stroke is enough, since the
     latch holds the drawer and the pin only has to follow its own light plunger.) They land on
     **gold flat targets** on the drawer's rear (the mating half of a 2-pin pogo pair, ≈ 10–15 kr AliExpress), not on
     tinned perfboard.
   - **Use no magnets** (the latch holds the drawer).
   - When latched, the pins sit **mid-stroke** (≥ 0.5 of travel left each way), so a goal hit can't open them. The latch holds the
     2 × 1.5 N push-back with margin (your ~10 N release is fine).
   - The key rib makes the drawer one-way. A reversed drawer is harmless anyway: D1 blocks it, and the divider's clamp carries ≈ 4 µA.
   - **With the drawer out, the pins are dead.** D1 stops USB from back-feeding VPACK, so the exposed pins beside the USB cut-out carry
     nothing. Keep them ≥ 10 from the cut-out anyway.
   - The JST-PH disconnect goes (pulling the drawer is the off switch): −17 kr, + the pogo pair ≈ 12. The holder's leads are shortened
     to ≈ 30, soldered to the targets and heat-shrunk.
   - **Bench:** a rubber mallet on L during a Wi-Fi burst: no reset over 50 hits.
2. **USB-C through the empty lane: OK.**
   - The flashing case is "drawer out, USB only": VSENSE reads ≈ 0 and firmware treats it as USB-powered.
   - The plug is pushed in ~85 deep by feel, so give the 14 × 8.5 cut-out a **lead-in funnel** (≈ 20 × 14 at the mouth) on the lane side.
3. **Buzzer grille through the dash top: OK.** The port faces up to the grille, ≤ 2 from it, with nothing over the holes. It is far from
   the antenna now (≥ 80). The audibility bench check stays (it's the tunnel that muffles it, not the grille).
4. **OLED lead: ≈ 120–150** (mechanical ≈ 120; I add the rise to the dash). J_OLED moves with the board to s ≈ 143–151. Four 30 cm jumpers is fine.
   I²C at ≈ 150 + the board is fine at 100–400 kHz.
5. **Lead lengths after the board's +84.5 move** (EST, all from 30 cm jumpers; cut at the dry fit):

| Lead | From (board) | To | Was | Now |
|---|---|---|---|---|
| Undo button | J_BTN, s ≈ 180 | dash, s ≈ 40, z ≈ 41 | ≈ 110 | **≈ 180** |
| Buzzer | J_BZ, s ≈ 184 | dash left end, r 3–14 | ≈ 110 | **≈ 200** |
| OLED | J_OLED, s ≈ 147 | dash | – | **≈ 120–150** |
| J_PT extension | J_PT, s ≈ 158 | bay header in the dash, s ≈ 40, z ≈ 35 | ≈ 80 | **≈ 140**: 2 extra jumpers (no longer the sensor's leftovers): **16 jumpers per counter** |
| LED | J_LED, s ≈ 165 | emitter well, s 194 | ≈ 200 | **≈ 80–100** (mechanical routes it; the board's end at s 192 must clear the s 181.8 cross wall and the well) |
| Battery | J_BAT, s ≈ 173 | pogo pins in the lane wall, s 120 | ≈ 40 + JST | **≈ 60–70**, no JST |

### 4b. assembly-review's drawer review (`assembly-review/2026-10-17-drawer-review.md`)

- **S31: the leads go through the duct at r 1.2–19**, not over the open lane. The lengths with that route, assuming the board's header
  edge stays at r ≈ 47.6 (EST, from 30 cm jumpers; cut at the dry fit):

  | Lead | Route | Length |
  |---|---|---|
  | OLED (4) | module r ≈ 20 → duct → along s to ≈ 140 → across to J_OLED (s ≈ 147) | **≈ 160** |
  | Undo button (2) | dash r ≈ 50 → across to the duct → along s to ≈ 175 → across to J_BTN (s ≈ 180) | **≈ 220** |
  | Buzzer (2) | dash r 3–14 (already in the duct strip) → along s → across to J_BZ (s ≈ 184) | **≈ 200** |
  | J_PT extension (2) | bay r 58–70 → across the dash's back to the duct → along s → across to J_PT (s ≈ 158) | **≈ 210** (2 extra jumpers, 16 per counter) |

  All of them fit within 30 cm jumpers. The I²C (OLED) at ≈ 160 is fine at 100 kHz. The duct stays clear of the latch notch (mechanical).
- **S33 (loop option):** agreed. Ribs run along s, one rib cell is kept free for the loop, and the holder is clipped into the tray.
- **N23 (contacts option, which I accepted):** no plug. The holder's leads stay soldered to the tray's targets, and the **tray's end is open on
  the side the FIT0610's cover slides out of** (mechanical checks the direction on the sample). Or use the **Keystone 2487**, whose
  snap cover lifts off with no slide (≈ 11-week lead time).
- **Contact bounce:** I accept the risk on the conditions in §4.1 (≥ 1.5 N gold pogo pins, mid-stroke when latched) and the mallet bench test. The cells' own holder springs are the
  same kind of joint.

## 5. Final spec: the drawer contacts (DECISIONS 2026-10-18; superseded by §6, hardware review 2)

Mechanical's CAD sets the positions; these are the electrical rules it must meet.

| Item | Spec |
|---|---|
| **Pins** (L side) | 2 × spring-loaded pogo pins: gold-plated, **solder-cup** tail, Ø 2–3 barrel, **stroke ≥ 1.5**, **≥ 0.6 N at mid-stroke** (1 N preferred), ≥ 1 A. Pressed into the **lane's back wall**, tips toward the drawer, **10 apart** (centres), **≥ 10 from the USB-C cut-out**. A collar or a glue dot stops them being pushed back |
| **Targets** (drawer side) | 2 × flat **nickel plates, 8 × 8**, cut from 0.15 × 8 mm nickel strip, set **flush** in recesses in the drawer's rear, 10 apart, facing the pins. The holder's leads are shortened to **≈ 30**, tinned and soldered to the plates' backs (flux) **before** the plates are glued in, with heat-shrink on each joint. A target ≥ 8 wide tolerates ±3 of misalignment |
| **Polarity** | The key rib allows one orientation only. Mark **+** beside the red pin and the red target. A reversed drawer is still harmless (D1 blocks it) |
| **Engagement** | When latched, each pin is at **mid-stroke** (≈ 0.75 compressed, ≥ 0.5 left each way). The pins push the drawer out with ≈ 1.2–2 N, which the latch holds without rattle. The drawer's hard stop sits ≥ 0.5 past full compression, so a hard push can't bottom the pins |
| **Lead** | Red and black jumpers (one plug kept on each) soldered into the pins' solder cups, heat-shrunk, ≈ **65** to a 2-pin housing on **J_BAT** (red on **+**) |
| **Off switch** | Pulling the drawer. The holder's own switch **stays ON**. No JST-PH any more |
| **Pulled while running** | A clean power-off. No queued goal is lost (firmware: NVS, tested at every write). Bounce on insertion = a few clean boots |
| **Bench** | (1) Resistance pin to target < 0.2 Ω, latched. (2) A rubber mallet on L during a Wi-Fi burst: no reset over 50 hits. (3) Pull and re-insert 20 times while running: it boots every time, and the queue is intact |
| Cost | ≈ 5 kr per counter (AliExpress) · first build with Mill-Max solder-cup pins from DigiKey ≈ 12 each *est.* + nickel strip ≈ 30. Instead of the JST-PH (17) |

## 6. Review 2 (lead's calls, 2026-10-18): the contacts as built (superseded by §7)

| Item | Spec |
|---|---|
| **Pins** | **Mill-Max 0973-0-15-20-77-14-11-0** (DigiKey ED10073-ND), **2 per pole** (redundancy against fretting), pressed into the lane's back wall from behind. Barrel Ø1.50, plunger Ø1.07, shoulder Ø2.16 × 0.25 + barb Ø1.91 × 0.71; stroke 2.03 with a hard stop; Mill-Max's working point 1.02 at 60 g (25 g preload); 2 A, ≤ 20 mΩ, gold; solder cup 20 AWG |
| **Compression at the latch catch** | nominal 1.0, **min 0.6** (≈ 0.44 N per pin, 0.9 N per pole), max 1.6. The latch holds 4 × ≈ 0.6 N = ≈ 2.4 N of push-back without slack (mechanical; assembly-review B16 gates it) |
| **Targets** | gold: **ENIG 8 × 8 squares** cut from a 1.6 mm 2-layer panel (top pad, bottom solder pad, via), lead soldered behind, each **recessed ≥ 1 mm in its own pocket** that only a plunger reaches (a pulled drawer's live contacts can't be shorted by a coin or key; no fuse: it would eat the TX margin). Fallback: Mill-Max 3024 target pins (Ø1.83 head, ±0.4 alignment) |
| **Holder** | FIT0610 only; its slide switch is **bridged** (a series contact vibration could open) |
| **Coupon** | mechanical prints a pin wall + target pocket first: hole sizes, seating and the < 0.2 Ω check before the full drawer |
| **Bench** | < 0.2 Ω per pole latched; 100 drawer cycles and a mallet on L during TX bursts with zero resets (reset reason in telemetry); a pull mid-burst loses no queued goal (firmware: NVS) |

## 7. Lead's call after review 2 (2026-10-18): a wired lead, no pogo pins

The pogo contacts at review-2 quality (2 Mill-Max pins per pole, gold targets) pushed §0 to ≈ 315 kr per counter. Lead
chose the option this study first recommended: **(A1) a keyed wired lead with a slack loop**.
- The holder's leads run in mechanical's loop chamber to a **3-pin plug on J_BAT** (middle cavity plugged, middle pin
  pulled: the battery plug fits nothing else, nothing else bridges J_BAT; `check_plugs.py`).
- No exposed contacts on a pulled drawer, nothing that mates by feel, no fretting; the FIT0610 switch stays bridged.
- **Bench:** 10 pull/push cycles with the loop never reaching the board, plugs or rails (assembly-review sweeps it);
  the mallet test during TX still checks the holder's own springs.
