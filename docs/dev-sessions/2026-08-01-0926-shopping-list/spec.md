# Shopping list panel

Issue: byom-player#55. Companion feature already shipped: #56 (per-track
purchase links).

## Problem

A playlist played through a personal-collection provider will contain tracks the
collection doesn't hold. The player already knows which — `checkAvailability`
marks them `unavailable` as it scans — but that knowledge is scattered across
tracklist rows and lost when the page closes.

Collate it: the missing tracks, grouped by artist and album, each with a link to
buy the music.

## What changed since this was first designed

The original design had the panel doing two jobs: identify misses *and* surface
purchase links. #56 shipped the links independently — every track row already
shows one, for every provider, with no scan.

So the panel's remaining job is narrower and clearer: **scan, collate, export.**
The link rendering is reuse, not new work.

## Design

### 1. `isCollection` — one capability, two consequences

`AudioProvider` gains `isCollection?: boolean`. Subsonic, Jellyfin and Plex set
it; YouTube, Spotify and the mock don't.

It decides two things, and both follow from the same fact — *this server is
yours*:

**It gates the panel.** Every provider that implements `checkAvailability`
returns the same `unavailable` value, but it does not mean the same thing.
Against a collection it means "you don't own this", which is something you can
fix by buying it. Against YouTube it means "no video resolved", which buying
the record does not fix. Offering a *shopping list* built from the second would
make the feature assert something false, so only collection providers get it.

**It sets the scan pace.** `AvailabilityQueue`'s 300ms cooldown exists to be
polite to third-party APIs with quotas. A collection server has no quota to
burn, so collection providers scan at **50ms**. On the reference hub that is the
difference between 43 minutes and 7 for the largest playlist.

Why one field rather than two: a separate `scanGapMs` would let the two settings
drift apart, and there is no coherent provider that wants one without the other.

### 2. `src/shoppingList.ts` — collation, pure

```ts
interface ShoppingAlbum { artist: string; album?: string; tracks: Track[]; purchaseUrl?: string }
interface ShoppingList { albums: ShoppingAlbum[]; missingCount: number; uncheckedCount: number }

function buildShoppingList(tracks: Track[], statuses: Map<number, AvailabilityStatus>): ShoppingList;
function toMarkdown(list: ShoppingList, playlistTitle: string): string;
```

- Group `unavailable` tracks by artist, then album. Playlist order within an
  album; albums sorted by missing-track count descending, then artist name.
- Tracks with no album group under their artist in one untitled bucket, last.
- **`unknown` is never a row.** It is a transient failure, not an absence —
  putting it on a shopping list would tell you to buy a record you already own
  because the server hiccuped. It is counted separately as `uncheckedCount`.
- `purchaseUrl` is taken from the first track in the group that has one, since
  it is album-scoped upstream.

No DOM, no lit, no component state. This is the part worth testing hardest.

### 3. Sweep-all in `AvailabilityQueue`

Today the queue is fed the visible window, and `retain()` prunes rows scrolled
past. Add a mode that enqueues every index and skips that pruning.

The existing `done` set already persists for the session, so a playlist that has
been scrolled through is largely pre-checked and the sweep only fills gaps.

### 4. The panel

`view` becomes `'list' | 'settings' | 'shopping'`, reusing the existing overlay
pattern and backdrop-click-to-close.

- **Summoned, never automatic.** A full scan starts only on explicit user
  action. Lazy visible-window scanning behaves exactly as it does today when the
  panel is closed. This is a firm constraint: the sweep is expensive and must
  not run on its own.
- Progress as `checked n / total`, rendering incrementally so the list is useful
  before the sweep completes.
- Closing mid-sweep stops queueing new checks and keeps results already
  gathered; re-summoning resumes.

### 5. Links are reuse

`renderPurchaseLink` and `storeFor` already exist from #56. An album with no
`purchase_url` still appears — you still don't own it — with a constructed
`https://bandcamp.com/search?q=<artist>+<album>&item_type=a`.

### 6. Export

Copy as Markdown, and download as a file. Grouped by artist → album with links,
so it pastes into a note or an issue.

## Honesty constraint

A provider "miss" is frequently a metadata mismatch rather than a real absence:
the collection may hold the track under a different album or artist spelling.
The panel says so plainly rather than presenting the list as ground truth. This
matters more here than for per-track links, because a list *titled* "missing"
invites being trusted.

Per-row dismissal is out of scope for v1.

## Testing

- `buildShoppingList`: grouping by artist/album, ordering by missing count,
  playlist order within an album, the albumless bucket, `unknown` excluded and
  counted, empty input, all-available input.
- `toMarkdown`: stable output, links present, an album with no link falls back
  to a search URL.
- Gate: a provider without `isCollection` offers no panel.
- **Nothing scans until summoned** — the constraint from the original design.
- Pace: a collection provider scans at the short gap, a non-collection one does
  not.

## Out of scope

- Cross-playlist aggregation. The panel is per-playlist.
- Per-row dismissal or persistent "already bought" state.
- Any change to byom-sync.
