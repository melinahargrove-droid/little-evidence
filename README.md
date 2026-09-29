# Little Evidence · Objective 4 and Objective 1a Prototypes

A standalone, browser-openable prototype for the Teaching Strategies GOLD Checkpoint Companion concept. This is separate from the Early Eagle Classroom Companion curriculum app.

## Try it

Open the published GitHub Pages URL on the SmartBoard. Select **Start Movement Check** and scan the temporary pairing QR code with the teacher iPad. The iPad opens the teacher controller; the SmartBoard switches to one full-screen child movement prompt at a time. The child taps **I did it!**, the teacher selects a quick observation on the iPad, then advances to the next prompt. After the final prompt, the SmartBoard shows a cheerful completion screen and the iPad opens the teacher recording view.

## Prototype scope

- An Objective 1a · Manages Feelings teacher observation flow alongside Objective 4
- Objective 1a observation guide for authentic classroom moments; it deliberately has no child-facing SmartBoard task
- Objective 1a teacher recording with selectable observed indicators, an adaptive reflection, optional notes/evidence controls, an editable suggested level, next-level evidence, and family-friendly wording
- Objective page with the saved Objective 4 progression and Level 6 examples
- One-at-a-time, full-screen child movement prompts with large text, a visual, an optional spoken direction, and progress dots
- A cheerful completion screen followed by the separate teacher recording view
- Live SmartBoard and iPad pairing through a short-lived Supabase session
- A teacher-only iPad controller that advances the child prompts and stores quick observation ratings locally on the iPad
- Teacher-selected observation ratings, consistency, notes, and evidence placeholders
- Teacher-selected developmental indicators, an optional in-between-level suggestion when the next anchor is emerging, editable levels 1–12, next-level evidence, and a family-friendly summary

The child prompts do not score physical performance. Prompt ratings are supporting notes only and stay in the teacher's browser. Objective 1a is teacher-observed and does not ask the child to perform or talk about feelings. The pairing service stores only a random temporary session ID, hashed pairing tokens, the current prompt, and workflow status; sessions expire after 45 minutes. It stores no child name, notes, photo, video, checkpoint level, or teacher rating. The prototype level suggestions use teacher-selected indicators; marking an upcoming indicator as emerging suggests an in-between level. This interaction is not a validated Teaching Strategies GOLD scoring rule. The teacher makes the final checkpoint decision in GOLD. Photo, video, and voice controls are placeholders, and teacher review data is not saved as a long-term child record.

QR rendering is bundled locally with the MIT-licensed qrcode-generator 2.0.4 library so pairing does not depend on a third-party CDN. Its license is included in `vendor/qrcode-generator-LICENSE.txt`.

## Supabase setup

The Edge Function source is in `supabase/functions/little-evidence-session/index.ts`. The Supabase project uses a private table with RLS enabled and no browser table access. The function is deployed with JWT verification disabled because it authenticates each request with separate, high-entropy teacher and SmartBoard pairing tokens. Only the publishable API key is embedded in the public page; the server secret remains inside Supabase.
