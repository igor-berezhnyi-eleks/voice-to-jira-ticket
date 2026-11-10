// Pure list operations for the editable lists. Each returns a new array and never changes its input;
// an index outside the list (or a move off either end) leaves the content unchanged.

const inRange = (items: readonly unknown[], index: number) => Number.isInteger(index) && index >= 0 && index < items.length;

export function addItem<T>(items: readonly T[], item: T): T[] {
  return [...items, item];
}

export function removeItem<T>(items: readonly T[], index: number): T[] {
  return inRange(items, index) ? items.filter((_, i) => i !== index) : [...items];
}

export function updateItem<T>(items: readonly T[], index: number, item: T): T[] {
  return inRange(items, index) ? items.map((current, i) => (i === index ? item : current)) : [...items];
}

export function moveItem<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (!inRange(items, index) || !inRange(items, target)) return [...items];
  const result = [...items];
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}
