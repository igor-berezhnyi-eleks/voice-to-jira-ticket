import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateTicketResponse, Ticket } from '../api';
import { ConnectPanel } from '../jira/ConnectPanel';
import { CreateInJiraPage } from '../jira/CreateInJiraPage';
import { issueTypes, jsonResponse, projects, stubJiraFetch } from '../jira/fakeJira';
import { JiraApiError, type JiraStatus } from '../jira/jiraApi';
import { describeJiraError } from '../jira/jiraErrorMessages';
import { TicketPage } from '../ticket/TicketPage';
import { en } from './en';
import { LanguageProvider } from './LanguageProvider';
import { languageStorageKey } from './languagePreference';
import { uk } from './uk';

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(languageStorageKey, 'uk');
});

/** Every English string the page must not show while Ukrainian is selected. */
function expectNoEnglish(strings: string[]) {
  // The preview and the copied text follow the ticket's language (L5), not the UI language.
  const page = document.body.cloneNode(true) as HTMLElement;
  page.querySelector('#preview-text')?.remove();
  const text = page.textContent ?? '';
  const labels = Array.from(document.querySelectorAll('[aria-label]'), (element) => element.getAttribute('aria-label'));
  for (const english of strings) {
    expect(text, english).not.toContain(english);
    expect(labels, english).not.toContain(english);
  }
}

const bug: Ticket = {
  type: 'Bug',
  language: 'uk',
  title: 'Збереження рахунку закриває редактор',
  description: 'Збереження рахунку з порожньою датою закриває редактор.',
  bug: {
    stepsToReproduce: ['Відкрити рахунок', 'Очистити дату'],
    actualResult: 'Редактор закривається.',
    expectedResult: 'Not provided',
    environment: 'Chrome на Windows',
  },
  feature: null,
  missingInformation: [{ field: 'bug.expectedResult', question: 'Що має статися натомість?' }],
};

const response: GenerateTicketResponse = { ticket: bug, provider: 'Fake', model: 'fake', durationMs: 12, usage: null };

