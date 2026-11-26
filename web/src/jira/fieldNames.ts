import type { Dictionary } from '../i18n/en';
import type { JiraField } from './jiraApi';

/**
 * The Jira system fields the app names itself (L10). Matched by `fieldId`, never by Jira's name, because Jira
 * sends names in the Jira user's own language and Server/Data Center spells some differently ("Fix Version/s").
 */
export const systemFieldIds = [
  'priority',
  'environment',
  'labels',
  'components',
  'fixVersions',
  'versions',
  'duedate',
  'assignee',
  'reporter',
  'timetracking',
] as const;

export type SystemFieldId = (typeof systemFieldIds)[number];

/** Names by system field id, one set per dictionary. */
export type JiraFieldNames = Record<SystemFieldId, string>;

const isSystemFieldId = (id: string): id is SystemFieldId => (systemFieldIds as readonly string[]).includes(id);

/**
 * The name shown for a field: the dictionary's name for a known system field, so the label follows the app's
 * language rather than the Jira account's; otherwise Jira's name (custom fields and other system fields).
 * Only the label changes; the id sent to Jira stays the same.
 */
export function fieldName(field: Pick<JiraField, 'fieldId' | 'name'>, t: Dictionary): string {
  return isSystemFieldId(field.fieldId) ? t.jira.fieldNames[field.fieldId] : field.name;
}
