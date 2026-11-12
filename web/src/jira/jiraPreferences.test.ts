import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferenceStore, STORAGE_KEY } from './jiraPreferences';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('PreferenceStore', () => {
  it('starts empty', () => {
    const store = new PreferenceStore();
    expect(store.lastProject()).toBeNull();
    expect(store.issueType('SCRUM', 'Bug')).toBeNull();
    expect(store.linkType('SCRUM')).toBeNull();
    expect(store.fields('SCRUM')).toEqual([]);
  });

  it('remembers choices per project and reads them back in a new store', () => {
    const store = new PreferenceStore();
    store.setProject('SCRUM');
    store.setIssueType('SCRUM', 'Bug', '10002');
    store.setIssueType('SCRUM', 'Feature', '10001');
    store.setLinkType('SCRUM', 'Blocks');
    store.setFields('SCRUM', ['priority', 'labels']);
    store.setIssueType('OPS', 'Bug', '20001');

    const again = new PreferenceStore();
    expect(again.lastProject()).toBe('SCRUM');
    expect(again.issueType('SCRUM', 'Bug')).toBe('10002');
    expect(again.issueType('SCRUM', 'Feature')).toBe('10001');
    expect(again.issueType('OPS', 'Bug')).toBe('20001');
    expect(again.issueType('OPS', 'Feature')).toBeNull();
    expect(again.linkType('SCRUM')).toBe('Blocks');
    expect(again.linkType('OPS')).toBeNull();
    expect(again.fields('SCRUM')).toEqual(['priority', 'labels']);
  });

  it('forgets everything, in memory and in storage', () => {
    const store = new PreferenceStore();
    store.setProject('SCRUM');
    store.setLinkType('SCRUM', 'Blocks');
    store.clear();

    expect(store.lastProject()).toBeNull();
    expect(store.linkType('SCRUM')).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(new PreferenceStore().lastProject()).toBeNull();
  });

  it('stores only keys, ids and names: no ticket text, values or credentials', () => {
    const store = new PreferenceStore();
    store.setProject('SCRUM');
    store.setIssueType('SCRUM', 'Bug', '10002');
    store.setLinkType('SCRUM', 'Relates');
    store.setFields('SCRUM', ['labels']);
    const raw = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(JSON.parse(raw)).toEqual({
      version: 1,
      lastProject: 'SCRUM',
      projects: { SCRUM: { issueTypes: { Bug: '10002' }, linkType: 'Relates', fields: ['labels'] } },
    });
  });

  it.each([['not json'], ['null'], ['[]'], ['{"version":2}'], ['{"version":1,"projects":5}'], ['{"version":1,"lastProject":7,"projects":{"A":{"fields":"x","linkType":3}}}']])(
    'ignores unusable stored data (%s)',
    (stored) => {
      localStorage.setItem(STORAGE_KEY, stored);
      const store = new PreferenceStore();
      expect(store.lastProject()).toBeNull();
      expect(store.fields('A')).toEqual([]);
      expect(store.linkType('A')).toBeNull();
    },
  );

  it('keeps only strings from stored lists', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, projects: { A: { fields: ['x', 3, null, 'y'] } } }));
    expect(new PreferenceStore().fields('A')).toEqual(['x', 'y']);
  });

  it('works without memory when reading storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = new PreferenceStore();
    store.setProject('SCRUM');
    expect(store.lastProject()).toBe('SCRUM');
  });

  it('works without memory when writing or clearing storage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = new PreferenceStore();
    expect(() => store.setLinkType('SCRUM', 'Blocks')).not.toThrow();
    expect(store.linkType('SCRUM')).toBe('Blocks');
    expect(() => store.clear()).not.toThrow();
    expect(store.linkType('SCRUM')).toBeNull();
  });

  it('does not fail when the storage object itself throws on access', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied');
    });
    const store = new PreferenceStore();
    expect(() => store.setProject('SCRUM')).not.toThrow();
    expect(() => store.clear()).not.toThrow();
  });
});
