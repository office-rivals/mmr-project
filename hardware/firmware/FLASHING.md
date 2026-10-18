# Flash and configure a goal counter

This is for whoever builds the units, and you don't need to be a developer. It takes about
20 minutes for the first unit and 2 minutes for each one after that. Commands are typed into a
terminal: **Terminal** on macOS, **PowerShell** on Windows.

You need:
- the assembled unit (XIAO ESP32-C6 board)
- a USB-C **data** cable (some cables only charge)
- a laptop on the same Wi-Fi the tables will use

## 1. One-time setup

1. Install **uv**, a small tool manager. It downloads everything else automatically.
   - macOS: `curl -LsSf https://astral.sh/uv/install.sh | sh`
   - Windows: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`

   Close and reopen the terminal afterwards.
2. Get this repository. On its GitHub page, click **Code → Download ZIP** and unzip it, or use
   `git clone`.
3. In the terminal, go to the firmware folder by typing `cd ` (with a space) and dragging the
   `hardware/firmware` folder onto the terminal window, then press Enter.
4. Check that the tools work:

   ```
   uvx platformio@6.1.19 --version
   ```

   The first run downloads for a minute and then prints a version number. Always type
   `platformio@6.1.19` exactly as shown: other versions fail to build this project.

## 2. Create the secrets file

The Wi-Fi password and server token live in `include/secrets.h`. It is deliberately **never
committed**: it stays on your laptop.

1. Copy the template:
   - macOS: `cp include/secrets.example.h include/secrets.h`
   - Windows: `copy include\secrets.example.h include\secrets.h`
2. Open `include/secrets.h` in a **plain-text** editor such as VS Code or Notepad. TextEdit turns
   `"` into curly quotes and breaks the file. Fill in:

   | Setting | What to put there |
   |---|---|
   | `WIFI_SSID`, `WIFI_PASSWORD` | The Wi-Fi network the tables use (2.4 GHz, WPA2/WPA3-Personal) |
   | `API_BASE_URL` | Bench test: `http://<your laptop's IP>:8000` (see step 4). Real use: the server address you were given, with no `/` at the end |
   | `ENROLMENT_TOKEN` | Bench test: any word, e.g. `bench`. Real use: your organisation's enrolment token (admin → devices) |
   | `OTLP_ENDPOINT`, `OTLP_HEADER_NAME`, `OTLP_HEADER_VALUE` | Optional: where the device sends its logs and metrics (e.g. `http://<your laptop's IP>:8000` for the mock). Leave `""` to switch it off |
   | `API_ROOT_CA` | Real use only: paste the certificate you were given between `R"(` and `)"`, including the BEGIN and END lines. Leave it empty for the bench test |

   Keep the quotes around each value.

## 3. Flash

1. Plug the unit into the laptop.
2. For the first test, flash the **bench** build. It keeps the USB log running, and the board's tiny
   user LED lights whenever the beam is blocked:

   ```
   uvx platformio@6.1.19 run -e xiao_c6_bench -t upload
   ```

   It ends with `SUCCESS`. **The very first build takes about 6–10 minutes**: it downloads the
   chip maker's toolkit once (about 1 GB) and compiles it. Later builds take seconds.
3. **Does the upload fail with "No serial port" or "Failed to connect"?** Put the board into
   download mode: hold the tiny **B** (BOOT) button, press and release **R** (RESET), release **B**.
   Then run the command again, and press **R** once when it finishes.

## 4. Check it works (bench test)

1. Find your laptop's IP address:
   - macOS: `ipconfig getifaddr en0`
   - Windows: `ipconfig`, then read the "IPv4 Address" line

   Put it in `API_BASE_URL` (e.g. `http://192.168.1.23:8000`) and flash again (step 3.2).
2. Start the mock server in a **second** terminal window, from the same folder. Use the same
   token as `ENROLMENT_TOKEN`:

   ```
   uv run tools/mock_server.py --token bench --idle 30
   ```

   If macOS asks whether to allow incoming connections, click **Allow**.
3. In the first terminal, open the device log, then press **R** on the board:

   ```
   uvx platformio@6.1.19 device monitor
   ```

   Exit with Ctrl+C.

**What success looks like.** The device log shows, within ~5 s:

```
fb-a0b1c2d3e4f5 fw 0.1.0 wake 0 queued 0 battery -1 mV      ← device_id; battery -1 is normal on USB
wifi up in 2140 ms (scan), RSSI -54 dBm
GET /devices/fb-a0b1c2d3e4f5/config -> 200
```

The mock server prints `config fb-a0b1c2d3e4f5`.

4. **Write down the `device_id`** (`fb-` followed by 12 characters) and stick a label on the unit.
   Whoever configures the server needs it to assign the unit to a table and goal.
5. Drop a ball through the beam. Within ~3 s:
   - device log: `GOAL seq 0` then `POST /goal-events -> 201`
   - mock server: `GOAL {"event_id": "fb-…", … "table_id": "table-1", "goal": "home", …}`
6. Leave the table alone for 30 s. Expect `POST /devices/…/status -> 204` and `deep sleep`. Tap
   the table, and it wakes and fetches its config again.

## 5. Final flash for real use

Put the real server's `API_BASE_URL`, `ENROLMENT_TOKEN` and `API_ROOT_CA` into `secrets.h`, then flash
the **production** build:

```
uvx platformio@6.1.19 run -e xiao_c6 -t upload
```

The production build saves battery by light-sleeping between goals. That drops the USB log and
keeps the LED off, which is expected. Re-flashing keeps the unit's goal counter and queued goals.

## If something is wrong

| Symptom | Fix |
|---|---|
| `wifi: could not connect to "…"` | Check `WIFI_SSID`/`WIFI_PASSWORD` (case matters). The network must be 2.4 GHz. |
| Wi-Fi is up but `-> -1` on requests | Wrong `API_BASE_URL`/IP, the mock server isn't running, or the laptop firewall is blocking port 8000. |
| `-> 401` | `ENROLMENT_TOKEN` doesn't match the server's (`--token` for the mock), or the board was erased and needs a reset in admin (it made itself a new secret). |
| No `GOAL` when a ball passes | In the bench build, the LED must light while the ball blocks the beam. If it doesn't, check the beam wiring and alignment ([ASSEMBLY.md](../ASSEMBLY.md)). |
| `LIS3DH not responding at 0x18/0x19` | Check the accelerometer wiring on D4/D5 (SDA/SCL, 3V3, GND). Either address works: clone boards often use 0x18 and the log then says `LIS3DH at 0x18`. |
| `lis3dh: found LIS3DSH, not supported` | The clone board carries a LIS3DSH (a different chip, not supported). Fit a real LIS3DH board (ASSEMBLY 3.2). |
| Nothing in the log after pressing R | Run `uvx platformio@6.1.19 device monitor` again right after pressing R (the USB port briefly disappears on reset). |
