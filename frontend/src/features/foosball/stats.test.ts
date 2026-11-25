import { expect, it } from 'vitest';
import { mmss, officeHoursText, percent, statText } from './stats';

const stat = (value: number | null, enough = true) => ({
  value,
  n: 3,
  minN: 10,
  enough,
});

it('formats percentages and durations', () => {
  expect(percent(0.234)).toBe('23%');
  expect(mmss(270)).toBe('4:30');
  expect(mmss(59.6)).toBe('1:00');
});

it('keeps the value but notes a small sample', () => {
  expect(statText(stat(0.5), percent)).toEqual({ text: '50%', note: null });
  expect(statText(stat(0.5, false), percent)).toEqual({
    text: '50%',
    note: 'Not enough games yet (3 of 10)',
  });
  expect(statText(stat(null, false), percent, 'weeks').text).toBe('–');
});

it('names the office hours', () => {
  const hours = { start: '08:00', end: '18:00' };
  expect(
    officeHoursText({ days: ['mon', 'tue', 'wed', 'thu', 'fri'], ...hours })
  ).toBe('Mon–Fri 08:00–18:00');
  expect(officeHoursText({ days: ['mon', 'wed'], ...hours })).toBe(
    'Mon, Wed 08:00–18:00'
  );
});
