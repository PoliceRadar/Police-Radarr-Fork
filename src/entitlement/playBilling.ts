import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface PlayPurchase {
  productId: string;
  purchaseToken: string;
  state: 'purchased' | 'pending' | 'unknown';
}
export interface ProStatus {
  pro: boolean;
  foundingTester: boolean;
  expiresAt: string | null;
  source: 'founder' | 'play' | 'none';
}
export interface PlayProduct {
  productId: string;
  basePlanId: string;
  price: string;
  currencyCode: string;
}
type NativeBilling = {
  getProduct(): Promise<PlayProduct>;
  purchase(): Promise<{ launched: boolean }>;
  restore(): Promise<{ purchases: PlayPurchase[] }>;
  addListener(name: string, callback: (event: any) => void): Promise<{ remove(): Promise<void> }>;
};
const PRODUCT = 'patrol_radar_pro';
const EMPTY: ProStatus = { pro: false, foundingTester: false, expiresAt: null, source: 'none' };

export function nativeBilling(): NativeBilling | undefined {
  const cap = (globalThis as any).Capacitor;
  if (!cap?.isNativePlatform?.()) return undefined;
  return cap.Plugins?.PlayBilling ?? cap.registerPlugin?.('PlayBilling');
}

export class PlayProClient {
  private constructor(
    private readonly sb: SupabaseClient,
    private readonly endpoint: string,
    readonly native: NativeBilling | undefined,
  ) {}
  static async create(): Promise<PlayProClient> {
    const url = import.meta.env.VITE_SUPABASE_URL?.trim();
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
    if (!url || !key) throw new Error('Subscriptions are not configured yet.');
    const sb = createClient(url, key, { auth: { persistSession: true, storageKey: 'pr.chat.auth' } });
    const session = await sb.auth.getSession();
    if (session.error) throw session.error;
    if (!session.data.session) {
      const signed = await sb.auth.signInAnonymously();
      if (signed.error) throw signed.error;
    }
    return new PlayProClient(sb, url.replace(/\/$/, '') + '/functions/v1/pro-entitlement', nativeBilling());
  }
  private async request(action: string, purchaseToken?: string, founderCode?: string): Promise<ProStatus> {
    const { data, error } = await this.sb.auth.getSession();
    if (error || !data.session) throw new Error('Sign in to restore your subscription.');
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + data.session.access_token,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, purchaseToken, founderCode }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Could not verify with Google Play.');
    if (typeof body.pro !== 'boolean' || typeof body.foundingTester !== 'boolean') throw new Error('Invalid entitlement response.');
    return { ...EMPTY, ...body };
  }
  async status(): Promise<ProStatus> { return this.request('status'); }
  async verify(p: PlayPurchase): Promise<ProStatus> {
    if (p.state !== 'purchased' || p.productId !== PRODUCT || !p.purchaseToken) return this.status();
    return this.request('verify', p.purchaseToken);
  }
  async getProduct(): Promise<PlayProduct> {
    if (!this.native) throw new Error('Google Play purchases require the Android app.');
    return this.native.getProduct();
  }
  async purchase(): Promise<void> {
    if (!this.native) throw new Error('Google Play purchases require the Android app.');
    await this.native.purchase();
    // The purchaseUpdated callback contains the token. Never grant Pro here.
  }
  async restore(): Promise<ProStatus> {
    if (!this.native) return this.status();
    const result = await this.native.restore();
    for (const purchase of result.purchases ?? []) {
      if (purchase.state === 'purchased' && purchase.productId === PRODUCT) {
        // A bad token must not prevent checking another valid purchase.
        try { await this.verify(purchase); } catch { /* next valid purchase can still restore */ }
      }
    }
    return this.status();
  }
  async redeemFounderCode(code: string): Promise<ProStatus> {
    if (!/^[A-Za-z0-9-]{16,96}$/.test(code.trim())) throw new Error('Invalid founding tester code.');
    return this.request('founder', undefined, code.trim());
  }
  async listen(onVerified: (status: ProStatus) => void, onNotice: (message: string) => void) {
    if (!this.native) return;
    await this.native.addListener('purchaseUpdated', async (purchase: PlayPurchase) => {
      if (purchase.state === 'pending') { onNotice('Payment pending in Google Play. Pro remains locked.'); return; }
      try { onVerified(await this.verify(purchase)); }
      catch (error) { onNotice((error as Error).message); }
    });
    await this.native.addListener('purchaseError', (event: { cancelled?: boolean; code?: number }) => {
      if (!event.cancelled) onNotice('Google Play checkout could not complete. Please retry.');
    });
  }
}
