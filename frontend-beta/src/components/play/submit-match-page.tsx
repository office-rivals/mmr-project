import { useEffect, useMemo, useState } from 'react';
import { MatchSource } from '@/api-v3';
import { FreeFormScoreInputs } from '@/components/free-form-score-inputs';
import { LoadingOverlay } from '@/components/loading-overlay';
import { MatchCard } from '@/components/match-card';
import { PageTitle } from '@/components/page-title';
import { LoserScoreStep } from '@/components/play/loser-score-step';
import { NewPlayerDialog } from '@/components/play/new-player-dialog';
import { TeamMemberField } from '@/components/play/team-member-field';
import type { SlotValue } from '@/components/play/team-member-field';
import { StepHeading } from '@/components/play/step-heading';
import { WinnerStep } from '@/components/play/winner-step';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  deriveLosingTeam,
  isScorePairComplete,
  loserScoreOptions,
} from '@/lib/scoring';
import { formatLeagueFormat } from '@/lib/utils';
import type { NewPlayerDraft } from '@/components/play/new-player-dialog';
import type {
  LeaguePlayerResponse,
  MatchResponse,
  OrganizationMemberResponse,
} from '@/api-v3';

export type SlotName =
  'team1_player1' | 'team1_player2' | 'team2_player1' | 'team2_player2';

export type SlotEncoding = '' | 'new' | `league:${string}` | `member:${string}`;

export interface SubmitMatchInput {
  orgId: string;
  leagueId: string;
  /** Raw slot encodings, exactly the values the Svelte hidden inputs carried. */
  slots: Record<SlotName, SlotEncoding | string>;
  /** Only populated for slots encoded as `new`. */
  newPlayers: Partial<
    Record<SlotName, { displayName: string; username: string; email: string }>
  >;
  team1Score: number;
  team2Score: number;
}

interface SubmitMatchPageProps {
  orgId: string;
  leagueId: string;
  leagueTeamSize: number;
  leagueWinningScore: number | null;
  players: LeaguePlayerResponse[];
  members: OrganizationMemberResponse[];
  /** Server-action error, rendered as a persistent destructive alert. */
  formMessage: string | null;
  submitting: boolean;
  onSubmit: (input: SubmitMatchInput) => void;
  /** Scrolls to the named progressive form step. */
  onGoToStep: (hash: string) => void;
  /** Rendered under the title, e.g. a shortcut to report a live match. */
  banner?: React.ReactNode;
}

// Stored values are LeaguePlayer ids, which are scoped to a single league — a
// user has a different LeaguePlayer row in each league they've joined. The
// legacy unscoped keys silently no-op across leagues; keeping them as a
// read-only fallback preserves auto-fill for users on whichever league they
// last submitted in before the scoped keys shipped.
// TODO(remove-after-next-release): drop the legacy keys.
const primaryPlayerKey = (leagueId: string) =>
  `primaryLeaguePlayerId:${leagueId}`;
const latestPlayersKey = (leagueId: string) =>
  `latestLeaguePlayerIds:${leagueId}`;
const LEGACY_PRIMARY_PLAYER_KEY = 'primaryLeaguePlayerId';
const LEGACY_LATEST_PLAYERS_KEY = 'latestLeaguePlayerIds';

const EMPTY_SLOTS: Record<SlotName, SlotValue> = {
  team1_player1: null,
  team1_player2: null,
  team2_player1: null,
  team2_player2: null,
};

const EMPTY_DRAFT: NewPlayerDraft = {
  displayName: '',
  username: '',
  email: '',
  error: '',
};

function slotToFormValue(value: SlotValue): SlotEncoding {
  if (value === null) return '';
  if (value.kind === 'league') return `league:${value.player.id}`;
  if (value.kind === 'member') return `member:${value.member.id}`;
  return 'new';
}

function slotExclusion(value: SlotValue): string | null {
  if (value === null) return null;
  if (value.kind === 'league') return `league:${value.player.id}`;
  if (value.kind === 'member') return `member:${value.member.id}`;
  return null;
}

