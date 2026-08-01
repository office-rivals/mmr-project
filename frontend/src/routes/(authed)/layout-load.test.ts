import { describe, expect, it } from 'vitest';
import { load } from './+layout.server';

type Locals = Parameters<typeof load>[0]['locals'];

function makeLocals(opts: {
  me?: () => Promise<unknown>;
  badges?: () => Promise<unknown>;
}): Locals {
  return {
    auth: () => ({ userId: 'user-1', getToken: async () => 't' }),
    apiClientV3: {
      meApi: {
        getMe: opts.me ?? (async () => ({ organizations: [] })),
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
  it('surfaces the badge total from getBadges', async () => {
    const data = await run(
      makeLocals({
        me: async () => ({
          organizations: [],
          displayName: 'A',
          username: 'a',
        }),
        badges: async () => ({ openMatchFlags: { total: 7 } }),
      })
    );
    expect(data.openFlagCount).toBe(7);
  });

  it('degrades to 0 when getBadges rejects, without failing the profile', async () => {
    const data = await run(
      makeLocals({
        me: async () => ({
          organizations: [],
          displayName: 'A',
          username: 'a',
        }),
        badges: async () => {
          throw new Error('badges down');
        },
      })
    );
    expect(data.openFlagCount).toBe(0);
    expect(data.profileLoadFailed).toBe(false);
  });

  /* If getMe fails while getBadges succeeds, the load yields a count with no
     organizations. header.svelte must not paint the alert dot in that state —
     it gates on `hasAdminAccess && openFlagCount > 0`, and `hasAdminAccess`
     derives from these (empty) organizations. */
  it('getMe failing while getBadges succeeds yields count>0 with no orgs', async () => {
    const data = await run(
      makeLocals({
        me: async () => {
          throw new Error('profile down');
        },
        badges: async () => ({ openMatchFlags: { total: 4 } }),
      })
    );

    expect(data.profileLoadFailed).toBe(true);
    expect(data.organizations).toEqual([]); // => hasAdminAccess === false
    expect(data.openFlagCount).toBe(4);
  });

  /* A malformed profile payload must degrade like a failed request rather than
     throwing out of the layout and 500-ing every authenticated route. */
  it('degrades instead of throwing when the me payload is malformed', async () => {
    const data = await run(
      makeLocals({
        // organizations is not an array => `organizations.find(...)` throws.
        me: async () => ({ organizations: 'not-an-array' }),
        badges: async () => ({ openMatchFlags: { total: 0 } }),
      })
    );

    expect(data.profileLoadFailed).toBe(true);
    expect(data.organizations).toEqual([]);
  });
});
