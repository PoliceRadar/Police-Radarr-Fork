# Closed test checklist (new personal accounts: 12+ testers opted in for 14 continuous days)
1. Wait for identity + phone verification in Play Console.
2. Create app: name "Patrol Radar", App, Free, accept declarations. Package `io.github.missionaryj.patrolradar`.
3. Setup → App signing: keep **Play App Signing** (default). The upload key is our keystore; the first AAB upload registers it.
4. Configure the Play upload service account and the `PLAY_SERVICE_ACCOUNT_JSON` GitHub secret ([github-play-upload.md](github-play-upload.md)). After that, a successful **Android APK** run on `main` uploads the signed AAB to Closed testing → **Alpha** (API track `alpha`). The workflow rejects the production track. Until the secret exists, the upload step skips with a notice.
5. Manual fallback while the secret is unset: GitHub → Actions → "Android APK" latest successful `main` run → artifact `patrol-radar-release-aab` (unzip → `patrol-radar-release.aab`). Upload that AAB by hand to Closed testing → Alpha only. Never upload the debug APK.
6. Testing → Closed testing → Alpha → Testers: an email list with **at least 12–15 Google accounts** (add a few spares; testers who drop out don't count). Do not create a second closed track for CI. The API id of this track is `alpha`.
7. Release notes are the commit title. With managed publishing on, you still open **Publishing overview** after review and click **Publish changes**. That click is what reaches testers. See [github-play-upload.md](github-play-upload.md).
8. Fill App content (Policy → App content): privacy policy URL, ads (no), app access (no login), content rating (content-rating.md), target audience 18+, data safety (data-safety.md), foreground service declaration (permissions.md, include a short screen video link, e.g. unlisted YouTube).
9. Store listing: paste listing.md text, upload icon-512.png, feature-graphic-1024x500.png and screenshots/*.png (2–8).
10. Send testers the opt-in link (Closed testing → Testers → "Copy link"). Each must open it, tap **Become a tester**, then install from Play.
11. Keep ≥12 testers opted in for 14 days straight; ask them to open the app a few times (Google looks at engagement).
12. After day 14: Dashboard → **Apply for production** and answer the questionnaire about the test (how testers were recruited, feedback, changes made). That application is a Play Console form. This GitHub workflow still cannot upload a production release.
13. Every new upload needs a higher versionCode. CI uses the Android workflow run number (about 239 in November 2026, already above the version code 58 Alpha release seen on 7 November 2026). A re-run reuses that number. A manual upload with a higher code blocks CI until the run number passes it. See [github-play-upload.md](github-play-upload.md).
