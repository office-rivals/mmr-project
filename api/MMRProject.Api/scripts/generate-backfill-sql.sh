#!/bin/bash
# generate-backfill-sql.sh
# Generates SQL to backfill Player.Email from CSV export

CSV_FILE="${1:-user_emails.csv}"
OUTPUT_FILE="backfill-player-emails.sql"

if [ ! -f "$CSV_FILE" ]; then
    echo "Error: CSV file not found: $CSV_FILE"
    exit 1
fi

echo "-- Generated: $(date)" > "$OUTPUT_FILE"
echo "-- Source: $CSV_FILE" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

tail -n +2 "$CSV_FILE" | while IFS=, read -r identity_user_id email; do
    identity_user_id=$(echo "$identity_user_id" | tr -d '"')
    email=$(echo "$email" | tr -d '"')

    email=$(echo "$email" | sed "s/'/''/g")

    echo "UPDATE players SET email = '$email', updated_at = NOW() WHERE identity_user_id = '$identity_user_id' AND email IS NULL;" >> "$OUTPUT_FILE"
done

echo "" >> "$OUTPUT_FILE"
echo "-- Validation query:" >> "$OUTPUT_FILE"
echo "-- SELECT COUNT(*) as total, COUNT(email) as with_email, COUNT(*) - COUNT(email) as missing_email" >> "$OUTPUT_FILE"
echo "-- FROM players WHERE deleted_at IS NULL AND identity_user_id IS NOT NULL;" >> "$OUTPUT_FILE"

echo "Generated SQL file: $OUTPUT_FILE"
