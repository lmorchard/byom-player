// A deliberately tiny inline-markdown renderer for host-authored playlist
// descriptions. Supports **bold**/__bold__, *italic*/_italic_, [text](url)
// links, and line breaks — nothing else (no lists, headings, block quotes).
//
// The source is HTML-escaped BEFORE any formatting is applied, so the only HTML
// that reaches the DOM is the small set of tags we emit. Link hrefs are
// restricted to http(s)/mailto; anything else renders as plain text. Even though
// descriptions are host-authored (low trust surface), this keeps it safe by
// construction to pass through Lit's `unsafeHTML`.
//
// byom-sync renders the same grammar server-side for its feed and landing page
// (internal/site/inlinemd.go), so one description string looks the same in the
// player, in the RSS body, and on a playlist card. A change here belongs there
// too.

const ALLOWED_HREF = /^(https?:|mailto:)/i;

// Anchors are parked in slots while the emphasis passes run, so an emphasis
// rule can never reach inside markup we already emitted. Two failures came from
// not doing this: a description with two links had its `target="_blank"`
// attributes paired up by the `_italic_` rule and rewritten to
// `target="<em>blank"` (links silently stopped opening in a new tab), and any
// URL containing underscores got an `<em>` spliced into its href. NUL cannot
// U+E000 is a Private Use Area code point: it carries no markdown meaning, will
// not occur in a real description, and (unlike NUL) is not a control character,
// so it doesn't trip eslint's no-control-regex. It is stripped from the source
// first so a hostile input can't forge a slot.
const SLOT = /\uE000L(\d+)\uE000/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Bold before italic so `**` is consumed before the single-`*` pass sees it.
function applyEmphasis(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

export function renderMarkdownInline(src: string | undefined): string {
  if (!src) return '';
  let s = escapeHtml(src.replace(/\uE000/g, ''));

  // Links first, into slots. A disallowed protocol drops the link and keeps
  // just the visible text. Emphasis inside the link text is applied here, since
  // the slot hides it from the pass below.
  const links: string[] = [];
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    if (!ALLOWED_HREF.test(url)) return text;
    links.push(
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${applyEmphasis(text)}</a>`,
    );
    return `\uE000L${links.length - 1}\uE000`;
  });

  s = applyEmphasis(s);
  s = s.replace(/\n/g, '<br>');
  s = s.replace(SLOT, (_m, i: string) => links[Number(i)] ?? '');
  return s;
}
