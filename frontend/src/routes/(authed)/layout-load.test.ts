import { describe, expect, it } from 'vitest';
import { load } from './+layout.server';

type Locals = Parameters<typeof load>[0]['locals'];

const adminOrgs = [
  { id: 'org-1', name: 'Org', slug: 'org', role: 'Owner', leagues: [] },
];
const memberOrgs = [
  { id: 'org-1', name: 'Org', slug: 'org', role: 'Member', leagues: [] },
];

function makeLocals(opts: {
  me?: () => Promise<unknown>;
  badges?: () => Promise<unknown>;
}): Locals {
  return {
    auth: () => ({ userId: 'user-1', getToken: async () => 't' }),
    apiClientV3: {
      meApi: {
        getMe: opts.me ?? (async () => ({ organizations: adminOrgs })),
        getBadges:
          opts.badges ?? (async () => ({ openMatchFlags: { total: 0 } })),
      },
    },
  } as unknown as Locals;
}

const run = (locals: Locals) =>
  // The load only reads `locals`; the rest of the event is unused.
  (load as (e: { locals: Locals }) => Promise<Record<string, unknown>>)({
    locals,
  });

describe('(authed) layout load — badge count wiring', () => {
  it('surfaces the badge total for an admin', async () => {
    const data = await run(
      makeLocals({
        me: async () => ({ organizations: adminOrgs, displayName: 'A' }),
        badges: async () => ({ openMatchFlags: { total: 7 } }),
      })
    );
    expect(data.openFlagCount).toBe(7);
  });

  /* Only admins can act on flags, so everyone else should not pay for the
     request at all — they would just be told zero. */
  it('does not request badges for a non-admin', async () => {
    let called = false;
    const data = await run(
      makeLocals({
        me: async () => ({ organizations: memberOrgs }),
        badges: async () => {
          called = true;
          return { openMatchFlags: { total: 9 } };
        },
      })
    );

    expect(called).toBe(false);
    expect(data.openFlagCount).toBe(0);
  });

  /* getMe() provisions the user row and claims pending invites, and the counts
     derive from the memberships it creates — so the badge request must not
     start until it has resolved, or a freshly-invited admin reports zero. */
  it('requests badges only after getMe has resolved', async () => {
    const order: string[] = [];
    await run(
      makeLocals({
        me: async () => {
          order.push('me:start');
          await new Promise((r) => setTimeout(r, 5));
          order.push('me:end');
          return { organizations: adminOrgs };
        },
        badges: async () => {
          order.push('badges:start');
          return { openMatchFlags: { total: 0 } };
        },
      })
    );

    expect(order).toEqual(['me:start', 'me:end', 'badges:start']);
  });

  it('degrades to 0 when the badge request fails, without failing the profile', async () => {
    const data = await run(
      makeLocals({
        me: async () => ({ organizations: adminOrgs, displayName: 'A' }),
        badges: async () => {
          throw new Error('badges down');
        },
      })
    );
    expect(data.openFlagCount).toBe(0);
    expect(data.profileLoadFailed).toBe(false);
  });

  /* A failed profile leaves no organizations, so there is no one to badge —
     the count must stay 0 rather than alerting a user who has no Admin entry
     to reach. */
  it('reports no count when the profile fails', async () => {
    let called = false;
    const data = await run(
      makeLocals({
        me: async () => {
          throw new Error('profile down');
        },
        badges: async () => {
          called = true;
          return { openMatchFlags: { total: 4 } };
        },
      })
    );

    expect(data.profileLoadFailed).toBe(true);
    expect(data.organizations).toEqual([]);
    expect(called).toBe(false);
    expect(data.openFlagCount).toBe(0);
  });

  /* A malformed profile payload must degrade like a failed request rather than
     throwing out of the layout and 500-ing every authenticated route. */
  it('degrades instead of throwing when the me payload is malformed', async () => {
    const data = await run(
      makeLocals({
        // organizations is not an array => `organizations.find(...)` throws.
        me: async () => ({ organizations: 'not-an-array' }),
      })
    );

    expect(data.profileLoadFailed).toBe(true);
    expect(data.organizations).toEqual([]);
  });
});
