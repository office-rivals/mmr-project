#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "psycopg2-binary",
# ]
# ///
"""
Regenerate scripts/seed-data.sql from a local Postgres that already contains
real match data, anonymizing all personally identifiable info on the way out.

The local DB must:
  - have the v3 schema (run the .NET API once so EF applies migrations)
  - contain at least one organization+league with matches across several seasons

The script reads the most-recent N seasons of the league identified by the
SOURCE_ORG_SLUG/SOURCE_LEAGUE_SLUG environment variables, replaces every
display name / username / email / Clerk identity / UUID with deterministic
anonymized values, and overwrites scripts/seed-data.sql. The rating histories'
(mmr, mu, sigma, delta) values are preserved verbatim — they were produced by
the actual openskill calculator and are internally consistent under
RankingDisplayValue, so the seed avoids the phantom −1300 first-match delta
caused by default (mu=25, sigma=8.333) caches.

Required environment variables:
  SOURCE_ORG_SLUG     slug of the organization to pull from
  SOURCE_LEAGUE_SLUG  slug of the league within that organization

Optional:
  NUM_SEASONS         number of most-recent seasons to include (default: 3)
  DB_HOST DB_PORT DB_NAME DB_USER DB_PASS  Postgres connection overrides
"""
from __future__ import annotations

import os
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras

# --------------------------------------------------------------------------- #
# Tunables
# --------------------------------------------------------------------------- #

SOURCE_ORG_SLUG = os.environ.get("SOURCE_ORG_SLUG")
SOURCE_LEAGUE_SLUG = os.environ.get("SOURCE_LEAGUE_SLUG")
NUM_SEASONS = int(os.environ.get("NUM_SEASONS", "3"))

OUT_PATH = Path(__file__).parent / "seed-data.sql"

# Fixed UUIDs the e2e suite depends on.
TEST_ORG_ID = "11111111-1111-1111-1111-111111111111"
TEST_LEAGUE_ID = "22222222-2222-2222-2222-222222222222"
TEST_USER_ID = "44444444-4444-4444-4444-444444444401"
TEST_USER_MEMBERSHIP_ID = "55555555-5555-5555-5555-555555555501"
TEST_USER_LEAGUE_PLAYER_ID = "66666666-6666-6666-6666-666666666601"
OTHER_ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
OTHER_LEAGUE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
OTHER_ORG_TEST_MEMBERSHIP_ID = "cccccccc-cccc-cccc-cccc-cccccccccc01"

# Namespaces for deterministic v5 UUIDs (so re-runs produce identical output).
NS_MEMBERSHIP = uuid.UUID("aa000000-0000-0000-0000-000000000001")
NS_LEAGUE_PLAYER = uuid.UUID("aa000000-0000-0000-0000-000000000002")
NS_SEASON = uuid.UUID("aa000000-0000-0000-0000-000000000003")
NS_MATCH = uuid.UUID("aa000000-0000-0000-0000-000000000004")
NS_MATCH_TEAM = uuid.UUID("aa000000-0000-0000-0000-000000000005")
NS_MATCH_TEAM_PLAYER = uuid.UUID("aa000000-0000-0000-0000-000000000006")
NS_RATING_HISTORY = uuid.UUID("aa000000-0000-0000-0000-000000000007")

