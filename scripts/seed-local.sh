#!/usr/bin/env bash
# Apply the vendored seed (scripts/seed-data.sql) against the local Postgres
# running in docker-compose. Wipes all v3 data and inserts a deterministic
# fixture suitable for local UI development and the Playwright e2e suite.
#
# Usage:
#   ./scripts/seed-local.sh                                 # uses defaults
#   IDENTITY_USER_ID=user_xxx USER_EMAIL=me@x.com ./scripts/seed-local.sh
#
# The IDENTITY_USER_ID must match the Clerk identity_user_id of the test
# account you'll log in as in the browser. To find it:
#   1. Sign in to http://localhost:5173 with your Clerk dev test account
#   2. SELECT identity_user_id FROM users WHERE email = '<your email>';

set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mmr_project}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-this_is_a_hard_password1337}"

IDENTITY_USER_ID="${IDENTITY_USER_ID:-e2e-test-user}"
USER_EMAIL="${USER_EMAIL:-e2e@test.local}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

echo "Applying seed to ${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "  identity_user_id = ${IDENTITY_USER_ID}"
echo "  user_email       = ${USER_EMAIL}"
echo

PGPASSWORD="${DB_PASS}" psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -v "identity_user_id=${IDENTITY_USER_ID}" \
    -v "user_email=${USER_EMAIL}" \
    -f "${SCRIPT_DIR}/seed-data.sql"
