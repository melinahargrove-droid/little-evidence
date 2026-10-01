# Classroom readiness audit — October 1, 2026

## Fixed

- Same-user authentication events (including token refresh) no longer clear the active checkpoint.
- Child/year/season changes require opening the new checkpoint; selecting another checkpoint resets child answers, notes, suggested levels, and attachment references. An unsaved-work confirmation protects unfinished work.
- Saved-record requests arriving after a checkpoint change are ignored.
- Teacher screens identify the selected checkpoint or explicitly show practice mode.
- Legacy Not Yet values normalize to numeric zero before saving; absent/invalid final levels cannot be saved.
- Rapid repeated taps are ignored for 350 ms, preventing an accidental second answer on the next screen.
- Returning to a completed ordering task resets its sequence so it can be tried again rather than getting stuck.
- Movement rating selection enables the teacher's Next button without a child-finished signal. New pairing sessions reset prior display status; cancelled display polling cannot restart itself.
- Movement setup explicitly requires a second device and offers teacher-only observation as a fallback.
- Finished child activities offer teacher review/save directly; checkpoint workspace offers Choose an activity.
- Reload/close warning protects marked unfinished activity work. It does not provide offline storage or recovery.

## Verification

`node scripts/verify-progressions.cjs`
`node scripts/verify-child-advance.cjs`
`node scripts/verify-classroom-state.cjs`

These cover progression bounds, synthetic save/resume, Not Yet storage, touch/sequence/observation behavior, skipped evidence, family wording, same-user auth refresh, sign-out, and clearing child state. App inline JavaScript also passes syntax checking.

## Practical limits for today's trial

- Internet is required for sign-in, saves, and paired activity controls.
- Save each teacher-reviewed objective before switching children or closing the page.
- iPad/phone remote control now covers every child-facing objective. Use “Use iPad remote” on a guided objective or its preparation page; movement retains “Start paired movement check.” Child touch answers advance automatically. Observed prompts advance from the iPad, with optional observation, Previous, Skip, and Repeat direction controls. Each activity uses a temporary pairing.
- A real signed-in add-child → save → reopen test on the classroom device is still required. Synthetic storage tests do not establish that email sign-in or the school network works.
- Browser testing cannot certify the classroom SmartBoard's touch hardware, audio settings, or network.

## Paired activity verification

Live two-screen check: Objective 22c child choices advance automatically, including an incorrect choice; hands-on prompt waits for iPad Next; completion leaves SmartBoard in child view and opens teacher review on iPad. Reducer checks cover role restrictions, stale requests, ordered selections, skipped prompts and scenarios. Every guided activity passes configuration validation. Real signed-in checkpoint saving was not exercised in this test.
