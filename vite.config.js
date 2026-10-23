import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import wasm from 'vite-plugin-wasm';
import { faqTips } from './src/faq/faqContent.js';

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

// The same history with each commit's short hash, for the start screen's "New since last time" (src/start/sinceLast.js): the build you
// last played is remembered by its newest hash.
function gitLogHashes() {
  try {
    return execSync('git log -n 300 --pretty=format:%h%x09%s', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

// The start screen's tips, taken out of the FAQ here so the game's first page does not load the whole FAQ (1.3 MB) for them.
const FAQ_TIPS = faqTips();

export default defineConfig({
  plugins: [wasm()],
  define: {
    __GIT_LOG__: JSON.stringify(gitLog()),
    __GIT_LOG_HASHES__: JSON.stringify(gitLogHashes()),
    __FAQ_TIPS__: JSON.stringify(FAQ_TIPS),
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 3500,
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
