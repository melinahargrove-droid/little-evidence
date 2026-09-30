# GOLD companion development checkpoint

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
