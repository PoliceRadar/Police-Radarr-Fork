import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';
import { sha256, playSubscription, evaluateSubscription, acknowledgeSubscription, PRODUCT } from './play.ts';

export function admin() {
  const url = Deno.env.get('SUPABASE_URL');
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !secret) throw new Error('Supabase service configuration missing');
  return createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function authenticatedUser(jwt: string) {
  const { data, error } = await admin().auth.getUser(jwt);
  if (error || !data.user?.id) throw new Error('Authentication required');
  return data.user.id as string;
}

/** Check every grant against Google. A purchase token alone never grants privileges. */
export async function refreshToken(token: string, presentedBy?: string) {
  const db = admin();
  const tokenHash = await sha256(token);
  const subscription = await playSubscription(token);
  const verdict = evaluateSubscription(subscription);
  if (!verdict.productMatches) throw new Error('This purchase is not Patrol Radar Pro');
  const { data: previous } = await db.from('pro_purchases').select('user_id')
    .eq('token_sha256', tokenHash).maybeSingle();
  let owner = presentedBy || previous?.user_id;
  if (!owner && verdict.linkedPurchaseToken) {
    const linkedHash = await sha256(verdict.linkedPurchaseToken);
    const { data: linked } = await db.from('pro_purchases').select('user_id')
      .eq('token_sha256', linkedHash).maybeSingle();
    owner = linked?.user_id;
  }
  // RTDN can arrive before the device sends its first verified purchase.
  if (!owner) return null;
  const { error } = await db.from('pro_purchases').upsert({
    token_sha256: tokenHash, purchase_token: token, user_id: owner,
    product_id: PRODUCT, state: verdict.state, active: verdict.active,
    expires_at: verdict.expiresAt, verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token_sha256' });
  if (error) throw new Error('Unable to persist subscription verification');
  // Ack only AFTER the trusted database has recorded fulfillment.
  if (verdict.active && verdict.needsAcknowledge) {
    try { await acknowledgeSubscription(token); }
    catch { console.warn('Google subscription acknowledgement retry required'); }
  }
  return verdict;
}

export async function proStatus(userId: string) {
  const db = admin();
  const { data: founder, error: founderError } = await db.from('pro_founders')
    .select('user_id').eq('user_id', userId).maybeSingle();
  if (founderError) throw new Error('Could not read founding entitlement');
  if (founder) return { pro: true, foundingTester: true, source: 'founder', expiresAt: null };
  const { data: purchases, error } = await db.from('pro_purchases')
    .select('purchase_token').eq('user_id', userId).order('verified_at', { ascending: false }).limit(10);
  if (error) throw new Error('Could not read subscription entitlements');
  for (const row of purchases ?? []) {
    // Re-read Play on user return. RTDN also keeps status fresh between launches.
    try { await refreshToken(row.purchase_token); } catch { /* rely on short-lived verified cache only */ }
  }
  const staleAfter = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: valid, error: validError } = await db.from('pro_purchases')
    .select('expires_at').eq('user_id', userId).eq('active', true)
    .gt('expires_at', new Date().toISOString()).gte('verified_at', staleAfter)
    .order('expires_at', { ascending: false }).limit(1);
  if (validError) throw new Error('Could not check subscription entitlement');
  if (!valid?.length) return { pro: false, foundingTester: false, source: 'none', expiresAt: null };
  return { pro: true, foundingTester: false, source: 'play', expiresAt: valid[0].expires_at };
}
