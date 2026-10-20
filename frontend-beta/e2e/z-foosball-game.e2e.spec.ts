// The goal counter's critical path, end to end: the owner issues an
// enrolment token, two goal counters enrol with it and count a game on
// Table 2 through the device API, the phone's live view follows the score,
// and the finished game is claimed on "Who played?" and saved to the league.
// It saves a match and an enrolment token, so it runs last (z-) and leaves
// the earlier specs' seed untouched.
import { randomBytes } from 'node:crypto';
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

const API_URL = `http://localhost:${process.env.E2E_API_PORT ?? '8091'}`;
const TABLE_2 = 'f005ba11-0000-0000-0000-000000000002';
const TABLE_URL = `/test-org/test-league/tables/${TABLE_2}`;

// A counter at end A watches goal A, so its goals score for team B (Yellow).
const YELLOW_COUNTER = 'fb-0123456789ad';
const BLUE_COUNTER = 'fb-0123456789ae';

function goalCounter(
  request: APIRequestContext,
  deviceId: string,
  token: string
) {
  const headers = {
    'X-Device-Id': deviceId,
    Authorization: `Device ${randomBytes(32).toString('hex')}`,
    'X-Enrolment-Token': token,
  };
  const boot = randomBytes(4).toString('hex');
  let seq = 0;
  return {
    config: () =>
      request.get(`${API_URL}/api/v3/hardware/devices/${deviceId}/config`, {
        headers,
      }),
    goal: async () => {
      seq += 1;
      const response = await request.post(
        `${API_URL}/api/v3/hardware/goal-events`,
        {
          headers,
          data: {
            event_id: `${deviceId}-${boot}-${seq}`,
            device_id: deviceId,
            seq,
            occurred_at: new Date().toISOString(),
            uptime_ms: seq * 1000,
            table_id: TABLE_2,
            goal: deviceId === YELLOW_COUNTER ? 'A' : 'B',
            battery_mv: 3900,
            firmware_version: '0.1.0',
          },
        }
      );
      expect(response.status()).toBe(201);
    },
  };
}

async function pickPlayer(page: Page, displayName: string) {
  await page
    .locator('input[placeholder="Filter..."]')
    .first()
    .fill(displayName);
  await page
    .getByRole('option', { name: new RegExp(displayName) })
    .first()
    .click();
}

test('a game counted by the goal counters is followed live and saved', async ({
  page,
  request,
}) => {
  // The owner issues the token the counters enrol with.
  await page.goto('/admin/test-org/hardware');
  await page.getByRole('button', { name: 'Create token' }).click();
  const token = await page
    .getByRole('status')
    .filter({ hasText: 'New enrolment token' })
    .locator('code')
    .innerText();

  const yellow = goalCounter(request, YELLOW_COUNTER, token);
  const blue = goalCounter(request, BLUE_COUNTER, token);
  for (const counter of [yellow, blue]) {
    const config = await counter.config();
    expect(config.status()).toBe(200);
    expect(await config.json()).toMatchObject({
      role: 'goal',
      table_id: TABLE_2,
    });
  }

  // The first goal starts a new game; the phone follows it without a reload.
  await page.goto(TABLE_URL);
  const score = page.getByRole('region', { name: 'Live score' });
  await blue.goal();
  await expect(score).toContainText(/Blue\s*1\s*:\s*Yellow\s*0/);
  await yellow.goal();
  await yellow.goal();
  await expect(score).toContainText(/Blue\s*1\s*:\s*Yellow\s*2/);

  // Yellow reaches the league's winning score: the game finishes and waits
  // to be claimed.
  await blue.goal();
  await blue.goal();
  for (let i = 0; i < 8; i++) await yellow.goal();
  const finished = page.getByRole('link', { name: /Blue 3 – Yellow 10/ });
  await expect(finished).toBeVisible();

  await finished.click();
  await expect(page).toHaveURL(new RegExp(`/submit\\?table=${TABLE_2}&match=`));
  await expect(
    page.getByRole('heading', { name: 'Who played?' })
  ).toBeVisible();
  await pickPlayer(page, 'Alice Anderson');
  await pickPlayer(page, 'Bob Brown');
  await pickPlayer(page, 'Carol Carter');
  await pickPlayer(page, 'Dave Davies');
  await page.getByRole('button', { name: 'Save match' }).click();
  await expect(page).toHaveURL(/\/test-org\/test-league$/);

  // Saved: the table no longer offers the game for claiming.
  await page.goto(TABLE_URL);
  await expect(score).toBeVisible();
  await expect(finished).toHaveCount(0);
});
