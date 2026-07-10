// A deliberately tiny inline-markdown renderer for host-authored playlist
// descriptions. Supports **bold**/__bold__, *italic*/_italic_, [text](url)
// links, and line breaks — nothing else (no lists, headings, block quotes).
//
// The source is HTML-escaped BEFORE any formatting is applied, so the only HTML
// that reaches the DOM is the small set of tags we emit. Link hrefs are
// restricted to http(s)/mailto; anything else renders as plain text. Even though
// descriptions are host-authored (low trust surface), this keeps it safe by
// construction to pass through Lit's `unsafeHTML`.

const ALLOWED_HREF = /^(https?:|mailto:)/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderMarkdownInline(src: string | undefined): string {
  if (!src) return '';
  let s = escapeHtml(src);
  // Links first (before emphasis, so `*` inside a URL isn't mangled). A
  // disallowed protocol drops the link and keeps just the visible text.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) =>
    ALLOWED_HREF.test(url)
      ? `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`
      : text,
  );
  // Bold before italic so `**` is consumed before the single-`*` pass.
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__(.+?)__/g, '<strong>$1</strong>');
  s = s.replace(/\*(.+?)\*/g, '<em>$1</em>');
  s = s.replace(/_(.+?)_/g, '<em>$1</em>');
  s = s.replace(/\n/g, '<br>');
  return s;
}
