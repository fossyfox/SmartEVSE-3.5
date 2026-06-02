import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'

// Builds the demo mock for the LEGACY jQuery UI as a single self-running IIFE
// (`dist/classic-mock.js`). scripts/inject-classic.mjs then injects it into the
// classic pages. Run after the main `vite build` with emptyOutDir off so it adds
// to dist rather than wiping it. Only used by `npm run build:demo`.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    emptyOutDir: false,
    // IIFE so the bundle self-executes on load (installDemo() runs at top level)
    // with no module/global plumbing, exactly like a plain <script>.
    lib: {
      entry: fileURLToPath(new URL('./src/lib/demo/classic.ts', import.meta.url)),
      formats: ['iife'],
      name: 'SmartEVSEDemoClassic',
      fileName: () => 'classic-mock.js',
    },
    // One predictable filename the injector references — no content hash.
    rollupOptions: {
      output: { entryFileNames: 'classic-mock.js', assetFileNames: 'classic-mock-[name][extname]' },
    },
  },
})
