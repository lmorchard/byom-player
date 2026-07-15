import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './ByomPlayer';
import { ByomPlayer, matchesFilter, isOrphan, computeCenterOffset } from './ByomPlayer';
import type { Track } from './types';
import { BYOM_EXT_NS } from './manifest';
import { loadSettings, saveSettings } from './settings';
import type { AudioProvider, ProviderState } from './providers/types';

// A provider whose state transitions the test drives directly.
class ControllableProvider implements AudioProvider {
  name = 'ctrl';
  loadedIndex: string[] = [];
  disposed = false;
  seekedMs: number | null = null;
  private cb: (s: ProviderState) => void = () => {};
  private progressCb: (pos: number, dur: number) => void = () => {};
  async initialize(): Promise<void> {}
  async load(t: { title: string }): Promise<void> {
    this.loadedIndex.push(t.title);
  }
  async play(): Promise<void> {
    this.cb('playing');
  }
  pause(): void {
    this.cb('paused');
  }
  seek(ms: number): void {
    this.seekedMs = ms;
  }
  onStateChange(cb: (s: ProviderState) => void): void {
    this.cb = cb;
  }
  onProgress(cb: (pos: number, dur: number) => void): void {
    this.progressCb = cb;
  }
  dispose(): void {
    this.disposed = true;
  }
  emit(s: ProviderState): void {
    this.cb(s);
  }
  emitProgress(pos: number, dur: number): void {
    this.progressCb(pos, dur);
  }
}

const jspf = {
  playlist: {
    title: 'Test PL',
    creator: 'Les',
    date: '2026-07-08T12:00:00Z',
    annotation: 'A **great** mix',
    extension: { [BYOM_EXT_NS]: [{ date_updated: '2026-09-08T12:00:00Z' }] },
    track: [
      { title: 'A', creator: 'aa', duration: 60 },
      {
        title: 'B',
        creator: 'bb',
        duration: 120,
        extension: { [BYOM_EXT_NS]: [{ spotify_present: false }] },
      },
      { title: 'C', creator: 'cc', album: 'Greatest Hits', duration: 60 },
    ],
  },
};

// A larger manifest for the viewport-driven prescan mapping tests — more
// tracks than the 10-track lookahead so a far index (e.g. 40) is provably
// outside it. Real indices 20/25/30 carry a distinct artist so a filter can
// select exactly them, at positions (0/1/2) that differ from their real index
// — this is what makes the position→real-index mapping test unambiguous.
const BIG_TRACK_COUNT = 50;
const FILTER_MATCH_INDICES = [20, 25, 30];
const bigJspf = {
  playlist: {
    title: 'Big PL',
    track: Array.from({ length: BIG_TRACK_COUNT }, (_, i) => ({
      title: `Track ${i}`,
      creator: FILTER_MATCH_INDICES.includes(i) ? 'Special Artist' : `Artist ${i}`,
      duration: 60,
    })),
  },
};

async function mount(): Promise<{ el: ByomPlayer; provider: ControllableProvider }> {
  const provider = new ControllableProvider();
  const el = document.createElement('byom-player') as ByomPlayer;
  el.src = '/playlist.jspf.json';
  el.providerFactory = () => provider;
  el.skipDelayMs = 0; // deterministic in tests (no throttle wait)
  document.body.appendChild(el);
  // let connectedCallback's async fetch/init settle
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
  return { el, provider };
}

// Flush pending microtasks/macrotasks (async provider load→play chain), then the render.
async function settle(el: ByomPlayer): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
}

// Type a value into the tracklist filter field and let the render settle.
async function setFilter(el: ByomPlayer, value: string): Promise<void> {
  const input = el.shadowRoot!.querySelector<HTMLInputElement>('.filter-input')!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
}

// Reach private state/helpers for assertions (no public API for these).
const rowsOf = (el: ByomPlayer) =>
  (el as unknown as { filteredRows: Array<{ t: Track; i: number }> }).filteredRows;
const stateOf = (el: ByomPlayer, i: number, orphaned = false) =>
  (el as unknown as { trackState(i: number, o: boolean): string }).trackState(i, orphaned);
const indexOf = (el: ByomPlayer) => (el as unknown as { currentIndex: number }).currentIndex;
const clickRow = (el: ByomPlayer, i: number) =>
  (el as unknown as { onRowClick(i: number): void }).onRowClick(i);
const availabilityOf = (el: ByomPlayer) =>
  (el as unknown as { availability: Map<number, string> }).availability;
