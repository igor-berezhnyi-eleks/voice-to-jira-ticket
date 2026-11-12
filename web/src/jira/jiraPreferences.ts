/**
 * Remembered Jira choices, kept in localStorage per browser. Only project keys, issue type ids,
 * link type names and field ids are stored: never ticket text, field values or anything about the credential.
 * Every storage access is wrapped, and the page works without memory when storage is blocked.
 */
export const STORAGE_KEY = 'vtt.jira.preferences';

interface ProjectPreferences {
  issueTypes: Record<string, string>;
  linkType?: string;
  fields?: string[];
}

interface Preferences {
  version: 1;
  lastProject?: string;
  projects: Record<string, ProjectPreferences>;
}

const empty = (): Preferences => ({ version: 1, projects: {} });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function sanitise(raw: unknown): Preferences {
  const result = empty();
  if (!isRecord(raw) || raw.version !== 1) return result;
  if (typeof raw.lastProject === 'string') result.lastProject = raw.lastProject;
  if (!isRecord(raw.projects)) return result;
  for (const [key, value] of Object.entries(raw.projects)) {
    if (!isRecord(value)) continue;
    const project: ProjectPreferences = { issueTypes: {} };
    if (isRecord(value.issueTypes)) {
      for (const [ticketType, id] of Object.entries(value.issueTypes)) {
        if (typeof id === 'string') project.issueTypes[ticketType] = id;
      }
    }
    if (typeof value.linkType === 'string') project.linkType = value.linkType;
    if (Array.isArray(value.fields)) project.fields = value.fields.filter((f): f is string => typeof f === 'string');
    result.projects[key] = project;
  }
  return result;
}

function read(): Preferences {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? empty() : sanitise(JSON.parse(stored));
  } catch {
    return empty();
  }
}

export class PreferenceStore {
  private data: Preferences = read();

  lastProject(): string | null {
    return this.data.lastProject ?? null;
  }

  issueType(projectKey: string, ticketType: string): string | null {
    return this.data.projects[projectKey]?.issueTypes[ticketType] ?? null;
  }

  linkType(projectKey: string): string | null {
    return this.data.projects[projectKey]?.linkType ?? null;
  }

  fields(projectKey: string): string[] {
    return this.data.projects[projectKey]?.fields ?? [];
  }

  setProject(projectKey: string): void {
    this.data.lastProject = projectKey;
    this.save();
  }

  setIssueType(projectKey: string, ticketType: string, issueTypeId: string): void {
    this.project(projectKey).issueTypes[ticketType] = issueTypeId;
    this.save();
  }

  setLinkType(projectKey: string, name: string): void {
    this.project(projectKey).linkType = name;
    this.save();
  }

  setFields(projectKey: string, fieldIds: string[]): void {
    this.project(projectKey).fields = [...fieldIds];
    this.save();
  }

  clear(): void {
    this.data = empty();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage is blocked: nothing was stored that could be removed.
    }
  }

  private project(projectKey: string): ProjectPreferences {
    return (this.data.projects[projectKey] ??= { issueTypes: {} });
  }

  private save(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage is blocked or full: the choice is remembered for this page only.
    }
  }
}
