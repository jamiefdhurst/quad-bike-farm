import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { bumpFor, nextVersion, latestTag, parseVersion, checkLabels, BUMP_LABELS, TYPE_LABELS, FIRST_VERSION } from '../tools/nextVersion.mjs';

describe('next release version', () => {
  it('bumps by the merged PR\'s labels, the biggest winning', () => {
    expect(bumpFor(['💥 breaking', '✨ feature'])).toBe('major');
    expect(bumpFor(['✨ feature', '👭 girls'])).toBe('minor');
    expect(bumpFor(['🐛 bug'])).toBe('patch');
    expect(bumpFor([])).toBe('patch');
    expect(bumpFor(undefined)).toBe('patch');
  });

  it('counts on from the latest tag, resetting the lower numbers', () => {
    expect(nextVersion('v1.4.2', ['💥 breaking']).version).toBe('2.0.0');
    expect(nextVersion('v1.4.2', ['✨ feature']).version).toBe('1.5.0');
    expect(nextVersion('v1.4.2', ['⚡ enhancement']).version).toBe('1.4.3');
  });

  it('starts at the first version with no tag', () => {
    expect(nextVersion('', ['✨ feature'])).toEqual({ version: FIRST_VERSION, bump: 'minor' });
    expect(FIRST_VERSION).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version);
  });

  it('finds the highest version among the tags, by number not by text', () => {
    expect(latestTag(['v1.9.0', 'v1.10.0', 'v1.2.0', 'not-a-version', 'v2.0.0-rc1'])).toBe('v1.10.0');
    expect(latestTag([])).toBe('');
    expect(parseVersion('v2.0.0-rc1')).toBeNull();
  });

  it('passes a PR with exactly one type label, and says what it will release as', () => {
    expect(checkLabels('v1.0.0', ['✨ feature', '👭 girls'])).toEqual({ ok: true, message: expect.stringContaining('minor, 1.0.0 to 1.1.0') });
    expect(checkLabels('v1.0.0', ['🐛 bug', '💥 breaking']).message).toContain('major, 1.0.0 to 2.0.0');
    expect(checkLabels('v1.0.0', ['⬆️ dependencies']).ok).toBe(true);
  });

  it('fails a PR with no type label or two', () => {
    expect(checkLabels('v1.0.0', ['👭 girls'])).toEqual({ ok: false, message: expect.stringContaining('it has none') });
    expect(checkLabels('v1.0.0', ['💥 breaking']).ok).toBe(false);
    expect(checkLabels('v1.0.0', ['✨ feature', '🐛 bug']).message).toContain('it has ✨ feature, 🐛 bug');
  });

  it('uses labels that settings.yml defines', () => {
    const settings = readFileSync('.github/settings.yml', 'utf8');
    for (const label of [...BUMP_LABELS.major, ...BUMP_LABELS.minor, ...TYPE_LABELS]) expect(settings).toContain(`name: "${label}"`);
  });
});
