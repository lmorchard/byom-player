import { describe, it, expect } from 'vitest';
import { md5 } from './md5';

describe('md5', () => {
  // Standard RFC 1321 / well-known test vectors.
  it('matches known ASCII vectors', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e');
    expect(md5('a')).toBe('0cc175b9c0f1b6a831c399e269772661');
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    expect(md5('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0');
    expect(md5('The quick brown fox jumps over the lazy dog')).toBe(
      '9e107d9d372bb6826bd81d3542a419d6',
    );
  });

  // Verified against the `md5` CLI on the UTF-8 bytes.
  it('handles UTF-8 and emoji', () => {
    expect(md5('café')).toBe('07117fe4a1ebd544965dc19573183da2');
    expect(md5('naïve — résumé')).toBe('56fae30b449e43a99385581523ebb41c');
    expect(md5('🎵🎶')).toBe('6539d43ef56f8d908071ce208004a184');
  });
});
