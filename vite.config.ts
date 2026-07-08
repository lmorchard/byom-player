import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
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
