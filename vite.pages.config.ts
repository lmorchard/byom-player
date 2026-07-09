import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Static build of the dev harness (index.html) for GitHub Pages, served at the
// project subpath https://<user>.github.io/byom-player/. This is a normal app
// build — distinct from the LIBRARY build in vite.config.ts (which emits the
// droppable byom-player.js). Output goes to dist-pages/ so it never collides
// with the library dist/ the rolling release force-pushes.
export default defineConfig({
  base: '/byom-player/',
  build: {
    outDir: 'dist-pages',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
