import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { describeGenerationError } from './errorMessages';

const apiError = (code: string, status: number | null = 502, message = 'server text') =>
  new ApiError(code, status, message);

describe('describeGenerationError', () => {
  const codes = [
    'llm_refused',
    'llm_invalid_output',
    'llm_truncated',
    'llm_unavailable',
    'llm_timeout',
    'network_error',
    'unexpected_response',
  ];

  it.each(codes)('gives %s its own message without internals', (code) => {
    const { message } = describeGenerationError(apiError(code));
    expect(message.length).toBeGreaterThan(20);
    expect(message).not.toContain(code);
    expect(message).not.toContain('server text');
    expect(message).not.toMatch(/\b(HTTP|\d{3}|Claude|Anthropic|API key)\b/);
  });

  it('uses a different message for every code', () => {
    const messages = codes.map((code) => describeGenerationError(apiError(code)).message);
    expect(new Set(messages).size).toBe(codes.length);
  });

  it('offers Retry except when an identical retry cannot help', () => {
    for (const code of codes.filter((c) => c !== 'llm_refused')) {
      expect(describeGenerationError(apiError(code)).retryable, code).toBe(true);
    }
    expect(describeGenerationError(apiError('llm_refused', 422)).retryable).toBe(false);
  });

  it('tells the user to shorten the report when the answer was truncated', () => {
    expect(describeGenerationError(apiError('llm_truncated')).message).toMatch(/shorter/i);
  });

  it('tells the user to edit the transcript when the request was refused', () => {
    expect(describeGenerationError(apiError('llm_refused', 422)).message).toMatch(/edit/i);
  });

  it('keeps the server message for validation errors and offers no Retry', () => {
    const result = describeGenerationError(apiError('validation', 400, 'The transcript must be at least 20 characters.'));
    expect(result).toEqual({ message: 'The transcript must be at least 20 characters.', retryable: false });
  });

  it('falls back to a generic retryable message for unknown codes and other errors', () => {
    for (const failure of [apiError('something_new'), new Error('boom'), 'text', null]) {
      const result = describeGenerationError(failure);
      expect(result.message).toBe('Something went wrong. Please try again.');
      expect(result.retryable).toBe(true);
    }
  });
});
