import type { JiraSchema } from '../jiraContract';
import type { JiraField } from './jiraApi';

/** What the user has typed or picked for a field: a string, or a list for `options` and `labels`. */
export type FieldDraft = string | string[];

type FieldValue = JiraSchema['fieldValue'];

export const isSupportedKind = (kind: JiraField['kind']): boolean => kind !== 'unsupported';

/** Required fields without a default: the ones Create cannot skip. */
export function blockingFields(fields: JiraField[]): JiraField[] {
  return fields.filter((field) => field.required && !field.hasDefaultValue);
}

/** Optional fields (or required ones with a default) of a supported kind, which "Add field" offers. */
export function addableFields(fields: JiraField[]): JiraField[] {
  return fields.filter((field) => isSupportedKind(field.kind) && !(field.required && !field.hasDefaultValue));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The typed value for a draft, or null when the draft is empty, invalid or has the wrong shape for the kind. */
export function toFieldValue(field: JiraField, draft: FieldDraft | undefined): FieldValue | null {
  if (draft === undefined) return null;
  switch (field.kind) {
    case 'text':
    case 'textarea': {
      if (typeof draft !== 'string' || draft.trim() === '') return null;
      return { kind: field.kind, value: field.kind === 'text' ? draft.trim() : draft };
    }
    case 'number': {
      if (typeof draft !== 'string' || draft.trim() === '') return null;
      const value = Number(draft);
      return Number.isFinite(value) ? { kind: 'number', value } : null;
    }
    case 'date':
      return typeof draft === 'string' && DATE.test(draft) ? { kind: 'date', value: draft } : null;
    case 'option':
      return typeof draft === 'string' && draft !== '' ? { kind: 'option', id: draft } : null;
    case 'options':
      return Array.isArray(draft) && draft.length > 0 ? { kind: 'options', ids: draft } : null;
    case 'labels':
      return Array.isArray(draft) && draft.length > 0 ? { kind: 'labels', values: draft } : null;
    default:
      return null;
  }
}

export const isFilled = (field: JiraField, draft: FieldDraft | undefined): boolean => toFieldValue(field, draft) !== null;
