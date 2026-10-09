import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// The commit history (date and subject), for the FAQ page's "Recently changed" (src/faq/changes.js). Read when the dev server
// starts or the build runs; empty if there's no git.
function gitLog() {
  try {
    return execSync('git log -n 300 --date=short --pretty=format:%ad%x09%s', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

export default defineConfig({
  define: {
    __GIT_LOG__: JSON.stringify(gitLog()),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
    rollupOptions: {
      // Two pages: the game and the FAQ.
      input: { main: `${root}index.html`, faq: `${root}faq.html` },
    },
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
