#!/usr/bin/env bash
# Boot the API on a throwaway Postgres and provision the digital twin's devices, so the twin
# (hardware/twin) can run its scenarios against the real device API.
#
#   api/scripts/hardware-twin-stack.sh            # start (or reuse) Postgres + API, seed, print env
#   api/scripts/hardware-twin-stack.sh stop       # stop the API and remove the database container
#
# Local only: placeholder secrets, no Clerk (the device API doesn't use it). Override ports with
# HW_PG_PORT / HW_API_PORT / HW_MMR_PORT, the token with HW_ENROLMENT_TOKEN and the card key with HW_CARD_UID_KEY
# (random per API start otherwise).
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
pg_port="${HW_PG_PORT:-55491}"
api_port="${HW_API_PORT:-8091}"
mmr_port="${HW_MMR_PORT:-8092}"
token="${HW_ENROLMENT_TOKEN:-twin}"
card_key="${HW_CARD_UID_KEY:-$(openssl rand -base64 32)}"
container=mmr-hardware-twin-db
state="${TMPDIR:-/tmp}/mmr-hardware-twin"
mkdir -p "$state"

if [[ "${1:-}" == stop ]]; then
  [[ -f "$state/api.pid" ]] && kill "$(cat "$state/api.pid")" 2>/dev/null || true
  [[ -f "$state/mmr.pid" ]] && kill "$(cat "$state/mmr.pid")" 2>/dev/null || true
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -f "$state/api.pid" "$state/mmr.pid"
  echo "stopped"
  exit 0
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$container"; then
  docker run -d --name "$container" -e POSTGRES_PASSWORD=postgres -p "$pg_port:5432" postgres:16 >/dev/null
fi
until docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done

# The MMR API rates submitted matches (a confirmed scan-in game, or a claim).
if ! { [[ -f "$state/mmr.pid" ]] && kill -0 "$(cat "$state/mmr.pid")" 2>/dev/null; }; then
  (cd "$root/mmr-api" && go build -o "$state/mmr-api" .)
  (
    cd "$state"
    MMR_API_PORT="$mmr_port" ADMIN_SECRET=twin-mmr nohup ./mmr-api >"$state/mmr.log" 2>&1 &
    echo $! >"$state/mmr.pid"
  )
fi

if ! { [[ -f "$state/api.pid" ]] && kill -0 "$(cat "$state/api.pid")" 2>/dev/null; }; then
  echo "$card_key" >"$state/card_key"
  (
    cd "$root/api/MMRProject.Api"
    ConnectionStrings__ApiDbContext="Host=localhost;Port=$pg_port;Database=mmr_hardware_twin;Username=postgres;Password=postgres" \
    Authorization__Issuer="https://issuer.invalid" \
    Migration__Enabled=true \
    MMRCalculationAPI__BaseUrl="http://127.0.0.1:$mmr_port" \
    MMRCalculationAPI__ApiKey=twin-mmr \
    Hardware__PublicFrontendBaseUrl="https://app.example.test" \
    Hardware__CardUidKey="$card_key" \
    ASPNETCORE_URLS="http://127.0.0.1:$api_port" \
    ASPNETCORE_ENVIRONMENT=Development \
      nohup dotnet run --no-launch-profile >"$state/api.log" 2>&1 &
    echo $! >"$state/api.pid"
  )
fi
until curl -sf "http://127.0.0.1:$api_port/ready" >/dev/null; do
  kill -0 "$(cat "$state/api.pid")" 2>/dev/null || { tail -30 "$state/api.log"; exit 1; }
  sleep 1
done

# Seed: one org (enrolment token = $token), a 2v2 league to 10, one table per twin table, and every
# device the twin lists, pre-assigned (they enrol on their first request and keep the assignment).
make -C "$root/hardware/twin" -s >/dev/null
"$root/hardware/twin/build/twin" devices | python3 "$root/api/scripts/hardware-twin-seed.py" "$token" "$(cat "$state/card_key")" \
  | docker exec -i "$container" psql -q -v ON_ERROR_STOP=1 -U postgres -d mmr_hardware_twin >/dev/null

cat <<EOF
API ready (log: $state/api.log). For the twin:
  export TWIN_BASE=http://127.0.0.1:$api_port/api/v3/hardware
  export TWIN_ENROLMENT_TOKEN=$token
  export TWIN_OTLP=
Badge players "Badge 1".."Badge 8" (MMR 1100..1800) have cards with UIDs 0454574E000001..08.
Re-run this script to reset all table/device state. Stop with: $0 stop
EOF
