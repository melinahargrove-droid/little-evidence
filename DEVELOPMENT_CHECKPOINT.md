# Little Evidence development checkpoint

Latest release: the assessment continuity and reconnect recovery changes below are merged and live. Earlier workstream status is retained as history; the latest published status and remaining acceptance limits are in the final two sections.

## Current workstream — October 1, 2026

Little Evidence is separate from Early Eagle Classroom Companion. Preserve its existing teacher checkpoint, child activity, remote-control, and evidence-capture flows; do not rebuild them from the historical sections below.

### Complete in main at recovery baseline `26acfd0fb7fe31053eb4c16d296046bad76200d0`
- Objectives 1–23, teacher interviews, editable GOLD suggestions, saved checkpoint records, family reports, and per-objective photo/video/voice attachments are implemented.
- All 44 guided child-facing routes have iPad remote configurations; movement keeps its separate pairing flow.
- GOLD 18–23 progression verification was completed in `a5204d1`. See `docs/GOLD-PROGRESSION-VERIFICATION.md`. The September 30 “next unfinished work” below is historical and superseded.
- October 1 checkpoint isolation, Not Yet normalization, repeated-tap protections, automatic child choices, iPad touch sizing, and responsive illustrations are in the baseline. See `docs/CLASSROOM-READINESS-2026-10-01.md`.

### Current bounded change: evidence capture isolation
- Reproduced a pending file-picker race using synthetic data: a capture started on checkpoint A could target checkpoint B after a switch.
- Capture now snapshots the account, checkpoint, objective record, and cancellation revision. Pending file/voice results are discarded when their target is no longer current.
- Checkpoint or view changes cancel pending capture and stop the microphone. Reset also clears old preview links. Late microphone permission cannot resurrect a cancelled recording; repeated starts cannot create competing recorders.
- Uploads already started retain their original target, and delayed status/preview results cannot paint another checkpoint's screen.
- No database schema, RLS, bucket permissions, deployment, or scoring changes.

### Verification
- All five `scripts/verify-*` suites pass, including the new synthetic evidence-isolation races. Existing suites cover 44 remote configurations, child advance, checkpoint state, progression suggestions, and synthetic save/resume.
- Inline JavaScript syntax passes. A read-only PR workflow now runs the synthetic suites and inline syntax check.
- Live baseline browser smoke check: app opens, teacher-only movement review opens, and signed-out Photo shows “Save this assessment first, then attach evidence.” No real child data or evidence was uploaded.
- Local browser preview was blocked by the cloud browser (`ERR_BLOCKED_BY_CLIENT` for localhost). The live baseline smoke check is not a browser test of the patched branch.
- The isolation change is a reviewable branch change, not yet merged or deployed. Synthetic tests do not establish device microphone/file-picker behavior or authenticated storage success.

### Blocked / needs user
- A classroom-device sign-in → synthetic test child → save → reopen and photo/voice test remains to be verified. Use a synthetic learner and sample media, never real child information in shared tests.
- The desired capture-first objective suggestions and “strong / possible evidence” design are not present in this repository's current UI. Preserve that direction, but reconcile the established design/source before implementing a new flow; do not silently replace the existing checkpoint app.

### Next
- Review the isolated capture fix, then merge/deploy only with authorization and verify the exact deployed revision.
- Reconcile the capture-first design while authenticated/device-specific validation is pending.

---


2026-09-30 — Remaining child-facing activity pages

## Scope
- Objectives 1–23 only; Objectives 24–38 remain removed.
- Added activity routes for 2b, 5, 6, 7a, 7b, 9a–9d, 12a, 12b, 14a, 17a, 18a–18e, 19a–19c, 20d–20f, and 23.
- Updated existing child pages for 20a–20c, 21a–21b, and 22a–22c.
- Other social-emotional skills, conversation conventions, approaches to learning, and sociodramatic play remain based on observation in real interactions rather than separate screen tests.
- Existing child activities for 4, 3b, 8a, 8b, 13, 15a–15d, 16a, 16b, and 17b remain available.

## Behavior
- Teacher prep gives materials and optional extension guidance before child mode.
- Children tap picture choices directly; spoken, motor, and writing prompts are presented without a correct-answer key.
- Previous, skip, audio replay, and neutral completion are available.
- Teacher review records independent, supported, not demonstrated in this activity, or insufficient observation. Completion alone never records skill mastery.
- Skipped/unanswered/observation tasks do not count as wrong touch responses.
- Child evidence uses the existing private checkpoint payload; no database schema or access change.
- Real books, paper, tools, and objects are required where appropriate. The app does not score fluency, speech, handwriting, movement quality, or GOLD levels from taps.
- Removed obsolete duplicate draft Objective 13 card.

## Sources and limits
- Existing verified objective definitions and supplied GOLD progression PDFs for Objectives 18–23 informed activity routes.
- Activity prompts and SVG pictures are original.
- This change builds activities; existing draft developmental anchors for 18–23 still require a separate source-verification pass. Do not label those anchors verified.
- Advanced reading and number-concept activities are optional, teacher-selected extensions, not requirements for all preschoolers.

