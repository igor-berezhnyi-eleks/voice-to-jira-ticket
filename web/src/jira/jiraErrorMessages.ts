import { JiraApiError } from './jiraApi';

export type JiraAction = 'load' | 'create' | 'connect';

export interface JiraErrorDescription {
  message: string;
  /** Whether the same call can plausibly work if repeated. */
  retryable: boolean;
  /** The session is gone: show the Connect panel. */
  authRequired: boolean;
}

const generic = 'Something went wrong. Please try again.';

/** Turns a failed Jira call into the text Page 3 shows. Never shows codes, statuses or the token. */
export function describeJiraError(error: unknown, action: JiraAction): JiraErrorDescription {
  const result = (message: string, retryable: boolean, authRequired = false): JiraErrorDescription => ({
    message,
    retryable,
    authRequired,
  });
  if (!(error instanceof JiraApiError)) return result(generic, true);

  switch (error.code) {
    case 'jira_auth_required':
      return result('Your Jira session has ended. Connect again; your entries are kept.', false, true);
    case 'jira_auth_denied':
      return result('Jira did not accept this email and token. Use a token without scopes.', false);
    case 'jira_forbidden':
      return result('Your Jira account cannot do this in this project.', false);
    case 'jira_not_found':
      return result('Jira could not find that project or issue, or your account cannot see it.', false);
    case 'jira_rejected':
      return result('Jira did not accept the issue. See the messages below.', false);
    case 'jira_rate_limited':
      return result(
        error.retryAfterSeconds ? `Jira is busy. Try again in ${error.retryAfterSeconds} seconds.` : 'Jira is busy. Try again in a moment.',
        true,
      );
    case 'jira_timeout':
      return action === 'create'
        ? result('The issue may have been created. Check Jira before trying again.', false)
        : result('Could not reach Jira.', true);
    case 'jira_unavailable':
    case 'network_error':
      return result('Could not reach Jira.', true);
    case 'jira_not_configured':
      return result('Jira is not configured.', false);
    case 'validation':
      return result(error.message, false);
    default:
      return result(generic, true);
  }
}
