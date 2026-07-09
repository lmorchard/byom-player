import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  // Bind the dev server to the IPv4 loopback: Spotify's dashboard only accepts
  // `127.0.0.1` (not `localhost`) as a loopback redirect URI, so the harness's
  // PKCE login only works when the page is served from 127.0.0.1.
  server: { host: '127.0.0.1' },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'byom-player.js',
    },
    // Bundle everything (incl. Lit) into a single droppable ES module.
    rollupOptions: {},
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
  },
});
