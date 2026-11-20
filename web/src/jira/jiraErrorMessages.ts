import { en, type Dictionary } from '../i18n/en';
import { JiraApiError } from './jiraApi';

export type JiraAction = 'load' | 'create' | 'connect';

export interface JiraErrorDescription {
  message: string;
  /** Whether the same call can plausibly work if repeated. */
  retryable: boolean;
  /** The session is gone: show the Connect panel. */
  authRequired: boolean;
}

/** Turns a failed Jira call into the text Page 3 shows. Never shows codes, statuses or the token. */
export function describeJiraError(error: unknown, action: JiraAction, t: Dictionary = en): JiraErrorDescription {
  const texts = t.jiraErrors;
  const result = (message: string, retryable: boolean, authRequired = false): JiraErrorDescription => ({
    message,
    retryable,
    authRequired,
  });
  if (!(error instanceof JiraApiError)) return result(texts.generic, true);

  switch (error.code) {
    case 'jira_auth_required':
      return result(texts.authRequired, false, true);
    case 'jira_auth_denied':
      return result(texts.authDenied, false);
    case 'jira_forbidden':
      return result(texts.forbidden, false);
    case 'jira_not_found':
      return result(texts.notFound, false);
    case 'jira_rejected':
      return result(texts.rejected, false);
    case 'jira_rate_limited':
      return result(texts.rateLimited(error.retryAfterSeconds), true);
    case 'jira_timeout':
      return action === 'create'
        ? result(texts.createTimeout, false)
        : result(texts.unreachable, true);
    case 'jira_unavailable':
    case 'network_error':
      return result(texts.unreachable, true);
    case 'jira_not_configured':
      return result(texts.notConfigured, false);
    case 'validation':
      return result(error.message, false);
    default:
      return result(texts.generic, true);
  }
}
