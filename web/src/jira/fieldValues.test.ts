import { describe, expect, it } from 'vitest';
import { blockingFields, isFilled, isSupportedKind, toFieldValue, type FieldDraft } from './fieldValues';
import type { JiraField } from './jiraApi';

const field = (kind: JiraField['kind'], extra: Partial<JiraField> = {}): JiraField => ({
  fieldId: 'f',
  name: 'F',
  required: true,
  hasDefaultValue: false,
  kind,
  allowedValues: null,
  ...extra,
});

describe('toFieldValue', () => {
  const valid: [JiraField['kind'], FieldDraft, unknown][] = [
    ['text', ' hello ', { kind: 'text', value: 'hello' }],
    ['textarea', 'a\nb', { kind: 'textarea', value: 'a\nb' }],
    ['number', '12.5', { kind: 'number', value: 12.5 }],
    ['date', '2026-11-12', { kind: 'date', value: '2026-11-12' }],
    ['option', '3', { kind: 'option', id: '3' }],
    ['options', ['1', '2'], { kind: 'options', ids: ['1', '2'] }],
    ['labels', ['a', 'b'], { kind: 'labels', values: ['a', 'b'] }],
  ];
  it.each(valid)('turns a %s draft into its typed value', (kind, draft, expected) => {
    expect(toFieldValue(field(kind), draft)).toEqual(expected);
  });

  const invalid: [JiraField['kind'], FieldDraft][] = [
    ['text', ''],
    ['text', '   '],
    ['number', ''],
    ['number', 'abc'],
    ['date', ''],
    ['date', '12/11/2026'],
    ['option', ''],
    ['options', []],
    ['labels', []],
    ['unsupported', 'x'],
  ];
  it.each(invalid)('gives no value for an empty or invalid %s draft (%j)', (kind, draft) => {
    expect(toFieldValue(field(kind), draft)).toBeNull();
    expect(isFilled(field(kind), draft)).toBe(false);
  });

  it('gives no value when the draft has the wrong shape for the kind', () => {
    expect(toFieldValue(field('options'), '1')).toBeNull();
    expect(toFieldValue(field('text'), ['a'])).toBeNull();
  });

  it('accepts zero and negative numbers', () => {
    expect(toFieldValue(field('number'), '0')).toEqual({ kind: 'number', value: 0 });
    expect(toFieldValue(field('number'), '-3')).toEqual({ kind: 'number', value: -3 });
  });
});

describe('blockingFields', () => {
  it('returns required fields without a default only', () => {
    const fields = [
      field('text', { fieldId: 'a' }),
      field('text', { fieldId: 'b', hasDefaultValue: true }),
      field('text', { fieldId: 'c', required: false }),
      field('unsupported', { fieldId: 'd' }),
    ];
    expect(blockingFields(fields).map((f) => f.fieldId)).toEqual(['a', 'd']);
  });
});

describe('isSupportedKind', () => {
  it('is false only for unsupported', () => {
    expect(isSupportedKind('unsupported')).toBe(false);
    expect(isSupportedKind('labels')).toBe(true);
  });
});
