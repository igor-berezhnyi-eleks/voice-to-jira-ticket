import type { ReactNode } from 'react';

type Block =
  | { kind: 'heading'; level: 1 | 2; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; lines: string[] };

const HEADING = /^h([12])\.\s+(.*)$/;
const NUMBERED = /^#\s+(.*)$/;
const BULLET = /^\*\s+(.*)$/;

/** Reads the subset of Jira wiki markup that `renderJiraWiki` writes. Anything else is a paragraph line. */
function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split('\n')) {
    const heading = HEADING.exec(line);
    const numbered = NUMBERED.exec(line);
    const bullet = BULLET.exec(line);
    const last = blocks.at(-1);

    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1] === '1' ? 1 : 2, text: heading[2] });
    } else if (numbered ?? bullet) {
      const ordered = numbered !== null;
      const item = (numbered ?? bullet)?.[1] ?? '';
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(item);
      else blocks.push({ kind: 'list', ordered, items: [item] });
    } else if (line.trim() === '') {
      if (last?.kind === 'paragraph') blocks.push({ kind: 'paragraph', lines: [] });
    } else if (last?.kind === 'paragraph') {
      last.lines.push(line);
    } else {
      blocks.push({ kind: 'paragraph', lines: [line] });
    }
  }
  return blocks.filter((block) => block.kind !== 'paragraph' || block.lines.length > 0);
}

/** An approximation of how Jira shows the wiki text. Built from React elements, so text is never read as HTML. */
export function JiraWikiView({ text }: { text: string }) {
  return (
    <div className="wiki-view">
      {parse(text).map((block, index): ReactNode => {
        switch (block.kind) {
          case 'heading':
            // Wiki h1/h2 sit below the page's own h1/h2, so they are shown as h3/h4.
            return block.level === 1 ? <h3 key={index}>{block.text}</h3> : <h4 key={index}>{block.text}</h4>;
          case 'list': {
            const items = block.items.map((item, i) => <li key={i}>{item}</li>);
            return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
          }
          case 'paragraph':
            return (
              <p key={index}>
                {block.lines.flatMap((line, i) => (i === 0 ? [line] : [<br key={`br${i}`} />, line]))}
              </p>
            );
        }
      })}
    </div>
  );
}
