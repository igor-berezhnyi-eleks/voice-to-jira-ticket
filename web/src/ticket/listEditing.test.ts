import { describe, expect, it } from 'vitest';
import { addItem, moveItem, removeItem, updateItem } from './listEditing';

describe('listEditing', () => {
  it('adds an item at the end without changing the input', () => {
    const items = ['a', 'b'];

    expect(addItem(items, 'c')).toEqual(['a', 'b', 'c']);
    expect(items).toEqual(['a', 'b']);
  });

  it('removes the item at an index', () => {
    const items = ['a', 'b', 'c'];

    expect(removeItem(items, 1)).toEqual(['a', 'c']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('removes the last remaining item', () => {
    expect(removeItem(['a'], 0)).toEqual([]);
  });

  it('updates the item at an index', () => {
    const items = ['a', 'b'];

    expect(updateItem(items, 1, 'x')).toEqual(['a', 'x']);
    expect(items).toEqual(['a', 'b']);
  });

  it('moves an item up and down', () => {
    const items = ['a', 'b', 'c'];

    expect(moveItem(items, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(items, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('leaves the list as it is when a move would leave the list', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('ignores an index outside the list', () => {
    expect(removeItem(['a'], 5)).toEqual(['a']);
    expect(updateItem(['a'], -1, 'x')).toEqual(['a']);
    expect(moveItem(['a'], 3, -1)).toEqual(['a']);
  });

  it('returns a new array even when nothing changes', () => {
    const items = ['a'];

    expect(moveItem(items, 0, 1)).not.toBe(items);
  });
});
