import { expect, it } from 'vitest';
import { rosterMessage } from './badges';

it('words the roster result for you or for the player you linked', () => {
  expect(rosterMessage('Joined', 'Table 1', null)).toBe(
    "You're in the game on Table 1."
  );
  expect(rosterMessage('Joined', 'Table 1', 'Alice')).toBe(
    'Alice is in the game on Table 1.'
  );
  expect(rosterMessage('Busy', 'Table 1', 'Alice')).toBe(
    "Alice is playing at another table, so they didn't join Table 1."
  );
});
