# Little Evidence · Objective 4 and Objective 1a Prototypes

A standalone, browser-openable prototype for the Teaching Strategies GOLD Checkpoint Companion concept. This is separate from the Early Eagle Classroom Companion curriculum app.

## Try it

Open the published GitHub Pages URL on the SmartBoard. Select **Start Movement Check** and scan the temporary pairing QR code with the teacher iPad. The iPad opens the teacher controller; the SmartBoard switches to one full-screen child movement prompt at a time. The teacher selects a quick observation on the iPad and taps **Next movement**; the SmartBoard advances without requiring a child button. After the final prompt, the SmartBoard shows a cheerful completion screen and the iPad opens the teacher recording view.

## Prototype scope

- An Objective 1a · Manages Feelings teacher observation flow alongside Objective 4
- Objective 1a observation guide for authentic classroom moments; it deliberately has no child-facing SmartBoard task
- Objective 1a tap-through teacher interview with an adaptive behavior-specific follow-up, frequency question, optional notes/evidence controls, an editable suggested continuum point, next-level evidence, and family-friendly wording
- Compact teacher objective home screens with expandable progression, examples, and evidence guidance
- Objective 4 page with the saved progression and Level 6 examples
- One-at-a-time, full-screen child movement prompts with large text, a visual, an optional spoken direction, and progress dots
- A cheerful completion screen followed by the separate teacher recording view
- Live SmartBoard and iPad pairing through a short-lived Supabase session
- A teacher-only iPad controller that advances the child prompts and stores quick observation ratings locally on the iPad
- Teacher-selected observation ratings, consistency, notes, and evidence placeholders
- A preliminary Objective 4 level suggestion based on the teacher's movement ratings, refinable with observed developmental indicators, an optional in-between level, next-level evidence, and family-friendly wording

The child prompts do not score physical performance. Teacher-selected prompt ratings produce a cautious starting suggestion through Level 8; higher levels can be supported by selecting developmental indicators seen during play and routines. These suggestions are decision support, not validated Teaching Strategies GOLD scoring rules, and the teacher makes the final checkpoint decision in GOLD. Ratings stay in the teacher's browser. Objective 1a is teacher-observed and does not ask the child to perform or talk about feelings. The teacher answers the guided 1a questions by tapping; typing a note is optional. The 1a follow-up distinguishes supported or emerging behavior from more independent behavior, and a final frequency question adds context to the suggested continuum point. These suggestions are decision support, not validated Teaching Strategies GOLD scoring rules. The teacher makes the final checkpoint decision in GOLD. The pairing service stores only a random temporary session ID, hashed pairing tokens, the current prompt, and workflow status; sessions expire after 45 minutes. It stores no child name, notes, photo, video, checkpoint level, or teacher rating. Photo, video, and voice controls are placeholders, and teacher review data is not saved as a long-term child record.

QR rendering is bundled locally with the MIT-licensed qrcode-generator 2.0.4 library so pairing does not depend on a third-party CDN. Its license is included in `vendor/qrcode-generator-LICENSE.txt`.

## Supabase setup

The Edge Function source is in `supabase/functions/little-evidence-session/index.ts`. The Supabase project uses a private table with RLS enabled and no browser table access. The function is deployed with JWT verification disabled because it authenticates each request with separate, high-entropy teacher and SmartBoard pairing tokens. Only the publishable API key is embedded in the public page; the server secret remains inside Supabase.
