import { describe, it, expect } from 'vitest';
import { LocalStorageResolutionCache, trackKey } from './resolutionCache';

// Minimal in-memory Storage stand-in.
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  } as Storage;
}

describe('trackKey', () => {
  it('prefers a lowercased ISRC when present', () => {
    expect(trackKey({ title: 'X', artist: 'Y', isrc: 'USABC1234567' })).toBe('isrc:usabc1234567');
  });

  it('falls back to a normalized artist|title query', () => {
    expect(trackKey({ title: '  Night   Call ', artist: 'Kavinsky ' })).toBe(
      'q:kavinsky|night call',
    );
  });
});

describe('LocalStorageResolutionCache', () => {
  it('set/get roundtrips; miss returns undefined', () => {
    const c = new LocalStorageResolutionCache({ storage: fakeStorage() });
    expect(c.get('s', 'k')).toBeUndefined();
    c.set('s', 'k', 'id-1');
    expect(c.get('s', 'k')).toBe('id-1');
  });

  it('scopes keys independently', () => {
    const c = new LocalStorageResolutionCache({ storage: fakeStorage() });
    c.set('a', 'k', 'id-a');
    c.set('b', 'k', 'id-b');
    expect(c.get('a', 'k')).toBe('id-a');
    expect(c.get('b', 'k')).toBe('id-b');
  });

  it('evict removes one entry; clear removes a whole scope only', () => {
    const c = new LocalStorageResolutionCache({ storage: fakeStorage() });
    c.set('a', 'k1', '1');
    c.set('a', 'k2', '2');
    c.set('b', 'k1', '3');
    c.evict('a', 'k1');
    expect(c.get('a', 'k1')).toBeUndefined();
    expect(c.get('a', 'k2')).toBe('2');
    c.clear('a');
    expect(c.get('a', 'k2')).toBeUndefined();
    expect(c.get('b', 'k1')).toBe('3'); // other scope survives
  });

  it('persists across instances sharing the same storage', () => {
    const storage = fakeStorage();
    new LocalStorageResolutionCache({ storage }).set('s', 'k', 'id-9');
    const fresh = new LocalStorageResolutionCache({ storage });
    expect(fresh.get('s', 'k')).toBe('id-9');
  });

  it('operates in-memory without throwing when storage is unavailable', () => {
    const c = new LocalStorageResolutionCache({ storage: null });
    expect(() => c.set('s', 'k', 'id')).not.toThrow();
    expect(c.get('s', 'k')).toBe('id'); // works, just not persisted
  });

  it('survives storage that throws on access', () => {
    const throwing = {
      get length(): number {
        throw new Error('blocked');
      },
      clear: () => {
        throw new Error('blocked');
      },
      getItem: () => {
        throw new Error('blocked');
      },
      key: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    const c = new LocalStorageResolutionCache({ storage: throwing });
    expect(() => c.set('s', 'k', 'id')).not.toThrow();
    expect(c.get('s', 'k')).toBe('id');
  });

  it('evicts oldest entries (FIFO) at the cap', () => {
    const c = new LocalStorageResolutionCache({ storage: fakeStorage(), maxEntries: 2 });
    c.set('s', 'a', '1');
    c.set('s', 'b', '2');
    c.set('s', 'c', '3'); // over cap -> 'a' evicted
    expect(c.get('s', 'a')).toBeUndefined();
    expect(c.get('s', 'b')).toBe('2');
    expect(c.get('s', 'c')).toBe('3');
  });
});
