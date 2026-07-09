# Subsonic Scrobble Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record listening metrics on the Navidrome / Subsonic server by calling the Subsonic `scrobble` API from `SubsonicProvider` as tracks play.

**Architecture:** Two-phase scrobbling driven off the provider's existing HTML audio events. Now-playing (`submission=false`) fires off the `playing` event; the real submission (`submission=true`) fires off the existing `timeupdate` handler once playback position crosses a threshold. Scrobble calls are fire-and-forget — a bare `fetch(...).catch()` that never awaits, never routes through the retrying `fetchJson`, and never touches provider state.

**Tech Stack:** TypeScript, Vitest + happy-dom. No new dependencies.

## Global Constraints

- `scrobble` method built via the existing `url()` helper → path `/rest/scrobble.view` with the same auth params as `search3`/`stream`. `.view` suffix kept for consistency; Navidrome accepts the bare alias too (note it in a comment).
- Scrobble is fire-and-forget: MUST NOT await in `play()`, MUST NOT trip the circuit breaker, MUST NOT emit `error`, MUST NOT throw. Failures swallowed, logged only under `debug`.
- Config flag `scrobble?: boolean`, default `true` (only `scrobble: false` disables).
- Each phase fires at most once per loaded track; `load()` resets the flags.
- No new audio event listeners — reuse the existing `playing` and `timeupdate` handlers.
- happy-dom: `audio.duration` is read-only via direct assignment — tests MUST set it with `Object.defineProperty(audio, 'duration', { value: N, configurable: true })`. `audio.currentTime` can be set directly.
- `Date.now()` is fine here (browser provider code, not a workflow script).

## File Structure

- Modify: `src/providers/SubsonicProvider.ts` — add config flag, per-track scrobble state, `scrobble()` helper, now-playing trigger on `playing`, submission trigger in `emitProgress`.
- Modify: `src/providers/SubsonicProvider.test.ts` — add scrobble tests alongside existing ones.

No new files; the feature is small and belongs with the provider it extends.

---

### Task 1: Config flag, `scrobble()` helper, and now-playing on start

**Files:**
- Modify: `src/providers/SubsonicProvider.ts`
- Test: `src/providers/SubsonicProvider.test.ts`

**Interfaces:**
- Consumes: existing `url()`, `log()`, `cfg`, and the `playing` event listener in the constructor.
- Produces:
  - `SubsonicConfig.scrobble?: boolean` (default `true`).
  - private `currentId: string | null` — resolved song id of the loaded track (`null` when unresolved/unavailable/errored).
  - private `nowPlayingSent: boolean`, `submitted: boolean` — per-track once-guards, reset in `load()`.
  - private `scrobbleEnabled(): boolean` → `this.cfg.scrobble !== false`.
  - private `scrobble(id: string, submission: boolean): void` — fire-and-forget `GET /rest/scrobble.view?id&submission&time`.
  - private `sendNowPlaying(): void` — sends `submission=false` once per track.

- [ ] **Step 1: Write the failing tests**

Add this shared helper near the top of `SubsonicProvider.test.ts` (below the existing `okResponse`):

```ts
// fetch mock that answers search3 with one song and everything else (scrobble) with ok
function mockServer(songId = 'song-1') {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('search3.view')) {
      return {
        ok: true,
        json: async () => ({
          'subsonic-response': { status: 'ok', searchResult3: { song: [{ id: songId }] } },
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({ 'subsonic-response': { status: 'ok' } }) } as Response;
  });
}

function scrobbleCalls(fetchMock: { mock: { calls: unknown[][] } }) {
  return fetchMock.mock.calls
    .map((c) => new URL(c[0] as string))
    .filter((u) => u.pathname === '/rest/scrobble.view');
}
```

Add these tests inside the `describe('SubsonicProvider', ...)` block:

```ts
it('sends now-playing (submission=false) once when playback starts', async () => {
  const fetchMock = mockServer();
  const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
  await p.load({ title: 'T', artist: 'A' });
  const audio = (p as any).audio as HTMLAudioElement;
  audio.dispatchEvent(new Event('playing'));
  audio.dispatchEvent(new Event('playing')); // must not re-send

  const nowPlaying = scrobbleCalls(fetchMock).filter(
    (u) => u.searchParams.get('submission') === 'false',
  );
  expect(nowPlaying.length).toBe(1);
  expect(nowPlaying[0].searchParams.get('id')).toBe('song-1');
  expect(nowPlaying[0].searchParams.get('time')).toBeTruthy();
  expect(nowPlaying[0].searchParams.get('c')).toBe('byom-player');
});

it('does not scrobble when scrobble: false', async () => {
  const fetchMock = mockServer();
  const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K', scrobble: false });
  await p.load({ title: 'T', artist: 'A' });
  const audio = (p as any).audio as HTMLAudioElement;
  audio.dispatchEvent(new Event('playing'));
  expect(scrobbleCalls(fetchMock).length).toBe(0);
});

it('does not scrobble on playing when no track is loaded', () => {
  const fetchMock = mockServer();
  const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
  const audio = (p as any).audio as HTMLAudioElement;
  audio.dispatchEvent(new Event('playing'));
  expect(scrobbleCalls(fetchMock).length).toBe(0);
});

it('a failed scrobble does not emit error or throw', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('search3.view')) {
      return {
        ok: true,
        json: async () => ({
          'subsonic-response': { status: 'ok', searchResult3: { song: [{ id: 's1' }] } },
        }),
      } as Response;
    }
    throw new Error('scrobble network fail');
  });
  const states: ProviderState[] = [];
  const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
  p.onStateChange((s) => states.push(s));
  await p.load({ title: 'T', artist: 'A' });
  const audio = (p as any).audio as HTMLAudioElement;
  audio.dispatchEvent(new Event('playing'));
  await new Promise((r) => setTimeout(r, 0)); // let the rejected promise settle
  expect(states).not.toContain('error');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/providers/SubsonicProvider.test.ts`
