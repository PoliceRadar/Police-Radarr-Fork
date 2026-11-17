/**
 * Pro entitlement.
 *
 * Play Billing is not connected. A paid purchase is never read from localStorage,
 * the URL, or the page. The only live grant is Android install-date grandfathering
 * for builds already installed when Open testing begins. The web app is never grandfathered.
 *
 * A later billing integration can pass `verifiedPurchase: true` from a server-checked
 * Play purchase. This module does not talk to Play Billing.
 */

/**
 * TODO: set to the Open testing go-live time before that release.
 * Placeholder only: 2026-11-17T00:00:00-06:00. Confirm the real instant before Open testing.
 */
export const TESTER_CUTOFF_MS = Date.parse('2026-11-17T00:00:00-06:00');

/** Written only after an Android install qualifies. Not a purchase receipt. */
export const FOUNDING_TESTER_KEY = 'pr.foundingTester';

export const FOUNDING_TESTER_LABEL = 'Founding tester: Pro unlocked';

export type EntitlementPlatform = 'android' | 'web';

export interface EntitlementSources {
  platform: EntitlementPlatform;
  /** PackageInfo.firstInstallTime in epoch ms, or null when the bridge did not return one. */
  firstInstallTimeMs: number | null;
  /** True when this Android install already stored a founding-tester grant. */
  persistedGrant: boolean;
  /**
   * Verified Play Billing entitlement. Defaults to locked.
   * Only a future server-checked purchase may set this. Never load it from localStorage.
   */
  verifiedPurchase?: boolean;
}

export interface ProEntitlement {
  pro: boolean;
  foundingTester: boolean;
}

export interface GrantStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Strictly before the cutoff. The cutoff instant itself does not qualify. */
export function qualifiesByInstallDate(firstInstallTimeMs: number | null, cutoffMs = TESTER_CUTOFF_MS): boolean {
  return typeof firstInstallTimeMs === 'number' && Number.isFinite(firstInstallTimeMs) && firstInstallTimeMs < cutoffMs;
}

export function resolveEntitlement(sources: EntitlementSources, cutoffMs = TESTER_CUTOFF_MS): ProEntitlement {
  const verifiedPurchase = sources.verifiedPurchase === true;
  if (sources.platform !== 'android') return { pro: verifiedPurchase, foundingTester: false };
  const foundingTester = sources.persistedGrant || qualifiesByInstallDate(sources.firstInstallTimeMs, cutoffMs);
  return { pro: foundingTester || verifiedPurchase, foundingTester };
}

export function parseInstallTime(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Resolve Pro for this launch. On Android, a qualifying install time is stored locally
 * so a later launch still grants Pro if the bridge cannot be read. Web never stores or honors the flag.
 */
export async function loadProEntitlement(opts: {
  platform: EntitlementPlatform;
  readInstallTime?: () => Promise<unknown>;
  storage?: GrantStore;
  verifiedPurchase?: boolean;
  cutoffMs?: number;
}): Promise<ProEntitlement> {
  const platform: EntitlementPlatform = opts.platform === 'android' ? 'android' : 'web';
  let persistedGrant = false;
  if (platform === 'android' && opts.storage) {
    try { persistedGrant = opts.storage.getItem(FOUNDING_TESTER_KEY) === '1'; } catch { persistedGrant = false; }
  }
  let firstInstallTimeMs: number | null = null;
  if (platform === 'android' && opts.readInstallTime) {
    try { firstInstallTimeMs = parseInstallTime(await opts.readInstallTime()); }
    catch { firstInstallTimeMs = null; }
  }
  const entitlement = resolveEntitlement({
    platform,
    firstInstallTimeMs,
    persistedGrant,
    verifiedPurchase: opts.verifiedPurchase === true,
  }, opts.cutoffMs);
  if (entitlement.foundingTester && opts.storage?.getItem(FOUNDING_TESTER_KEY) !== '1') {
    try { opts.storage?.setItem(FOUNDING_TESTER_KEY, '1'); } catch { /* storage may be blocked */ }
  }
  return entitlement;
}

/** Read PackageInfo.firstInstallTime from the PatrolScan plugin. Returns null when the method is absent. */
export async function readNativeFirstInstallTime(plugin: { firstInstallTime?: () => Promise<{ firstInstallTime?: unknown } | null | undefined> } | undefined): Promise<unknown> {
  if (!plugin?.firstInstallTime) return null;
  const result = await plugin.firstInstallTime();
  return result?.firstInstallTime ?? null;
}
