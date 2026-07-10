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

  it('converts newlines to <br>', () => {
    expect(renderMarkdownInline('a\nb')).toBe('a<br>b');
  });
});