Expected: FAIL — no scrobble requests are made (`nowPlaying.length` is 0, not 1).

- [ ] **Step 3: Implement config flag, state, and now-playing**

In `SubsonicConfig` add the flag (below `debug`):

```ts
  scrobble?: boolean; // send Subsonic scrobble on play (now-playing + submission); default true
```

Add fields near the other private fields (below `authSalt`):

```ts
  // Per-track scrobble state (reset in load()).
  private currentId: string | null = null;
  private nowPlayingSent = false;
  private submitted = false;
```

Change the `playing` listener in the constructor from:

```ts
    this.audio.addEventListener('playing', () => this.callback('playing'), opts);
```

to:

```ts
    this.audio.addEventListener(
      'playing',
      () => {
        this.callback('playing');
        this.sendNowPlaying();
      },
      opts,
    );
```

In `load()`, reset state at the top and record the id on success. Replace the method body so it reads:

```ts
  async load(track: Track): Promise<void> {
    this.currentId = null;
    this.nowPlayingSent = false;
    this.submitted = false;
    let id: string | null;
    try {
      id = await this.resolve(track);
    } catch (err) {
      // Transient failure that persisted past retries — NOT a clean miss.
      this.log('resolve error', track.artist, '-', track.title, err);
      this.callback('error');
      return;
    }
    if (!id) {
      // Server answered but the track isn't in the collection — a clean miss.
      this.log('not in collection', track.artist, '-', track.title);
      this.callback('unavailable');
      return;
    }
    this.log('resolved', track.artist, '-', track.title, '->', id);
    this.currentId = id;
    this.audio.src = this.streamUrl(id);
    this.callback('ready');
  }
```

Add the helper methods (place them just below `emitProgress`):

