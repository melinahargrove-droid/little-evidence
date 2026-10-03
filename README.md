# Little Evidence · Objective 4, Objective 1a, and Objective 1b Prototypes

A standalone, browser-openable prototype for the Teaching Strategies GOLD Checkpoint Companion concept. This is separate from the Early Eagle Classroom Companion curriculum app.

## Try it

Open the published GitHub Pages URL on the computer, sign in, and choose the child's checkpoint. Start a paired activity and scan its QR code with the teacher phone or iPad. When both devices use the same teacher account, the exact child, school year, and checkpoint open automatically on the phone, and the activity begins. If the phone is signed out, sign in there and return to the paired tab or scan the same code again. Do not add the child again. The teacher screen shows the child and full objective; the child display hides private context.

The QR code and public activity relay contain no child/checkpoint identifiers. A separate owner-only, expiring private mapping resolves the selected checkpoint after authentication. Mappings are immutable, so another child cannot inherit a running pairing. Pairings created without a checkpoint retain the older phone-selection flow.

Child picture choices advance automatically. For spoken, hands-on, or movement prompts, the teacher records an observation and advances from the iPad. Teacher review still determines the final checkpoint level. **Save & next objective** saves and opens the next unfinished ordinary objective for the same child, using the established objective order; optional advanced activities stay optional. **Save & add evidence** saves while keeping the review open for photos, video, or voice evidence.

The paired activity stays connected while the iPad selects a checkpoint. A running activity cannot be reassigned to another child. New movement pairings use the same controller as other activities, allowing the same SmartBoard/iPad connection to continue between objectives.

## Run regression checks

The published app remains a standalone static page. Test-only dependencies are pinned in `package-lock.json`.

```sh
npm ci --ignore-scripts
for script in scripts/verify-*; do node "$script" || exit; done
npm exec -- playwright install chromium
node scripts/browser-phone-handoff.cjs
```

Tests use synthetic learners and mocked private storage. They do not substitute for authenticated iPad/SmartBoard, microphone, file-picker, or classroom-device testing.


## Prototype scope

- An Objective 1a · Manages Feelings teacher observation flow alongside Objective 4
- Objective 1a observation guide for authentic classroom moments; it deliberately has no child-facing SmartBoard task
- Objective 1b observation flow for adult cues, redirection, familiar routines, rule transfer, and understanding why expectations matter; it has no required child task or typing
- Objective 1a and 1b tap-through teacher interviews with behavior-specific follow-ups, a frequency question, optional evidence controls, editable suggested continuum points, next-level evidence, and family-friendly wording
- Compact teacher objective home screens with expandable progression, examples, and evidence guidance
- Objective 4 page with the saved progression and Level 6 examples
- One-at-a-time, full-screen child movement prompts with large text, a visual, an optional spoken direction, and progress dots
- A cheerful completion screen followed by the separate teacher recording view
- Live SmartBoard and iPad pairing through a short-lived Supabase session
- A teacher-only iPad controller that advances the child prompts and stores quick observation ratings locally on the iPad
- Teacher-selected observation ratings, consistency, notes, and evidence placeholders
- A preliminary Objective 4 level suggestion based on the teacher's movement ratings, refinable with observed developmental indicators, an optional in-between level, next-level evidence, and family-friendly wording

The child prompts do not score physical performance. Teacher-selected prompt ratings produce a cautious starting suggestion through Level 8; higher levels can be supported by selecting developmental indicators seen during play and routines. These suggestions are decision support, not validated Teaching Strategies GOLD scoring rules, and the teacher makes the final checkpoint decision in GOLD. Ratings stay in the teacher's browser. Objectives 1a and 1b are teacher-observed and do not require a child-facing task. Objective 1b includes optional spoken prompts for supporting higher-level evidence. The teacher answers the guided 1a questions by tapping; typing a note is optional. The 1a follow-up distinguishes supported or emerging behavior from more independent behavior, and a final frequency question adds context to the suggested continuum point. These suggestions are decision support, not validated Teaching Strategies GOLD scoring rules. The teacher makes the final checkpoint decision in GOLD. The public activity relay stores a random temporary session ID, hashed pairing tokens, prompt/response coordination, and workflow status; current guided-activity sessions expire after two hours (legacy movement sessions after 45 minutes). It stores no child name, checkpoint identifier, notes, media, checkpoint level, or precise teacher rating. Account-protected checkpoint records and evidence are stored separately. The private pairing-checkpoint mapping is readable/insertable only by its authenticated owner and expires with the activity session.

QR rendering is bundled locally with the MIT-licensed qrcode-generator 2.0.4 library so pairing does not depend on a third-party CDN. Its license is included in `vendor/qrcode-generator-LICENSE.txt`.

## Supabase setup

The Edge Function source is in `supabase/functions/little-evidence-session/index.ts`. The Supabase project uses a private table with RLS enabled and no browser table access. The function is deployed with JWT verification disabled because it authenticates each request with separate, high-entropy teacher and SmartBoard pairing tokens. Only the publishable API key is embedded in the public page; the server secret remains inside Supabase.
