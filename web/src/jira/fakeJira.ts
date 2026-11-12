import { vi } from 'vitest';

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>;

export const jsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });

export const problem = (status: number, code: string, extra: Record<string, unknown> = {}): Response =>
  jsonResponse({ title: 'x', status, code, ...extra }, status);

/** A fetch stub that answers by "METHOD /path" (query-free). An unlisted route fails the test loudly. */
export function stubJiraFetch(routes: Record<string, Handler>) {
  const mock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const key = `${init?.method ?? 'GET'} ${url}`;
    const handler = routes[key];
    if (!handler) throw new Error(`No fake route for ${key}`);
    return handler(url, init);
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

export const callsTo = (mock: ReturnType<typeof stubJiraFetch>, key: string) =>
  mock.mock.calls.filter(([input, init]) => `${init?.method ?? 'GET'} ${String(input)}` === key);

export const bodyOf = (call: Parameters<typeof fetch>) => JSON.parse(String(call[1]?.body));

export const projects = [
  { key: 'SCRUM', name: 'Scrum' },
  { key: 'OPS', name: 'Operations' },
];

export const issueTypes = [
  { id: '10001', name: 'Story', hierarchyLevel: 0, suggestedFor: ['Feature'] },
  { id: '10002', name: 'Bug', hierarchyLevel: 0, suggestedFor: ['Bug'] },
  { id: '10003', name: 'Task', hierarchyLevel: 0, suggestedFor: [] },
];

export const noFields = { fields: [], parentTypeIds: [] };