```ts
  private scrobbleEnabled(): boolean {
    return this.cfg.scrobble !== false; // default on
  }

  private sendNowPlaying(): void {
    if (!this.currentId || this.nowPlayingSent || !this.scrobbleEnabled()) return;
    this.nowPlayingSent = true;
    this.scrobble(this.currentId, false);
  }

  // scrobble notifies the server of a play. Fire-and-forget: it never awaits,
  // never routes through the retrying fetchJson, and never affects provider
  // state — a flaky scrobble must not disrupt playback or trip the breaker.
  // submission=false is a "now playing" ping; submission=true is a play count.
  // Navidrome also accepts the bare /rest/scrobble alias.
  private scrobble(id: string, submission: boolean): void {
    const url = this.url('scrobble.view', {
      id,
      submission: String(submission),
      time: String(Date.now()),
    });
    fetch(url).catch((err) => this.log('scrobble failed', err));
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/providers/SubsonicProvider.test.ts`
Expected: PASS (all existing tests + the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/providers/SubsonicProvider.ts src/providers/SubsonicProvider.test.ts
git commit -m "feat(subsonic): send now-playing scrobble on play start"
```

---

### Task 2: Submission scrobble at play threshold

**Files:**
- Modify: `src/providers/SubsonicProvider.ts`
- Test: `src/providers/SubsonicProvider.test.ts`

**Interfaces:**
- Consumes: `currentId`, `submitted`, `scrobbleEnabled()`, `scrobble()` from Task 1; the existing `emitProgress()` (fired by `timeupdate`/`durationchange`).
- Produces:
  - module constants `SCROBBLE_MIN_DURATION_S = 30`, `SCROBBLE_MAX_DELAY_S = 240`.
  - private `maybeSubmit(positionS: number, durationS: number): void` — submits once when `positionS` first reaches `min(durationS / 2, 240)`, skipping tracks shorter than 30 s.

- [ ] **Step 1: Write the failing tests**

Add these tests inside the `describe('SubsonicProvider', ...)` block:

```ts
it('submits (submission=true) once when position crosses half the duration', async () => {
  const fetchMock = mockServer();
  const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
  await p.load({ title: 'T', artist: 'A' });
  const audio = (p as any).audio as HTMLAudioElement;
  Object.defineProperty(audio, 'duration', { value: 200, configurable: true }); // half = 100s

  audio.currentTime = 99;
  audio.dispatchEvent(new Event('timeupdate')); // below threshold
  expect(scrobbleCalls(fetchMock).filter((u) => u.searchParams.get('submission') === 'true'))
    .toHaveLength(0);

  audio.currentTime = 100;
  audio.dispatchEvent(new Event('timeupdate')); // at threshold
  audio.currentTime = 180;
  audio.dispatchEvent(new Event('timeupdate')); // past threshold — must not re-send

  const subs = scrobbleCalls(fetchMock).filter((u) => u.searchParams.get('submission') === 'true');
  expect(subs).toHaveLength(1);
  expect(subs[0].searchParams.get('id')).toBe('song-1');
});

it('caps the submission threshold at 4 minutes for long tracks', async () => {
  const fetchMock = mockServer();
  const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
  await p.load({ title: 'T', artist: 'A' });
  const audio = (p as any).audio as HTMLAudioElement;
  Object.defineProperty(audio, 'duration', { value: 3600, configurable: true }); // half = 1800s, cap = 240s

  audio.currentTime = 239;
  audio.dispatchEvent(new Event('timeupdate'));
  expect(scrobbleCalls(fetchMock).filter((u) => u.searchParams.get('submission') === 'true'))
    .toHaveLength(0);

  audio.currentTime = 240;
  audio.dispatchEvent(new Event('timeupdate'));
  expect(scrobbleCalls(fetchMock).filter((u) => u.searchParams.get('submission') === 'true'))
    .toHaveLength(1);
});

it('never submits tracks shorter than 30 seconds', async () => {
  const fetchMock = mockServer();
  const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K' });
  await p.load({ title: 'T', artist: 'A' });
  const audio = (p as any).audio as HTMLAudioElement;
  Object.defineProperty(audio, 'duration', { value: 20, configurable: true });

  audio.currentTime = 20; // played to the end
  audio.dispatchEvent(new Event('timeupdate'));
  expect(scrobbleCalls(fetchMock).filter((u) => u.searchParams.get('submission') === 'true'))
    .toHaveLength(0);
});

it('does not submit when scrobble: false', async () => {
  const fetchMock = mockServer();
  const p = new SubsonicProvider({ baseUrl: 'https://nav.example', apiKey: 'K', scrobble: false });
  await p.load({ title: 'T', artist: 'A' });
  const audio = (p as any).audio as HTMLAudioElement;
  Object.defineProperty(audio, 'duration', { value: 200, configurable: true });
  audio.currentTime = 150;
  audio.dispatchEvent(new Event('timeupdate'));
  expect(scrobbleCalls(fetchMock)).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/providers/SubsonicProvider.test.ts`
Expected: FAIL — no `submission=true` request is made.

- [ ] **Step 3: Implement the threshold submission**

Add module-level constants near the top (below `CLIENT_NAME`):

```ts
// Last.fm-style scrobble rule: submit once playback passes half the track or
// 4 minutes, whichever comes first; never submit tracks under 30 seconds.
const SCROBBLE_MIN_DURATION_S = 30;
const SCROBBLE_MAX_DELAY_S = 240;
```

Extend `emitProgress()` to also run the submission check. Replace it with:

```ts
  private emitProgress(): void {
    const durationS = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    this.progressCallback(this.audio.currentTime * 1000, durationS * 1000);
    this.maybeSubmit(this.audio.currentTime, durationS);
  }

  private maybeSubmit(positionS: number, durationS: number): void {
    if (!this.currentId || this.submitted || !this.scrobbleEnabled()) return;
    if (durationS < SCROBBLE_MIN_DURATION_S) return; // too short to count / unknown duration
    const threshold = Math.min(durationS / 2, SCROBBLE_MAX_DELAY_S);
    if (positionS >= threshold) {
      this.submitted = true;
      this.scrobble(this.currentId, true);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/providers/SubsonicProvider.test.ts`
Expected: PASS (all existing + Task 1 + Task 2 tests).

- [ ] **Step 5: Full verification + commit**

```bash
npm run lint && npm test && npm run build
git add src/providers/SubsonicProvider.ts src/providers/SubsonicProvider.test.ts
git commit -m "feat(subsonic): submit scrobble at play threshold (half / 4min)"
```

---

## Post-implementation: live verification

Not a code task — drive it manually (AGENTS.md: live Subsonic testing is manual against a server). With `npm run dev` running and Navidrome creds in the harness:

- Play a track, watch the network tab for `GET /rest/scrobble.view?...submission=false` on start.
- Let it pass the halfway point, confirm a `submission=true` request fires once.
- Confirm the play count / recently-played updates in the Navidrome UI.
- Skip a track before the threshold, confirm no `submission=true` for it.
