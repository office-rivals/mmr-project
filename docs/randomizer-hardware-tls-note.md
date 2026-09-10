# Randomizer Hardware TLS note

The ESP32 firmware currently uses `WiFiClientSecure::setInsecure()`, so it does
not verify the API server's TLS certificate. A personal access token is a
bearer credential: someone who can intercept the connection could recover the
token and use it until it is revoked or expires.

Before production hardware sends a PAT, we should choose certificate
verification (for example, an embedded CA certificate or a pinned certificate)
or explicitly accept this residual risk. A narrowly scoped PAT would reduce the
impact of theft, but would not make an unverified TLS connection safe. This note
records the risk; it does not change the firmware yet.
