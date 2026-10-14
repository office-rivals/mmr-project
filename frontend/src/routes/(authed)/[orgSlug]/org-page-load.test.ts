import { describe, expect, it } from 'vitest';
import { load } from './+page.server';

type Locals = Parameters<typeof load>[0]['locals'];

const org = { id: 'org-1', name: 'Org', slug: 'org', leagues: [{ id: 'l-1' }] };
const leagues = [
  { id: 'l-1', name: 'Joined', slug: 'joined' },
  { id: 'l-2', name: 'Open', slug: 'open' },
];
const failing = async () => {
  throw new Error('API unavailable');
};

function makeLocals(opts: {
  listLeagues?: () => Promise<unknown>;
  listClaimable?: () => Promise<unknown>;
  getMine?: () => Promise<unknown>;
}): Locals {
  return {
    apiClientV3: {
      meApi: { getMe: async () => ({ organizations: [org] }) },
      leaguesApi: { listLeagues: opts.listLeagues ?? (async () => leagues) },
      organizationMembersApi: {
        listClaimable:
          opts.listClaimable ??
          (async () => ({ requesterEligible: true, memberships: [] })),
      },
      organizationClaimRequestsApi: {
        getMine: opts.getMine ?? (async () => undefined),
      },
    },
  } as unknown as Locals;
}

const run = (locals: Locals) =>
  // The load only reads `params` and `locals`; the rest of the event is unused.
  (
    load as (e: {
      params: { orgSlug: string };
      locals: Locals;
    }) => Promise<Record<string, unknown>>
  )({ params: { orgSlug: 'org' }, locals });

describe('organization page load — claim data is optional', () => {
  it('still lists the leagues when the claimable request fails', async () => {
    const data = await run(makeLocals({ listClaimable: failing }));

    expect(data.claimable).toBeNull();
    expect(data.leagues).toEqual([
      { ...leagues[0], isJoined: true },
      { ...leagues[1], isJoined: false },
    ]);
  });

  it('still lists the leagues when the own-claim request fails', async () => {
    const data = await run(makeLocals({ getMine: failing }));

    expect(data.claimRequest).toBeUndefined();
    expect(data.claimable).toEqual({
      requesterEligible: true,
      memberships: [],
    });
  });

  /* The leagues are the page itself, so their failure still surfaces. */
  it('fails when the leagues cannot be loaded', async () => {
    await expect(run(makeLocals({ listLeagues: failing }))).rejects.toThrow(
      'API unavailable'
    );
  });
});
