import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FOUNDING_TESTER_KEY,
  FOUNDING_TESTER_LABEL,
  TESTER_CUTOFF_MS,
  loadProEntitlement,
  qualifiesByInstallDate,
  resolveEntitlement,
  type GrantStore,
} from './pro';

const before = TESTER_CUTOFF_MS - 1;
const at = TESTER_CUTOFF_MS;
const after = TESTER_CUTOFF_MS + 1;

function memoryStore(initial: Record<string, string> = {}): GrantStore & { writes: number } {
  const data = { ...initial };
  const store = {
    writes: 0,
    getItem(key: string) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key: string, value: string) { data[key] = value; store.writes += 1; },
  };
  return store;
}

describe('install-date grandfathering', () => {
  it('uses the named Open-testing placeholder cutoff', () => {
    expect(TESTER_CUTOFF_MS).toBe(Date.parse('2026-11-17T00:00:00-06:00'));
    expect(Number.isFinite(TESTER_CUTOFF_MS)).toBe(true);
  });

  it('grants Pro before the cutoff', () => {
    expect(qualifiesByInstallDate(before)).toBe(true);
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: before, persistedGrant: false }))
      .toEqual({ pro: true, foundingTester: true });
  });

  it('does not grant at the cutoff', () => {
    expect(qualifiesByInstallDate(at)).toBe(false);
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: at, persistedGrant: false }))
      .toEqual({ pro: false, foundingTester: false });
  });

  it('does not grant after the cutoff', () => {
    expect(qualifiesByInstallDate(after)).toBe(false);
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: after, persistedGrant: false }))
      .toEqual({ pro: false, foundingTester: false });
  });

  it('keeps a persisted Android grant when install time is missing or after the cutoff', () => {
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: after, persistedGrant: true }))
      .toEqual({ pro: true, foundingTester: true });
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: null, persistedGrant: true }))
      .toEqual({ pro: true, foundingTester: true });
  });

  it('stores the grant once and honors it on a later launch', async () => {
    const storage = memoryStore();
    const first = await loadProEntitlement({
      platform: 'android',
      readInstallTime: async () => before,
      storage,
    });
    expect(first).toEqual({ pro: true, foundingTester: true });
    expect(storage.getItem(FOUNDING_TESTER_KEY)).toBe('1');
    expect(storage.writes).toBe(1);

    const again = await loadProEntitlement({
      platform: 'android',
      readInstallTime: async () => { throw new Error('bridge unavailable'); },
      storage,
    });
    expect(again).toEqual({ pro: true, foundingTester: true });
    expect(storage.writes).toBe(1);
  });

  it('does not grandfather the web app, even with a stored flag or an install time', async () => {
    const storage = memoryStore({ [FOUNDING_TESTER_KEY]: '1' });
    const entitlement = await loadProEntitlement({
      platform: 'web',
      readInstallTime: async () => before,
      storage,
    });
    expect(entitlement).toEqual({ pro: false, foundingTester: false });
    expect(storage.writes).toBe(0);
    expect(resolveEntitlement({ platform: 'web', firstInstallTimeMs: before, persistedGrant: true }))
      .toEqual({ pro: false, foundingTester: false });
  });

  it('ignores a missing or unreadable install time when nothing was stored', async () => {
    const storage = memoryStore();
    const entitlement = await loadProEntitlement({
      platform: 'android',
      readInstallTime: async () => 'not-a-time',
      storage,
    });
    expect(entitlement).toEqual({ pro: false, foundingTester: false });
    expect(storage.getItem(FOUNDING_TESTER_KEY)).toBeNull();
  });

  it('places the founding-tester label in Settings', () => {
    const html = readFileSync(new URL('../../v2/index.html', import.meta.url), 'utf8');
    expect(FOUNDING_TESTER_LABEL).toBe('Founding tester: Pro unlocked');
    expect(html).toContain(`id="founding-tester"`);
    expect(html).toContain(FOUNDING_TESTER_LABEL);
    const main = readFileSync(new URL('../v2/main.ts', import.meta.url), 'utf8');
    expect(main).toContain("platform: nativePlugin() ? 'android' : 'web'");
    expect(main).not.toContain('verifiedPurchase:');
  });

  it('leaves purchases locked unless a caller supplies a verified purchase', () => {
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: after, persistedGrant: false }).pro).toBe(false);
    expect(resolveEntitlement({
      platform: 'web', firstInstallTimeMs: null, persistedGrant: false, verifiedPurchase: true,
    })).toEqual({ pro: true, foundingTester: false });
  });
});
