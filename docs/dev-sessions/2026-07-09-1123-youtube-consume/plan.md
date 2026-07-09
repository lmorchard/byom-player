# byom-player: consume resolved.youtube — Plan

> TDD, task by task (failing test → minimal code → green → commit). Checkbox steps.

**Goal:** byom-player reads `resolved.youtube` from the manifest and plays YouTube via a resolution chain (embedded → cache → live search → give up), reusing `ResolutionCache`.

## Constraints
- Reuse `src/providers/resolutionCache.ts` (`ResolutionCache`, `trackKey`, `LocalStorageResolutionCache`). Scope constant `youtube`.
- No throw when unconfigured — enriched/cached tracks resolve; else `null`/`unknown`.
- `npm run lint && npm test && npm run build` green.

---

### Task 1: manifest reads `resolved.youtube`

**Files:** `src/types.ts`, `src/manifest.ts`, `src/manifest.test.ts`.

- [ ] Test: a JSPF track with `extension[BYOM_EXT_NS][0].resolved.youtube = "vidX"` → `track.resolvedIds.youtube === "vidX"`; a track without → `resolvedIds` undefined; malformed `resolved` (e.g. `resolved: "x"` or `resolved.youtube` non-string) → undefined. Existing `sync_state` still read.
- [ ] Run → fail.
- [ ] Implement:
  - `types.ts`: add to `Track`: `resolvedIds?: { youtube?: string };`
  - `manifest.ts`: `mapTrack` sets `resolvedIds: readResolved(t.extension)`. Add:
    ```ts
    function readResolved(extension?: Record<string, unknown[]>): { youtube?: string } | undefined {
      const body = extension?.[BYOM_EXT_NS]?.[0] as any;
      const resolved = body?.resolved;
      if (!resolved || typeof resolved !== 'object') return undefined;
      const youtube = typeof resolved.youtube === 'string' ? resolved.youtube : undefined;
      return youtube ? { youtube } : undefined;
    }
    ```
- [ ] Run → pass. Commit `feat(manifest): read resolved.youtube into Track.resolvedIds`.

---

### Task 2: YouTubeProvider resolution chain + cache

**Files:** `src/providers/YouTubeProvider.ts`, `src/providers/YouTubeProvider.test.ts`.

- [ ] Tests (add; use a fake cache or the real one with injected storage — mirror SubsonicProvider tests):
  - embedded id (`track.resolvedIds.youtube`) → `resolve` returns it, `fetch` NOT called.
  - cache hit (pre-populated) → returns it, no fetch.
  - live search hit → returns id AND writes to cache (second `resolve` no fetch).
  - search miss → `setMiss`; next `resolve` returns null with no fetch (known miss).
  - no config + no embedded/cache → `resolve` returns **null** (no throw).
  - `cache: false` → injected cache untouched.
  - Update existing test "throws when neither configured" → now expects `null`.
- [ ] Run → fail.
- [ ] Implement in `YouTubeProvider.ts`:
  - import `{ trackKey, LocalStorageResolutionCache, type ResolutionCache }`.
  - `YouTubeConfig`: add `cache?: boolean; resolutionCache?: ResolutionCache;`
  - const `YT_SCOPE = 'youtube'`.
  - fields: `private readonly cache: ResolutionCache | null;` set in ctor:
    `this.cache = this.cfg.cache === false ? null : (this.cfg.resolutionCache ?? new LocalStorageResolutionCache());`
  - `private searchConfigured() { return !!(this.cfg.apiKey || this.cfg.searchEndpoint); }`
  - `private cachedId(track): string | null | undefined { return track.resolvedIds?.youtube ?? this.cache?.get(YT_SCOPE, trackKey(track)); }`
    - NOTE: `?? ` — embedded wins; if no embedded, `cache?.get` (which may be string|null|undefined). If cache null → undefined.
  - rename current `resolve` body into `private async liveSearch(track): Promise<string | null>` (the apiKey/searchEndpoint fetch, minus the throw; keep the two branches, drop the final `throw` — liveSearch is only called when configured).
  - new `resolve`:
    ```ts
    async resolve(track: Track): Promise<string | null> {
      const cached = this.cachedId(track);
      if (cached) return cached;
      if (cached === null) return null;
      if (!this.searchConfigured()) return null;
      const id = await this.liveSearch(track);
      const key = trackKey(track);
      if (id) this.cache?.set(YT_SCOPE, key, id);
      else this.cache?.setMiss(YT_SCOPE, key);
      return id;
    }
    ```
- [ ] Run → pass. Commit `feat(youtube): resolution chain (embedded -> cache -> search)`.

---

### Task 3: checkAvailability + isResolutionCached

**Files:** `src/providers/YouTubeProvider.ts`, `src/providers/YouTubeProvider.test.ts`.

- [ ] Tests:
  - embedded/cache hit → `checkAvailability` `available`, no fetch; `isResolutionCached` true.
  - known miss → `unavailable`; `isResolutionCached` true.
  - no config, unknown track → `unknown`; `isResolutionCached` false.
  - with key, live miss → `unavailable` (+ setMiss); live hit → `available` (+ set); transient throw → `unknown`.
- [ ] Run → fail.
- [ ] Implement:
    ```ts
    async checkAvailability(track: Track): Promise<AvailabilityStatus> {
      const cached = this.cachedId(track);
      if (cached) return 'available';
      if (cached === null) return 'unavailable';
      if (!this.searchConfigured()) return 'unknown';
      try {
        const id = await this.liveSearch(track);
        const key = trackKey(track);
        if (id) { this.cache?.set(YT_SCOPE, key, id); return 'available'; }
        this.cache?.setMiss(YT_SCOPE, key);
        return 'unavailable';
      } catch {
        return 'unknown';
      }
    }

    isResolutionCached(track: Track): boolean {
      return this.cachedId(track) !== undefined;
    }
    ```
  - Add `AvailabilityStatus` to the type import.
- [ ] Run → pass. `npm run lint && npm test && npm run build`. Commit `feat(youtube): quota-free checkAvailability + isResolutionCached`.

---

### Task 4 (manual): real fixtures + dev-harness verification

Not TDD. Export the resolved hub playlists from byom-sync and drive the harness.

- [ ] Build byom-sync from `origin/main` (temp worktree), `export jspf --input <hub with youtube_ids> --out /tmp/enriched`.
- [ ] Copy 1–2 enriched JSPF (e.g. `20150907`) into `public/playlists/`.
- [ ] `npm run dev`; load the enriched playlist with the **youtube** provider and **no** API key; confirm tracks play via the embedded id (network tab shows the YouTube iframe, no search request). Confirm an unenriched track is `unavailable` (no key) / resolves via search (with key).
