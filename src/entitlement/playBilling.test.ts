import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/v2/main.ts', 'utf8');
const ui = readFileSync('v2/index.html', 'utf8');
const plugin = readFileSync('android/app/src/main/java/io/github/missionaryj/patrolradar/PlayBillingPlugin.java', 'utf8');
const server = readFileSync('supabase/functions/_shared/store.ts', 'utf8');
const verifier = readFileSync('supabase/functions/_shared/play.ts', 'utf8');
const sql = readFileSync('supabase/migrations/20261117000000_play_pro_entitlements.sql', 'utf8');
const ownershipSql = readFileSync('supabase/migrations/20261118000000_pro_purchase_owner_immutable.sql', 'utf8');

describe('Play subscription security boundaries', () => {
  it('never upgrades Pro from Android callback or local install/grant flag', () => {
    expect(app).toContain('status = await proClient.restore()');
    expect(app).toContain('applyVerified(status)');
    expect(app).toContain('void proClient.purchase()');
    expect(app).not.toContain('hasVerifiedPro = entitlement.pro');
    expect(app).toContain('hasVerifiedPro = status.pro');
    expect(app).toContain('trafficCamerasPro = status.pro');
    expect(app).not.toContain('trafficCamerasPro = entitlement.pro');
    expect(app).toContain('applyTrafficCamEntitlement();');
    expect(app).toContain('tcAlerter.check(f, cams, tcSet, travel().mode, trafficCamerasPro)');
    expect(plugin).not.toContain('SharedPreferences');
    expect(plugin).not.toMatch(/\bsetPro\s*\(/);
    expect(verifier).toContain('/purchases/subscriptionsv2/tokens/');
    expect(server).toContain('await playSubscription(token)');
    expect(server).toContain('productMatches');
  });
  it('offers purchases only through native Play and includes restore and pending flow', () => {
    expect(plugin).toContain('BillingClient.ProductType.SUBS');
    expect(plugin).toContain('PLAN.equals(offer.getBasePlanId())');
    expect(plugin).toContain('notifyListeners("purchaseUpdated"');
    expect(plugin).toContain('QueryPurchasesParams');
    expect(ui).toContain('id="heat-upgrade"');
    expect(ui).toContain('id="pro-restore"');
    expect(ui).toContain('id="founder-claim"');
  });
  it('keeps private purchase records server-only and founders independent from subscription expiry', () => {
    expect(sql).toContain('alter table public.pro_purchases enable row level security');
    expect(sql).toContain('revoke all on public.pro_purchases');
    expect(sql).toContain('grant all on public.pro_purchases');
    expect(sql).toContain('create table if not exists public.pro_founders');
    expect(server).toContain("source: 'founder'");
    expect(server).toContain('acknowledgeSubscription');
    expect(server).toContain('owner = linked.user_id');
    expect(server).toContain('owner !== presentedBy');
    expect(ownershipSql).toContain('old.user_id is distinct from new.user_id');
    expect(ownershipSql).toContain('before update of user_id');
  });
  it('requires authenticated Google Pub/Sub notifications', () => {
    const rtdn = readFileSync('supabase/functions/pro-rtdn/index.ts', 'utf8');
    expect(rtdn).toContain('verifyPubSubPush(req)');
    expect(rtdn).toContain('await refreshToken(token)');
  });
});
