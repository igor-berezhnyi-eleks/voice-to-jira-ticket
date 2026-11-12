import type { JiraField } from './jiraApi';

/** Required fields without a default: the ones Create cannot skip. */
export function blockingFields(fields: JiraField[]): JiraField[] {
  return fields.filter((field) => field.required && !field.hasDefaultValue);
}

/**
 * The field area of Page 3. In J4 it only explains why Create is blocked; J5 adds the controls
 * for required and optional fields here.
 */
export function JiraFieldsArea({ fields }: { fields: JiraField[] }) {
  const blocking = blockingFields(fields);
  if (blocking.length === 0) return null;
  return (
    <div className="notice" role="alert">
      <p>This issue type needs more fields (coming in J5): {blocking.map((field) => field.name).join(', ')}.</p>
    </div>
  );
}
