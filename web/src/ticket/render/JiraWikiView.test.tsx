import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JiraWikiView } from './JiraWikiView';

describe('JiraWikiView', () => {
  it('shows headings, numbered and bullet lists and paragraphs', () => {
    render(
      <JiraWikiView
        text={['h1. The title', 'Type: Bug', '', 'h2. Steps', '# one', '# two', '', 'h2. Criteria', '* a', '* b', '', 'h2. Notes', 'First line', 'Second line'].join('\n')}
      />,
    );

    // Wiki h1/h2 are shown as h3/h4 because the page has its own h1/h2.
    expect(screen.getByRole('heading', { level: 3, name: 'The title' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 4, name: 'Steps' })).toBeTruthy();
    expect(screen.getByText('Type: Bug').tagName).toBe('P');
    const lists = screen.getAllByRole('list');
    expect(lists.map((list) => list.tagName)).toEqual(['OL', 'UL']);
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['one', 'two', 'a', 'b']);
    expect(screen.getByText(/First line/).textContent).toBe('First lineSecond line');
  });

  it('never injects HTML', () => {
    const { container } = render(<JiraWikiView text={'h2. <b>x</b>\n<img src=x onerror=alert(1)>'} />);

    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