## Verification
- Inline and activity JavaScript syntax passed.
- Catalog validation passed: 33 new/updated objective routes, 81 prompts (64 observed, 17 keyed touch).
- Serialization checks passed: observation status retained, skipped and observed items never score, unanswered touch items excluded.
- Published activity build: 1c1726e8d2688be68556aa55a43747c1dba24526.
- Live browser traversal passed for all 33 new/updated routes and all 81 prompts, including preparation, skip, completion, and return to the child menu.
- Pattern activity tested through teacher review: one correct touch response, one skipped response, and one presented hands-on prompt produced 1/1 touch matches, one skipped, and an unmarked teacher observation.
- Teacher observation selection worked; no child checkpoint data was saved during tests.
- Ordered ribbon input enabled Next only after a complete sequence; reset cleared the order and disabled Next.
- Visual checks covered pattern and graph picture choices. Graph/prompt art width was increased after inspection for SmartBoard readability.
- Persistence payload verified locally; authenticated save/reload was not exercised with real student records.

## Next unfinished work
Verify existing draft progression anchors for 18–23 against the uploaded PDFs before treating their teacher checkpoint suggestions as source-verified. Child-facing pages are implemented; completing an activity is supporting evidence only.


## Simple picture refresh — 2026-09-30

- Replaced object emoji, abstract fruit drawings, generic people, routine props, and movement scenes with 38 original classroom illustrations in `assets/illustrations/`.
- Same fruit assets appear in graph row labels and answer choices. Votes remain exactly 4 apples, 2 bananas, and 3 grapes.
- Native counting dots, shapes, patterns, lengths, and deterministic spatial compositions remain exact.
- Existing choice labels are preserved for saved evidence compatibility; prompts, response order/answer keys, teacher notes, and observed modes are unchanged.
- Transparent WebP assets are at most 640px; images use contained sizing to avoid cropping and fit smaller screens. Prompt subjects documented beside assets.
- Checks: all scripts parse; 33 catalog routes retain identical task semantics. All 32 task image references resolve locally, plus six social/movement illustrations. Live browser verification confirmed new fruit images and 4/2/3 votes, selectable choices, listening action pictures, puppy spatial compositions, and the feelings page. The movement entry still uses its existing iPad pairing setup; no paired session or child record was saved.
- Published commit `8bf3a13e9640264f81e94731f61df29bc684c971`; deployment `36771954493` completed its deploy job successfully, and the new art was verified on the live page. The previously waiting spacing deployment was superseded. No environment or permission changes.

## 2026-10-01 — Single-child iPad assessment continuity

### Current media-fix status
- Capture isolation PR #1 is merged at `74279830963b6295309a249894fc1a5ccf28ce1b` and deployed. CI run `36882529097` and Pages run `36882529022` passed; the published index matched the tested source.
- Authenticated media upload/reopen and real iPad microphone/file-picker behavior remain unverified. Use synthetic learners and sample media for validation.

### Assessment continuity
- The teacher chooses the child on the iPad before starting. Child name, checkpoint season, and the full existing GOLD objective number/title remain prominent on teacher screens; child displays and printed artifacts hide this context banner.
- A running activity is bound locally to its child/account/checkpoint. Child identity and exact movement ratings are never added to pairing links or anonymous relay payloads. Local session storage preserves the binding and movement-rating distinctions on reload.
- Opening the private checkpoint workspace preserves the paired activity and returns after selection. During an active activity, a different child cannot silently inherit its responses. Returning from the workspace preserves the in-progress review instead of overwriting it with an older saved record.
- New movement sessions use the existing guided-activity relay so the same pair can continue across objectives. The existing service already supports objective configuration; no backend, schema, RLS, permissions, or scoring changes were required. Old movement links remain supported for their original movement assessment.
- Save & next opens the next unfinished ordinary objective in established numeric order, wrapping to earlier gaps when needed. Optional advanced activities remain optional. Save & add evidence keeps the review open for media attachments.
- Materials and optional-extension warnings remain visible. Guided teacher answers advance on a tap; Back and editable final checkpoint judgment remain available. Change answers now correctly returns to the interview.
- Captured child identity prevents stale checkpoint loads from showing a different child's name. Shared save locks and child/account/navigation/edit freshness guards prevent overlapping saves or stale continuation from discarding newer work.

### Verification
- All synthetic regression scripts pass after `npm ci --ignore-scripts`; pinned jsdom is test-only. Coverage includes full-app DOM boot, child/title banners, selection/return, question progression, movement ratings, retry/skip, private relay payloads, same-pair objective change, save concurrency, and stale child/account/navigation/edit responses.
- Inline/external JavaScript syntax and `git diff --check` pass. Independent code review findings were fixed and relevant tests rerun.
- Live baseline cloud-browser navigation reproduced redundant start/prep and answer/Next stops.
- Live anonymous service smoke test confirmed objective 4 configuration and same-session switch to 20a on the display role. No child, owner, checkpoint, or rating information was transmitted in that smoke test.
- Local Chromium cannot create required sockets in this runtime. Synthetic DOM tests verify application behavior but do not verify rendered layout or real iPad input. Authenticated save/reopen, actual cross-device behavior, microphone/file picker, and interrupted-device recovery still require classroom-device validation.

