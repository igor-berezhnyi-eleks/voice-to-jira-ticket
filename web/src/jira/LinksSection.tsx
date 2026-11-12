import { IssueSearch } from './IssueSearch';
import type { JiraIssueHit, JiraLinkType } from './jiraApi';

export const MAX_LINKS = 5;

export type LinkDirection = 'outward' | 'inward';

export interface LinkDraft {
  id: number;
  typeName: string;
  direction: LinkDirection;
  issue: JiraIssueHit | null;
}

interface LinkOption {
  value: string;
  typeName: string;
  direction: LinkDirection;
  phrase: string;
}

/** Both directions of every link type as phrases ("blocks", "is blocked by"); one entry when they read the same. */
export function linkOptions(types: JiraLinkType[]): LinkOption[] {
  return types.flatMap((type, index) => {
    const outward: LinkOption = { value: `${index}:outward`, typeName: type.name, direction: 'outward', phrase: type.outward };
    const inward: LinkOption = { value: `${index}:inward`, typeName: type.name, direction: 'inward', phrase: type.inward };
    return type.inward === type.outward ? [outward] : [outward, inward];
  });
}

/** The link type a new link starts with: the remembered one, else Jira's default, else the first. */
export function defaultLinkType(types: JiraLinkType[], remembered: string | null): string {
  return (types.find((t) => t.name === remembered) ?? types.find((t) => t.isDefault) ?? types[0])?.name ?? '';
}

interface LinksSectionProps {
  links: LinkDraft[];
  linkTypes: JiraLinkType[] | null;
  loading: boolean;
  loadError: string | null;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onChangeType: (id: number, typeName: string, direction: LinkDirection) => void;
  onPick: (id: number, issue: JiraIssueHit | null) => void;
  onAuthRequired: () => void;
}

export function LinksSection({ links, linkTypes, loading, loadError, onAdd, onRemove, onChangeType, onPick, onAuthRequired }: LinksSectionProps) {
  const options = linkTypes ? linkOptions(linkTypes) : [];
  return (
    <div className="field links">
      <span className="label">Links</span>
      {links.map((link, index) => {
        const current = options.find((o) => o.typeName === link.typeName && o.direction === link.direction);
        // Types that read the same both ways have one entry; an inward pick of one maps onto it.
        const value = current?.value ?? options.find((o) => o.typeName === link.typeName)?.value ?? '';
        return (
          <div key={link.id} className="link-row">
            <label htmlFor={`jira-link-type-${link.id}`}>Link type {index + 1}</label>
            <select
              id={`jira-link-type-${link.id}`}
              value={value}
              onChange={(e) => {
                const picked = options.find((o) => o.value === e.target.value);
                if (picked) onChangeType(link.id, picked.typeName, picked.direction);
              }}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.phrase}
                </option>
              ))}
            </select>
            {link.issue ? (
              <span>
                {link.issue.key} {link.issue.summary}{' '}
                <button type="button" onClick={() => onPick(link.id, null)}>
                  Change issue {index + 1}
                </button>
              </span>
            ) : (
              <IssueSearch label={`Search for issue to link ${index + 1}`} onPick={(hit) => onPick(link.id, hit)} onAuthRequired={onAuthRequired} />
            )}
            <button type="button" onClick={() => onRemove(link.id)} aria-label={`Remove link ${index + 1}`}>
              Remove link
            </button>
          </div>
        );
      })}
      {loadError && (
        <p role="alert" className="error">
          {loadError}
        </p>
      )}
      <button type="button" disabled={loading || links.length >= MAX_LINKS} onClick={onAdd}>
        Add link
      </button>
      {links.length >= MAX_LINKS && <span className="hint"> Up to {MAX_LINKS} links.</span>}
    </div>
  );
}
