# Print vs buy

We have a Bambu printer and PETG costs about 0.18 kr/g, so a part is printed wherever that is cheaper or
easier, **except** where a printed part would make an electrical contact or a safety function flaky.
Prices are from `electronics/bom.md` (DKK incl. moms, 2026-10-14). Savings are per goal device (insert)
or per scoreboard.

| Part | Bought: cost / availability | Printed alternative | Still bought | Saving | Reliability risk | Verdict |
|---|---|---|---|---|---|---|
| **3×AA holder** (FIT0610, both units) | 15 kr; 12.70 at 22+, 10.50 at 43+; 14 in stock (let-elektronik) | Holder moulded into the insert's battery slot, with spring and flat contacts pushed into printed pockets and series links in nickel strip | AA contact set (spring + flat, ×3, ~6–10 kr from DigiKey/AliExpress), nickel strip, spot-welding or soldering to the strip | ≈ 0–3 kr at the quantity price. It only wins if contacts cost under ~2 kr each (electronics: 4 contacts + ~15 g PETG must come in under ~8 kr) | **High.** Contacts in printed pockets loosen as PETG creeps, and table knocks then make intermittent contact: a power pull many times a minute, the worst case for both devices. Electronics' requirements: plated spring-steel contacts captured in slots, ≤ 20 mΩ each, springs ≥ 3 N with ≥ 2 mm travel, cells cradled over ≥ 120°, wires soldered before the contacts go in | **Buy.** Contact-critical, and the bought holder is cheap and in stock |
| **Magnets** (insert hatch 4 × Ø10×2, scoreboard cover 8) | 14 kr / insert, 28 kr / scoreboard; one DK shop | **Friction lip with crush ribs**: the hatch or cover plugs into its opening and 4 small ribs per side deform 0.1–0.2 mm on fitting, with a finger notch to lift it off | Nothing | 14 kr / insert, 28 kr / scoreboard, plus the gluing and polarity step | Low. Nothing important depends on the hatch: it sits flush in the insert's downstream face on a ledge, so a ball can only push it in, and the scoreboard cover is vertical. Crush ribs hold well against vibration and survive monthly swaps | **Print** |
| **M3 × 8 screws** (4 per insert, incl. 2 nylon from France) | 4 kr, but the nylon has no DK stock (~6 kr plus EU shipping) | **2 locating pins + 2 snap clips**: Ø2.9 pins on the far bosses go through the board's Ø3.2 holes, and 2 cantilever clips on the long edges press the board onto the bosses and the rest pad. To remove, flex the clips outward | Nothing | 4 kr, plus the nylon order and shipping | Low–medium. The accelerometer needs a board that doesn't rattle; the clips are sized to preload the board 0.2 mm onto the bosses. **No metal near the antenna at all**, which is better than the nylon fix | **Print** |
| **LED / phototransistor holders** | – | Already printed: top-loading wells with flange shoulders | Hot glue dab | – | – | Printed (done) |
| **Cable clips / routing** | – | Already printed: grooves under the strap band and the lid | Duct tape over the grooves (already in the BOM) | – | – | Printed (done) |
| **Battery pull tab** | Ribbon, ~0 kr | Printed tab | – | ~0 | – | **Keep the ribbon.** It costs nothing and is flexible |
| **Double-sided tape, duct tape** | 4 kr / insert | – | – | – | – | **Buy.** Can't be printed |
| **Perfboard, headers, Dupont wires, heat-shrink** | 15 + 2 + 1 kr | – | – | – | Solder joints and contacts | **Buy** |
| **Scoreboard key caps** | Round caps for 12 × 12 tactile switches, ~1–2 kr each, round only | **Printed 17 × 11 rectangular caps** with a plunger onto the switch and a guide skirt in the face (ux's shape isn't sold) | The tactile switches (contact-critical) | ~6 kr / scoreboard, and the shape ux wants | Low: PETG caps, PLA works too | **Print the caps, buy the switches** |
| **Scoreboard key plungers / flexure keys instead of switches** | – | Printed flexure that closes a contact | – | – | **High.** A printed contact is flaky | **Buy switches** |
| **Scoreboard e-paper mounting** | – | Printed locating recess plus 2 clips | – | – | Low | **Print** (with the scoreboard design) |
| **Scoreboard 3×AA holder** | 15 kr | As for the insert | As for the insert | ≈ 5 kr | High | **Buy** (same FIT0610) |

## Net effect on `electronics/bom.md`

**Insert:**
- **Remove** row 16 (magnets, 14 kr / insert, 35 kr pack).
- **Remove** row 17 (M3 × 8 steel and nylon, 4 kr / insert). The audiophonics.fr order and the Elextra
  screw pack go with it.
- **Superglue** in row 19 is no longer needed (it was only for the magnets); hot glue stays.
- PETG goes up by about 2 g per insert for the pins, clips and ribs. That's noise, so keep ~200 g.
- **Insert subtotal: ≈ 66 → ≈ 48 kr.** For 5 tables (12 inserts), the order no longer needs
  makersupplies.dk (−175), the Elextra screws (−39) or audiophonics (−20 plus shipping).

**Scoreboard** (when that section is written):
- No magnets and no case screws: the back cover is a friction lip, and the display and board are held by
  printed clips.
- Key caps are printed; **buy** the tactile switches and the FIT0610.

## What changes in the models

1. **Insert battery hatch:** the magnet pockets are replaced by a friction lip with crush ribs.
2. **Insert perfboard:** the screw bosses on the antenna side become locating pins, and 2 snap clips are
   added on the long edges.
3. **Scoreboard back cover:** the magnets are replaced by a friction lip with crush ribs.
4. **Scoreboard keys:** the caps get a plunger and a guide skirt (done once ux and electronics fix the
   switch).

`print-and-install.md` drops the magnet and screw steps accordingly.