const checkingOf = (el: ByomPlayer) => (el as unknown as { checking: Set<number> }).checking;
const fireRangeChanged = (el: ByomPlayer, first: number, last: number) =>
  (el as unknown as { onRangeChanged(e: { first: number; last: number }): void }).onRangeChanged({
    first,
    last,
  });

describe('matchesFilter', () => {
  const t: Track = { title: 'Black Out Days', artist: 'Phantogram', album: 'Voices' };
  it('matches everything on an empty query', () => {
    expect(matchesFilter(t, '')).toBe(true);
    expect(matchesFilter(t, '   ')).toBe(true);
  });
  it('matches title/artist/album case-insensitively', () => {
    expect(matchesFilter(t, 'phantogram')).toBe(true);
    expect(matchesFilter(t, 'VOICES')).toBe(true);
    expect(matchesFilter(t, 'black out')).toBe(true);
  });
  it('does not match unrelated text', () => {
    expect(matchesFilter(t, 'zzz')).toBe(false);
  });
});

describe('isOrphan', () => {
  it('is true only when spotifyPresent is explicitly false', () => {
    expect(isOrphan({ title: 'a', artist: 'a', syncState: { spotifyPresent: false } })).toBe(true);
    expect(isOrphan({ title: 'a', artist: 'a', syncState: { spotifyPresent: true } })).toBe(false);
    expect(isOrphan({ title: 'a', artist: 'a' })).toBe(false);
  });
});

