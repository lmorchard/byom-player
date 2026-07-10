import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './ByomPlayer';
import type { ByomPlayer } from './ByomPlayer';
import { BYOM_EXT_NS } from './manifest';
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
    track: [
      { title: 'A', creator: 'aa' },
      {
        title: 'B',
        creator: 'bb',
        extension: { [BYOM_EXT_NS]: [{ spotify_present: false }] },
      },
      { title: 'C', creator: 'cc' },
    ],
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

const lis = (el: ByomPlayer) => Array.from(el.shadowRoot!.querySelectorAll('.tracklist li'));

// Flush pending microtasks/macrotasks (async provider load→play chain), then the render.
async function settle(el: ByomPlayer): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await el.updateComplete;
}

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

  it('loads the manifest and renders title + one row per track', async () => {
    const { el } = await mount();
    expect(el.shadowRoot!.querySelector('.title')!.textContent).toContain('Test PL');
    expect(lis(el)).toHaveLength(3);
  });

  it('marks orphaned tracks (spotify_present === false)', async () => {
    const { el } = await mount();
    expect(lis(el)[1].classList.contains('orphan')).toBe(true);
    expect(lis(el)[0].classList.contains('orphan')).toBe(false);
  });

  it('clicking a track selects and plays it, moving .active', async () => {
    const { el, provider } = await mount();
    (lis(el)[2] as HTMLElement).click();
    await settle(el);
    expect(lis(el)[2].classList.contains('active')).toBe(true);
    expect(lis(el)[0].classList.contains('active')).toBe(false);
    expect(provider.loadedIndex).toContain('C');
  });

  it('advances the active track when the provider emits ended', async () => {
    const { el, provider } = await mount();
    await el['controller']!.start(0);
    await el.updateComplete;
    expect(lis(el)[0].classList.contains('active')).toBe(true);
    provider.emit('ended');
    await el.updateComplete;
    expect(lis(el)[1].classList.contains('active')).toBe(true);
  });

  it('flags a track unavailable and advances on error', async () => {
    const { el, provider } = await mount();
    await el['controller']!.start(0);
    await el.updateComplete;
    provider.emit('error');
    await el.updateComplete;
    expect(lis(el)[0].classList.contains('unavailable')).toBe(true);
    expect(lis(el)[1].classList.contains('active')).toBe(true);
  });

  it('marks tracks unavailable from the background availability sweep', async () => {
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
    // let the sweep finish
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(lis(el)[1].classList.contains('unavailable')).toBe(true);
    expect(lis(el)[0].classList.contains('unavailable')).toBe(false);
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
    expect(lis(el)[1].classList.contains('unavailable')).toBe(true);

    sessionChanged = true; // session changed under us
    fireReset();
    await new Promise((r) => setTimeout(r, 0)); // let the re-scan run
    await el.updateComplete;
    // B was re-evaluated against the new session — no longer unavailable.
    expect(lis(el)[1].classList.contains('unavailable')).toBe(false);
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

  it('shows a pending state for tracks the prescan has not reached yet', async () => {
    const provider = new ControllableProvider();
    // Track A resolves immediately; the rest hang, so the sweep stalls on track 1.
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
    expect(lis(el)[0].classList.contains('pending')).toBe(false); // checked (available)
    expect(lis(el)[1].classList.contains('pending')).toBe(true); // not yet reached
    expect(lis(el)[2].classList.contains('pending')).toBe(true);
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

  it('debug toggle is persisted and flows into the effective config on apply', async () => {
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
    dbg.dispatchEvent(new Event('change'));
    (el.shadowRoot!.querySelector('.apply') as HTMLButtonElement).click();
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

  it('applies settings: persists creds + provider and re-inits, emitting settingschange', async () => {
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

    let fired = false;
    el.addEventListener('settingschange', () => (fired = true));

    (el.shadowRoot!.querySelector('.gear') as HTMLButtonElement).click();
    await el.updateComplete;
    const sel = el.shadowRoot!.querySelector('.provider-select') as HTMLSelectElement;
    sel.value = 'subsonic';
    sel.dispatchEvent(new Event('change'));
    await el.updateComplete;
    const baseUrl = el.shadowRoot!.querySelector(
      '.provider-fields input[name="baseUrl"]',
    ) as HTMLInputElement;
    baseUrl.value = 'https://nav.example.com';
    baseUrl.dispatchEvent(new Event('input'));
    (el.shadowRoot!.querySelector('.apply') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;

    expect(fired).toBe(true);
    expect(el.provider).toBe('subsonic');
    expect(providers.at(-1)!.name).toBe('subsonic'); // re-init with new provider
    const stored = JSON.parse(localStorage.getItem('byom-player:settings:v1')!);
    expect(stored.provider).toBe('subsonic');
    expect(stored.providers.subsonic.baseUrl).toBe('https://nav.example.com');
  });

  it('renders a top-level playlist picker from <byom-playlist> children and switches on change', async () => {
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
    const picker = el.shadowRoot!.querySelector('.playlist-picker') as HTMLSelectElement;
    expect(picker).toBeTruthy();
    expect([...picker.options].map((o) => o.textContent!.trim())).toEqual(['One', 'Two']);
    expect(el.src).toBe('/one.json'); // first entry is the initial src

    picker.value = '/two.json';
    picker.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.src).toBe('/two.json');
  });

  it('does not render a playlist picker for a single playlist', async () => {
    const el = document.createElement('byom-player') as ByomPlayer;
    el.src = '/one.json';
    el.providerFactory = () => new ControllableProvider();
    el.skipDelayMs = 0;
    el.prescanDelayMs = 0;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.playlist-picker')).toBeNull();
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
    expect(btn.textContent!.trim()).toBe('⏸'); // playing
    btn.click();
    await el.updateComplete;
    expect(btn.textContent!.trim()).toBe('▶'); // paused
  });
});
