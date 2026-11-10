import type { Ticket } from '../api';

const two = (value: number) => String(value).padStart(2, '0');

/** `ticket-<type>-<yyyyMMdd-HHmmss>.json`, in the browser's local time (plan 4.8). */
export function jsonFileName(type: Ticket['type'], date: Date): string {
  const day = `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`;
  const time = `${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
  return `ticket-${type.toLowerCase()}-${day}-${time}.json`;
}

/** Hands `text` to the browser as a file download. */
export function downloadText(fileName: string, text: string, mimeType = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
