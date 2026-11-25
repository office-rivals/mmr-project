"""SQL for hardware-twin-stack.sh: `twin devices` JSON on stdin, enrolment token as argv[1], card key
(Hardware:CardUidKey, base64) as argv[2]."""
import base64
import hashlib
import hmac
import json
import sys
import uuid

token, card_key, data = sys.argv[1], base64.b64decode(sys.argv[2]), json.load(sys.stdin)

BADGES = 8  # "Badge <n>", card UID 0454574E0000<n>


def q(value):
    return "'" + str(value).replace("'", "''") + "'"


def uid(name):
    return q(uuid.uuid5(uuid.NAMESPACE_URL, name))


org, league = uid("twin-org"), uid("twin-league")
token_hash = hashlib.sha256(token.encode()).hexdigest()

print("BEGIN;")
print("DELETE FROM table_goals; DELETE FROM table_matches; DELETE FROM devices; DELETE FROM foosball_tables; "
      "DELETE FROM player_cards;")
# The twin org's matchmaking leftovers (linked rosters of earlier runs).
print(f"""DELETE FROM active_matches WHERE organization_id = {org};
DELETE FROM pending_match_team_players WHERE pending_match_team_id IN (SELECT id FROM pending_match_teams WHERE organization_id = {org});
DELETE FROM pending_match_teams WHERE organization_id = {org};
DELETE FROM pending_match_acceptances WHERE pending_match_id IN (SELECT id FROM pending_matches WHERE organization_id = {org});
DELETE FROM pending_matches WHERE organization_id = {org};""")
print(f"""INSERT INTO organizations (id, name, slug, created_at, device_enrolment_token_hash, device_enrolment_token_created_at)
VALUES ({org}, 'Twin Office', 'twin', now(), decode('{token_hash}', 'hex'), now())
ON CONFLICT (id) DO UPDATE SET device_enrolment_token_hash = excluded.device_enrolment_token_hash;""")
print(f"""INSERT INTO leagues (id, organization_id, name, slug, team_size, winning_score, created_at)
VALUES ({league}, {org}, 'Foosball', 'foosball', 2, 10, now()) ON CONFLICT (id) DO NOTHING;""")
print(f"""INSERT INTO seasons (id, organization_id, league_id, starts_at, created_at)
SELECT gen_random_uuid(), {org}, {league}, now() - interval '1 day', now()
WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE league_id = {league});""")

for i, (key, table) in enumerate(data["tables"].items()):
    print(f"""INSERT INTO foosball_tables (id, organization_id, name, short_code, league_id, end_label_a, end_label_b, sound_volume, state_version, created_at)
VALUES ({uid('twin-table-' + key)}, {org}, {q(table['name'])}, 'TWIN{i:06d}', {league}, 'Home', 'Away', 2, 0, now());""")

# Twin's home/away = ends A/B. Role 0 = goal, 1 = scoreboard.
for hardware_id, device in data["devices"].items():
    end = 0 if (device.get("goal") or device.get("end") or "home") == "home" else 1
    role = 0 if device["role"] == "goal" else 1
    # A scenario's beam_* config keys, stored as the admin's beam config (BeamConfig, snake_case, no prefix).
    beam = {k.removeprefix("beam_"): v for k, v in device.items() if k.startswith("beam_")}
    beam_config = f"{q(json.dumps(beam))}::jsonb" if beam else "NULL"
    print(f"""INSERT INTO devices (id, organization_id, hardware_id, claimed, claimed_at, role, table_id, "end", config_version, low_batt, beam_config, created_at)
VALUES (gen_random_uuid(), {org}, {q(hardware_id)}, true, now(), {role}, {uid('twin-table-' + device['table_id'])}, {end}, 1, false, {beam_config}, now());""")

def player(key, name, mmr):
    """A member with a league player (ids from key); returns the member and player id literals."""
    user, member, lp = uid(f"twin-user-{key}"), uid(f"twin-member-{key}"), uid(f"twin-player-{key}")
    print(f"""INSERT INTO users (id, identity_user_id, email, display_name, created_at)
VALUES ({user}, 'twin-{key}', '{key.lower()}@example.test', {q(name)}, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO organization_memberships (id, organization_id, user_id, role, status, created_at)
VALUES ({member}, {org}, {user}, 2, 1, now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO league_players (id, organization_id, league_id, organization_membership_id, mmr, mu, sigma, created_at)
VALUES ({lp}, {org}, {league}, {member}, {mmr}, 25.0, 8.333, now())
ON CONFLICT (id) DO UPDATE SET mmr = excluded.mmr;""")
    return member, lp


