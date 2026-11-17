import { useEffect, useId, useState } from 'react';
import { Alert, Box, Link, TextField } from '@eleks-ui/components';
import { searchIssues, type JiraIssueHit } from './jiraApi';
import { describeJiraError } from './jiraErrorMessages';

const DEBOUNCE_MS = 300;

interface IssueSearchProps {
  label: string;
  /** Limits the search to a project; links in J5 leave it out. */
  projectKey?: string;
  issueTypeIds?: string[];
  onPick: (hit: JiraIssueHit) => void;
  /** Called when a search fails with an expired session. */
  onAuthRequired?: () => void;
}

export function IssueSearch({ label, projectKey, issueTypeIds, onPick, onAuthRequired }: IssueSearchProps) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<{ query: string; hits: JiraIssueHit[] } | null>(null);
  const [failed, setFailed] = useState<{ query: string; message: string } | null>(null);
  // Answers belong to the query they were asked for; an older answer is not shown for newer text.
  const hits = found?.query === query.trim() ? found.hits : [];
  const error = failed?.query === query.trim() ? failed.message : null;
  const typeKey = issueTypeIds?.join(',') ?? '';

  useEffect(() => {
    if (query.trim() === '') return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchIssues(
        { projectKey: projectKey ?? null, issueTypeIds: typeKey ? typeKey.split(',') : null, query: query.trim() },
        controller.signal,
      )
        .then((list) => setFound({ query: query.trim(), hits: list }))
        .catch((failure) => {
          if (controller.signal.aborted) return;
          const description = describeJiraError(failure, 'load');
          if (description.authRequired) onAuthRequired?.();
          setFailed({ query: query.trim(), message: description.message });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // onAuthRequired is deliberately not a dependency: a new callback must not restart the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, projectKey, typeKey]);

  return (
    <Box sx={{ width: '100%' }}>
      <TextField
        id={inputId}
        label={label}
        size="small"
        fullWidth
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
      {hits.length > 0 && (
        <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>
          {hits.map((hit) => (
            <li key={hit.key}>
              <Link
                component="button"
                type="button"
                variant="body2"
                sx={{ textAlign: 'left' }}
                onClick={() => {
                  onPick(hit);
                  setQuery('');
                }}
              >
                {hit.key} {hit.summary} ({hit.issueType}, {hit.status})
              </Link>
            </li>
          ))}
        </Box>
      )}
    </Box>
  );
}
