import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldInput } from './FieldInput';
import type { FieldDraft } from './fieldValues';
import type { JiraField } from './jiraApi';

const field = (kind: JiraField['kind'], extra: Partial<JiraField> = {}): JiraField => ({
  fieldId: 'f',
  name: 'Thing',
  required: true,
  hasDefaultValue: false,
  kind,
  allowedValues: null,
  ...extra,
});

const allowedValues = [
  { id: '1', name: 'High' },
  { id: '2', name: 'Low' },
  { id: '3', name: 'Medium' },
];

/** Keeps the draft in state like the page does, and reports the latest one. */
function Harness({ f, initial, spy }: { f: JiraField; initial?: FieldDraft; spy: (v: FieldDraft) => void }) {
  const [value, setValue] = useState<FieldDraft | undefined>(initial);
  return (
    <FieldInput
      field={f}
      value={value}
      onChange={(v) => {
        setValue(v);
        spy(v);
      }}
    />
  );
}

function show(f: JiraField, initial?: FieldDraft) {
  const spy = vi.fn();
  render(<Harness f={f} initial={initial} spy={spy} />);
  return spy;
}

describe('FieldInput', () => {
  it('text: an input', () => {
    const spy = show(field('text'));
    const input = screen.getByLabelText('Thing (required)') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.type).toBe('text');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(spy).toHaveBeenLastCalledWith('abc');
  });

  it('textarea: a textarea', () => {
    const spy = show(field('textarea'));
    const input = screen.getByLabelText('Thing (required)');
    expect(input.tagName).toBe('TEXTAREA');
    fireEvent.change(input, { target: { value: 'a\nb' } });
    expect(spy).toHaveBeenLastCalledWith('a\nb');
  });

  it('number: a number input', () => {
    const spy = show(field('number'));
    const input = screen.getByLabelText('Thing (required)') as HTMLInputElement;
    expect(input.type).toBe('number');
    fireEvent.change(input, { target: { value: '4.5' } });
    expect(spy).toHaveBeenLastCalledWith('4.5');
  });

  it('date: a date input', () => {
    const spy = show(field('date'));
    const input = screen.getByLabelText('Thing (required)') as HTMLInputElement;
    expect(input.type).toBe('date');
    fireEvent.change(input, { target: { value: '2026-11-12' } });
    expect(spy).toHaveBeenLastCalledWith('2026-11-12');
  });

  it('option: a select with a placeholder and the allowed values', () => {
    const spy = show(field('option', { allowedValues }));
    const select = screen.getByLabelText('Thing (required)') as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.text)).toEqual(['Choose…', 'High', 'Low', 'Medium']);
    expect(select.multiple).toBe(false);
    fireEvent.change(select, { target: { value: '2' } });
    expect(spy).toHaveBeenLastCalledWith('2');
  });

  it('options: a multi-select that reports every selected id', () => {
    const spy = show(field('options', { allowedValues }));
    const select = screen.getByLabelText('Thing (required)') as HTMLSelectElement;
    expect(select.multiple).toBe(true);
    select.options[0].selected = true;
    select.options[2].selected = true;
    fireEvent.change(select);
    expect(spy).toHaveBeenLastCalledWith(['1', '3']);
  });

  it('shows no "(required)" for an optional field or one with a default', () => {
    show(field('text', { required: false, name: 'Opt' }));
    expect(screen.getByLabelText('Opt')).toBeTruthy();
  });

  it('shows Jira\'s message for the field', () => {
    render(<FieldInput field={field('text')} value="" onChange={() => undefined} error="Bad value" />);
    expect(screen.getByRole('alert').textContent).toBe('Bad value');
  });

  it('calls onRemove from a Remove button named after the field', () => {
    const onRemove = vi.fn();
    render(<FieldInput field={field('text', { name: 'Env' })} value="" onChange={() => undefined} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove field Env' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe('FieldInput labels', () => {
  const typeLabel = (text: string) => fireEvent.change(screen.getByLabelText('Thing (required)'), { target: { value: text } });

  it('adds a label with Enter, shows it as a tag and clears the input', () => {
    const spy = show(field('labels'));
    typeLabel('voice');
    fireEvent.keyDown(screen.getByLabelText('Thing (required)'), { key: 'Enter' });
    expect(spy).toHaveBeenLastCalledWith(['voice']);
    expect(screen.getByText('voice')).toBeTruthy();
    expect((screen.getByLabelText('Thing (required)') as HTMLInputElement).value).toBe('');
  });

  it('adds a label with the Add label button and with a comma', () => {
    const spy = show(field('labels'));
    typeLabel('a');
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    typeLabel('b,');
    expect(spy).toHaveBeenLastCalledWith(['a', 'b']);
  });

  it('rejects a space: the text is not accepted and a message says why', () => {
    const spy = show(field('labels'));
    typeLabel('two words');
    expect((screen.getByLabelText('Thing (required)') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Labels cannot contain spaces.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects a pasted label with a tab (a text input removes newlines itself)', () => {
    const spy = show(field('labels'));
    typeLabel('a\tb');
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('ignores an empty label and a duplicate', () => {
    const spy = show(field('labels'), ['a']);
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    typeLabel('a');
    fireEvent.click(screen.getByRole('button', { name: 'Add label' }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('removes a label', () => {
    const spy = show(field('labels'), ['a', 'b']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove label a' }));
    expect(spy).toHaveBeenLastCalledWith(['b']);
  });
});
