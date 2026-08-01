import { describe, it, expect, afterEach } from 'vitest';
import { render } from 'lit';
import type { Track } from './types';
import { storeFor, renderPurchaseLink } from './purchaseLink';

describe('storeFor', () => {
  it('identifies Bandcamp artist subdomains', () => {
    // The shape byom-sync's Bandcamp tier emits for ~5.4k links.
    expect(storeFor('https://beachhouse.bandcamp.com/album/once-twice-melody').id).toBe('bandcamp');
    expect(storeFor('https://rideox4.bandcamp.com/album/nowhere-2022-reissue').id).toBe('bandcamp');
    expect(storeFor('https://bandcamp.com/album/x').id).toBe('bandcamp');
  });

  it('identifies both Apple hosts', () => {
    expect(storeFor('https://music.apple.com/us/album/medusa/123').id).toBe('apple');
    expect(storeFor('https://itunes.apple.com/us/album/x/1').id).toBe('apple');
  });

  it('does not match a host that merely contains a store name', () => {
    // Guards against a substring check: this is not Bandcamp.
    expect(storeFor('https://notbandcamp.com.evil.example/album/x').id).toBe('other');
    expect(storeFor('https://bandcamp.com.evil.example/x').id).toBe('other');
  });

  it('falls back to other for a Bandcamp custom domain', () => {
    // A documented, accepted limitation: these are real Bandcamp pages, but the
    // hostname carries no signal. 24 such links exist on the reference hub.
    expect(storeFor('https://threatmachine.com/album/echoes-of-a-butterfly').id).toBe('other');
    expect(storeFor('https://hungrylucy.com/album/to-kill-a-king').id).toBe('other');
  });

  it('is total: never throws, always returns a store', () => {
    for (const input of ['', 'not a url', '://nope', undefined]) {
      const s = storeFor(input as string | undefined);
      expect(s.id).toBe('other');
      expect(s.label).toBeTruthy();
      expect(s.glyph).toBeTruthy();
    }
  });

  it('gives every store a label and a glyph', () => {
    for (const url of [
      'https://x.bandcamp.com/album/y',
      'https://music.apple.com/us/album/y/1',
      'https://example.com/y',
    ]) {
      const s = storeFor(url);
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.glyph.length).toBeGreaterThan(0);
    }
  });
});

describe('renderPurchaseLink', () => {
  const track = (purchaseUrl?: string): Track => ({
    title: 'Superstar',
    artist: 'Beach House',
    purchaseUrl,
  });

  // Renders the cell inside a click-to-play parent, mirroring the tracklist <li>.
  function mountCell(t: Track) {
    const row = document.createElement('li');
    const played = { count: 0 };
    row.addEventListener('click', () => (played.count += 1));
    const host = document.createElement('span');
    row.appendChild(host);
    document.body.appendChild(row);
    render(renderPurchaseLink(t), host);
    return { row, host, played };
  }

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders an anchor with safe external-link attributes', () => {
    const { host } = mountCell(track('https://beachhouse.bandcamp.com/album/once-twice-melody'));
    const a = host.querySelector('a')!;
    expect(a).toBeTruthy();
    expect(a.getAttribute('href')).toBe('https://beachhouse.bandcamp.com/album/once-twice-melody');
    expect(a.getAttribute('target')).toBe('_blank');
    // noopener matters: target=_blank without it hands the opened page a
    // reference back to this window.
    expect(a.getAttribute('rel')).toContain('noopener');
  });

  it('names the destination for screen readers and marks the glyph decorative', () => {
    const { host } = mountCell(track('https://music.apple.com/us/album/x/1'));
    const a = host.querySelector('a')!;
    expect(a.getAttribute('aria-label')).toBe('Buy Superstar on Apple Music');
    expect(a.getAttribute('data-store')).toBe('apple');
    expect(a.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  // The bug this feature can realistically introduce: the whole row is
  // click-to-play, so a naive anchor makes "buy" also start playback. Invisible
  // until someone taps it on a phone.
  it('does NOT trigger the row click-to-play handler', () => {
    const { host, played } = mountCell(track('https://x.bandcamp.com/album/y'));
    const a = host.querySelector('a')!;
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(played.count).toBe(0);
  });

  // Guards the guard: prove the harness would catch a leak if stopPropagation
  // were removed, so the test above cannot pass vacuously.
  it('harness detects a click that does reach the row', () => {
    const { row, host, played } = mountCell(track());
    const leaky = document.createElement('a');
    host.appendChild(leaky);
    leaky.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(played.count).toBe(1);
    expect(row).toBeTruthy();
  });

  it('renders a placeholder, not an anchor, when there is no link', () => {
    const { host } = mountCell(track(undefined));
    expect(host.querySelector('a')).toBeNull();
    const slot = host.querySelector('.buy-empty')!;
    expect(slot).toBeTruthy();
    // Occupies the same slot so rows stay aligned, and is hidden from AT.
    expect(slot.getAttribute('aria-hidden')).toBe('true');
    expect(slot.classList.contains('buy')).toBe(true);
  });
});