/**
 * Progressive-disclosure match submission.
 *
 * The caller **must** mount this with `key={leagueId}`: the Svelte page reset
 * every slot, both scores and the recents list in an `$effect` keyed on
 * `data.leagueId`, because submitting a `LeaguePlayer.id` that belongs to
 * another league is a hard API error. Remounting is the React equivalent and
 * cannot be forgotten halfway through a state update.
 */
export function SubmitMatchPage({
  orgId,
  leagueId,
  leagueTeamSize,
  leagueWinningScore,
  players,
  members,
  formMessage,
  submitting,
  onSubmit,
  onGoToStep,
  banner,
}: SubmitMatchPageProps) {
  const teamSize = leagueTeamSize;
  // Fixed-target leagues (foosball: 10) use the "we won / they won" + loser
  // 0..N picker. Free-form leagues (winningScore === null) take two raw scores.
  const winningScore = leagueWinningScore;
  const isFreeForm = winningScore === null;

  // 1v1 leagues only use the player1 slots; the player2 entries stay null and
  // the server action filters them out.
  const team1Slots = useMemo<SlotName[]>(
    () =>
      teamSize >= 2 ? ['team1_player1', 'team1_player2'] : ['team1_player1'],
    [teamSize]
  );
  const team2Slots = useMemo<SlotName[]>(
    () =>
      teamSize >= 2 ? ['team2_player1', 'team2_player2'] : ['team2_player1'],
    [teamSize]
  );
  const SLOTS = useMemo(
    () => [...team1Slots, ...team2Slots],
    [team1Slots, team2Slots]
  );
  const opponentLabel = teamSize >= 2 ? 'Opponent 1' : 'Opponent';

  const [slots, setSlots] = useState<Record<SlotName, SlotValue>>(EMPTY_SLOTS);
  const [latestPlayerIds, setLatestPlayerIds] = useState<string[]>([]);
  // -1 is the "not entered yet" sentinel; 0 is a legitimate score (🥚).
  const [team1Score, setTeam1Score] = useState(-1);
  const [team2Score, setTeam2Score] = useState(-1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogSlot, setDialogSlot] = useState<SlotName>('team1_player1');
  const [draft, setDraft] = useState<NewPlayerDraft>(EMPTY_DRAFT);

  // Runs once per mount, and the component is keyed on leagueId, so this is the
  // per-league hydration the Svelte `$effect` performed.
  useEffect(() => {
    const primaryId =
      window.localStorage.getItem(primaryPlayerKey(leagueId)) ??
      window.localStorage.getItem(LEGACY_PRIMARY_PLAYER_KEY);
    if (primaryId) {
      const player = players.find((p) => p.id === primaryId);
      if (player) {
        setSlots((current) => ({
          ...current,
          team1_player1: { kind: 'league', player },
        }));
      }
    }

    const stored =
      window.localStorage.getItem(latestPlayersKey(leagueId)) ??
      window.localStorage.getItem(LEGACY_LATEST_PLAYERS_KEY);
    if (stored) setLatestPlayerIds(stored.split(',').filter(Boolean));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSlot = (slot: SlotName, value: SlotValue) =>
    setSlots((current) => ({ ...current, [slot]: value }));

  const allFilled = SLOTS.every((s) => slots[s] !== null);
  const team1Filled = team1Slots.every((s) => slots[s] !== null);

  const exclusions = SLOTS.map((s) => slotExclusion(slots[s])).filter(
    (v): v is string => !!v
  );

  const loserScores = loserScoreOptions(winningScore);
  const losingTeam = deriveLosingTeam(team1Score, team2Score, winningScore);
  const isPreviewVisible = isScorePairComplete(
    team1Score,
    team2Score,
    winningScore
  );

  // Only reachable from the fixed-target winner buttons; the null check narrows
  // the type and fails closed if that ever changes.
  const setTeam1Wins = () => {
    if (winningScore === null) return;
    setTeam1Score(winningScore);
    setTeam2Score(-1);
    onGoToStep('score-step');
  };

  const setTeam2Wins = () => {
    if (winningScore === null) return;
    setTeam2Score(winningScore);
    setTeam1Score(-1);
    onGoToStep('score-step');
  };

  const openNewPlayerDialog = (slot: SlotName, suggested: string) => {
    setDialogSlot(slot);
    setDraft({ displayName: suggested, username: '', email: '', error: '' });
    setDialogOpen(true);
  };

  const saveNewPlayer = () => {
    if (draft.displayName.trim() === '') {
      setDraft((d) => ({ ...d, error: 'Display name is required' }));
      return;
    }
    setSlot(dialogSlot, {
      kind: 'new',
      displayName: draft.displayName.trim(),
      username: draft.username.trim(),
      email: draft.email.trim(),
    });
    setDialogOpen(false);
  };

  function previewMatch(): MatchResponse {
    const playerNames = (
      slot: SlotValue
    ): { displayName?: string; username?: string } => {
      if (slot === null) return { displayName: 'Unknown' };
      if (slot.kind === 'league')
        return {
          displayName: slot.player.displayName,
          username: slot.player.username,
        };
      if (slot.kind === 'member')
        return {
          displayName: slot.member.displayName,
          username: slot.member.username,
        };
      return {
        displayName: slot.displayName,
        username: slot.username || undefined,
      };
    };

    const safeT1 = team1Score === -1 ? 0 : team1Score;
    const safeT2 = team2Score === -1 ? 0 : team2Score;
    const now = new Date().toISOString();

    return {
      id: 'preview',
      leagueId,
      seasonId: '',
      source: MatchSource.Manual,
      playedAt: now,
      recordedAt: now,
      createdAt: now,
      teams: [
        {
          id: 't1',
          index: 0,
          score: safeT1,
          isWinner: safeT1 > safeT2,
          players: team1Slots.map((s, i) => ({
            id: `t1p${i}`,
            leaguePlayerId: '',
            ...playerNames(slots[s]),
            index: i,
          })),
        },
        {
          id: 't2',
          index: 1,
          score: safeT2,
          isWinner: safeT2 > safeT1,
          players: team2Slots.map((s, i) => ({
            id: `t2p${i}`,
            leaguePlayerId: '',
            ...playerNames(slots[s]),
            index: i,
          })),
        },
      ],
    };
  }

  const rememberPlayers = () => {
    const enteredIds = SLOTS.map((s) => {
      const v = slots[s];
      return v?.kind === 'league' ? v.player.id : null;
    }).filter((v): v is string => !!v);

    if (enteredIds[0]) {
      window.localStorage.setItem(primaryPlayerKey(leagueId), enteredIds[0]);
    }
    const merged = [
      ...enteredIds,
      ...latestPlayerIds.filter((id) => !enteredIds.includes(id)),
    ].slice(0, 10);
    window.localStorage.setItem(latestPlayersKey(leagueId), merged.join(','));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    rememberPlayers();

    const newPlayers: SubmitMatchInput['newPlayers'] = {};
    const encoded = {} as Record<SlotName, string>;
    for (const slot of SLOTS) {
      const value = slots[slot];
      encoded[slot] = slotToFormValue(value);
      if (value?.kind === 'new') {
        newPlayers[slot] = {
          displayName: value.displayName,
          username: value.username,
          email: value.email,
        };
      }
    }
    // Unused slots in a 1v1 league are absent from SLOTS; send them as '' so
    // the server sees exactly the FormData the Svelte page produced.
    const slotsPayload: Record<SlotName, string> = {
      team1_player1: encoded.team1_player1 ?? '',
      team1_player2: encoded.team1_player2 ?? '',
      team2_player1: encoded.team2_player1 ?? '',
      team2_player2: encoded.team2_player2 ?? '',
    };

    onSubmit({
      orgId,
      leagueId,
      slots: slotsPayload,
      newPlayers,
      // Sent raw, including -1 — the API rejects negatives, exactly as before.
      team1Score,
      team2Score,
    });
  };

  const field = (slot: SlotName, label: string, autofocus = false) => (
    <TeamMemberField
      label={label}
      autofocus={autofocus}
      value={slots[slot]}
      onChange={(v) => setSlot(slot, v)}
      leaguePlayers={players}
      orgMembers={members}
      latestPlayerIds={latestPlayerIds}
      excludeIds={exclusions}
      onCreateUser={(suggested) => openNewPlayerDialog(slot, suggested)}
    />
  );

  const teamStep = (
    <div className="flex flex-col gap-4">
      <StepHeading step={1}>Teams</StepHeading>
      <div className="flex gap-3">
        <div id="team1-step" className="flex min-w-0 flex-1 flex-col gap-3">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            Team 1
          </h3>
          {field('team1_player1', 'You', true)}
          {teamSize >= 2 &&
          (slots.team1_player1 !== null || slots.team1_player2 !== null)
            ? field('team1_player2', 'Your teammate')
            : null}
        </div>
        <span
          aria-hidden="true"
          className="self-center pt-6 text-xs text-muted-foreground"
        >
          vs
        </span>
        <div id="team2-step" className="flex min-w-0 flex-1 flex-col gap-3">
          <h3 className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Team 2
          </h3>
          {team1Filled || slots.team2_player1 !== null
            ? field('team2_player1', opponentLabel)
            : null}
          {teamSize >= 2 &&
          (slots.team2_player1 !== null || slots.team2_player2 !== null)
            ? field('team2_player2', 'Opponent 2')
            : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {formatLeagueFormat(teamSize)} ·{' '}
            {isFreeForm ? 'Any score' : `First to ${winningScore}`}
          </p>
          <PageTitle>Submit match</PageTitle>
          <p className="text-sm text-muted-foreground">
            Played just now? Lock it in while it&apos;s fresh.
          </p>
        </div>

        {banner}

        {formMessage ? (
          <Alert variant="destructive">{formMessage}</Alert>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-8 lg:rounded-xl lg:border lg:bg-card lg:p-8"
        >
          {teamStep}

          {allFilled && !isFreeForm ? (
            <WinnerStep
              step={2}
              weDisabled={team1Score === winningScore}
              theyDisabled={team2Score === winningScore}
              onWeWon={setTeam1Wins}
              onTheyWon={setTeam2Wins}
            />
          ) : null}

          {/* Deliberately gated on `losingTeam` alone, not on `allFilled`:
              clearing a player after picking a winner keeps the loser-score
              picker on screen, exactly as in the Svelte page. */}
          {losingTeam ? (
            <LoserScoreStep
              step={3}
              possessive={losingTeam === 'team1' ? 'your' : 'their'}
              options={loserScores}
              selected={losingTeam === 'team1' ? team1Score : team2Score}
              onPick={(score) => {
                if (losingTeam === 'team1') setTeam1Score(score);
                else setTeam2Score(score);
                onGoToStep('submit-step');
              }}
            />
          ) : null}

          {allFilled && isFreeForm ? (
            <div id="free-form-score-step" className="flex flex-col gap-4">
              <StepHeading step={2}>What was the final score?</StepHeading>
              <FreeFormScoreInputs
                team1Label="Your score"
                team2Label="Their score"
                team1Score={team1Score}
                team2Score={team2Score}
                onTeam1ScoreChange={setTeam1Score}
                onTeam2ScoreChange={setTeam2Score}
              />
            </div>
          ) : null}

          {isPreviewVisible ? (
            <div id="submit-step" className="flex flex-col gap-4">
              <StepHeading step={isFreeForm ? 3 : 4}>Submit?</StepHeading>
              {/* Remounted per score change, matching the Svelte `{#key}`. */}
              <MatchCard
                key={`${team1Score}:${team2Score}`}
                match={previewMatch()}
                showMmr={false}
              />
              <Button
                type="submit"
                disabled={submitting}
                className="h-12 text-base font-bold"
              >
                Submit the match
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Everyone in the match can flag it if something&apos;s off.
              </p>
            </div>
          ) : null}
        </form>
      </div>

      <NewPlayerDialog
        open={dialogOpen}
        draft={draft}
        onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        onOpenChange={setDialogOpen}
        onSave={saveNewPlayer}
      />

      <LoadingOverlay isLoading={submitting} message="Uploading match result" />
    </>
  );
}
