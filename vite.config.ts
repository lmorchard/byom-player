import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // Serve the dev harness over HTTPS on `localhost` (dev-only; production embeds
  // on real HTTPS domains where none of this applies). This is what YouTube
  // needs: its embedded player wants an https origin and allows
  // `https://localhost`, but blocks http:// and the IP-literal `https://127.0.0.1`.
  // NOTE: Spotify's loopback redirect-URI rules are finicky (it wants 127.0.0.1
  // for http, and rejects `https://localhost` at auth with "redirect_uri:
  // Insecure" despite the dashboard accepting it) — testing Spotify PKCE on this
  // harness is an unresolved, separate issue.
  plugins: [basicSsl()],
  server: { host: 'localhost' },
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
    setupFiles: ['src/test-setup.ts'],
  },
});
