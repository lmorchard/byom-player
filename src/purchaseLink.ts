import { html, type TemplateResult } from 'lit';
import type { Track } from './types';

// Identifying which store a purchase link points at.
//
// byom-sync deliberately does not record which tier produced a link — the hub
// stores only the URL — so the store is derived here from the hostname.

export type StoreId = 'bandcamp' | 'apple' | 'other';

export interface Store {
  id: StoreId;
  /** Human-readable destination, used in the link's accessible name. */
  label: string;
  /** Short decorative mark shown in the row; never the accessible name. */
  glyph: string;
}

const BANDCAMP: Store = { id: 'bandcamp', label: 'Bandcamp', glyph: 'bc' };
const APPLE: Store = { id: 'apple', label: 'Apple Music', glyph: '⌥' };
const OTHER: Store = { id: 'other', label: 'the store', glyph: '↗' };

// safeHttpUrl returns the URL only when it is an ordinary web link.
//
// A manifest is data, and byom-player is a reusable component that a host may
// point at a JSPF it does not control. Without this, a crafted `purchase_url`
// of `javascript:...` would become a clickable link in the tracklist and in the
// shopping list. Anything that isn't http(s) — including a relative or
// unparseable value — is discarded rather than rendered.
export function safeHttpUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

// storeFor maps a purchase URL to the store it belongs to.
//
// Known limitation: artists can point a custom domain at Bandcamp, and some do
// (threatmachine.com, submotile.com). Those are genuine Bandcamp pages but are
// indistinguishable from any other host, so they resolve to `other` and get the
// neutral mark. On the hub this was built against that is 24 of 11,655 links —
// cheap enough to accept rather than have the resolver record the tier.
export function storeFor(url: string | undefined): Store {
  if (!url) return OTHER;
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return OTHER;
  }
  if (host === 'bandcamp.com' || host.endsWith('.bandcamp.com')) return BANDCAMP;
  if (host === 'music.apple.com' || host === 'itunes.apple.com') return APPLE;
  return OTHER;
}

// renderPurchaseLink renders a track's buy link, or an empty slot of the same
// size when there is none, so rows in the tracklist stay aligned. It mirrors
// the reserved-width trick the active row's border-left already uses.
//
// stopPropagation is load-bearing, not defensive: the whole tracklist <li> is
// click-to-play, so without it, buying a track also starts playing it. Pressing
// Enter on the focused anchor fires a click as well, so this covers the
// keyboard path too.
export function renderPurchaseLink(t: Track): TemplateResult {
  const href = safeHttpUrl(t.purchaseUrl);
  if (!href) return html`<span class="buy buy-empty" aria-hidden="true"></span>`;
  const store = storeFor(href);
  return html`<a
    class="buy"
    part="track-buy"
    data-store=${store.id}
    href=${href}
    target="_blank"
    rel="noopener noreferrer"
    title=${`Buy on ${store.label}`}
    aria-label=${`Buy ${t.title} on ${store.label}`}
    @click=${(e: Event) => e.stopPropagation()}
    ><span aria-hidden="true">${store.glyph}</span></a
  >`;
}
