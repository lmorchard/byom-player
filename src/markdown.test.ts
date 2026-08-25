import { describe, it, expect } from 'vitest';
import { renderMarkdownInline } from './markdown';

describe('renderMarkdownInline', () => {
  it('returns empty for empty/undefined input', () => {
    expect(renderMarkdownInline('')).toBe('');
    expect(renderMarkdownInline(undefined)).toBe('');
  });

  it('escapes HTML in the source', () => {
    expect(renderMarkdownInline('<b>x</b> & "q"')).toBe('&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot;');
  });

  it('renders bold (** and __)', () => {
    expect(renderMarkdownInline('a **bold** b')).toBe('a <strong>bold</strong> b');
    expect(renderMarkdownInline('a __bold__ b')).toBe('a <strong>bold</strong> b');
  });

  it('renders italic (* and _)', () => {
    expect(renderMarkdownInline('a *it* b')).toBe('a <em>it</em> b');
    expect(renderMarkdownInline('a _it_ b')).toBe('a <em>it</em> b');
  });

  it('renders an allowed link', () => {
    expect(renderMarkdownInline('see [notes](https://e.com/x)')).toBe(
      'see <a href="https://e.com/x" target="_blank" rel="noopener noreferrer">notes</a>',
    );
  });

  it('drops a disallowed link protocol, keeping the text', () => {
    expect(renderMarkdownInline('[x](javascript:evil)')).toBe('x');
  });

  // Regression: the emphasis passes used to run over already-rendered anchors,
  // so the two `_blank` occurrences in a two-link description paired up and the
  // italic rule wrapped everything between them. Live on
  // mixtapes.lmorchard.com this shipped as target="&lt;em&gt;blank", which
  // silently stops links opening in a new tab.
  it('leaves target="_blank" intact when a description has two links', () => {
    const out = renderMarkdownInline('[a](https://e.com/1) and [b](https://e.com/2)');
    expect(out).toBe(
      '<a href="https://e.com/1" target="_blank" rel="noopener noreferrer">a</a>' +
        ' and ' +
        '<a href="https://e.com/2" target="_blank" rel="noopener noreferrer">b</a>',
    );
    expect(out).not.toContain('<em>blank');
  });

  it('does not treat underscores inside a url as emphasis', () => {
    expect(renderMarkdownInline('[q](https://e.com/a_b_c)')).toBe(
      '<a href="https://e.com/a_b_c" target="_blank" rel="noopener noreferrer">q</a>',
    );
  });

  it('still applies emphasis inside link text', () => {
    expect(renderMarkdownInline('[**q**](https://e.com/x)')).toBe(
      '<a href="https://e.com/x" target="_blank" rel="noopener noreferrer"><strong>q</strong></a>',
    );
  });

  it('still applies emphasis outside a link', () => {
    expect(renderMarkdownInline('*hi* [a](https://e.com/1) _bye_')).toBe(
      '<em>hi</em> <a href="https://e.com/1" target="_blank" rel="noopener noreferrer">a</a> <em>bye</em>',
    );
  });

  it('converts newlines to <br>', () => {
    expect(renderMarkdownInline('a\nb')).toBe('a<br>b');
  });
});
