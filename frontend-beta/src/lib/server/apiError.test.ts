import { describe, expect, it } from 'vitest';
import { ResponseError } from '@/api-v3';
import { getApiErrorDetails, getFormActionFailure } from './apiError';

const problem = (status: number, detail: string) =>
  new ResponseError(
    new Response(JSON.stringify({ status, title: 'Error', detail }), {
      status,
      headers: { 'content-type': 'application/problem+json' },
    })
  );

describe('getApiErrorDetails', () => {
  it('keeps a conflict so the user is told to reload', async () => {
    const details = await getApiErrorDetails(
      problem(
        409,
        'The request conflicted with another update. Reload and retry.'
      ),
      'Failed to update role'
    );

    expect(details).toEqual({
      status: 409,
      message: 'The request conflicted with another update. Reload and retry.',
    });
  });

  it.each([
    'Multiple organization members match this email. Select an existing player instead.',
    "The slug 'claim' is reserved and cannot be used",
  ])('passes a validation failure through: %s', async (detail) => {
    expect(await getApiErrorDetails(problem(400, detail), 'Failed')).toEqual({
      status: 400,
      message: detail,
    });
  });

  it('falls back to the message when the problem has no detail', async () => {
    const error = new ResponseError(
      new Response(JSON.stringify({ title: 'One or more errors occurred.' }), {
        status: 400,
      })
    );

    expect(
      await getApiErrorDetails(error, 'Failed to submit claim request')
    ).toEqual({ status: 400, message: 'Failed to submit claim request' });
  });

  it('uses a plain-text body', async () => {
    const error = new ResponseError(
      new Response('Too many requests', { status: 429 })
    );

    expect(await getApiErrorDetails(error, 'Failed')).toEqual({
      status: 429,
      message: 'Too many requests',
    });
  });

  it('reports a failure without a response as a 500', async () => {
    expect(
      await getApiErrorDetails(new TypeError('fetch failed'), 'Failed')
    ).toEqual({ status: 500, message: 'Failed' });
  });
});

describe('getFormActionFailure', () => {
  it('keeps fixed copy for the native document and the API reason for the page', async () => {
    const failure = await getFormActionFailure(
      problem(400, "A member with email 'x@example.com' already exists"),
      'Failed to invite member'
    );

    expect(failure).toEqual({
      status: 400,
      error: 'Failed to invite member',
      detail: "A member with email 'x@example.com' already exists",
    });
  });

  it('carries a conflict through with its status', async () => {
    const failure = await getFormActionFailure(
      problem(409, 'This claim request was already decided as Rejected.'),
      'Failed to reject claim request'
    );

    expect(failure.status).toBe(409);
    expect(failure.detail).toBe(
      'This claim request was already decided as Rejected.'
    );
  });

  it('falls back to the fixed copy when the API gives no reason', async () => {
    expect(
      await getFormActionFailure(new TypeError('fetch failed'), 'Failed')
    ).toEqual({ status: 500, error: 'Failed', detail: 'Failed' });
  });
});
