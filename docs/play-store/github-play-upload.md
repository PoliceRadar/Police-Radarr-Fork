# Upload Patrol Radar to Google Play from GitHub Actions

Package: `io.github.missionaryj.patrolradar`.

The **Android APK** workflow (`.github/workflows/android.yml`) builds the signed release AAB on every non-pull-request run. After the `apk` tests and the `aab` job both succeed, the `play` job uploads that AAB to a **testing track**. It never targets production.

| How the workflow starts | Play track | Who gets it |
| --- | --- | --- |
| Push to `main` | `alpha` | Closed testing → Alpha |
| Actions → Android APK → Run workflow, track **alpha** | `alpha` | Closed testing → Alpha |
| Actions → Android APK → Run workflow, track **beta** | `beta` | Open testing |

Pull requests do not build the signed AAB and do not upload. Forks do not upload. If the `PLAY_SERVICE_ACCOUNT_JSON` secret is missing or blank, the upload step is skipped with a notice and the workflow stays green. The artifact `patrol-radar-release-aab` is still there for a manual upload.

The upload uses [r0adkll/upload-google-play](https://github.com/r0adkll/upload-google-play) **v1.1.5**, pinned to commit `e738b9dd8f2476ea806d921b64aacd24f34515a5`. That action uploads to **production** when its `tracks` input is left empty. This workflow rejects an empty track, `production`, `prod`, and any name other than `alpha` or `beta` before the action runs. The track choice in the GitHub UI has no production option. A push to `main` always uses `alpha`; the dispatch input cannot retarget a push.

## One-time setup

Use a service account that can release **this app** to testing tracks. Keep it separate from the Supabase secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, which is for purchase verification. Do not put a private key in the repo, in Android, or in chat.

### 1. Google Cloud

1. In Play Console open **Setup → API access** and use the Google Cloud project already linked to this developer account. Link a project there first if the page says none is linked.
2. In that project, open [Google Play Android Developer API](https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com) and click **Enable**.
3. **IAM & Admin → Service accounts → Create service account**. Name it `patrol-radar-play-upload`. Do not grant it any Google Cloud IAM roles. Play Console permissions are what allow the upload.
4. Open the new account → **Keys → Add key → Create new key → JSON**. A JSON file downloads. That file is the private key.

### 2. Play Console permissions

1. Play Console → **Users and permissions → Invite new users**.
2. Paste the service account email (`client_email` in the JSON, ending in `iam.gserviceaccount.com`). Leave access expiry off.
3. Under **App permissions**, add only **Patrol Radar** (`io.github.missionaryj.patrolradar`). Do not grant account-wide admin.
4. Grant these app permissions:
   - **View app information (read-only)**
   - **Release apps to testing tracks**
5. Do **not** grant **Admin (all permissions)**, **Release to production, exclude devices, and use Play App Signing**, **View financial data**, or **Manage orders and subscriptions**. "Release apps to testing tracks" cannot publish a production release.
6. Click **Invite user**. Apply. A new user can take a few minutes to be accepted by the API. The first upload returns 401 or 403 until it does.

You do not need **Manage testing tracks and edit tester lists**. Tester lists stay as they are. Set those up by hand (see [closed-test-checklist.md](closed-test-checklist.md)).

### 3. GitHub secret

1. GitHub → `missionaryj/patrol-radar` → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `PLAY_SERVICE_ACCOUNT_JSON`
3. Value: the entire JSON file, including the opening and closing braces. Do not wrap it in extra quotes.
4. Save. Repository secret, not an environment secret. The workflow does not use a GitHub Environment, so a main merge is not held for a reviewer here. Managed publishing is the publish gate (below).

A missing secret skips the upload. A secret that is not valid service-account JSON fails the `play` job so a bad paste is visible. The `apk` and `aab` jobs are already done by then; their artifacts remain.

### 4. Confirm the tracks

The API track id for Closed testing → Alpha is `alpha`. The API track id for Open testing is `beta`. Those ids are not the display name. Before the first **beta** upload, open **Test and release → Testing → Open testing** once and save countries and testers. If the API says the track was not found, that page has not been set up yet.

## Open testing

Closed testing receives every successful `main` build. Open testing does not, because that track is wider than the Alpha email list.

**New build on Open testing.** Actions → **Android APK** → **Run workflow** → branch **main** → track **beta**. The run builds current `main`, gives it a new versionCode (that run's number), and uploads to `beta`. The same run also refreshes the rolling `android-latest` debug APK, which is existing behavior for any non-pull-request run. Dispatching from a branch other than `main` fails the Play job and does not upload.

**Same binary testers already have on Alpha.** Play Console → **Test and release → Testing → Closed testing → Alpha** → the release → **Promote release** → **Open testing**. That copies the existing version code. It is not a second upload, and this workflow does not do it. Promoting from the console still cannot be aimed at production by the workflow; do not choose production in the console promote dialog if you only wanted Open testing.

## Release status and managed publishing

The upload sets release status to **`completed`**: once Play actually publishes the release, every tester on that track gets it. This is not a staged production rollout (`inProgress` plus a user fraction). `changesNotSentForReview` is **false**, so committing the edit sends it for review. Release notes are the `en-US` "what's new" text: `versionName (short SHA): commit title`, from `package.json` and the commit subject, cut at 500 characters. The ProGuard `mapping.txt` is attached. Native debug symbols are attached when the AAB job produced `native-debug-symbols.zip`.

Publishing overview on 7 November 2026 had **managed publishing** turned on for this app. Recheck the toggle; it can be changed.

**Managed publishing on.** A green Actions run means Play accepted the bundle. Testers do not get it yet.

1. Open Play Console → **Publishing overview**.
2. The release should be in review, then under **Changes ready to publish** after Google approves it. You do not upload the AAB yourself.
3. Read the whole list. **Publish changes** publishes every change in that list, including store listing or policy edits that were waiting, not only this AAB.
4. Click **Publish changes** (the control may say **Go live** or **Publish**). Until that click, Alpha or Open testers stay on the previous build.

**Managed publishing off.** After Google finishes review, the testing-track release goes out without that extra click. Still confirm the track and the version in the console before telling testers.

If a change sits under **Changes not yet sent for review**, this workflow did not ask for that. Check for an edit someone started in the console, and do not send unrelated changes for review.

## versionCode

`android/app/build.gradle` sets `versionCode` from `VERSION_CODE`. The `aab` job sets that to `github.run_number`, the Android APK workflow's run number. `versionName` stays `package.json` `version`.

Around 18 November 2026 the run number is about **239**. On 7 November 2026 the Alpha release in review was version name `1.0.25`, version code **58**. The run number is ahead of that code. Gaps are normal: pull requests, failed runs, and manual dispatches all increment the run number, and Play allows unused codes.

Before the first automated upload, look up the highest version code on **any** track, including drafts, halted releases, and releases in review. Play rejects a code that is not strictly greater.

Risks:

- A **re-run of the same workflow run** reuses the run number (`github.run_attempt` does not change it). If that attempt already committed the code to Play, the re-run fails with a version-code error. Start a new run (push or **Run workflow**) instead. Re-running the failed jobs is safe only when the earlier attempt did not commit the edit.
- A **manual upload** whose version code is higher than the current run number blocks CI until the run number passes it. Do not hand-bump a code to something like 10000.
- **Renaming or replacing** `.github/workflows/android.yml` can start a new workflow whose run number goes back to 1. Those bundles would be rejected. Keep this file path.
- A **beta** dispatch uses a new run number, so that Open testing build is a higher version code than earlier Alpha builds of the same commit. Console **Promote release** is how the same version code moves from Alpha to Open testing.

## What a green `play` job means

- **Notice "Google Play upload skipped".** The secret is unset. Nothing was sent to Play.
- **Job failed on "Refusing Play track".** The track was production, empty, or something other than `alpha` or `beta`. Nothing was uploaded.
- **Job succeeded and the summary names a track.** Play accepted the edit and, unless managed publishing is holding it, sent it for review. Check Publishing overview before telling testers the build is installable.

## When the API rejects the upload

- **401 / 403.** The API is not enabled, the JSON is for a different project, or the Play Console invite has not applied yet. Permissions do not include production release; that is not the cause of a testing-track 403.
- **Package not found.** The first AAB for this package has to be uploaded once in Play Console so the app exists. Alpha already has builds, so this should not happen for `io.github.missionaryj.patrolradar`.
- **Version code has already been used.** See versionCode above. Use a new run.
- **Track not found.** The id must be `alpha` or `beta`, and Open testing must have been opened once for `beta`.
- **Edit in progress / precondition check failed.** A draft edit is open in Play Console, or another client committed first. Finish or discard that draft if this build should replace it, then start a **new** Actions run if the version code was already consumed.

## Manual fallback

Download artifact `patrol-radar-release-aab` from a successful `main` run, unzip `patrol-radar-release.aab`, and upload it in Play Console to Closed testing → Alpha or Open testing only. Do not upload the debug APK. Do not create a production release.