describe('<byom-player>', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => jspf,
    } as Response);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('loads the manifest and derives one row per track', async () => {
    const { el } = await mount();
    expect(el.shadowRoot!.querySelector('.title')!.textContent).toContain('Test PL');
    expect(rowsOf(el)).toHaveLength(3);
  });

  it('marks orphaned tracks (spotify_present === false)', async () => {
    const { el } = await mount();
    const rows = rowsOf(el);
    expect(isOrphan(rows[1].t)).toBe(true);
    expect(isOrphan(rows[0].t)).toBe(false);
  });

  it('selecting a track plays it and makes it active', async () => {
    const { el, provider } = await mount();
    clickRow(el, 2);
    await settle(el);
    expect(indexOf(el)).toBe(2);
    expect(stateOf(el, 2)).toBe('active');
    expect(stateOf(el, 0)).not.toBe('active');
    expect(provider.loadedIndex).toContain('C');
  });

  it('shows the transport preview badge when the Spotify embed reports a 30s preview', async () => {
    const provider = new ControllableProvider();
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.provider = 'spotify';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    clickRow(el, 0); // play track A (manifest 60s)
    await settle(el);
    const badge = () => el.shadowRoot!.querySelector('.preview-badge');

    // Full-length progress → no badge.
    provider.emitProgress(1000, 60_000);
    await el.updateComplete;
    expect(badge()).toBeNull();

    // 30s embed duration against a 60s manifest track → preview badge.
    provider.emitProgress(1000, 30_000);
    await el.updateComplete;
    expect(badge()).not.toBeNull();

    // Back to full (e.g. viewer clicked Spotify's own ▶) → badge clears.
    provider.emitProgress(1000, 60_000);
    await el.updateComplete;
    expect(badge()).toBeNull();
  });

  it('never shows the preview badge for a non-Spotify provider', async () => {
    const provider = new ControllableProvider();
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.provider = 'subsonic';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    clickRow(el, 0);
    await settle(el);
    provider.emitProgress(1000, 30_000);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.preview-badge')).toBeNull();
  });

  it('filters the tracklist by title/artist (case-insensitive)', async () => {
    const { el } = await mount();
    await setFilter(el, 'bb');
    expect(rowsOf(el).map((r) => r.t.title)).toEqual(['B']);
    await setFilter(el, 'BB');
    expect(rowsOf(el).map((r) => r.t.title)).toEqual(['B']);
  });

  it('filters the tracklist by album (even though album is not shown)', async () => {
    const { el } = await mount();
    await setFilter(el, 'greatest');
    expect(rowsOf(el).map((r) => r.t.title)).toEqual(['C']);
  });

  it('shows all tracks when the query is cleared', async () => {
    const { el } = await mount();
    await setFilter(el, 'zzz');
    expect(rowsOf(el)).toHaveLength(0);
    await setFilter(el, '');
    expect(rowsOf(el)).toHaveLength(3);
  });

  it('selecting a filtered row plays the correct real track', async () => {
    const { el, provider } = await mount();
    await setFilter(el, 'cc');
    const rows = rowsOf(el);
    expect(rows).toHaveLength(1);
    clickRow(el, rows[0].i);
    await settle(el);
    expect(provider.loadedIndex).toContain('C');
    expect(indexOf(el)).toBe(2); // real index of C, not the filtered position
    expect(stateOf(el, rows[0].i)).toBe('active');
  });

  it('shows a no-matches message when nothing matches', async () => {
    const { el } = await mount();
    await setFilter(el, 'zzz');
    expect(rowsOf(el)).toHaveLength(0);
    const msg = el.shadowRoot!.querySelector('.no-matches');
    expect(msg).not.toBeNull();
    expect(msg!.textContent).toContain('zzz');
  });

  it('clear button empties the query and restores all rows', async () => {
    const { el } = await mount();
    await setFilter(el, 'cc');
    expect(rowsOf(el)).toHaveLength(1);
    const clearBtn = el.shadowRoot!.querySelector<HTMLElement>('.filter-clear');
    expect(clearBtn).not.toBeNull();
    clearBtn!.click();
    await el.updateComplete;
    expect(rowsOf(el)).toHaveLength(3);
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.filter-input')!;
    expect(input.value).toBe('');
  });

  it('hides the clear button when the query is empty', async () => {
    const { el } = await mount();
    expect(el.shadowRoot!.querySelector('.filter-clear')).toBeNull();
  });

  it('pressing / focuses the filter input', async () => {
    const { el } = await mount();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.filter-input')!;
    const focusSpy = vi.spyOn(input, 'focus');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(focusSpy).toHaveBeenCalled();
  });

  it('ignores / while the settings panel is open', async () => {
    const { el } = await mount();
    (el.shadowRoot!.querySelector('.gear') as HTMLElement).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.filter-input')!;
    const focusSpy = vi.spyOn(input, 'focus');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('ignores / when pressed as a modifier combo', async () => {
    const { el } = await mount();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.filter-input')!;
    const focusSpy = vi.spyOn(input, 'focus');
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: '/', metaKey: true, bubbles: true }),
    );
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it('ignores / while typing in another input', async () => {
    const { el } = await mount();
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.filter-input')!;
    const focusSpy = vi.spyOn(input, 'focus');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
    expect(focusSpy).not.toHaveBeenCalled();
    other.remove();
  });

  it('Escape clears the query and restores all rows', async () => {
    const { el } = await mount();
    await setFilter(el, 'cc');
    expect(rowsOf(el)).toHaveLength(1);
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.filter-input')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await el.updateComplete;
    expect(rowsOf(el)).toHaveLength(3);
    expect(input.value).toBe('');
  });

  it('removes the global keydown listener on disconnect', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { el } = await mount();
    el.remove();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('advances the active track when the provider emits ended', async () => {
    const { el, provider } = await mount();
    await el['controller']!.start(0);
    await el.updateComplete;
    expect(stateOf(el, 0)).toBe('active');
    provider.emit('ended');
    await el.updateComplete;
    expect(stateOf(el, 1)).toBe('active');
  });

  it('flags a track unavailable and advances on error', async () => {
    const { el, provider } = await mount();
    await el['controller']!.start(0);
    await el.updateComplete;
    provider.emit('error');
    await el.updateComplete;
    expect(stateOf(el, 0)).toBe('unavailable');
    expect(stateOf(el, 1)).toBe('active');
  });

  it('marks tracks unavailable from the background prescan', async () => {
    const provider = new ControllableProvider();
    (provider as AudioProvider).checkAvailability = async (t) =>
      t.title === 'B' ? 'unavailable' : 'available';
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    // let the prescan finish
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(stateOf(el, 1)).toBe('unavailable');
    expect(stateOf(el, 0)).not.toBe('unavailable');
  });

  it('re-scans availability when the provider fires onReset (session change)', async () => {
    const provider = new ControllableProvider();
    let sessionChanged = false;
    // Before the reset, B is unavailable; after (e.g. relink/unlink) it re-resolves.
    (provider as AudioProvider).checkAvailability = async (t) =>
      sessionChanged ? 'available' : t.title === 'B' ? 'unavailable' : 'available';
    let fireReset = () => {};
    (provider as AudioProvider).onReset = (cb) => {
      fireReset = cb;
    };
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(stateOf(el, 1)).toBe('unavailable');

    sessionChanged = true; // session changed under us
    fireReset();
    await new Promise((r) => setTimeout(r, 0)); // let the re-scan run
    await el.updateComplete;
    // B was re-evaluated against the new session — no longer unavailable.
    expect(stateOf(el, 1)).not.toBe('unavailable');
  });

  it('toggles shuffle via the control button', async () => {
    const { el } = await mount();
    const btn = el.shadowRoot!.querySelector('.shuffle') as HTMLButtonElement;
    expect(btn.classList.contains('on')).toBe(false);
    btn.click();
    await el.updateComplete;
    expect(btn.classList.contains('on')).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a pending state for tracks not yet resolved', async () => {
    const provider = new ControllableProvider();
    // Track A resolves immediately; the rest hang, so the prescan stalls on track 1.
    (provider as AudioProvider).checkAvailability = (t) =>
      t.title === 'A' ? Promise.resolve('available') : new Promise(() => {});
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(stateOf(el, 0)).not.toBe('pending'); // checked (available)
    expect(stateOf(el, 1)).toBe('pending');
    expect(stateOf(el, 2)).toBe('pending');
  });

  it('prescans only the initial lookahead window on mount, not the whole list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => bigJspf } as Response);
    const provider = new ControllableProvider();
    (provider as AudioProvider).checkAvailability = async () => 'available';
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/big.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    const availability = availabilityOf(el);
    for (let i = 0; i < 10; i++) expect(availability.has(i)).toBe(true); // the 0..9 lookahead
    expect(availability.has(40)).toBe(false); // far outside the lookahead, untouched
  });

  it('maps a virtualizer rangeChanged window (positions) to real track indices, inclusive of last', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => bigJspf } as Response);
    const provider = new ControllableProvider();
    (provider as AudioProvider).checkAvailability = async () => 'available';
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/big.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    // No filter active, so filtered position === real index: rangeChanged(30, 35)
    // should check exactly real indices 30..35 (last is inclusive), and nothing
    // past it.
    fireRangeChanged(el, 30, 35);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    const availability = availabilityOf(el);
    for (let i = 30; i <= 35; i++) expect(availability.has(i)).toBe(true);
    expect(availability.has(36)).toBe(false);
  });

  it('maps rangeChanged positions through an active filter to the correct real indices', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => bigJspf } as Response);
    const provider = new ControllableProvider();
    (provider as AudioProvider).checkAvailability = async () => 'available';
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/big.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    // Filter down to the 3 "Special Artist" tracks (real indices 20/25/30) — all
    // outside the mount-time 0..9 lookahead, so any checks on them can only come
    // from the rangeChanged mapping below, not from the initial prescan.
    await setFilter(el, 'special artist');
    const rows = rowsOf(el);
    expect(rows.map((r) => r.i)).toEqual([20, 25, 30]); // filtered positions 0,1,2

    fireRangeChanged(el, 0, 2); // positions within the FILTERED rows, not raw indices
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    const availability = availabilityOf(el);
    // The real indices behind filtered positions 0/1/2 got checked. If
    // requestVisible instead mapped positions as raw indices, this would fail:
    // raw indices 0/1/2 were already consumed (deduped) by the mount-time
    // lookahead, so a buggy raw mapping would request nothing new here and
    // 20/25/30 would never appear.
    expect(availability.has(20)).toBe(true);
    expect(availability.has(25)).toBe(true);
    expect(availability.has(30)).toBe(true);
  });

  it('prunes queued checks that scroll out of view before they run', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ json: async () => bigJspf } as Response);
    const provider = new ControllableProvider();
    // Every check hangs, so requested-but-unchecked indices stay observable in
    // `checking` (nothing drains past the first in-flight item).
    (provider as AudioProvider).checkAvailability = () => new Promise<never>(() => {});
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/big.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    // Scroll to one window, then to a non-overlapping one before the first drains.
    fireRangeChanged(el, 20, 25);
    await el.updateComplete;
    expect(checkingOf(el).has(22)).toBe(true); // queued from the first window

    fireRangeChanged(el, 40, 45);
    await el.updateComplete;
    // The first window's queued-but-unstarted checks were pruned…
    expect(checkingOf(el).has(22)).toBe(false);
    expect(checkingOf(el).has(24)).toBe(false);
    // …and the new window is queued instead.
    expect(checkingOf(el).has(42)).toBe(true);
    expect(checkingOf(el).has(44)).toBe(true);
  });

  it('renders progress from the provider and seeks on change', async () => {
    const { el, provider } = await mount();
    await el['controller']!.start(0);
    provider.emitProgress(30000, 120000);
    await el.updateComplete;
    const bar = el.shadowRoot!.querySelector('.progress') as HTMLInputElement;
    expect(bar.value).toBe('30000');
    expect(bar.max).toBe('120000');
    const times = [...el.shadowRoot!.querySelectorAll('.time')].map((n) => n.textContent!.trim());
    expect(times).toEqual(['0:30', '2:00']);
    // simulate a seek
    bar.value = '60000';
    bar.dispatchEvent(new Event('change'));
    expect(provider.seekedMs).toBe(60000);
  });

  it('attaches a video-capable provider to the .video region', async () => {
    let attachedEl: HTMLElement | null = null;
    const provider = new ControllableProvider();
    (provider as AudioProvider).attach = (el: HTMLElement) => {
      attachedEl = el;
    };
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => provider;
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(attachedEl).toBe(el.shadowRoot!.querySelector('.video'));
  });

  it('disposes the provider when disconnected (no audio outliving the element)', async () => {
    const { el, provider } = await mount();
    el.remove();
    expect(provider.disposed).toBe(true);
  });

  it('ignores a late onAuthChange from a replaced (disposed) provider', async () => {
    let n = 0;
    let firstAuthCb: (() => void) | null = null;
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => {
      const p = new ControllableProvider() as AudioProvider & ControllableProvider;
      if (n++ === 0) {
        // First provider has interactive auth and captures its change callback.
        p.getAuthState = () => ({
          status: 'Not connected',
          actions: [{ id: 'connect', label: 'Connect' }],
        });
        p.onAuthChange = (cb: () => void) => (firstAuthCb = cb);
      }
      // Later providers have no interactive auth.
      return p;
    };
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.auth-actions .auth-btn')).toBeTruthy();

    // Re-init with a provider that has no auth — the Connection section goes away.
    await el['initProvider']();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.auth-actions')).toBeNull();

    // A late fire from the disposed first provider must not resurrect its auth UI.
    firstAuthCb!();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.auth-actions')).toBeNull();
  });

  it('switches away cleanly when the new provider fails to construct (no stale auth)', async () => {
    let n = 0;
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => {
      // First provider has interactive auth; the second throws at construction
      // (like Subsonic with no baseUrl).
      if (n++ === 0) {
        const p = new ControllableProvider() as AudioProvider & ControllableProvider;
        p.getAuthState = () => ({
          status: 'Connected',
          actions: [{ id: 'disconnect', label: 'Disconnect' }],
        });
        return p;
      }
      throw new Error('bad config');
    };
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.auth-actions')).toBeTruthy();

    // Second provider fails to construct — the old provider must not stay active
    // and its auth UI must be gone.
    await el['initProvider']();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.auth-actions')).toBeNull();
    expect(el['activeProvider']).toBeNull();
  });

  it('refresh availability clears the resolution cache and re-inits', async () => {
    localStorage.setItem('byom-player:resolv:v1', '{"some":"cache"}');
    const providers: ControllableProvider[] = [];
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => {
      const p = new ControllableProvider();
      providers.push(p);
      return p;
    };
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.refresh') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(localStorage.getItem('byom-player:resolv:v1')).toBeNull();
    expect(providers.length).toBeGreaterThan(1);
  });

  it('debug toggle auto-commits: persisted + flows into the effective config', async () => {
    const configs: Record<string, unknown>[] = [];
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = (_name, config) => {
      configs.push(config);
      return new ControllableProvider();
    };
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
    await el.updateComplete;
    const dbg = el.shadowRoot!.querySelector('.debug-toggle') as HTMLInputElement;
    dbg.checked = true;
    dbg.dispatchEvent(new Event('change')); // toggling commits immediately (no Apply button)
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(configs.at(-1)!.debug).toBe(true);
    const stored = JSON.parse(localStorage.getItem('byom-player:settings:v1')!);
    expect(stored.debug).toBe(true);
  });

  it('renders a provider’s auth state in the panel and runs actions on click', async () => {
    const ran: string[] = [];
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => {
      const p = new ControllableProvider() as AudioProvider & ControllableProvider;
      p.getAuthState = () => ({
        status: 'Not connected',
        actions: [{ id: 'connect', label: 'Connect Spotify' }],
      });
      p.runAuthAction = async (id: string) => {
        ran.push(id);
      };
      return p;
    };
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.auth-status')!.textContent).toContain('Not connected');
    const btn = el.shadowRoot!.querySelector('.auth-btn') as HTMLButtonElement;
    expect(btn.textContent!.trim()).toBe('Connect Spotify');
    btn.click();
    await el.updateComplete;
    expect(ran).toEqual(['connect']);
  });

  it('shows a provider’s connection UI immediately on selecting it (no Apply needed)', async () => {
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = (name) => {
      const p = new ControllableProvider() as AudioProvider & ControllableProvider;
      p.name = name;
      if (name === 'plex') {
        p.getAuthState = () => ({
          status: 'Not linked',
          actions: [{ id: 'link', label: 'Link Plex' }],
        });
      }
      return p;
    };
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el); // default provider 'mock' (no auth)
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.settings-connection')).toBeNull();

    // Select plex — its Link button appears without clicking Apply, panel stays open.
    const sel = el.shadowRoot!.querySelector('.provider-select') as HTMLSelectElement;
    sel.value = 'plex';
    sel.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.settings.open')).toBeTruthy();
    const btn = el.shadowRoot!.querySelector('.auth-btn') as HTMLButtonElement;
    expect(btn.textContent!.trim()).toBe('Link Plex');
  });

  it('shows the settings gear by default and hides it with no-settings', async () => {
    const { el } = await mount();
    expect(el.shadowRoot!.querySelector('.gear')).toBeTruthy();

    const el2 = document.createElement('byom-player') as ByomPlayer;
    el2.src = '/playlist.jspf.json';
    el2.setAttribute('no-settings', '');
    el2.providerFactory = () => new ControllableProvider();
    el2.skipDelayMs = 0;
    el2.prescanDelayMs = 0;
    document.body.appendChild(el2);
    await new Promise((r) => setTimeout(r, 0));
    await el2.updateComplete;
    expect(el2.shadowRoot!.querySelector('.gear')).toBeNull();
  });

  it('opens the settings view (inline swap) and closes back to the list', async () => {
    const { el } = await mount();
    expect(el.shadowRoot!.querySelector('.settings.open')).toBeNull();
    (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.settings.open')).toBeTruthy();
    (el.shadowRoot!.querySelector('.settings-back') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.settings.open')).toBeNull();
  });

  it('auto-commits provider + credential edits (no Apply), re-inits, emits settingschange', async () => {
    const providers: ControllableProvider[] = [];
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = (name) => {
      const p = new ControllableProvider();
      p.name = name;
      providers.push(p);
      return p;
    };
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    el['commitDelayMs'] = 0; // fire the field-edit debounce on the next macrotask

    let fired = false;
    el.addEventListener('settingschange', () => (fired = true));

    (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
    await el.updateComplete;
    // Selecting a provider commits immediately.
    const sel = el.shadowRoot!.querySelector('.provider-select') as HTMLSelectElement;
    sel.value = 'subsonic';
    sel.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.provider).toBe('subsonic');

    // Typing a credential auto-commits after the (0ms) debounce — no Apply click.
    const baseUrl = el.shadowRoot!.querySelector(
      '.provider-fields input[name="baseUrl"]',
    ) as HTMLInputElement;
    baseUrl.value = 'https://nav.example.com';
    baseUrl.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    expect(fired).toBe(true);
    expect(providers.at(-1)!.name).toBe('subsonic'); // re-init with new provider
    const stored = JSON.parse(localStorage.getItem('byom-player:settings:v1')!);
    expect(stored.provider).toBe('subsonic');
    expect(stored.providers.subsonic.baseUrl).toBe('https://nav.example.com');
  });

  it('renders the title as a playlist selector from <byom-playlist> children and switches on change', async () => {
    const el = document.createElement('byom-player') as ByomPlayer;
    el.innerHTML =
      '<byom-playlist title="One" src="/one.json"></byom-playlist>' +
      '<byom-playlist title="Two" src="/two.json"></byom-playlist>';
    el.providerFactory = () => new ControllableProvider();
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector('.title-select') as HTMLSelectElement;
    expect(picker).toBeTruthy();
    expect([...picker.options].map((o) => o.textContent!.trim())).toEqual(['One', 'Two']);
    expect(el.src).toBe('/one.json'); // first entry is the initial src

    picker.value = '/two.json';
    picker.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.src).toBe('/two.json');
  });

  it('renders a plain title (no selector) for a single playlist', async () => {
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/one.json';
    el.providerFactory = () => new ControllableProvider();
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.title-select')).toBeNull();
    expect(el.shadowRoot!.querySelector('h2.title')).toBeTruthy();
  });

  it('re-initializes the provider in place (dispose old, install new)', async () => {
    const providers: ControllableProvider[] = [];
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => {
      const p = new ControllableProvider();
      providers.push(p);
      return p;
    };
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(providers).toHaveLength(1);

    await el['initProvider']();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(providers).toHaveLength(2);
    expect(providers[0].disposed).toBe(true); // old provider torn down
  });

  it('toggles play/pause via the control button', async () => {
    const { el } = await mount();
    await el['controller']!.start(0);
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('.playpause') as HTMLButtonElement;
    expect(btn.textContent!.trim()).toBe('⏸︎'); // playing
    btn.click();
    await el.updateComplete;
    expect(btn.textContent!.trim()).toBe('▶︎'); // paused
  });

  it('renders the pause glyph with a text-presentation selector so it inherits theme color', async () => {
    const { el } = await mount();
    // Force the playing state; the play/pause control should render ⏸ + VS15.
    (el as unknown as { playbackState: string }).playbackState = 'playing';
    el.requestUpdate();
    await el.updateComplete;
    const btn = el.shadowRoot!.querySelector('.playpause')!;
    expect(btn.textContent).toContain('⏸︎'); // ⏸ + VS15
  });

  it('reflects the theme property to a host attribute', async () => {
    const { el } = await mount();
    el.theme = 'midnight';
    await el.updateComplete;
    expect(el.getAttribute('theme')).toBe('midnight');
  });

  it('applies a persisted theme on connect', async () => {
    saveSettings({ providers: {}, theme: 'terminal' });
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/playlist.jspf.json';
    el.providerFactory = () => new ControllableProvider();
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.getAttribute('theme')).toBe('terminal');
  });

  it('theme picker changes the theme, persists it, and reflects the attribute', async () => {
    const { el } = await mount();
    el['openSettings']();
    await el.updateComplete;
    const select = el.shadowRoot!.querySelector('.theme-select') as HTMLSelectElement;
    expect(select).toBeTruthy();
    select.value = 'sunset';
    select.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.getAttribute('theme')).toBe('sunset');
    expect(loadSettings().theme).toBe('sunset');
  });

  it('exposes a part surface for skins', async () => {
    const { el } = await mount();
    const parts = ['header', 'transport', 'tracklist', 'stage', 'progress'];
    for (const p of parts) {
      expect(el.shadowRoot!.querySelector(`[part~="${p}"]`), `part=${p}`).toBeTruthy();
    }
  });

  it('sets data-state on track rows', async () => {
    const { el } = await mount();
    // Row 1 (index 1) is the orphaned track in the fixture — derive `orphaned`
    // from the real track (as render() does via isOrphan) rather than hardcoding.
    const rows = rowsOf(el);
    expect(stateOf(el, 1, isOrphan(rows[1].t))).toBe('orphan');
    expect(stateOf(el, 0, isOrphan(rows[0].t))).not.toBe('orphan');
  });

  it('data-state=active follows the playing row', async () => {
    const { el } = await mount();
    clickRow(el, 2);
    await settle(el);
    expect(stateOf(el, 2)).toBe('active');
  });

  it('renders the playlist annotation as inline markdown', async () => {
    const { el } = await mount();
    const desc = el.shadowRoot!.querySelector('.description')!;
    expect(desc).toBeTruthy();
    expect(desc.innerHTML).toContain('<strong>great</strong>');
  });

  it('renders a meta line with track count, total duration, and date range', async () => {
    const { el } = await mount();
    const meta = el.shadowRoot!.querySelector('.meta-line')!.textContent!;
    expect(meta).toContain('3 tracks');
    expect(meta).toContain('4 min'); // 60+120+60s = 4 min
    expect(meta).toContain('Jul 2026 – Sep 2026'); // date (created) – date_updated
  });

  it('numbers rows by real playlist position, even while filtered', async () => {
    const { el } = await mount();
    await setFilter(el, 'cc'); // matches only track C (real index 2)
    const rows = rowsOf(el);
    expect(rows).toHaveLength(1);
    expect(rows[0].i).toBe(2); // real playlist position, not the filtered position
  });

  it('shows each track duration in the row', async () => {
    const { el } = await mount();
    // The virtualizer renders no rows under happy-dom (no layout engine), so
    // assert the row durations via the data + the shared formatter the row
    // template uses, rather than the (absent) .tracklist li DOM.
    const rows = rowsOf(el);
    const fmt = (ms: number) =>
      (ByomPlayer as unknown as { formatTime(ms: number): string }).formatTime(ms);
    expect(fmt(rows[0].t.durationMs!)).toBe('1:00'); // 60s
    expect(fmt(rows[1].t.durationMs!)).toBe('2:00'); // 120s
  });

  it('clicking the active row toggles play/pause (does not restart)', async () => {
    const { el, provider } = await mount();
    await el['controller']!.start(0);
    await el.updateComplete;
    expect(stateOf(el, 0)).toBe('active');
    const loadsBefore = provider.loadedIndex.length;
    clickRow(el, 0); // active row → toggle, not reload
    await settle(el);
    expect(provider.loadedIndex.length).toBe(loadsBefore); // no reload
    expect(el.shadowRoot!.querySelector('.playpause')!.textContent!.trim()).toBe('▶︎'); // paused
  });

  describe('video expand toggle', () => {
    const expandedOf = (el: ByomPlayer) =>
      (el as unknown as { videoExpanded: boolean }).videoExpanded;

    it('toggles videoExpanded and reflects state on the button', async () => {
      const { el } = await mount();
      const stage = () => el.shadowRoot!.querySelector('.stage')!;
      const toggle = () => el.shadowRoot!.querySelector<HTMLButtonElement>('.video-toggle')!;

      // Default collapsed.
      expect(expandedOf(el)).toBe(false);
      expect(stage().classList.contains('video-expanded')).toBe(false);
      expect(toggle().getAttribute('aria-expanded')).toBe('false');
      expect(toggle().getAttribute('aria-label')).toBe('Expand video');

      // The embed host is a sibling of the toggle, never its child (provider
      // mount targets `.video`). happy-dom's querySelector doesn't support
      // `:scope`, so check direct children explicitly instead.
      const wrap = el.shadowRoot!.querySelector('.video-wrap')!;
      const wrapChildren = Array.from(wrap.children);
      expect(wrapChildren.some((c) => c.classList.contains('video'))).toBe(true);
      expect(wrapChildren.some((c) => c.classList.contains('video-toggle'))).toBe(true);
      expect(toggle().querySelector('.video')).toBeNull();

      // Tap to expand.
      toggle().click();
      await el.updateComplete;
      expect(expandedOf(el)).toBe(true);
      expect(stage().classList.contains('video-expanded')).toBe(true);
      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(toggle().getAttribute('aria-label')).toBe('Collapse video');

      // Tap to collapse.
      toggle().click();
      await el.updateComplete;
      expect(expandedOf(el)).toBe(false);
      expect(stage().classList.contains('video-expanded')).toBe(false);
    });
  });
});

