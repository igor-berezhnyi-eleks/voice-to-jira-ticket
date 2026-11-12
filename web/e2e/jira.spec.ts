import { expect, test, type Page, type Route } from '@playwright/test';

// The Jira API is mocked in the browser with page.route; the rest runs against the real API with the fake generator.
const bugTranscript = 'The export button crashes the app every time I click it on the reports page.';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function mockJira(page: Page, created: unknown[]) {
  let connected = false;
  await page.route('**/api/jira/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const key = `${request.method()} ${path}`;
    switch (key) {
      case 'GET /api/jira/status':
        return json(route, { enabled: true, connected, displayName: connected ? 'Ada L' : null, defaultProjectKey: 'SCRUM' });
      case 'POST /api/jira/session':
        connected = true;
        return json(route, { displayName: 'Ada L' });
      case 'GET /api/jira/projects':
        return json(route, [{ key: 'SCRUM', name: 'Scrum' }]);
      case 'GET /api/jira/projects/SCRUM/issue-types':
        return json(route, [
          { id: '10001', name: 'Story', hierarchyLevel: 0, suggestedFor: ['Feature'] },
          { id: '10002', name: 'Bug', hierarchyLevel: 0, suggestedFor: ['Bug'] },
          { id: '10003', name: 'Task', hierarchyLevel: 0, suggestedFor: [] },
        ]);
      case 'GET /api/jira/projects/SCRUM/issue-types/10002/fields':
        return json(route, { fields: [], parentTypeIds: [] });
      case 'GET /api/jira/projects/SCRUM/issue-types/10001/fields':
        return json(route, { fields: [], parentTypeIds: ['10000'] });
      case 'POST /api/jira/issues/search':
        return json(route, [{ key: 'SCRUM-12', summary: 'Reports epic', issueType: 'Epic', status: 'To Do' }]);
      case 'POST /api/jira/issues':
        created.push(request.postDataJSON());
        return json(route, { key: 'SCRUM-13', url: 'https://example.atlassian.net/browse/SCRUM-13', warnings: [] });
      default:
        return json(route, { title: 'No mock', status: 500, code: 'internal_error' }, 500);
    }
  });
}

test('jira flow: connect, change type, pick a parent, create, link shown', async ({ page }) => {
  const created: unknown[] = [];
  await mockJira(page, created);

  await page.goto('/');
  await page.getByLabel('Transcript').fill(bugTranscript);
  await page.getByRole('button', { name: 'Generate ticket' }).click();
  await expect(page.getByLabel('Type')).toHaveValue('Bug');

  const jiraButton = page.getByRole('button', { name: 'Connect to Jira board' });
  await expect(jiraButton).toBeEnabled();
  await jiraButton.click();

  await page.getByLabel('Atlassian email').fill('ada@example.com');
  await page.getByLabel('API token').fill('not-a-real-token');
  await page.getByRole('button', { name: 'Connect', exact: true }).click();

  await expect(page.getByText('Connected as Ada L')).toBeVisible();
  await expect(page.getByLabel('Issue type')).toHaveValue('10002');
  await expect(page.getByLabel('Search for a parent')).toHaveCount(0);

  await page.getByLabel('Issue type').selectOption('10001');
  await page.getByLabel('Search for a parent').fill('rep');
  await page.getByRole('button', { name: /SCRUM-12 Reports epic/ }).click();

  await page.getByLabel('Summary').fill('Export crashes the reports page');
  await page.getByRole('button', { name: 'Create issue' }).click();

  const link = page.getByRole('link', { name: 'SCRUM-13' });
  await expect(link).toHaveAttribute('href', 'https://example.atlassian.net/browse/SCRUM-13');
  await expect(link).toHaveAttribute('target', '_blank');
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({
    projectKey: 'SCRUM',
    issueTypeId: '10001',
    summary: 'Export crashes the reports page',
    parentKey: 'SCRUM-12',
  });

  await page.getByRole('button', { name: 'Back to ticket' }).click();
  await expect(page.getByRole('heading', { name: 'Review ticket' })).toBeVisible();
});
