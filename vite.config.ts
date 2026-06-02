import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const volglRoot = resolve(projectRoot, '../VolGL');

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    // The cbct-viewer-demo consumes @volgl/renderer via a file: dependency
    // that symlinks into ../VolGL. Main-module imports resolve through
    // node_modules and pass the default fs allow-list, but Worker URLs
    // built with `import.meta.url` resolve to the *real* absolute path
    // (../VolGL/dist/...), which the default allow-list rejects with
    // "outside of Vite serving allow list" errors that the browser
    // surfaces as strict-MIME failures. Explicitly allowing both the
    // project root (default behavior) and ../VolGL fixes that.
    fs: {
      allow: [projectRoot, volglRoot]
    }
  }
});