# Fake names used to anonymize. The first six are the names existing e2e tests
# already pick from the seed; extend the list if you bump participant counts.
FAKE_NAMES = [
    ("Alice Anderson", "alia"),
    ("Bob Brown", "bobr"),
    ("Carol Carter", "caca"),
    ("Dave Davies", "dada"),
    ("Eve Edwards", "eved"),
    ("Frank Foster", "frfo"),
    ("Grace Green", "grgr"),
    ("Henry Hall", "heha"),
    ("Ivy Irving", "ivir"),
    ("Jack Jones", "jajo"),
    ("Kate King", "kaki"),
    ("Liam Lee", "lile"),
    ("Mia Moore", "mimo"),
    ("Noah Nash", "nona"),
    ("Olivia Owens", "olow"),
    ("Peter Park", "pepa"),
    ("Quinn Quick", "ququ"),
    ("Rachel Rose", "raro"),
    ("Sam Stone", "sast"),
    ("Tina Turner", "titu"),
    ("Uma Urban", "umur"),
    ("Victor Vale", "viva"),
    ("Wendy Wong", "wewo"),
    ("Xavier Xu", "xaxu"),
    ("Yara York", "yayo"),
    ("Zach Zimmerman", "zazi"),
    ("Amy Albright", "amal"),
    ("Ben Bishop", "bebi"),
    ("Clara Cole", "clco"),
    ("Daniel Drake", "dadr"),
    ("Ella Evans", "elev"),
    ("Felix Fox", "fefo"),
    ("Gina Grant", "gigr"),
    ("Hugo Hayes", "huha"),
    ("Iris Ingram", "irin"),
    ("Jake Jensen", "jaje"),
    ("Kira Knox", "kikn"),
    ("Leo Lloyd", "lell"),
    ("Maya Mills", "mami"),
    ("Nina North", "nino"),
    ("Otto Ortiz", "otor"),
    ("Piper Price", "pipr"),
    ("Riley Reed", "rire"),
    ("Stella Snow", "stsn"),
    ("Theo Tate", "thta"),
    ("Una Upton", "unup"),
    ("Vera Vance", "veva"),
    ("Wes Webb", "wewb"),
    ("Xena Xander", "xexa"),
    ("Yuki Young", "yuyo"),
    ("Zoe Zane", "zoza"),
]


# --------------------------------------------------------------------------- #
# Data classes
# --------------------------------------------------------------------------- #


@dataclass
class Player:
    real_id: uuid.UUID
    membership_id: uuid.UUID  # anonymized
    league_player_id: uuid.UUID  # anonymized
    display_name: str  # anonymized
    username: str  # anonymized
    is_test_user: bool


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def sql_str(s: str | None) -> str:
    if s is None:
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def sql_uuid(u: uuid.UUID | str) -> str:
    return f"'{u}'"


def sql_ts(ts: datetime) -> str:
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return f"'{ts.astimezone(timezone.utc).isoformat()}'"


def sql_bool(b: bool) -> str:
    return "TRUE" if b else "FALSE"


def deterministic_uuid(namespace: uuid.UUID, real_id: uuid.UUID | str) -> uuid.UUID:
    return uuid.uuid5(namespace, str(real_id))


def _emit_chunked(w, rows: list[str]) -> None:
    """Emit `rows` as one big comma-joined VALUES block terminated with ';'."""
    if not rows:
        w(";")
        return
    w(",\n".join(rows) + ";")
    w("")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #


