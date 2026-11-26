import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { uk } from '../i18n/uk';
import { fieldName, systemFieldIds } from './fieldNames';

const field = (fieldId: string, name: string) => ({ fieldId, name });

describe('fieldName', () => {
  it('names known system fields from the Ukrainian dictionary, by id', () => {
    expect(fieldName(field('priority', 'Priority'), uk)).toBe('Пріоритет');
    expect(fieldName(field('environment', 'Environment'), uk)).toBe('Середовище');
    // Matched by id, so a Server spelling or a Jira account in another language gets the same name.
    expect(fieldName(field('fixVersions', 'Fix Version/s'), uk)).toBe(uk.jira.fieldNames.fixVersions);
    expect(fieldName(field('priority', 'Priorität'), uk)).toBe('Пріоритет');
  });

  it('has a Ukrainian name for every listed id', () => {
    for (const id of systemFieldIds) {
      const name = fieldName(field(id, id), uk);
      expect(name, id).toMatch(/[а-яіїєґ]/i);
    }
  });

  it('uses the same English words in English, whatever Jira sends', () => {
    expect(fieldName(field('priority', 'Priority'), en)).toBe('Priority');
    expect(fieldName(field('environment', 'Environment'), en)).toBe('Environment');
    // Server / Data Center and other Jira languages get the Cloud spelling.
    expect(fieldName(field('fixVersions', 'Fix Version/s'), en)).toBe('Fix versions');
    expect(fieldName(field('priority', 'Priorität'), en)).toBe('Priority');
  });

  it('keeps Jira’s name for custom fields and unlisted system fields', () => {
    expect(fieldName(field('customfield_10020', 'Severity'), uk)).toBe('Severity');
    expect(fieldName(field('security', 'Security Level'), uk)).toBe('Security Level');
    // Only the id counts: a custom field called "Priority" keeps that name.
    expect(fieldName(field('customfield_1', 'Priority'), uk)).toBe('Priority');
  });
});
