import type { FieldPath } from '../ticket/fieldPaths';
import { plural } from './plural';

/**
 * The source dictionary. Its type is the contract for every other language (`uk.ts` is typed against it),
 * so a missing key fails `npm run build`. Entries are strings or functions (values, plurals).
 */
export const en = {
  locale: 'en',

  // Header
  appName: 'Voice to Ticket',
  steps: ['Report', 'Review', 'Jira'],
  progress: 'Progress',
  languageSelector: 'Interface language',
  switchToLight: 'Switch to light mode',
  switchToDark: 'Switch to dark mode',

  // Page 1
  reportTitle: 'Describe the bug or feature',
  reportHint:
    'Record or upload a spoken report (English; .wav, .mp3, .webm or .ogg, up to 5 minutes and 25 MB), or type it below. Record or upload more to append more text to the transcript. Check the text, then generate the ticket.',
  record: 'Record',
  stop: 'Stop',
  uploadRecording: 'Upload recording',
  audioFile: 'Audio file',
  recordingTimer: (elapsed: string, max: string) => `Recording ${elapsed} / ${max}`,
  waitingForMicrophone: 'Waiting for the microphone…',
  transcribing: 'Transcribing…',
  tryAgain: 'Try again',
  downloadRecording: 'Download recording',
  transcript: 'Transcript',
  charactersNeeded: (count: number, min: number) =>
    `${count} ${plural('en', count, { one: 'character', other: 'characters' })}, at least ${min} needed`,
  charactersOverLimit: (count: number, limit: number) =>
    `${count} ${plural('en', count, { one: 'character', other: 'characters' })}, over the ${limit.toLocaleString('en-US')}-character limit`,
  language: 'Language',
  translate: 'Translate',
  generating: 'Generating…',
  generateTicket: 'Generate ticket',
  retry: 'Retry',
  fakeBanner: 'Fake generator active — tickets are not real',

  // Recorder messages
  noSpeech: 'No speech was detected. Nothing was added to the transcript.',
  recordingUnsupported: 'Recording is not supported in this browser. Use a current Chrome or Edge, or type the report instead.',
  recordingFailed: 'The recording failed. Please try again.',
  microphoneDenied: 'Microphone access was denied. Allow the microphone for this site in the browser, then try again.',
  microphoneMissing: 'No microphone was found. Connect one and try again.',
  microphoneFailed: 'The microphone could not be started. Check that no other app is using it, then try again.',
  sttUnavailable: 'The transcription service is not available. Start it and use Try again, or download the recording.',
  sttTimeout: 'Transcription took too long. Use Try again, or download the recording.',
  audioTooLargeToTranscribe: 'The recording is too large to transcribe (limit 25 MB). Download it and record a shorter report.',
  audioUnreadable: 'The audio could not be read. Use a valid .wav, .mp3, .webm or .ogg file.',
  serverUnreachableRecording: 'Could not reach the server. Start it, then use Try again, or download the recording.',
  transcriptionFailed: 'Something went wrong while transcribing. Use Try again, or download the recording.',

  // Upload checks
  fileTypeNotSupported: (accepted: string) => `That file type is not supported. Use ${accepted}.`,
  fileEmpty: 'That file is empty.',
  fileTooLarge: 'That file is too large to transcribe (limit 25 MB).',
  recordingTooLong: (length: string) => `That recording is ${length} long. The limit is 5:00. Use a shorter file.`,

  // Generation errors
  genericError: 'Something went wrong. Please try again.',
  errors: {
    llm_refused: 'The ticket service declined to process this report. Edit the transcript, then press Generate ticket.',
    llm_invalid_output:
      'The ticket service returned a ticket that could not be used. Try again; if it keeps happening, reword the report.',
    llm_truncated:
      'The ticket was cut off because the report is too long to process in one go. Try again, or use a shorter report.',
    llm_unavailable:
      'The ticket service is not available right now. Try again in a moment; if it persists, ask whoever runs this tool to check its setup.',
    llm_timeout: 'The ticket service took too long to answer. Try again.',
    network_error: 'Could not reach the server. Check your connection and try again.',
    unexpected_response:
      'The server sent a reply this page does not understand. It may be restarting; try again in a moment.',
  },

  // Page 2 input labels, by field path (the preview and copied text use the ticket's language, L5)
  fieldLabels: {
    title: 'Title',
    description: 'Description',
    'bug.stepsToReproduce': 'Steps to reproduce',
    'bug.actualResult': 'Actual result',
    'bug.expectedResult': 'Expected result',
    'bug.environment': 'Environment / platform',
    'feature.userNeed': 'User or business need',
    'feature.proposedBehavior': 'Proposed behavior',
    'feature.acceptanceCriteria': 'Acceptance criteria',
  } satisfies Record<FieldPath, string>,

  // Page 2
  ticketPage: {
    backToTranscript: 'Back to transcript',
    regenerate: 'Regenerate',
    confirm: 'Confirm',
    replace: 'Replace',
    discard: 'Discard',
    cancel: 'Cancel',
    confirmRegenerate: 'Regenerating replaces your edits with a new ticket. Continue?',
    confirmBack: 'Going back discards your edits to this ticket. Continue?',
    generating: 'Generating…',
    retry: 'Retry',
    reviewTitle: 'Review ticket',
    modelInfo: (model: string, ms: number) => `Model ${model}, generated in ${ms} ms`,
    type: 'Type',
    typeNames: { Bug: 'Bug', Feature: 'Feature' },
    regenerateAs: (type: string) => `Regenerate as ${type}`,
    converted: (from: string, to: string) =>
      `Converted from ${from} in your browser. Regenerate as ${to} for a better ticket.`,
    missingTitle: 'Missing information',
    nothingMissing: 'Nothing is missing.',
    previewTitle: 'Preview',
    format: 'Format',
    plain: 'Plain',
    jiraWiki: 'Jira wiki',
    wikiApprox: 'How Jira shows it (approximate):',
    copy: 'Copy',
    saveJson: 'Save as JSON',
    connectToJira: 'Connect to Jira board',
    jiraNotConfigured: 'Jira is not configured',
    copied: 'Copied',
    copyFailed: 'Copy failed. Select the text above and copy it yourself.',
    needsContent: 'Needs content',
    titleTooLong: (limit: number) => `Title is longer than ${limit} characters.`,
    item: (label: string, n: number) => `${label} item ${n}`,
    moveUp: (name: string) => `Move ${name} up`,
    moveDown: (name: string) => `Move ${name} down`,
    remove: (name: string) => `Remove ${name}`,
    add: 'Add',
    addItem: (label: string) => `Add ${label} item`,
  },

  // Page 3 (text from Jira itself is never translated)
  jira: {
    backToTicket: 'Back to ticket',
    disconnect: 'Disconnect',
    title: 'Create in Jira',
    connectedAs: (name: string) => `Connected as ${name}`,
    tryAgain: 'Try again',
    loadingProjects: 'Loading projects…',
    project: 'Project',
    chooseProject: 'Choose a project',
    loadingTypes: 'Loading issue types…',
    noTypes: 'This project has no issue types you can create here.',
    issueType: 'Issue type',
    loadingFields: 'Loading fields…',
    summary: 'Summary',
    description: 'Description',
    resetToPreview: 'Reset to preview',
    parent: 'Parent',
    noParent: 'No parent',
    searchParent: 'Search for a parent',
    created: 'Created',
    createAnother: 'Create another',
    creating: 'Creating…',
    createIssue: 'Create issue',
    fillRequired: (names: string) => `Fill in the required fields: ${names}.`,
    pickLinkIssue: 'Pick an issue for each link, or remove the link.',
    linkFailed: (created: string, linked: string) => `Created ${created}, but the link to ${linked} failed; add it in Jira.`,
    jiraProblem: (code: string) => `Jira reported a problem (${code}).`,
    forget: 'Forget my Jira choices',
    forgotten: 'Remembered choices cleared.',
    noLinkTypes: 'This Jira site has no link types.',
    dropped: (names: string) =>
      `Dropped what you entered for ${names}: the new issue type does not have it or does not allow the value.`,
    requiresField: (name: string) =>
      `This issue type requires ‘${name}’, which this app can’t fill. Pick another issue type or create the issue in Jira.`,
    addField: 'Add field',
    chooseField: 'Choose a field…',
    add: 'Add',
    choose: 'Choose…',
    requiredSuffix: ' (required)',
    removeField: (name: string) => `Remove field ${name}`,
    remove: 'Remove',
    addLabel: 'Add label',
    labelsNoSpaces: 'Labels cannot contain spaces.',
    removeLabel: (label: string) => `Remove label ${label}`,
    links: 'Links',
    linkType: (n: number) => `Link type ${n}`,
    changeIssue: (n: number) => `Change issue ${n}`,
    searchLinkIssue: (n: number) => `Search for issue to link ${n}`,
    removeLinkLabel: (n: number) => `Remove link ${n}`,
    removeLink: 'Remove link',
    addLink: 'Add link',
    maxLinks: (max: number) => `Up to ${max} links.`,
  },

  // Connect panel
  connect: {
    title: 'Connect to Jira',
    cloudNotice:
      'The token gives this app the same rights as you in Jira. It is kept only in an encrypted browser cookie for this app, Disconnect removes it, and you can revoke it any time in your Atlassian account.',
    createToken: 'Create an API token (without scopes)',
    tokenNotice:
      'The token gives this app the same rights as you in Jira. It is kept only in an encrypted browser cookie for this app, and Disconnect removes it. Create a personal access token in your Jira profile, or ask your Jira administrator; you can revoke it there any time.',
    passwordNotice:
      'Your Jira password gives this app the same rights as you in Jira. It is kept only in an encrypted browser cookie for this app, and Disconnect removes it.',
    address: 'Jira address',
    allowed: (hosts: string) => `Allowed: ${hosts}`,
    typeGroup: 'Jira type',
    cloud: 'Cloud',
    server: 'Server / Data Center',
    signInWith: 'Sign in with',
    token: 'Token',
    usernameAndPassword: 'Username and password',
    username: 'Username',
    atlassianEmail: 'Atlassian email',
    apiToken: 'API token',
    personalAccessToken: 'Personal access token',
    password: 'Password',
    cancel: 'Cancel',
    connect: 'Connect',
    serverDenied: (usedToken: boolean, detail: string) =>
      `Jira did not accept ${usedToken ? 'this token' : 'this username and password'}. ${detail} If your Jira uses the other sign-in, choose "${usedToken ? 'Username and password' : 'Token'}".`,
  },

  // Jira errors produced by the web app
  jiraErrors: {
    generic: 'Something went wrong. Please try again.',
    authRequired: 'Your Jira session has ended. Connect again; your entries are kept.',
    authDenied: 'Jira did not accept this email and token. Use a token without scopes.',
    forbidden: 'Your Jira account cannot do this in this project.',
    notFound: 'Jira could not find that project or issue, or your account cannot see it.',
    rejected: 'Jira did not accept the issue. See the messages below.',
    rateLimited: (seconds: number | null | undefined) =>
      seconds ? `Jira is busy. Try again in ${seconds} seconds.` : 'Jira is busy. Try again in a moment.',
    createTimeout: 'The issue may have been created. Check Jira before trying again.',
    unreachable: 'Could not reach Jira.',
    notConfigured: 'Jira is not configured.',
  },
};

export type Dictionary = typeof en;
