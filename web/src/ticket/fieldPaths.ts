import type { Ticket } from '../api';

export type FieldPath =
  | 'title'
  | 'description'
  | 'bug.stepsToReproduce'
  | 'bug.actualResult'
  | 'bug.expectedResult'
  | 'bug.environment'
  | 'feature.userNeed'
  | 'feature.proposedBehavior'
  | 'feature.acceptanceCriteria';

export interface FieldInfo {
  path: FieldPath;
  label: string;
  kind: 'line' | 'text' | 'list';
}

const common: FieldInfo[] = [
  { path: 'title', label: 'Title', kind: 'line' },
  { path: 'description', label: 'Description', kind: 'text' },
];

const bugFields: FieldInfo[] = [
  { path: 'bug.stepsToReproduce', label: 'Steps to reproduce', kind: 'list' },
  { path: 'bug.actualResult', label: 'Actual result', kind: 'text' },
  { path: 'bug.expectedResult', label: 'Expected result', kind: 'text' },
  { path: 'bug.environment', label: 'Environment / platform', kind: 'text' },
];

const featureFields: FieldInfo[] = [
  { path: 'feature.userNeed', label: 'User or business need', kind: 'text' },
  { path: 'feature.proposedBehavior', label: 'Proposed behavior', kind: 'text' },
  { path: 'feature.acceptanceCriteria', label: 'Acceptance criteria', kind: 'list' },
];

/** The fields shown for a ticket type, in display order. */
export function fieldsFor(type: Ticket['type']): FieldInfo[] {
  return [...common, ...(type === 'Bug' ? bugFields : featureFields)];
}

/** True when `path` (a `missingInformation.field` value) is a field of this ticket type. */
export function isFieldOf(type: Ticket['type'], path: string): path is FieldPath {
  return fieldsFor(type).some((field) => field.path === path);
}

/** The DOM id of the control (text fields) or the group (list fields) for a path. */
export function controlId(path: FieldPath): string {
  return `field-${path.replace('.', '-')}`;
}
