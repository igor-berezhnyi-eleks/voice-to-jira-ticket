import type { GenerateTicketResponse } from '../api';

interface TicketPageProps {
  response: GenerateTicketResponse;
  onBack: () => void;
}

export function TicketPage({ response, onBack }: TicketPageProps) {
  const { ticket, model, durationMs } = response;

  return (
    <>
      <button type="button" onClick={onBack}>
        Back to transcript
      </button>
      <p>
        <span className="badge">{ticket.type}</span>
      </p>
      <h1>{ticket.title}</h1>
      <p className="hint">
        Model {model}, generated in {durationMs} ms
      </p>
      <dl>
        <TextField label="Description" value={ticket.description} />
        {ticket.bug && (
          <>
            <ListField label="Steps to reproduce" items={ticket.bug.stepsToReproduce} ordered />
            <TextField label="Actual result" value={ticket.bug.actualResult} />
            <TextField label="Expected result" value={ticket.bug.expectedResult} />
            <TextField label="Environment / platform" value={ticket.bug.environment} />
          </>
        )}
        {ticket.feature && (
          <>
            <TextField label="User or business need" value={ticket.feature.userNeed} />
            <TextField label="Proposed behavior" value={ticket.feature.proposedBehavior} />
            <ListField label="Acceptance criteria" items={ticket.feature.acceptanceCriteria} />
          </>
        )}
      </dl>
      <section>
        <h2>Missing information</h2>
        {ticket.missingInformation.length === 0 ? (
          <p>Nothing is missing.</p>
        ) : (
          <ul>
            {ticket.missingInformation.map((item, index) => (
              <li key={index}>
                {item.question}
                {item.field && ` (${item.field})`}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function TextField({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function ListField({ label, items, ordered = false }: { label: string; items: string[]; ordered?: boolean }) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <>
      <dt>{label}</dt>
      <dd>
        {items.length === 0 ? (
          'Not provided'
        ) : (
          <List>
            {items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </List>
        )}
      </dd>
    </>
  );
}