describe('Page 2 in Ukrainian', () => {
  function show() {
    render(
      <LanguageProvider>
        <TicketPage response={response} transcript="текст" onBack={vi.fn()} onRegenerated={vi.fn()} jiraEnabled={false} />
      </LanguageProvider>,
    );
  }

  it('shows no English text from the dictionary', () => {
    show();
    const p = en.ticketPage;
    expectNoEnglish([
      p.backToTranscript,
      p.regenerate,
      p.reviewTitle,
      p.missingTitle,
      p.previewTitle,
      p.copy,
      p.saveJson,
      p.connectToJira,
      p.needsContent,
      p.add,
      en.fieldLabels['bug.stepsToReproduce'],
      en.fieldLabels['bug.actualResult'],
      en.fieldLabels['bug.expectedResult'],
      en.fieldLabels['bug.environment'],
      p.item(en.fieldLabels['bug.stepsToReproduce'], 1),
      p.moveUp(p.item(en.fieldLabels['bug.stepsToReproduce'], 1)),
    ]);
    expect(screen.getByText(uk.ticketPage.reviewTitle)).toBeTruthy();
    expect(screen.getByLabelText(uk.fieldLabels['bug.actualResult'])).toBeTruthy();
    expect(screen.getByRole('button', { name: uk.ticketPage.connectToJira }).getAttribute('title')).toBe(uk.ticketPage.jiraNotConfigured);
  });

  it('translates the type picker, the conversion notice and the confirmation', () => {
    show();
    const picker = screen.getByLabelText<HTMLSelectElement>(uk.ticketPage.type);
    expect(Array.from(picker.options, (option) => option.textContent)).toEqual([uk.ticketPage.typeNames.Bug, uk.ticketPage.typeNames.Feature]);

    fireEvent.change(picker, { target: { value: 'Feature' } });
    expect(screen.getByRole('note').textContent).toContain(uk.ticketPage.converted(uk.ticketPage.typeNames.Bug, uk.ticketPage.typeNames.Feature));
    expectNoEnglish(['Converted from', 'in your browser']);

    fireEvent.change(screen.getByLabelText(uk.fieldLabels.title), { target: { value: 'Змінений заголовок' } });
    fireEvent.click(screen.getByRole('button', { name: uk.ticketPage.regenerate }));
    expect(screen.getByRole('group', { name: uk.ticketPage.confirm }).textContent).toContain(uk.ticketPage.confirmRegenerate);
  });

  it('lists the missing-information question and the Ukrainian copy status', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    show();
    expect(screen.getByText('Що має статися натомість?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: uk.ticketPage.copy }));
    expect(await screen.findByText(uk.ticketPage.copied)).toBeTruthy();
  });
});

const connected: JiraStatus = {
  enabled: true,
  connected: true,
  displayName: 'Ada L',
  defaultProjectKey: 'SCRUM',
  deployment: 'Cloud',
  authScheme: 'Basic',
  defaultServerAuthScheme: 'Bearer',
  siteUrl: 'https://example.atlassian.net',
  defaultSiteUrl: 'https://example.atlassian.net',
  allowedHosts: ['*.atlassian.net'],
};

const fieldsWithRequired = {
  fields: [
    { fieldId: 'customfield_1', name: 'Severity', required: true, hasDefaultValue: false, kind: 'option', allowedValues: [{ id: '7', name: 'Major' }] },
    { fieldId: 'customfield_9', name: 'Approver', required: true, hasDefaultValue: false, kind: 'unsupported', allowedValues: null },
    { fieldId: 'labels', name: 'Labels', required: false, hasDefaultValue: false, kind: 'labels', allowedValues: null },
  ],
  parentTypeIds: ['10000'],
};

describe('Page 3 and the Connect panel in Ukrainian', () => {
  function showPage(status: JiraStatus) {
    render(
      <LanguageProvider>
        <CreateInJiraPage summary="Збій експорту" description="Опис" ticketType="Bug" status={status} onBack={vi.fn()} />
      </LanguageProvider>,
    );
  }

  it('shows no English text from the dictionary on the form', async () => {
    stubJiraFetch({
      'GET /api/jira/projects': () => jsonResponse(projects),
      'GET /api/jira/projects/SCRUM/issue-types': () => jsonResponse(issueTypes),
      'GET /api/jira/projects/SCRUM/issue-types/10002/fields': () => jsonResponse(fieldsWithRequired),
      'GET /api/jira/link-types': () => jsonResponse([{ name: 'Relates', inward: 'relates to', outward: 'relates to', isDefault: true }]),
    });
    showPage(connected);
    expect(screen.getByText(uk.jira.loadingProjects)).toBeTruthy();
    await waitFor(() => expect(screen.getByText(uk.jira.requiresField('Approver'))).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: uk.jira.addLink }));
    await waitFor(() => expect(screen.getByLabelText(uk.jira.linkType(1))).toBeTruthy());
    fireEvent.change(screen.getByLabelText(uk.jira.addField), { target: { value: 'labels' } });
    fireEvent.click(screen.getByRole('button', { name: uk.jira.add }));

    const j = en.jira;
    expectNoEnglish([
      j.backToTicket,
      j.disconnect,
      j.title,
      j.connectedAs('Ada L'),
      j.project,
      j.issueType,
      j.summary,
      j.description,
      j.resetToPreview,
      j.parent,
      j.noParent,
      j.searchParent,
      j.createIssue,
      j.forget,
      j.links,
      j.addLink,
      j.addLabel,
      j.requiredSuffix,
      j.requiresField('Approver'),
      j.fillRequired('Severity'),
      j.removeLink,
      j.removeLinkLabel(1),
      j.searchLinkIssue(1),
    ]);
    expect(screen.getByText(uk.jira.connectedAs('Ada L'))).toBeTruthy();
    expect(screen.getByLabelText(`Severity${uk.jira.requiredSuffix}`)).toBeTruthy();
    expect(document.body.textContent).toContain(uk.jira.fillRequired('Severity'));
  });

  it('shows the Connect panel in Ukrainian, with the session-ended reason', () => {
    stubJiraFetch({});
    showPage({ ...connected, connected: false, displayName: null });
    const c = en.connect;
    expectNoEnglish([c.title, c.cloudNotice, c.createToken, c.address, c.connect, c.atlassianEmail, c.apiToken, c.cancel]);
    expect(screen.getByRole('form', { name: uk.connect.title })).toBeTruthy();
    expect(screen.getByLabelText(uk.connect.atlassianEmail)).toBeTruthy();
    expect(screen.getByRole('button', { name: uk.connect.connect })).toBeTruthy();
  });

  it('translates the Server sign-in choices and notices', () => {
    render(
      <LanguageProvider>
        <ConnectPanel
          defaultSiteUrl="https://jira.example.com"
          allowedHosts={['jira.example.com']}
          deployment="Server"
          authScheme="Bearer"
          defaultServerAuthScheme="Bearer"
          onConnected={vi.fn()}
          onCancel={vi.fn()}
          reason={uk.jiraErrors.authRequired}
        />
      </LanguageProvider>,
    );
    expect(screen.getByText(uk.connect.tokenNotice)).toBeTruthy();
    expect(screen.getByText(uk.connect.allowed('jira.example.com'))).toBeTruthy();
    expect(screen.getByLabelText(uk.connect.personalAccessToken)).toBeTruthy();
    expectNoEnglish([en.connect.tokenNotice, en.connect.signInWith, en.connect.usernameAndPassword, en.connect.personalAccessToken]);
  });
});

describe('Jira errors in Ukrainian', () => {
  const error = (code: string, extras = {}) => new JiraApiError(code, 400, 'server text', extras);

  it.each(['jira_auth_required', 'jira_auth_denied', 'jira_forbidden', 'jira_not_found', 'jira_rejected', 'jira_unavailable', 'jira_not_configured', 'surprise'])(
    '%s has a Ukrainian message',
    (code) => {
      const message = describeJiraError(error(code), 'load', uk).message;
      expect(message).not.toBe(describeJiraError(error(code), 'load', en).message);
      expect(message).toMatch(/[а-яіїєґ]/i);
    },
  );

  it('uses Ukrainian plural forms for the retry delay', () => {
    expect(describeJiraError(error('jira_rate_limited', { retryAfterSeconds: 1 }), 'create', uk).message).toContain('1 секунду');
    expect(describeJiraError(error('jira_rate_limited', { retryAfterSeconds: 12 }), 'create', uk).message).toContain('12 секунд');
    expect(describeJiraError(error('jira_rate_limited', { retryAfterSeconds: 3 }), 'create', uk).message).toContain('3 секунди');
  });

  it('keeps the create-timeout warning and passes validation text through as it is', () => {
    expect(describeJiraError(error('jira_timeout'), 'create', uk)).toMatchObject({ retryable: false, message: uk.jiraErrors.createTimeout });
    expect(describeJiraError(error('validation'), 'load', uk).message).toBe('server text');
  });

  it('says the type of the Server sign-in that was tried, in Ukrainian', () => {
    expect(uk.connect.serverDenied(true, 'Деталі.')).toContain('цей токен');
    expect(uk.connect.serverDenied(false, 'Деталі.')).toContain('Токен');
  });
});
