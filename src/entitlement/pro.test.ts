import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FOUNDING_TESTER_KEY,
  FOUNDING_TESTER_LABEL,
  PLAY_INSTALLER,
  TESTER_CUTOFF_MS,
  clientFounderFlagsAllowed,
  loadProEntitlement,
  qualifiesByInstallDate,
  resolveEntitlement,
  trafficCameraAlertUnlocked,
  trafficCamerasUnlocked,
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
  it('uses the Open testing resume time as the cutoff', () => {
    expect(TESTER_CUTOFF_MS).toBe(Date.parse('2026-11-16T19:54:00-06:00'));
    expect(Number.isFinite(TESTER_CUTOFF_MS)).toBe(true);
  });

  it('grants Pro before the cutoff on a Play release install', () => {
    expect(qualifiesByInstallDate(before)).toBe(true);
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: before, persistedGrant: false, clientFlagsAllowed: true }))
      .toEqual({ pro: true, foundingTester: true });
  });

  it('ignores install time and the stored flag on debug or non-Play builds', () => {
    expect(clientFounderFlagsAllowed({ debuggable: false, installer: PLAY_INSTALLER })).toBe(true);
    expect(clientFounderFlagsAllowed({ debuggable: true, installer: PLAY_INSTALLER })).toBe(false);
    expect(clientFounderFlagsAllowed({ debuggable: false, installer: 'com.android.packageinstaller' })).toBe(false);
    expect(clientFounderFlagsAllowed({ debuggable: false, installer: null })).toBe(false);
    expect(clientFounderFlagsAllowed(undefined)).toBe(false);
    const blocked = { platform: 'android' as const, firstInstallTimeMs: before, persistedGrant: true, clientFlagsAllowed: false };
    expect(resolveEntitlement(blocked)).toEqual({ pro: false, foundingTester: false });
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: before, persistedGrant: true }))
      .toEqual({ pro: false, foundingTester: false });
  });

  it('does not grant at the cutoff', () => {
    expect(qualifiesByInstallDate(at)).toBe(false);
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: at, persistedGrant: false, clientFlagsAllowed: true }))
      .toEqual({ pro: false, foundingTester: false });
  });

  it('does not grant after the cutoff', () => {
    expect(qualifiesByInstallDate(after)).toBe(false);
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: after, persistedGrant: false, clientFlagsAllowed: true }))
      .toEqual({ pro: false, foundingTester: false });
  });

  it('keeps a persisted Android grant when install time is missing or after the cutoff', () => {
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: after, persistedGrant: true, clientFlagsAllowed: true }))
      .toEqual({ pro: true, foundingTester: true });
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: null, persistedGrant: true, clientFlagsAllowed: true }))
      .toEqual({ pro: true, foundingTester: true });
  });

  it('stores the grant once and honors it on a later launch', async () => {
    const storage = memoryStore();
    const first = await loadProEntitlement({
      platform: 'android',
      readInstallTime: async () => before,
      storage,
      clientFlagsAllowed: true,
    });
    expect(first).toEqual({ pro: true, foundingTester: true });
    expect(storage.getItem(FOUNDING_TESTER_KEY)).toBe('1');
    expect(storage.writes).toBe(1);

    const again = await loadProEntitlement({
      platform: 'android',
      readInstallTime: async () => { throw new Error('bridge unavailable'); },
      storage,
      clientFlagsAllowed: true,
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

  it('does not store or honor the founding-tester flag when client flags are off', async () => {
    const storage = memoryStore({ [FOUNDING_TESTER_KEY]: '1' });
    const entitlement = await loadProEntitlement({
      platform: 'android',
      readInstallTime: async () => before,
      storage,
      clientFlagsAllowed: false,
    });
    expect(entitlement).toEqual({ pro: false, foundingTester: false });
    expect(storage.writes).toBe(0);
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

  it('keeps the Illinois agency directory free of the Pro lock', () => {
    const html = readFileSync(new URL('../../v2/index.html', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../v2/main.ts', import.meta.url), 'utf8');
    expect(html).toContain('id="illinois-agencies"');
    expect(main).toContain('mountIllinoisDirectory(');
    expect(main).not.toMatch(/if\s*\(\s*hasVerifiedPro\s*\)[\s\S]{0,240}mountIllinoisDirectory/);
    expect(main).not.toMatch(/if\s*\(\s*trafficCamerasPro\s*\)[\s\S]{0,240}mountIllinoisDirectory/);
  });

  it('leaves purchases locked unless a caller supplies a verified purchase', () => {
    expect(resolveEntitlement({ platform: 'android', firstInstallTimeMs: after, persistedGrant: false, clientFlagsAllowed: true }).pro).toBe(false);
    expect(resolveEntitlement({
      platform: 'web', firstInstallTimeMs: null, persistedGrant: false, verifiedPurchase: true,
    })).toEqual({ pro: true, foundingTester: false });
  });

  it('unlocks traffic cameras only when Pro is granted', () => {
    expect(trafficCamerasUnlocked({ pro: true })).toBe(true);
    expect(trafficCamerasUnlocked({ pro: false })).toBe(false);
    expect(trafficCamerasUnlocked(resolveEntitlement({ platform: 'android', firstInstallTimeMs: before, persistedGrant: false, clientFlagsAllowed: true }))).toBe(true);
    expect(trafficCamerasUnlocked(resolveEntitlement({ platform: 'android', firstInstallTimeMs: after, persistedGrant: false, clientFlagsAllowed: true }))).toBe(false);
    expect(trafficCamerasUnlocked(resolveEntitlement({ platform: 'web', firstInstallTimeMs: before, persistedGrant: true }))).toBe(false);
  });

  it('keeps school-zone and work-zone alerts free without Pro, including on web', () => {
    const locked = resolveEntitlement({ platform: 'web', firstInstallTimeMs: before, persistedGrant: true });
    expect(trafficCameraAlertUnlocked(locked, 'school_zone')).toBe(true);
    expect(trafficCameraAlertUnlocked(locked, 'work_zone')).toBe(true);
    expect(trafficCameraAlertUnlocked(locked, 'speed')).toBe(false);
    expect(trafficCameraAlertUnlocked(locked, 'red_light')).toBe(false);
    expect(trafficCameraAlertUnlocked(locked, 'monitor')).toBe(false);
    expect(trafficCameraAlertUnlocked({ pro: true }, 'speed')).toBe(true);
  });

  it('lists traffic cameras in Pro copy and locks them in Settings', () => {
    const html = readFileSync(new URL('../../v2/index.html', import.meta.url), 'utf8');
    const main = readFileSync(new URL('../v2/main.ts', import.meta.url), 'utf8');
    expect(html).toContain('id="open-tc"');
    expect(html).toMatch(/id="open-tc"[^>]*>[\s\S]*Traffic cameras[\s\S]*pro-mark/);
    expect(html).toContain('id="tc-pro-offer"');
    expect(html).toContain('id="tc-upgrade"');
    expect(html).toContain('Unlock traffic-camera map pins and upcoming-camera alerts for speed, red-light and traffic-monitoring cameras');
    expect(html).toContain('School-zone and work-zone alerts are included for everyone');
    expect(html).toContain('Pro camera pins, paid camera alerts, and Stop History filters; school/work-zone alerts stay free');
    expect(html).toContain('Unlock traffic-camera map pins and speed, red-light and monitoring alerts');
    expect(html).toContain('School-zone and work-zone alerts stay free');
    expect(html).toContain('id="tc-alerts-on"');
    expect(html).toContain('id="tc-alert-school_zone"');
    expect(html).toContain('id="tc-alert-work_zone"');
    expect(main).toContain('trafficCamerasUnlocked');
    expect(main).toContain('isFreeTrafficCameraAlertType');
    expect(main).toContain('trafficCamerasPro');
    expect(main).toContain("mountLegend($('map-legend'), localStorage, { trafficCameras: false })");
    expect(main).toContain("if (!document.body.dataset.experience || tcBusy || !tcSet.alerts)");
    expect(main).not.toContain("if (!trafficCamerasUnlocked({ pro: trafficCamerasPro }) || !document.body.dataset.experience");
    // Flock stays free: the mapped-Flock switch is not behind the Pro gate.
    const flockBlock = main.slice(main.indexOf('// Pre-loaded Flock cameras'), main.indexOf('// Traffic enforcement cameras'));
    expect(flockBlock).toContain("getElementById('flockmap')");
    expect(flockBlock).not.toContain('trafficCamerasUnlocked');
    expect(flockBlock).not.toContain('hasVerifiedPro');
    expect(flockBlock).not.toContain('trafficCamerasPro');
  });

  it('does not gate native police or BLE alerts on the traffic-camera entitlement', () => {
    const scan = readFileSync(new URL('../../android/app/src/main/java/io/github/missionaryj/patrolradar/ScanService.java', import.meta.url), 'utf8');
    const notes = readFileSync(new URL('../../android/app/src/main/java/io/github/missionaryj/patrolradar/PoliceAlertNotifications.java', import.meta.url), 'utf8');
    const matcher = readFileSync(new URL('../../android/app/src/main/java/io/github/missionaryj/patrolradar/NativeAlertMatcher.java', import.meta.url), 'utf8');
    for (const src of [scan, notes, matcher]) {
      expect(src).not.toContain('trafficCameras');
      expect(src).not.toMatch(/upcoming-camera|traffic.?cam/i);
    }
    // "Fixed camera ping" is the soft police-notification channel name, not a traffic-camera alert.
    expect(notes).toContain('Fixed camera ping');
  });
});
