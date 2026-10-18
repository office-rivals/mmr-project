# Plan: over-the-air (OTA) firmware updates

Status: **parked** (user, 2026-10-15). USB flashing covers the first table; do this before tables 2–3, or as soon
as devices become hard to reach. Estimated effort: ~3–4 agent-days across firmware, backend, admin-ui and CI.

## Goal

A new firmware version reaches every goal counter and scoreboard without anyone touching them, safely: a power
cut or a bad image can never brick a device, and only firmware signed by us is accepted (the repo is public).

## Design in one picture

```
CI (GitHub Actions) ── build + sign ──► server stores image (per role + variant)
admin page ── "roll out v1.4 to table 1" ──► server marks target version per device
device wakes ── GET config ──► { firmware: {version, url, sha256, size} } ──► downloads to the spare slot
             ──► verifies signature ──► reboots into it ──► self-test passes? keep : automatic rollback
             ──► reports firmware_version + ota result in its status
```

## 1. Firmware (owner: firmware)

- **Partitions:** today `huge_app.csv` (one 3 MB app, no OTA). Switch to a custom 4 MB table with two app
  slots + `otadata`: e.g. nvs 20 K, otadata 8 K, phy 4 K, app0 ≈ 1.94 MB, app1 ≈ 1.94 MB.
  ⚠ The scoreboard image is **1.70 MB** today (incl. ~154 KiB of sound samples), leaving only ~240 KB headroom
  per slot. Options if it grows: compress the samples (IMA-ADPCM ≈ 4×) or put them in their own small data
  partition that is updated separately.
- **Download:** ESP-IDF `esp_https_ota` over the existing TLS connection, streaming into the inactive slot.
- **Signature:** signed app images (ECDSA, "app signing without secure boot"), verified before switching. The
  public key is baked into the firmware; the private key never touches the repo.
- **Rollback:** enable `CONFIG_BOOTLOADER_APP_ROLLBACK_ENABLE`. The new image must mark itself valid only after
  a self-test (Wi-Fi up, server reachable, sensor/display/reader initialised); otherwise the bootloader returns
  to the old slot on the next reset.
- **When:** never during a live match or lobby; never below the battery warn threshold (3500 mV); prefer the
  daily heartbeat wake or after the idle timeout. Back off after a failure (e.g. retry next day).
- **Cost:** ~1.5–2 MB download, roughly 30–60 s of Wi-Fi ≈ 1–2 mAh per update. Negligible.
- **Variants:** the device reports role + build variant (goal / scoreboard; speaker | buzzer; badge side), so it
  only ever gets a matching image. Refuse an image whose embedded role/variant differs (like the D7 strap guard).
- **Tests:** native tests for the "may I update now" rules; twin scenario (offer → download → reboot → report;
  bad signature refused; mid-download power loss keeps the old version).

## 2. Backend (owner: backend)

- **Storage:** firmware images (Blob storage or DB) with version, role, variant, sha256, size, signature,
  upload date. Read-only to devices via a signed short-lived URL or an authenticated device route.
- **Targeting:** a target version per device, set per table or org ("all scoreboards"); default = no change.
- **Config:** add `firmware {version, url, sha256, size}` to the device config only when the target differs from
  the reported `firmware_version`.
- **Status:** accept `ota_result` (ok | rolled_back | bad_signature | no_space | download_failed) in the device
  status; keep the last result per device.
- **Tests:** integration tests for targeting, the config field, and status handling.

## 3. Admin page (owner: admin-ui)

- Upload a signed image (or pick a CI release), choose targets (one table / all), start the rollout.
- Per device: current version, target version, last OTA result and time. A "stop rollout" button.
- Docs page + changeset.

## 4. CI and signing (owner: firmware + backend)

- A GitHub Actions workflow builds every env, signs the images with a key from **repository secrets**
  (never in the repo), and attaches them to a release. Uploading to a deployment's server is a manual step
  (deployment-specific, so not scripted with real hosts in this public repo).

## 5. Rollout plan

1. Bench: two devices on USB, update A → B → A, pull the battery mid-download, flash a bad signature.
2. One table, one device for a week (watch `ota_result` in Grafana; observability adds a panel + alert).
3. All devices.

## Open questions for the user (when we start)

- Where to host images (the API's storage vs GitHub Releases).
- Who may start a rollout (owners only?).
- Auto-update to the latest release, or always a manual rollout?
