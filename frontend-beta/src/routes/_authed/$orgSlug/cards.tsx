import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { HttpErrorView } from '@/components/http-error-view';
import { PageTitle } from '@/components/page-title';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useLocaleFormatters } from '@/hooks/use-locale-formatters';
import { MembershipStatus } from '@/api-v3';
import { HttpError } from '@/lib/http-error';
import { failServerAction } from '@/lib/server/action-result';
import { requireApiClientV3 } from '@/lib/server/apiClientV3';
import { rosterMessage } from '@/features/foosball/badges';
import type { PlayerCardResponse, RosterResult } from '@/features/foosball/api';

// Same alphabet as the /t/<code> short links.
const CODE = /^[0-9A-Za-z]{10}$/;

type PendingLink = { tableName: string; expiresAt: string | null };
/** Who a badge can be linked to; names only, no emails reach the page. */
type Member = { id: string; name: string };

const nameOf = (p: { displayName?: string | null; username?: string | null }) =>
  p.displayName ?? p.username ?? 'Unknown';

const statusOf = (err: unknown) =>
  (err as { response?: Response }).response?.status;

const loadCardsFn = createServerFn({ method: 'GET' })
  .validator((input: { orgId: string; code?: string }) => input)
  .handler(
    async ({
      data: { orgId, code },
    }): Promise<{
      cards: PlayerCardResponse[];
      link: PendingLink | 'expired' | null;
      members: Member[];
    }> => {
      const { foosballApi, organizationMembersApi } =
        await requireApiClientV3();
      const resolve = async (): Promise<PendingLink | 'expired' | null> => {
        if (!code || !CODE.test(code)) return null;
        try {
          const link = await foosballApi.resolveShortLink(code);
          if (link.kind !== 'Card' || link.organizationId !== orgId)
            return null;
          return {
            tableName: link.tableName,
            expiresAt: link.cardLinkExpiresAt ?? null,
          };
        } catch (err) {
          if (statusOf(err) === 410) return 'expired';
          if (statusOf(err) === 404) return null;
          throw err;
        }
      };
      const [cards, link] = await Promise.all([
        foosballApi.listMyCards(orgId),
        resolve(),
      ]);
      // Only needed to link a pending badge to someone else.
      const members =
        link && link !== 'expired'
          ? (await organizationMembersApi.listMembers(orgId))
              .filter((m) => m.status === MembershipStatus.Active)
              .map((m) => ({ id: m.id, name: nameOf(m) }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : [];
      return { cards, link, members };
    }
  );

const EXPIRED = 'This link has expired. Tap the badge on the scoreboard again.';
const LINK_ERRORS: Record<number, string> = {
  404: 'This link is not valid any more. Tap the badge on the scoreboard again.',
  410: EXPIRED,
  409: 'This badge is already linked to someone else. Ask an admin to remove it first.',
};

const linkCardFn = createServerFn({ method: 'POST' })
  .validator(
    (input: { orgId: string; code: string; membershipId?: string }) => input
  )
  .handler(
    async ({
      data,
    }): Promise<{ error?: string; rosterResult?: RosterResult | null }> => {
      if (!CODE.test(data.code))
        return failServerAction(400, { error: LINK_ERRORS[404] });
      try {
        const card = await (
          await requireApiClientV3()
        ).foosballApi.linkCard(data.orgId, data.code, data.membershipId);
        return { rosterResult: card.rosterResult };
      } catch (err) {
        const status = statusOf(err) ?? 500;
        return failServerAction(status, {
          error: LINK_ERRORS[status] ?? 'Failed to link the badge',
        });
      }
    }
  );

const unlinkCardFn = createServerFn({ method: 'POST' })
  .validator((input: { orgId: string; cardId: string }) => input)
  .handler(async ({ data }): Promise<{ error?: string }> => {
    try {
      await (
        await requireApiClientV3()
      ).foosballApi.unlinkCard(data.orgId, data.cardId);
      return {};
    } catch (err) {
      return failServerAction(statusOf(err) ?? 500, {
        error: 'Failed to remove the badge',
      });
    }
  });

// The scoreboard's QR after an unknown badge tap lands here
// (/t/<code> → /<org>/cards?code=<code>); the user menu links here too.
export const Route = createFileRoute('/_authed/$orgSlug/cards')({
  validateSearch: (search: Record<string, unknown>): { code?: string } =>
    typeof search.code === 'string' ? { code: search.code } : {},
  loaderDeps: ({ search }) => ({ code: search.code }),
  loader: async ({ context, params, deps }) => {
    const org = context.authedShell.organizations.find(
      (o) => o.slug === params.orgSlug
    );
    if (!org)
      throw new HttpError(404, `Organization '${params.orgSlug}' not found`);
    return {
      org,
      ...(await loadCardsFn({ data: { orgId: org.id, code: deps.code } })),
    };
  },
  errorComponent: HttpErrorView,
  component: CardsPage,
});

function CardsPage() {
  const { org, cards, link, members } = Route.useLoaderData();
  const { code } = Route.useSearch();
  const router = useRouter();
  const { formatDate, formatTime } = useLocaleFormatters();
  const [error, setError] = useState<string | null>(null);
  // The success message, kept after ?code= is dropped.
  const [linked, setLinked] = useState<string | null>(null);

  const linkCard = useMutation({
    mutationFn: (target: Member | null) =>
      linkCardFn({
        data: { orgId: org.id, code: code!, membershipId: target?.id },
      }),
    onSuccess: async (result, target) => {
      if (result.error) return setError(result.error);
      setError(null);
      const table = link && link !== 'expired' ? link.tableName : 'the table';
      setLinked(
        `Badge linked${target ? ` to ${target.name}` : ''}. ${
          result.rosterResult
            ? rosterMessage(result.rosterResult, table, target?.name ?? null)
            : 'Tap it on a scoreboard to join the game.'
        }`
      );
      await router.navigate({
        to: '/$orgSlug/cards',
        params: { orgSlug: org.slug },
        search: {},
        replace: true,
      });
    },
    onError: () => setError('Failed to link the badge'),
  });

  const unlinkCard = useMutation({
    mutationFn: (cardId: string) =>
      unlinkCardFn({ data: { orgId: org.id, cardId } }),
    onSuccess: async (result) => {
      setError(result.error ?? null);
      setLinked(null);
      if (!result.error) await router.invalidate();
    },
    onError: () => setError('Failed to remove the badge'),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>My badges</PageTitle>
      {error && <Alert variant="destructive">{error}</Alert>}
      {linked && <Alert variant="success">{linked}</Alert>}

      {code &&
        !linked &&
        (link === 'expired' ? (
          <Alert variant="destructive">{EXPIRED}</Alert>
        ) : !link ? (
          <Alert variant="destructive">{LINK_ERRORS[404]}</Alert>
        ) : (
          <LinkBadge
            link={link}
            orgName={org.name}
            members={members}
            pending={linkCard.isPending}
            expiresAt={link.expiresAt && formatTime(link.expiresAt)}
            onLink={(target) => linkCard.mutate(target)}
          />
        ))}

      <Card>
        <CardHeader>
          <CardTitle>Your badges in {org.name}</CardTitle>
          <CardDescription>
            Only a scrambled fingerprint of each badge is stored, never its
            number. Remove a badge you lost or no longer use.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {cards.map((card, i) => (
            <div
              key={card.id}
              className="flex items-center justify-between gap-2"
            >
              <span>
                Badge {i + 1}{' '}
                <span className="text-sm text-muted-foreground">
                  linked {formatDate(card.createdAt)}
                  {card.linkedBy && ` by ${nameOf(card.linkedBy)}`}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={unlinkCard.isPending}
                onClick={() => unlinkCard.mutate(card.id)}
              >
                Remove
              </Button>
            </div>
          ))}
          {cards.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No badges yet. Tap your badge on a table&apos;s scoreboard, then
              scan the code it shows.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * "This is my badge" or "It's someone else's: pick the player", then one
 * confirming tap that names who the badge goes to.
 */
function LinkBadge({
  link,
  orgName,
  members,
  pending,
  expiresAt,
  onLink,
}: {
  link: PendingLink;
  orgName: string;
  members: Member[];
  pending: boolean;
  expiresAt: string | null;
  onLink: (target: Member | null) => void;
}) {
  const [mode, setMode] = useState<'mine' | 'other' | null>(null);
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<Member | null>(null);
  const q = query.trim().toLowerCase();
  const matches = q
    ? members.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Whose badge is this?</CardTitle>
        <CardDescription>
          A badge was just tapped on {link.tableName}. Whoever it&apos;s linked
          to plays as that person in {orgName}, so pick carefully.
          {expiresAt && ` The link works until ${expiresAt}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === 'mine' ? 'default' : 'outline'}
            onClick={() => {
              setMode('mine');
              setTarget(null);
            }}
          >
            This is my badge
          </Button>
          <Button
            variant={mode === 'other' ? 'default' : 'outline'}
            onClick={() => setMode('other')}
          >
            It&apos;s someone else&apos;s
          </Button>
        </div>

        {mode === 'other' && !target && (
          <div className="flex flex-col gap-2">
            <Input
              aria-label="Search for the player"
              placeholder="Search for the player"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {matches.map((m) => (
              <Button
                key={m.id}
                variant="ghost"
                className="justify-start"
                onClick={() => setTarget(m)}
              >
                {m.name}
              </Button>
            ))}
            {q && matches.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nobody in {orgName} matches.
              </p>
            )}
          </div>
        )}

        {(mode === 'mine' || target) && (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={pending} onClick={() => onLink(target)}>
              {target
                ? `Link this badge to ${target.name}?`
                : 'Link this badge to me?'}
            </Button>
            {target && (
              <Button variant="ghost" onClick={() => setTarget(null)}>
                Pick someone else
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
