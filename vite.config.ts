import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { resolve } from 'node:path';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Dev-only reverse proxies so http backends (Navidrome, Jellyfin) are reachable
// from the https harness without mixed-content blocks. The browser only ever
// talks https to this origin; Vite (Node) talks http to the backend. Point a
// provider's Base URL at the relative route (e.g. `/navidrome`) and both its API
// calls and the <audio> stream src flow through the proxy. Targets come from a
// gitignored .env.local (see .env.example) so nobody's LAN host lands in the repo;
// a route is only registered when its target is set.
function backendProxy(env: Record<string, string>) {
  const routes: Record<string, { prefix: string; target?: string }> = {
    '/navidrome': { prefix: '/navidrome', target: env.NAVIDROME_PROXY_TARGET },
    '/jellyfin': { prefix: '/jellyfin', target: env.JELLYFIN_PROXY_TARGET },
  };
  const proxy: Record<string, unknown> = {};
  for (const [route, { prefix, target }] of Object.entries(routes)) {
    if (!target) continue;
    proxy[route] = {
      target,
      changeOrigin: true,
      secure: false, // backends are plain http on the LAN
      rewrite: (path: string) => path.slice(prefix.length),
    };
  }
  return proxy;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // Serve the dev harness over HTTPS on `localhost` (dev-only; production embeds
    // on real HTTPS domains where none of this applies). This is what YouTube
    // needs: its embedded player wants an https origin and allows
    // `https://localhost`, but blocks http:// and the IP-literal `https://127.0.0.1`.
    // NOTE: Spotify's loopback redirect-URI rules are finicky (it wants 127.0.0.1
    // for http, and rejects `https://localhost` at auth with "redirect_uri:
    // Insecure" despite the dashboard accepting it) — testing Spotify PKCE on this
    // harness is an unresolved, separate issue.
    plugins: [basicSsl()],
    server: { host: 'localhost', proxy: backendProxy(env) },
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
  };
});