def color(member, taken):
    """PlayerColors.Assign: SHA-256 of the membership Guid (.NET byte order), first byte mod 6, next free."""
    preferred = hashlib.sha256(uuid.UUID(member.strip("'")).bytes_le).digest()[0] % 6
    return next(c % 6 for c in range(preferred, preferred + 6) if c % 6 not in taken)


# Tables whose teams list players (and that don't scan in) play a linked 2v2 like the mock's: an accepted
# active match with those teams (home = end A = team 0), a 0:0 table match linked to it, and its roster.
for key, table in data["tables"].items():
    sides = [table.get("teams", {}).get(side, {}).get("players", []) for side in ("home", "away")]
    if "cards" in table or not all(sides):
        continue
    pending, active, table_id = uid(f"twin-pending-{key}"), uid(f"twin-active-{key}"), uid("twin-table-" + key)
    print(f"""INSERT INTO pending_matches (id, organization_id, league_id, status, expires_at, created_at)
VALUES ({pending}, {org}, {league}, 1, now(), now());""")
    taken = []
    for index, names in enumerate(sides):
        team = uid(f"twin-team-{key}-{index}")
        print(f"""INSERT INTO pending_match_teams (id, organization_id, league_id, pending_match_id, index, created_at)
VALUES ({team}, {org}, {league}, {pending}, {index}, now());""")
        for slot, name in enumerate(names):
            member, lp = player(f"{key}-{name}".replace(" ", "-"), name, 1500)
            taken.append(color(member, taken))
            print(f"""INSERT INTO pending_match_team_players (id, pending_match_team_id, league_player_id, index, created_at)
VALUES (gen_random_uuid(), {team}, {lp}, {slot}, now());
INSERT INTO pending_match_acceptances (id, pending_match_id, league_player_id, status, accepted_at, created_at)
VALUES (gen_random_uuid(), {pending}, {lp}, 1, now(), now());
INSERT INTO table_roster_entries (id, organization_id, table_id, league_player_id, color, created_at)
VALUES (gen_random_uuid(), {org}, {table_id}, {lp}, {taken[-1]}, clock_timestamp());""")
    print(f"""INSERT INTO active_matches (id, organization_id, league_id, pending_match_id, started_at, created_at)
VALUES ({active}, {org}, {league}, {pending}, now(), now());
INSERT INTO table_matches (id, organization_id, table_id, status, short_code, started_at, last_activity_at, score_a, score_b,
  active_match_id, active_match_team_index_at_end_a, owns_active_match, created_at)
VALUES (gen_random_uuid(), {org}, {table_id}, 0, {q('TWM' + hashlib.sha256(key.encode()).hexdigest()[:7].upper())}, now(), now(),
  0, 0, {active}, 0, true, now());""")

# Players with cards: the twin's own (per table "cards", in its order, MMR falling, so the backend's MMR
# split matches the twin's join-order stand-in), then "Badge 1".."Badge 8" (MMR rising) for manual probes.
# The card hash is CardUidHasher's: HMAC-SHA256(key, org Guid bytes (.NET order) + UID bytes).
twin_cards = [(card_uid, card["name"]) for t in data["tables"].values() for card_uid, card in t.get("cards", {}).items()]
badges = [(card_uid, name, 2000 - 50 * i) for i, (card_uid, name) in enumerate(twin_cards)]
badges += [(f"0454574E0000{n:02X}", f"Badge {n}", 1000 + 100 * n) for n in range(1, BADGES + 1)]
org_bytes = uuid.uuid5(uuid.NAMESPACE_URL, "twin-org").bytes_le
for card_uid, name, mmr in badges:
    member, _ = player(card_uid.upper(), name, mmr)
    card_hash = hmac.new(card_key, org_bytes + bytes.fromhex(card_uid), hashlib.sha256).hexdigest()
    print(f"""INSERT INTO player_cards (id, organization_id, organization_membership_id, uid_hmac, created_at)
VALUES (gen_random_uuid(), {org}, {member}, decode('{card_hash}', 'hex'), now());""")

print("COMMIT;")
