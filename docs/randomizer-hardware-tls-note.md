# Randomizer Hardware TLS note

The ESP32 firmware currently uses `WiFiClientSecure::setInsecure()`, so it does
not verify the API server's TLS certificate. A Hardware Secret is a bearer
credential: someone who can intercept the connection could recover the secret
and use it until it is rotated or revoked.

Before production hardware is registered, we should choose certificate
verification (for example, an embedded CA certificate or a pinned certificate)
or explicitly accept this residual risk. Binding each secret to one league
limits the impact of theft, but does not make an unverified TLS connection
safe. This note records the risk; it does not change the firmware yet.
