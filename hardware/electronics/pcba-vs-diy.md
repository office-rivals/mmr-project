# Custom assembled PCBs (JLCPCB PCBA) vs DIY modules + perfboard

**Question (user, via lead):** would ready-assembled custom boards be cheaper than the DIY build in
[`bom.md`](bom.md)?

**Rollout:** 1 table first (2 goal counters + 1 scoreboard = **3 boards**), later 3 tables
(**9 boards**).

**Verdict: no. At 1 and 3 tables, DIY is clearly cheaper**: about **6–7× cheaper for 1 table** and
**2.4× cheaper for 3 tables**, counting only the parts that differ.
- Custom PCBA breaks even at about **9 tables** (≈ 26 boards) with one respin, or about **4–5 tables**
  if the first spin works.
- It saves roughly 1–1.5 h of soldering per board, but it adds PCB design and review work, ~2 weeks
  per spin, and real first-spin risk. Below ~8 tables, stay DIY.

Figures:
- Prices checked 2026-10-14 (LCSC part pages, JLCPCB fee page "last updated Sep 09, 2026").
- USD → DKK at 6.9 (assumed), 25 % Danish VAT on everything imported.
- *est.* = not confirmed.

## What a custom board would contain

| | Goal board (~40 × 30 mm) | Scoreboard board (~95 × 60 mm) |
|---|---|---|
| Common | ESP32-C6-MINI-1-N4 (onboard antenna), LIS3DHTR, RT9080-33 LDO (2 µA Iq), USB-C + USBLC6 ESD, BOOT/RESET tactiles, 2 × SS14 (battery / USB OR), VBAT divider, decoupling, JST-PH battery input | same |
| Specific | 2 × JST-PH for the IR LED and phototransistor, R_LED / R_PU as 0603 with alternative pads | 24-pin 0.5 mm FPC connector + e-paper boost (Si1308EDL, 3 × MBR0530, 10 µH, ~10 caps, 3 Ω): replaces the DESPI-C02. 4 × B3F-4055 + ladder resistors |
| Unique extended parts | ~8 | ~12 |
| Parts + assembly per board | **≈ $6.4** (module $3.54, LIS3DH $1.66, rest ~$1.2) | **≈ $8.0** (+ FPC/boost ~$0.8, keys $0.55 + THT joints) |

The e-paper panel, IR LED, phototransistor, battery holders, cells and printed parts are the same in
both cases, so they're left out of the comparison.

## JLCPCB costs that matter

- **Both the C6 module and the LIS3DH are "Extended, Standard-only"** at JLCPCB (C5736265, C15134).
  Economic PCBA ($8 setup) isn't possible, so every order pays **Standard** PCBA per design:

  | Item | USD |
  |---|---|
  | Setup | 25.56 |
  | Stencil | 8.21 |
  | Handling minimum | 14.93 |
  | Packing | 0.50 |
  | Per unique extended part | 1.53 |
  | THT hand-soldering labour | 3.58 per order |
  | SMT joints | $0.0016 each |

  That comes to **≈ $61 fixed for the goal design and ≈ $71 for the scoreboard design, per order**, before any parts.
- **PCBs:** 5 pcs ≤ 100 × 100 mm 2-layer cost $2 (one design per order at that price), about $5 for
  10–30 pcs *est.*
- **Shipping:** DHL ≈ $25 *est.* Direct Line is cheaper, but 3–5 weeks.
- **Import to DK:**
  - JLC collects VAT at checkout only up to **$170**. Every realistic order here is above that, so
    there's import clearance: 25 % VAT, 0 % duty (assembled PCB, *est.*), plus **DHL "told & moms"
    ≈ 100–128 kr**, plus the **€3 EU low-value duty** in force since Jul 2026.
  - **Fixed cost per order, both designs: ≈ 1,580 kr**, before a single part. Lead's guess was 600–900;
    it's higher because Standard PCBA is forced.
