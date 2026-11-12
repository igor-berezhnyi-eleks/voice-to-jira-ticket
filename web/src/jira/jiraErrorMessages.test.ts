import { describe, expect, it } from 'vitest';
import { JiraApiError } from './jiraApi';
import { describeJiraError } from './jiraErrorMessages';

const error = (code: string, extras = {}) => new JiraApiError(code, 400, 'server text', extras);

describe('describeJiraError', () => {
  it('maps an expired session to the Connect panel', () => {
    const d = describeJiraError(error('jira_auth_required'), 'load');
    expect(d.authRequired).toBe(true);
    expect(d.retryable).toBe(false);
  });

  it('gives the token hint when the login is denied', () => {
    expect(describeJiraError(error('jira_auth_denied'), 'connect').message).toContain('without scopes');
  });

  it('says the issue may exist after a create timeout, but not after a load timeout', () => {
    expect(describeJiraError(error('jira_timeout'), 'create')).toMatchObject({ retryable: false });
    expect(describeJiraError(error('jira_timeout'), 'create').message).toContain('may have been created');
    expect(describeJiraError(error('jira_timeout'), 'load')).toMatchObject({ message: 'Could not reach Jira.', retryable: true });
  });

  it('allows Try again for unavailable and network errors', () => {
    expect(describeJiraError(error('jira_unavailable'), 'load').retryable).toBe(true);
    expect(describeJiraError(error('network_error'), 'load').retryable).toBe(true);
  });

  it('uses the retry delay when Jira sent one', () => {
    expect(describeJiraError(error('jira_rate_limited', { retryAfterSeconds: 12 }), 'create').message).toContain('12 seconds');
    expect(describeJiraError(error('jira_rate_limited'), 'create').message).toBe('Jira is busy. Try again in a moment.');
  });

  it('covers forbidden, not found and rejected without server text', () => {
    for (const code of ['jira_forbidden', 'jira_not_found', 'jira_rejected']) {
      const d = describeJiraError(error(code), 'create');
      expect(d.message).not.toContain('server text');
      expect(d.retryable).toBe(false);
    }
  });

  it('falls back to a generic message for unknown codes and non-API errors', () => {
    expect(describeJiraError(error('weird'), 'load').message).toBe('Something went wrong. Please try again.');
    expect(describeJiraError(new Error('x'), 'load').retryable).toBe(true);
  });
});
