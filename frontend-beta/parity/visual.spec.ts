import playwright from '../../frontend/node_modules/@playwright/test/index.js';
const { test, expect } =
  playwright as unknown as typeof import('../../frontend/node_modules/@playwright/test/index.js');
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs/promises';

const league = '/test-org/test-league';
const admin = '/admin/test-org/leagues/test-league';
import type { Scene } from './types';
import { emptyScenes } from './empty-scenes';
import { playScenes } from './play-scenes';
import { displayScenes } from './display-scenes';
import { pendingScenes } from './pending-scenes';
import { additionalScenes } from './additional-scenes';
const scenes: Scene[] = [
  ...emptyScenes,
  ...playScenes,
  ...displayScenes,
  ...pendingScenes,
  ...additionalScenes,
  { name: 'home', route: '/' },
  { name: 'organization', route: '/test-org' },
  { name: 'organization-settings', route: '/test-org/settings' },
  { name: 'leaderboard', route: league },
  {
    name: 'leaderboard-season-picker',
    route: league,
    open: async (p) => {
      await p.getByLabel('Select a season').click();
    },
  },
  {
    name: 'player-stats-dialog',
    route: league,
    open: async (p) => {
      await p
        .getByRole('table')
        .first()
        .locator('tbody tr')
        .filter({ hasText: 'tuser' })
        .click();
      await expect(p.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'report-match-dialog',
    route: league,
    open: async (p) => {
      await p
        .getByRole('button', { name: 'Report match', exact: true })
        .click();
      await expect(
        p.getByRole('dialog').locator('button.w-full.rounded-lg.border').first()
      ).toBeVisible();
    },
  },
  { name: 'submit', route: `${league}/submit` },
  { name: 'matchmaking-active', route: `${league}/matchmaking` },
  { name: 'matchmaking-empty', route: '/test-org/singles-league/matchmaking' },
  {
    name: 'active-match',
    route: `${league}/active-match/eeeeeeee-0000-0000-0000-000000000005`,
  },
  { name: 'empty-leaderboard', route: '/test-org/empty-league' },
  { name: 'empty-statistics', route: '/test-org/empty-league/statistics' },
  {
    name: 'empty-admin-matches',
    route: '/admin/test-org/leagues/empty-league/matches',
  },
  {
    name: 'empty-admin-flags',
    route: '/admin/test-org/leagues/empty-league/match-flags',
  },
  {
    name: 'empty-admin-seasons',
    route: '/admin/test-org/leagues/empty-league/seasons',
  },
  { name: 'statistics', route: `${league}/statistics` },
  {
    name: 'profile',
    route: `${league}/player/66666666-6666-6666-6666-666666666601`,
  },
  { name: 'singles', route: '/test-org/singles-league' },
  { name: 'random', route: '/random' },
  { name: 'settings', route: '/settings' },
  { name: 'join', route: '/join' },
  { name: 'join-invitation', route: '/join/VIZUAL23456' },
  { name: 'join-invalid', route: '/join/invalid-parity-code' },
  { name: 'admin', route: '/admin' },
  { name: 'admin-organization', route: '/admin/test-org' },
  { name: 'admin-leagues', route: '/admin/test-org/leagues' },
  { name: 'admin-league', route: admin },
  { name: 'admin-matches', route: `${admin}/matches` },
  {
    name: 'admin-edit-match-dialog',
    route: `${admin}/matches`,
    open: async (p) => {
      await p
        .getByRole('button', { name: 'Edit', exact: true })
        .first()
        .click();
      await expect(p.getByRole('dialog')).toBeVisible();
    },
  },
  { name: 'admin-match-flags', route: `${admin}/match-flags` },
  { name: 'admin-seasons', route: `${admin}/seasons` },
  { name: 'admin-members', route: '/admin/test-org/members' },
  {
    name: 'header-leagues-menu',
    route: league,
    open: async (p) => {
      await p
        .getByRole('button', { name: 'Switch organization or league' })
        .click();
      await expect(p.getByRole('menu')).toBeVisible();
    },
  },
  {
    name: 'header-settings-menu',
    route: league,
    open: async (p) => {
      await p.getByRole('button', { name: /Settings menu/ }).click();
      await expect(p.getByRole('menu')).toBeVisible();
    },
  },
  {
    name: 'report-reason-dialog',
    route: league,
    open: async (p) => {
      await p
        .getByRole('button', { name: 'Report match', exact: true })
        .click();
      await p
        .getByRole('dialog')
        .locator('button.w-full.rounded-lg.border:not(.border-red-400)')
        .first()
        .click();
      await expect(
        p.getByPlaceholder('Describe why this match should be reviewed...')
      ).toBeVisible();
    },
  },
  {
    name: 'new-player-dialog',
    route: `${league}/submit`,
    open: async (p) => {
      const input = p.getByPlaceholder('Filter...').first();
      await input.pressSequentially('zzzzznoplayer');
      await p
        .getByRole('button', { name: 'Add new player', exact: true })
        .click();
      await expect(p.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'profile-flag-dialog',
    route: `${league}/player/66666666-6666-6666-6666-666666666601`,
    open: async (p) => {
      await p.getByTitle('Flag this match', { exact: true }).first().click();
      await expect(p.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'token-create-form',
    route: '/settings',
    open: async (p) => {
      await p.getByRole('button', { name: 'Create New Token' }).click();
      await expect(p.getByPlaceholder('e.g., My API Token')).toBeVisible();
    },
  },
  {
    name: 'admin-league-create-form',
    route: '/admin/test-org/leagues',
    open: async (p) => {
      await p.getByRole('button', { name: 'New league', exact: true }).click();
      await expect(
        p.getByRole('button', { name: 'Create league', exact: true })
      ).toBeVisible();
    },
  },
  {
    name: 'admin-season-create-form',
    route: `${admin}/seasons`,
    open: async (p) => {
      await p.getByRole('button', { name: 'New season', exact: true }).click();
      await expect(
        p.getByRole('button', { name: 'Create season', exact: true })
      ).toBeVisible();
    },
  },
  {
    name: 'admin-invite-link-form',
    route: '/admin/test-org/members',
    open: async (p) => {
      await p.getByRole('button', { name: 'Create Invite Link' }).click();
      await expect(
        p.getByRole('button', { name: 'Create', exact: true })
      ).toBeVisible();
    },
  },
  { name: 'login', route: '/login', anonymous: true },
  { name: 'signup', route: '/sign-up', anonymous: true },
];

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  for (const scene of scenes) {
    test(`${viewport.width} ${scene.name}`, async ({ browser }, testInfo) => {
      test.setTimeout(60_000);
      const images: Buffer[] = [];
      for (const [app, port] of [
        ['reference', process.env.E2E_PORT ?? '5180'],
        ['beta', process.env.PARITY_BETA_PORT ?? '5181'],
      ] as const) {
        const context = await browser.newContext({
          ...testInfo.project.use,
          viewport,
          storageState: scene.anonymous
            ? { cookies: [], origins: [] }
            : testInfo.project.use.storageState,
        });
        const page = await context.newPage();
        const target = `http://localhost:${port}${scene.route}`;
        const response = await page.goto(target);
        expect(
          response?.status(),
          `Unexpected document status for ${scene.name}`
        ).toBeLessThan(400);
        await page.waitForLoadState('networkidle');
        // Clerk can renew an expired saved session after the server redirects.
        if (!scene.anonymous && new URL(page.url()).pathname !== scene.route) {
          await page.goto(target);
        }
        await expect(page).toHaveURL(target);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        await expect(page.locator('body')).not.toBeEmpty();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(500);
        if (scene.open) await scene.open(page);
        // Carbon animates after its initial render; wait for its final geometry.
        await page.waitForTimeout(800);
        if (process.env.PARITY_DOM) {
          const geometry = await page.evaluate(() => {
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT
            );
            const text: unknown[] = [];
            while (walker.nextNode()) {
              const node = walker.currentNode;
              if (
                !node.textContent?.trim() ||
                !node.parentElement ||
                ['SCRIPT', 'STYLE'].includes(node.parentElement.tagName)
              )
                continue;
              const range = document.createRange();
              range.selectNodeContents(node);
              const box = range.getBoundingClientRect();
              const style = getComputedStyle(node.parentElement);
              text.push({
                text: node.textContent,
                box: box.toJSON(),
                tag: node.parentElement.tagName,
                classes: node.parentElement.className,
                font: style.font,
                letterSpacing: style.letterSpacing,
              });
            }
            return {
              text,
              svg: Array.from(document.querySelectorAll('svg')).map((svg) => ({
                box: svg.getBoundingClientRect().toJSON(),
                html: svg.outerHTML,
              })),
            };
          });
          await fs.writeFile(
            testInfo.outputPath(`${app}-geometry.json`),
            JSON.stringify(geometry, null, 2)
          );
        }
        const buffer = await page.screenshot({
          fullPage: true,
          animations: 'disabled',
          caret: 'hide',
          mask: scene.mask?.map((selector) => page.locator(selector)),
          maskColor: '#808080',
        });
        images.push(buffer);
        await testInfo.attach(app, { body: buffer, contentType: 'image/png' });
        await fs.writeFile(testInfo.outputPath(`${app}.png`), buffer);
        if (
          !scene.anonymous &&
          typeof testInfo.project.use.storageState === 'string'
        ) {
          const authPath = testInfo.project.use.storageState;
          const state = JSON.parse(await fs.readFile(authPath, 'utf8'));
          // Carry renewed cookies forward without carrying scene-specific local storage.
          state.cookies = (await context.storageState()).cookies;
          await fs.writeFile(authPath, JSON.stringify(state));
        }
        await context.close();
      }
      const [reference, beta] = images.map((buffer) => PNG.sync.read(buffer));
      const width = Math.max(reference.width, beta.width);
      const height = Math.max(reference.height, beta.height);
      const padded = [reference, beta].map((source) => {
        const target = new PNG({ width, height });
        PNG.bitblt(source, target, 0, 0, source.width, source.height, 0, 0);
        return target;
      });
      const diff = new PNG({ width, height });
      const pixels = pixelmatch(
        padded[0].data,
        padded[1].data,
        diff.data,
        width,
        height,
        { threshold: 0.1 }
      );
      const buffer = PNG.sync.write(diff);
      await fs.writeFile(testInfo.outputPath('diff.png'), buffer);
      await testInfo.attach('diff', { body: buffer, contentType: 'image/png' });
      await fs.writeFile(
        testInfo.outputPath('metrics.json'),
        JSON.stringify(
          {
            scene: scene.name,
            viewport,
            pixels,
            total: width * height,
            reference: { width: reference.width, height: reference.height },
            beta: { width: beta.width, height: beta.height },
          },
          null,
          2
        )
      );
      expect(
        pixels,
        `${pixels} differing pixels; see reference.png, beta.png and diff.png`
      ).toBe(0);
    });
  }
}
