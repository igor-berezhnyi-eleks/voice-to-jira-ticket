import { describe, expect, it } from 'vitest';
import { controlId, fieldsFor, isFieldOf } from './fieldPaths';

describe('fieldPaths', () => {
  it('lists the fields of a Bug in display order', () => {
    expect(fieldsFor('Bug').map((field) => field.path)).toEqual([
      'title',
      'description',
      'bug.stepsToReproduce',
      'bug.actualResult',
      'bug.expectedResult',
      'bug.environment',
    ]);
  });

  it('lists the fields of a Feature in display order', () => {
    expect(fieldsFor('Feature').map((field) => field.path)).toEqual([
      'title',
      'description',
      'feature.userNeed',
      'feature.proposedBehavior',
      'feature.acceptanceCriteria',
    ]);
  });

  it('marks the list fields', () => {
    const lists = [...fieldsFor('Bug'), ...fieldsFor('Feature')].filter((field) => field.kind === 'list');

    expect(lists.map((field) => field.path)).toEqual(['bug.stepsToReproduce', 'feature.acceptanceCriteria']);
  });

  it('accepts only paths of the ticket type', () => {
    expect(isFieldOf('Bug', 'bug.environment')).toBe(true);
    expect(isFieldOf('Bug', 'feature.userNeed')).toBe(false);
    expect(isFieldOf('Feature', 'title')).toBe(true);
    expect(isFieldOf('Feature', 'type')).toBe(false);
    expect(isFieldOf('Bug', 'bug.unknown')).toBe(false);
  });

  it('builds a DOM id that is valid and distinct per path', () => {
    expect(controlId('bug.environment')).toBe('field-bug-environment');
    expect(controlId('title')).toBe('field-title');
  });
});