def main() -> None:
    if not SOURCE_ORG_SLUG or not SOURCE_LEAGUE_SLUG:
        sys.exit(
            "Set SOURCE_ORG_SLUG and SOURCE_LEAGUE_SLUG env vars to the org+league "
            "to pull match data from."
        )

    conn = psycopg2.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        port=int(os.environ.get("DB_PORT", "5432")),
        dbname=os.environ.get("DB_NAME", "mmr_project"),
        user=os.environ.get("DB_USER", "postgres"),
        password=os.environ.get("DB_PASS", "this_is_a_hard_password1337"),
    )
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute(
        """
        SELECT l.id, l.queue_size
        FROM leagues l JOIN organizations o ON o.id = l.organization_id
        WHERE o.slug = %s AND l.slug = %s
        """,
        (SOURCE_ORG_SLUG, SOURCE_LEAGUE_SLUG),
    )
    league_row = cur.fetchone()
    if not league_row:
        sys.exit(f"League {SOURCE_ORG_SLUG}/{SOURCE_LEAGUE_SLUG} not found")
    league_id = league_row["id"]
    queue_size = league_row["queue_size"]

    cur.execute(
        """
        SELECT id, starts_at
        FROM seasons
        WHERE league_id = %s
        ORDER BY starts_at DESC
        LIMIT %s
        """,
        (league_id, NUM_SEASONS),
    )
    season_rows = list(reversed(cur.fetchall()))  # oldest first
    season_ids = [r["id"] for r in season_rows]
    season_id_map = {r["id"]: deterministic_uuid(NS_SEASON, r["id"]) for r in season_rows}

    print(f"Found {len(season_rows)} seasons", file=sys.stderr)
    for r in season_rows:
        print(f"  - starts {r['starts_at'].isoformat()}", file=sys.stderr)

    cur.execute(
        """
        SELECT DISTINCT lp.id AS league_player_id, lp.organization_membership_id,
               om.display_name, om.username,
               COUNT(*) OVER (PARTITION BY lp.id) AS match_count
        FROM league_players lp
        JOIN match_team_players mtp ON mtp.league_player_id = lp.id
        JOIN match_teams mt ON mt.id = mtp.match_team_id
        JOIN matches m ON m.id = mt.match_id
        JOIN organization_memberships om ON om.id = lp.organization_membership_id
        WHERE m.season_id = ANY(%s::uuid[])
        ORDER BY match_count DESC, lp.id
        """,
        (season_ids,),
    )
    player_rows = cur.fetchall()
    if not player_rows:
        sys.exit("No participating players found — wrong seasons?")

    print(f"Found {len(player_rows)} unique participants", file=sys.stderr)

    # Assign anonymized identities. The most-active player becomes the test user.
    players: dict[uuid.UUID, Player] = {}
    name_idx = 0
    for i, row in enumerate(player_rows):
        is_test_user = i == 0
        if is_test_user:
            membership_id = uuid.UUID(TEST_USER_MEMBERSHIP_ID)
            league_player_id = uuid.UUID(TEST_USER_LEAGUE_PLAYER_ID)
            display_name = "Test User"
            username = "tuser"
        else:
            membership_id = deterministic_uuid(
                NS_MEMBERSHIP, row["organization_membership_id"]
            )
            league_player_id = deterministic_uuid(NS_LEAGUE_PLAYER, row["league_player_id"])
            if name_idx < len(FAKE_NAMES):
                display_name, username = FAKE_NAMES[name_idx]
            else:
                display_name = f"Player {name_idx + 1:03d}"
                username = f"p{name_idx + 1:03d}"
            name_idx += 1

        players[row["league_player_id"]] = Player(
            real_id=row["league_player_id"],
            membership_id=membership_id,
            league_player_id=league_player_id,
            display_name=display_name,
            username=username,
            is_test_user=is_test_user,
        )

    test_player = next(p for p in players.values() if p.is_test_user)

    cur.execute(
        """
        SELECT id, mmr, mu, sigma, created_at FROM league_players
        WHERE id = ANY(%s::uuid[])
        """,
        (list(players.keys()),),
    )
    lp_state = {row["id"]: row for row in cur.fetchall()}

    cur.execute(
        """
        SELECT id, season_id, source, played_at, recorded_at, created_at
        FROM matches
        WHERE season_id = ANY(%s::uuid[])
        ORDER BY played_at, recorded_at, created_at
        """,
        (season_ids,),
    )
    match_rows = cur.fetchall()
    match_ids = [r["id"] for r in match_rows]
    print(f"Found {len(match_rows)} matches", file=sys.stderr)

    cur.execute(
        """
        SELECT id, match_id, index, score, is_winner, created_at
        FROM match_teams
        WHERE match_id = ANY(%s::uuid[])
        """,
        (match_ids,),
    )
    team_rows = cur.fetchall()
    team_ids = [r["id"] for r in team_rows]

    cur.execute(
        """
        SELECT match_team_id, league_player_id, index, created_at
        FROM match_team_players
        WHERE match_team_id = ANY(%s::uuid[])
        """,
        (team_ids,),
    )
    mtp_rows = cur.fetchall()

    cur.execute(
        """
        SELECT id, league_player_id, match_id, mmr, mu, sigma, delta, created_at
        FROM rating_histories
        WHERE match_id = ANY(%s::uuid[])
        """,
        (match_ids,),
    )
    rh_rows = cur.fetchall()

    print(
        f"Match teams: {len(team_rows)}, players in teams: {len(mtp_rows)}, "
        f"rating histories: {len(rh_rows)}",
        file=sys.stderr,
    )

    # ------------------------------------------------------------------ #
    # Emit SQL
    # ------------------------------------------------------------------ #

    out: list[str] = []
    w = out.append

    w("-- =============================================================================")
    w("-- Vendored test/dev seed for the MMR project.")
    w("--")
    w("-- Wipes all v3 data and inserts a deterministic fixture:")
    w('--   - 2 organizations ("Test Org" / test-org, "Other Org" / other-org)')
    w("--     - Test Org: test user is Owner. Used for the bulk of e2e coverage.")
    w("--     - Other Org: test user is Member only. Used for RBAC tests.")
    w('--   - 2 leagues (one per org; "Test League" + "Other League", both 2v2)')
    w(f"--   - {len(season_rows)} seasons in Test League (oldest first; latest is current)")
    w(f"--   - {len(players)} league players, including the test user")
    w(f"--   - {len(match_rows)} matches with rating_histories whose (mmr, mu, sigma) triplet is")
    w("--     self-consistent under RankingDisplayValue, so submitting a new match")
    w("--     produces sensible deltas instead of the phantom −1300 from default")
    w("--     (mu=25, sigma=8.333) caches")
    w("--")
    w("-- Variables (passed via `psql -v`):")
    w("--   identity_user_id   Clerk identity_user_id of the test user")
    w("--   user_email         Email for the test user")
    w("--")
    w("-- Usage:")
    w("--   psql ... -v identity_user_id=user_xxx -v user_email=me@example.com -f seed-data.sql")
    w("--   or use scripts/seed-local.sh which wraps this with sane defaults.")
    w("-- =============================================================================")
    w("")
    w("\\set ON_ERROR_STOP on")
    w("")
    w("BEGIN;")
    w("")
    w("-- Wipe v3 data only (preserve __EFMigrationsHistory and legacy_* tables).")
    w("TRUNCATE")
    w("    rating_histories,")
    w("    match_team_players,")
    w("    match_teams,")
    w("    matches,")
    w("    pending_match_acceptances,")
    w("    pending_match_team_players,")
    w("    pending_match_teams,")
    w("    pending_matches,")
    w("    active_matches,")
    w("    queue_entries,")
    w("    match_flags,")
    w("    league_players,")
    w("    seasons,")
    w("    organization_invite_links,")
    w("    personal_access_tokens,")
    w("    organization_memberships,")
    w("    leagues,")
    w("    organizations,")
    w("    users")
    w("CASCADE;")
    w("")

    w("INSERT INTO organizations (id, name, slug, created_at) VALUES")
    w(f"  ({sql_uuid(TEST_ORG_ID)}, 'Test Org', 'test-org', now() - interval '1 year');")
    w("")
    w("INSERT INTO leagues (id, organization_id, name, slug, queue_size, created_at) VALUES")
    w(
        f"  ({sql_uuid(TEST_LEAGUE_ID)}, {sql_uuid(TEST_ORG_ID)},"
        f"   'Test League', 'test-league', {queue_size}, now() - interval '1 year');"
    )
    w("")

    w("INSERT INTO seasons (id, organization_id, league_id, starts_at, created_at) VALUES")
    season_values = []
    for r in season_rows:
        anon_id = season_id_map[r["id"]]
        season_values.append(
            f"  ({sql_uuid(anon_id)}, {sql_uuid(TEST_ORG_ID)},"
            f" {sql_uuid(TEST_LEAGUE_ID)}, {sql_ts(r['starts_at'])}, {sql_ts(r['starts_at'])})"
        )
    w(",\n".join(season_values) + ";")
    w("")

    w("INSERT INTO users (id, identity_user_id, email, username, display_name, created_at) VALUES")
    w(
        f"  ({sql_uuid(TEST_USER_ID)}, :'identity_user_id', :'user_email',"
        f"   'tuser', 'Test User', now() - interval '1 year');"
    )
    w("")

    w("-- Test user (Owner) + unclaimed members (one per league player).")
    w("INSERT INTO organization_memberships")
    w("  (id, organization_id, user_id, role, status, claimed_at, created_at, display_name, username) VALUES")
    w(
        f"  ({sql_uuid(test_player.membership_id)}, {sql_uuid(TEST_ORG_ID)},"
        f" {sql_uuid(TEST_USER_ID)}, 0, 1, now(), now() - interval '1 year',"
        f" {sql_str(test_player.display_name)}, {sql_str(test_player.username)});"
    )
    w("")
    other_members = [p for p in players.values() if not p.is_test_user]
    if other_members:
        w("INSERT INTO organization_memberships")
        w("  (id, organization_id, role, status, created_at, display_name, username) VALUES")
        rows = []
        for p in other_members:
            rows.append(
                f"  ({sql_uuid(p.membership_id)}, {sql_uuid(TEST_ORG_ID)}, 2, 1,"
                f" now() - interval '1 year', {sql_str(p.display_name)}, {sql_str(p.username)})"
            )
        w(",\n".join(rows) + ";")
        w("")

    w("-- League players. The (mmr, mu, sigma) triplet on each row is internally")
    w("-- consistent under RankingDisplayValue (mmr ≈ (mu − 3·sigma) · 75), which is")
    w("-- not the case for default (1500, 25, 8.333). Without this consistency,")
    w("-- submitting a match produces a phantom −1300 delta on the first match.")
    w("INSERT INTO league_players")
    w("  (id, organization_id, league_id, organization_membership_id, mmr, mu, sigma, created_at) VALUES")
    rows = []
    sorted_players = sorted(players.values(), key=lambda p: (not p.is_test_user, str(p.league_player_id)))
    for p in sorted_players:
        state = lp_state[p.real_id]
        rows.append(
            f"  ({sql_uuid(p.league_player_id)}, {sql_uuid(TEST_ORG_ID)},"
            f" {sql_uuid(TEST_LEAGUE_ID)}, {sql_uuid(p.membership_id)},"
            f" {state['mmr']}, {state['mu']}, {state['sigma']}, {sql_ts(state['created_at'])})"
        )
    w(",\n".join(rows) + ";")
    w("")

    w("-- Matches. created_by is collapsed to the test user's membership.")
    w("INSERT INTO matches")
    w("  (id, organization_id, league_id, season_id, source, created_by_membership_id,")
    w("   played_at, recorded_at, created_at) VALUES")
    match_id_map: dict[uuid.UUID, uuid.UUID] = {}
    rows = []
    for r in match_rows:
        anon_match_id = deterministic_uuid(NS_MATCH, r["id"])
        match_id_map[r["id"]] = anon_match_id
        rows.append(
            f"  ({sql_uuid(anon_match_id)}, {sql_uuid(TEST_ORG_ID)},"
            f" {sql_uuid(TEST_LEAGUE_ID)}, {sql_uuid(season_id_map[r['season_id']])},"
            f" {r['source']}, {sql_uuid(test_player.membership_id)},"
            f" {sql_ts(r['played_at'])}, {sql_ts(r['recorded_at'])}, {sql_ts(r['created_at'])})"
        )
    _emit_chunked(w, rows)

    w("INSERT INTO match_teams")
    w("  (id, organization_id, league_id, match_id, index, score, is_winner, created_at) VALUES")
    team_id_map: dict[uuid.UUID, uuid.UUID] = {}
    rows = []
    for r in team_rows:
        anon_team_id = deterministic_uuid(NS_MATCH_TEAM, r["id"])
        team_id_map[r["id"]] = anon_team_id
        rows.append(
            f"  ({sql_uuid(anon_team_id)}, {sql_uuid(TEST_ORG_ID)},"
            f" {sql_uuid(TEST_LEAGUE_ID)}, {sql_uuid(match_id_map[r['match_id']])},"
            f" {r['index']}, {r['score']}, {sql_bool(r['is_winner'])}, {sql_ts(r['created_at'])})"
        )
    _emit_chunked(w, rows)

    w("INSERT INTO match_team_players")
    w("  (id, organization_id, league_id, match_team_id, league_player_id, index, created_at) VALUES")
    rows = []
    for r in mtp_rows:
        if r["league_player_id"] not in players:
            continue
        anon_mtp_id = deterministic_uuid(
            NS_MATCH_TEAM_PLAYER, f"{r['match_team_id']}:{r['league_player_id']}"
        )
        rows.append(
            f"  ({sql_uuid(anon_mtp_id)}, {sql_uuid(TEST_ORG_ID)},"
            f" {sql_uuid(TEST_LEAGUE_ID)}, {sql_uuid(team_id_map[r['match_team_id']])},"
            f" {sql_uuid(players[r['league_player_id']].league_player_id)},"
            f" {r['index']}, {sql_ts(r['created_at'])})"
        )
    _emit_chunked(w, rows)

    w("INSERT INTO rating_histories")
    w("  (id, organization_id, league_player_id, match_id, mmr, mu, sigma, delta, created_at) VALUES")
    rows = []
    for r in rh_rows:
        if r["league_player_id"] not in players:
            continue
        anon_id = deterministic_uuid(NS_RATING_HISTORY, r["id"])
        rows.append(
            f"  ({sql_uuid(anon_id)}, {sql_uuid(TEST_ORG_ID)},"
            f" {sql_uuid(players[r['league_player_id']].league_player_id)},"
            f" {sql_uuid(match_id_map[r['match_id']])},"
            f" {r['mmr']}, {r['mu']}, {r['sigma']}, {r['delta']}, {sql_ts(r['created_at'])})"
        )
    _emit_chunked(w, rows)

    w("-- Sync each league_player.(mmr, mu, sigma) to their latest rating_history row.")
    w("UPDATE league_players lp")
    w("SET mmr = latest.mmr, mu = latest.mu, sigma = latest.sigma")
    w("FROM (")
    w("    SELECT DISTINCT ON (rh.league_player_id)")
    w("        rh.league_player_id, rh.mmr, rh.mu, rh.sigma")
    w("    FROM rating_histories rh")
    w("    JOIN matches m ON m.id = rh.match_id")
    w("    ORDER BY rh.league_player_id, m.played_at DESC, m.recorded_at DESC, m.created_at DESC")
    w(") latest")
    w("WHERE lp.id = latest.league_player_id;")
    w("")

    w("-- =============================================================================")
    w("-- Second org where the test user is a Member (not Owner/Moderator). Used by")
    w("-- the RBAC e2e tests to verify admin pages 403 for non-admins.")
    w("-- =============================================================================")
    w("INSERT INTO organizations (id, name, slug, created_at) VALUES")
    w(f"  ({sql_uuid(OTHER_ORG_ID)}, 'Other Org', 'other-org', now() - interval '1 year');")
    w("")
    w("INSERT INTO leagues (id, organization_id, name, slug, queue_size, created_at) VALUES")
    w(
        f"  ({sql_uuid(OTHER_LEAGUE_ID)}, {sql_uuid(OTHER_ORG_ID)},"
        f"   'Other League', 'other-league', 4, now() - interval '1 year');"
    )
    w("")
    w("-- Membership status 1 = Active, role 2 = Member (see OrganizationRole.cs).")
    w("INSERT INTO organization_memberships")
    w("  (id, organization_id, user_id, role, status, claimed_at, created_at, display_name, username) VALUES")
    w(
        f"  ({sql_uuid(OTHER_ORG_TEST_MEMBERSHIP_ID)}, {sql_uuid(OTHER_ORG_ID)},"
        f" {sql_uuid(TEST_USER_ID)}, 2, 1, now(), now() - interval '1 year',"
        f" 'Test User', 'tuser');"
    )
    w("")

    w("COMMIT;")
    w("")
    w("DO $$")
    w("DECLARE")
    w("    v_users int; v_memberships int; v_league_players int; v_seasons int; v_matches int;")
    w("BEGIN")
    w("    SELECT count(*) INTO v_users FROM users;")
    w("    SELECT count(*) INTO v_memberships FROM organization_memberships;")
    w("    SELECT count(*) INTO v_league_players FROM league_players;")
    w("    SELECT count(*) INTO v_seasons FROM seasons;")
    w("    SELECT count(*) INTO v_matches FROM matches;")
    w("    RAISE NOTICE '';")
    w("    RAISE NOTICE '=== Seed summary ===';")
    w("    RAISE NOTICE 'Users:            %', v_users;")
    w("    RAISE NOTICE 'Memberships:      %', v_memberships;")
    w("    RAISE NOTICE 'League players:   %', v_league_players;")
    w("    RAISE NOTICE 'Seasons:          %', v_seasons;")
    w("    RAISE NOTICE 'Matches:          %', v_matches;")
    w("    RAISE NOTICE '====================';")
    w("END $$;")

    OUT_PATH.write_text("\n".join(out) + "\n")
    print(f"Wrote {OUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