// Real-world-ish geometry from live verification: ~39px rows, a ~472px tall
// scroller viewport. rowTop is the row's MEASURED top offset in scroll space.
describe('computeCenterOffset', () => {
  const rowH = 39;
  const clientH = 472;

  it('centers a row in the middle of a long list', () => {
    // rowTop 1950 (row ~50) → target = 1950 - (472-39)/2 = 1733.5; within [0, max].
    expect(computeCenterOffset(1950, rowH, clientH, 5000)).toBe(1733.5);
  });

  it('clamps to 0 near the top of the list', () => {
    // rowTop 0 → target = 0 - 216.5 = -216.5 → clamped up to 0.
    expect(computeCenterOffset(0, rowH, clientH, 5000)).toBe(0);
  });

  it('clamps to scrollHeight - clientHeight near the end of the list', () => {
    // 200 rows: scrollHeight = 7800, max = 7328. Last row top = 199*39 = 7761;
    // target = 7761 - 216.5 = 7544.5 > max → clamped down to max.
    expect(computeCenterOffset(7761, rowH, clientH, 7800)).toBe(7328);
  });

  it('centers using the measured row top, not a predicted pos*rowH', () => {
    // A row whose real top is 4001 (not necessarily a clean multiple of rowH)
    // centers at 4001 - 216.5 = 3784.5 — the point of measuring is that the
    // input need not equal pos*rowH.
    expect(computeCenterOffset(4001, rowH, clientH, 50000)).toBe(3784.5);
  });
});
