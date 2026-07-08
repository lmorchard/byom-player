import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './ByomPlayer';
import type { ByomPlayer } from './ByomPlayer';
import { BYOM_EXT_NS } from './manifest';
import type { AudioProvider, ProviderState } from './providers/types';

// A provider whose state transitions the test drives directly.
class ControllableProvider implements AudioProvider {
  name = 'ctrl';
  loadedIndex: string[] = [];
  private cb: (s: ProviderState) => void = () => {};
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
  seek(): void {}
  onStateChange(cb: (s: ProviderState) => void): void {
    this.cb = cb;
  }
  emit(s: ProviderState): void {
    this.cb(s);
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
