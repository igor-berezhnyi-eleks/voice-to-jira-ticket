import { Alert, Box, Button, Paper, Stack, Typography } from '@eleks-ui/components';
import AddLinkIcon from '@mui/icons-material/AddLink';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useT } from '../i18n/LanguageProvider';
import { NativeSelect } from '../layout/NativeSelect';
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
  const j = useT().jira;
  const options = linkTypes ? linkOptions(linkTypes) : [];
  return (
    <Box className="field links">
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
        {j.links}
      </Typography>
      <Stack spacing={1}>
        {links.map((link, index) => {
          const current = options.find((o) => o.typeName === link.typeName && o.direction === link.direction);
          // Types that read the same both ways have one entry; an inward pick of one maps onto it.
          const value = current?.value ?? options.find((o) => o.typeName === link.typeName)?.value ?? '';
          return (
            <Paper key={link.id} variant="outlined" sx={{ p: 1.5 }}>
              <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <NativeSelect
                  id={`jira-link-type-${link.id}`}
                  label={j.linkType(index + 1)}
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
                </NativeSelect>
                {link.issue ? (
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2">
                      {link.issue.key} {link.issue.summary}
                    </Typography>
                    <Button variant="text" size="small" onClick={() => onPick(link.id, null)}>
                      {j.changeIssue(index + 1)}
                    </Button>
                  </Stack>
                ) : (
                  <IssueSearch label={j.searchLinkIssue(index + 1)} onPick={(hit) => onPick(link.id, hit)} onAuthRequired={onAuthRequired} />
                )}
                <Button
                  variant="text"
                  color="error"
                  size="small"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={() => onRemove(link.id)}
                  aria-label={j.removeLinkLabel(index + 1)}
                >
                  {j.removeLink}
                </Button>
              </Stack>
            </Paper>
          );
        })}
        {loadError && <Alert severity="error">{loadError}</Alert>}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button variant="outlined" startIcon={<AddLinkIcon />} disabled={loading || links.length >= MAX_LINKS} onClick={onAdd}>
            {j.addLink}
          </Button>
          {links.length >= MAX_LINKS && (
            <Typography variant="caption" color="text.secondary">
              {j.maxLinks(MAX_LINKS)}
            </Typography>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
