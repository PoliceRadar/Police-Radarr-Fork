# Patrol Radar Pro — Open Testing release gate

Android package: io.github.missionaryj.patrolradar. Subscription product: patrol_radar_pro, base plan: monthly, U.S. price: $1.99/month. **Open Testing only. Never production.**

## Code delivered
- Native Google Play Billing Library 9.1.0 product lookup, monthly purchase, restore and pending-state callbacks.
- Supabase-authenticated server calling Google's purchases.subscriptionsv2.get API before unlocking Pro. Server stores purchase tokens privately with RLS, acknowledges after fulfillment, and applies expiry and state policy.
- Google Cloud Pub/Sub real-time developer notifications (RTDN), with authenticated OIDC push and Google re-verification, for renewals, cancellations and refunds.
- Server-owned permanent founding-tester grants and single-use code redemption. Legacy Android install-date is a UI hint only, never a secure Pro entitlement.
- Free Stop History preview; verified users get full shading and filters. Web has no Play checkout.

## Backend and Google Cloud setup (required before merging)
1. Apply both Supabase migrations (20261117000000_play_pro_entitlements.sql, then 20261118000000_pro_purchase_owner_immutable.sql) in the existing project. Inspect RLS, the service-role-only founder RPC and the trigger that prevents purchase-token ownership reassignment.
2. Enable Google Play Android Developer API in the Play-linked Google Cloud project. Create a narrowly privileged service account and authorize Play Console API access to view purchase status and acknowledge subscriptions.
3. Set Supabase Edge Function secret GOOGLE_PLAY_SERVICE_ACCOUNT_JSON to the complete JSON service account credential via secure Supabase secrets; do not commit keys, store them in Android, or paste them into chat. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are available to server functions.
4. Deploy pro-entitlement and pro-rtdn functions. Supabase config.toml intentionally disables gateway JWT verification because pro-entitlement validates Supabase Auth tokens through GoTrue and pro-rtdn validates Google-issued OIDC tokens.
5. Set up Google Cloud Pub/Sub topic for Play Real-time Developer Notifications, grant publishing access to google-play-developer-notifications@system.gserviceaccount.com, and connect topic in Play Console. Make authenticated push subscription to https://PROJECT_REF.supabase.co/functions/v1/pro-rtdn. Configure GOOGLE_PUBSUB_PUSH_EMAIL as exact push service-account email, GOOGLE_PUBSUB_AUDIENCE as exact audience. Send test notification.
6. Verify GitHub Actions public variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY target the same Supabase project; never bundle service-role and Google private keys. Monitor failed verification and Pub/Sub dead letters.

## Founding testers: mandatory grandfather migration
Existing grants use local firstInstallTime or localStorage; the server cannot securely prove those values came from an earlier install. Before shipping, provision confirmed founding users as pro_founders (using their Supabase Auth UUIDs), or privately provide each eligible founding tester a separate one-time random activation code (24+ random bytes), storing only SHA-256 in pro_founder_codes. Codes can be claimed once. Verify each founding tester still has Pro without a Subscribe button. Anonymous user IDs may change after uninstall; provide a verified recovery method for these testers. **Block rollout until founder access is migrated.**

## Play Console and payment checks
1. Complete merchant payments profile, identity, tax and bank verification. Only the account owner can do private financial verification.
2. Confirm product patrol_radar_pro, auto-renewing monthly plan, $1.99 U.S. price and region eligibility. **Activate/publish the base plan before a license-test purchase**: Google does not allow buying draft subscription products, even with license testers. Restrict billing checkout to a controlled Play test build until end-to-end verification passes.
3. Configure license-testing accounts and first publish the signed billing test AAB to a tightly scoped internal/closed test track to exercise test instruments. Google does not charge valid license testers for test purchases. Do not route ordinary users to checkout before validation.
4. On the Play-distributed signed build, test initial purchase, delayed/pending, failed verification, acknowledgement, restore, relaunch, renewal, cancellation until paid expiry, account hold, expiration, refund/revocation, duplicate RTDN and server outage. Verify access in every case.
5. Update Play Console IARC content rating: digital purchases YES. Recheck user-generated content answers for the City Chat feature. Update Data Safety for pseudonymous user ID, purchase/transaction status and verification. Check Financial features declaration as applicable: ordinary Play subscription is not money transfer or financial services.
6. Publish revised privacy policy and clear recurring price, Google Play payment and cancellation disclosures. Verify public URL.
7. Confirm highest versionCode already uploaded to any Play track, signing and Play checks. A tightly restricted test-track billing build can be distributed before Open Testing to run the purchase test; only merge the final candidate after review, tests, backend deployment and founder migration.
8. Get signed main-branch AAB from GitHub Actions and upload ONLY to Open Testing, reusing intended tester lists. Verify release actually reaches Open Testing and do not use production.

## Limitations and security
- A copied genuine Play purchase token could potentially be replayed. This implementation ties the token to only one authenticated anonymous account at a time, but broader rollout should add Play Integrity and durable account linking to resist theft and enable founder recovery.
- A purchase token is not a purchase until server-validated. Refund/revocation and expired subscriptions remove access. A paid cancellation typically keeps access until verified expiry.
- The heatmap source files under public/data/stop-heat are publicly downloadable; this gate protects in-app enhanced features, not confidential data files. Do not market them as exclusive secret datasets.
- Never ship Pro checkout with unavailable backend or unprovisioned founding grants. Never publish to production.
