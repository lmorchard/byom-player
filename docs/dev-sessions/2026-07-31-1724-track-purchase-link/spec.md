# Per-track purchase link

## Problem

`byom-sync resolve purchase` fills a `purchase_url` for hub albums and emits it
in each track's JSPF extension. On a real hub that is now **11,655 of 14,119
tracks (83%)**. The player reads none of it — `purchase` appears nowhere in
`src/`, so the data has been shipping in every manifest with no consumer.

Surface it as a small link on each track row: if we know where to buy a track,
say so, right there.

## Why this is separate from the shopping list

byom-player#55 (the shopping-list panel) is the other consumer of the same
field, and it is a much larger feature: it needs a provider that implements
`checkAvailability` (Subsonic/Jellyfin/Plex only), an explicit throttled sweep
of the whole playlist, collation, and an export.

A per-track link needs **none** of that. The data is already in the manifest at
page load, for every provider including YouTube and Spotify. It is a rendering
change, not a resolution one, so it ships independently and much sooner — and it
establishes the `purchase_url` → `Track` plumbing the panel will reuse.

## Design

### 1. Read the field

`manifest.ts` already pulls `resolved` out of the byom extension namespace
(`https://github.com/lmorchard/byom-sync`). `purchase_url` is a sibling there.

- `Track` gains `purchaseUrl?: string`.
- A reader mirrors `readResolved`: accept only a string, ignore anything else,
  absent stays `undefined`.

Generic JSPF without the extension degrades to no links, as it does today for
`resolved` and `syncState`.

### 2. Derive the store from the URL

byom-sync deliberately does not record which tier produced a link — the spec
chose to derive it from the hostname rather than store a `purchase_source`. So
the player does that derivation, in its own small pure module:

```ts
type Store = { id: 'bandcamp' | 'apple' | 'other'; label: string };
function storeFor(url: string): Store;
```

- `*.bandcamp.com` → Bandcamp
- `music.apple.com`, `itunes.apple.com` → Apple
- anything else → `other`, with a neutral mark

**Known limitation, accepted.** Artists can point a custom domain at Bandcamp,
and 24 links on the live hub do exactly that (`threatmachine.com`,
`submotile.com`, `hungrylucy.com`). Those are real Bandcamp pages that will
display the neutral mark. At 0.2% of links, that is cheaper than changing the
emitter and re-running a six-hour fill.

### 3. Render it

`renderRow` builds a grid row:

```
grid-template-columns: 2.2rem  <art>  1fr  auto
                       [num]   [thumb] [title/artist] [duration]
```

Add a fifth `auto` column. The `1fr` title column absorbs the width, so nothing
else moves.

- With a link: an `<a>` carrying the store glyph.
- Without: an empty `<span>` occupying the same slot, so rows stay aligned.
  This matches the existing precedent in the same file —
  `border-left: 3px solid transparent; /* reserve the active bar's width */`.

Link attributes:

- `target="_blank"`, `rel="noopener noreferrer"` — it leaves the site.
- **`@click` must call `stopPropagation()`.** The whole `<li>` has a
  click-to-play handler; without this, buying a track also starts playing it.
  This is the one bug the change can realistically introduce, and it is
  invisible until someone taps it.
- `aria-label="Buy {title} on {store}"` carries the destination, so the glyph
  itself stays decorative (`aria-hidden`) and can be visually quiet.

### 4. No gating

No provider requirement, no scan, no setting, no host attribute. The link
appears wherever the manifest has one — including the chrome-less `/embed/`
pages, since they render the same component.

## Testing

- **`storeFor`**: bandcamp subdomain, apple both hosts, a custom domain falling
  to `other`, an unparseable string, an empty string.
- **manifest**: `purchase_url` read into `Track.purchaseUrl`; absent extension
  leaves it `undefined`; a non-string value is ignored.
- **render**: a row with a link has an anchor with the right `href`, `target`
  and `rel`; a row without has no anchor but still renders its slot.
- **The important one**: clicking the anchor does **not** invoke the row's
  play handler.

## Out of scope

- The shopping-list panel (byom-player#55).
- Any change to byom-sync, including recording the source tier.
- Discogs links — that tier has not been run, so no hub carries one yet. The
  `other` branch covers them if it ever is.