- **Stock:** ESP32-C6-MINI-1-N4 was **out of stock at LCSC** on 2026-10-14. You'd have to wait, or
  pre-order or consign it. The LIS3DHTR had 527 in stock.

## Per unit (parts that differ, DKK incl. VAT)

| | DIY (bom.md) | Custom PCBA | Lead's guess |
|---|---|---|---|
| **Goal device core** | XIAO 46 + LIS3DH 63 + perfboard, passives, headers, wire ≈ **152** | ≈ **55** | module+accel ~30 vs ~110: right ballpark (module + LIS3DH alone ≈ 45 kr) |
| **Scoreboard core** | XIAO 46 + LIS3DH 63 + DESPI-C02 62 + keys, passives, perfboards ≈ **244** | ≈ **69** | ~170 → ~40: ≈ 171 → ≈ 57 for the same parts |
| **Saving per board** | | goal **≈ 97**, scoreboard **≈ 175**, so ≈ **370 per table** | |

## Totals for your quantities

Assumes a prototype order and **one respin** (lead's assumption). For 1 table, the respin's boards are
the ones you use. For 3 tables, the second order is the production run plus spares.

| Scenario | Custom PCBA | DIY core | Difference |
|---|---|---|---|
| **1 table** (3 boards): proto 3 goal + 2 scoreboard assembled, then the same again as the respin | 1,834 + 1,834 = **≈ 3,670 kr** (≈ 1,830 if the first spin works) | **≈ 550 kr** | DIY is **≈ 3,100 kr cheaper**, still ≈ 1,300 kr cheaper if the first spin works |
| **3 tables** (9 boards): proto 2 + 1, then production 7 + 4 incl. spares | 1,710 + 2,245 = **≈ 3,950 kr** (≈ 2,250 first-time-right) | **≈ 1,640 kr** | DIY is **≈ 2,300 kr cheaper** (≈ 600 if the first spin works) |
| *For reference: the old 12 goal + 10 scoreboard plan* | ≈ 3,160 fixed + 1,350 parts ≈ 4,500 | ≈ 4,260 | about break-even |

**Break-even:** each table saves ≈ 370 kr on parts, against ≈ 1,580 kr fixed per order.

| Scenario | Break-even |
|---|---|
| Proto + respin | **≈ 9 tables** (≈ 17 goal + 9 scoreboard boards) |
| First spin works | **≈ 4–5 tables** |
| Later batches, once the design is proven | One order of ≥ 5 tables pays off; smaller batches don't |

## Not in the kroner, but real

| | DIY | Custom PCBA |
|---|---|---|
| **Soldering** | ~110 joints per goal board, ~100 per scoreboard, incl. 2 small XIAO pads | The LED and phototransistor leads still need soldering or pre-crimped JST pigtails. Everything else plugs in |
| **Build time** | ~1.5–2.5 h per board → ~5 h for 1 table, ~15 h for 3 tables | ~20 min per board → saves **~4 h (1 table)** / **~12 h (3 tables)** |
| **Tools** | ~1,100–1,250 kr one-off kit | Still need an iron for the leads (or pigtails), so the saving is small |
| **Design work** | None. Done, with layouts drawn | Schematic + layout for 2 boards (antenna keep-out, e-paper boost, USB), DRC/review: **days**, and a respin is likely |
| **Lead time** | Parts in 2–5 days | ~1–2 weeks per spin (fab + Standard PCBA + DHL), so **3–5 weeks** with a respin. Longer if the C6 module stays out of stock |
| **Risk** | Modules are proven (XIAO RF and USB are done); mistakes are fixable with an iron | A layout mistake can scrap a whole batch. Rework on fine-pitch parts is hard |
| **Calibration knobs** | R_LED / R_PU socketed | Become 0603 swaps, unless jumper-selectable pads are added |

## Recommendation

**Build the first table, and the 3-table rollout, DIY as designed.** Revisit custom PCBA only if the
project grows beyond ~8 tables, or for a v2 once the DIY units have proven the design on real tables.
At that point a single production order (no prototype) of ≥ 5 tables would pay off.