### Published release status
- Assessment continuity PR #2 is merged at `9154f4565062b290b0e5e3fd5ec86aaa749545cf` and live at https://melinahargrove-droid.github.io/little-evidence/.
- Exact-head CI `36888205946`, main CI `36888328115`, and Pages deployment `36888328441` all succeeded. The published `index.html`, `activity-remote.js`, and `assessment-continuation.js` exactly matched the tested source.
- Post-deployment cloud-browser checks passed for the persistent objective banner, consolidated prep, one-tap teacher questions, editable final review, signed-out save guard, new movement pairing, iPad child-selection gate, and return to the same pairing.
- Real-device acceptance remains pending: authenticated child selection, save/reopen, automatic next objective on an actual paired iPad/SmartBoard, media capture, and interrupted-device recovery have not been accepted as complete. Use a synthetic learner and sample media; do not treat synthetic DOM tests as real-device acceptance.
- The bounded refresh/reopen and network-reconnect verification is complete; its two confirmed defects were fixed and published as documented below. Classroom-device acceptance remains pending.


## 2026-10-01 — Published reconnect recovery closure

- Recovery PR #4 (https://github.com/melinahargrove-droid/little-evidence/pull/4) is merged at `36564fb28a638309a153204b45b01da21eab8c45`. Its exact tested head is `8aee7e552444e029ae602a3140def6696fb86169`.
- A next-objective configure that commits but loses its acknowledgement now reconciles current relay state before retrying. Repeated attempts do not reset an objective that already started or acquired responses. Overlapping continuations are serialized; child and navigation checks remain enforced before opening the next screen.
- Movement observations now retain a private pending intent on the teacher device before transmission. Matching immediate objective/prompt/revision recovery preserves the precise local movement rating through a lost acknowledgement, direct stale retry, or same-tab refresh. Child identity, checkpoint identifiers, and precise ratings are not sent to the relay. No backend, schema, permission, or scoring change was introduced.
- All 12 regression scripts passed locally and in GitHub CI, using synthetic learners and mocked network responses against the real relay-transition implementation. Added cases cover loss before/after commit, direct retries before polling, repeated continuation, same-tab refresh, older/conflicting revisions, progress preservation, child/navigation changes, and overlapping requests. Independent QA reproduced both original failures and verified the fixes; independent review found no blocker within this bounded same-device recovery scope.
- Exact-head PR CI run `36890829421` passed. Merged-main verification `36890950070` and Pages deployment `36890950094` passed. The live root returned HTTP 200 and matched the tested HTML. Live `activity-remote.js` exactly matched the tested controller; SHA-256: `5194f0de80f2f2f04eee83774d1760faa7b2f6f176b1deb339493c6355b7144a`.
- Live app: https://melinahargrove-droid.github.io/little-evidence/. This entry records the verified application release; publishing this documentation-only update does not change app behavior.

### Remaining acceptance limits and stopping point

- Authenticated physical iPad/SmartBoard child selection, save/reopen, automatic next objective, and media capture remain unverified. Use a synthetic learner and sample media. No real child data was entered or uploaded for these regression tests.
- A fresh tab without the original session storage, or an expired pairing, requires re-pairing. This change does not introduce fresh-tab recovery or a new storage backend.
- Simultaneous teacher clients submitting identical generic observations at the same revision cannot be distinguished by the existing relay contract. A relay operation identifier would be a separate backend change and is outside this release. Later or nonmatching transitions do not inherit a pending precise rating.
- The authorized recovery engineering work is complete. Wait for the user's paired-device findings before proposing adjacent features or further changes.

## 2026-10-01 — Report and delayed-load audit fixes

- Family reports and GOLD entry sheets capture the requesting account, checkpoint, child name, and navigation revision. Stale results or errors cannot render or navigate after a child/account change, navigation away/back, or a newer report request. Report identity and checkpoint captions come from the same captured request as the records.
- Movement, feelings, limits, and guided saved-record hydration now reject responses when a newer assessment edit occurred while loading. This preserves newer notes, ratings, and interview answers rather than replacing them with an older saved version.
- Added a full-app synthetic regression suite covering report identity/account/logout/navigation/repeated-request races and all four hydration paths. Actual feelings/limits answer taps now mark edits, and capture-phase tracking ensures the final guided answer does not invalidate the saved-record load it starts. All 13 suites and inline JavaScript syntax pass locally. No schema, security, relay, or curriculum changes.
- Publication verification will be recorded after exact-head CI, merge, Pages deployment, and live checks. Actual authenticated iPad/SmartBoard testing remains unverified; these tests use only synthetic learners and mocked private storage.
