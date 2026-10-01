# Objectives 18–23 verification — 2026-10-01

Checked all 20 dimensions against the user-uploaded GOLD Objectives for Development & Learning, Birth Through Third Grade PDFs. The shared 18b/18c page covers both dimensions; the 18d PDF also contains 18e. Source filenames, page numbers, and SHA-256 hashes are recorded in `verified-progressions.js`. PDFs are not republished in this repository.

| Dimensions | Numbered checkpoint range |
| --- | --- |
| 18a, 18c, 19a, 20a, 20b, 20c, 21b, 22a, 23 | 1–15 |
| 18b, 18d, 18e, 19c, 20d, 20e, 20f, 21a | 1–9 |
| 19b | 1–19 |
| 22b | 1–13 |
| 22c | 1–11 |

All also offer Not Yet. Even-numbered descriptions come from the supplied pages. Odd points between anchors describe emerging evidence. The final odd point is available for teacher selection but never automatically suggested from independence alone. The app directs teachers to confirm that final point using the official continuum.

The guided follow-up now shows the actual next indicator. It respects adult support explicitly allowed by the selected indicator. Changing the teacher's final level updates the displayed description, next evidence, and family note. Short touch checks remain supporting evidence and cannot establish an entire progression level. Family reports use shorter plain-language descriptions and the next skill plus a practical activity.

New saved reviews include `teacher_answers.progression_version = gold-b3-20261001`. Earlier saved reviews retain their data and display a reminder to review the new descriptions.

## Database correction

Applied remote migration `support_gold_progression_levels_through_19` to expand both existing level checks from 0–13 to 0–19. No records or access policies changed.

```sql
ALTER TABLE public.little_evidence_objective_records
  DROP CONSTRAINT little_evidence_objective_records_final_level_check,
  DROP CONSTRAINT little_evidence_objective_records_suggested_level_check,
  ADD CONSTRAINT little_evidence_objective_records_final_level_check
    CHECK (final_level >= 0 AND final_level <= 19),
  ADD CONSTRAINT little_evidence_objective_records_suggested_level_check
    CHECK (suggested_level >= 0 AND suggested_level <= 19);
```

Verification: inspected resulting constraints; inserted all 20 values from 0 through 19 into a temporary table copied with the production table's constraints. All accepted; the temporary table was dropped at transaction completion. Production child records were not used. Row-level security remains enabled.

## Regression checks

Run `node scripts/verify-progressions.cjs` for all objective ranges, established/emerging suggestions, high writing levels, skipped/unanswered/observed responses, save/resume through synthetic storage, family report content, and the signed-out save guard. These are isolated app tests, not a signed-in production checkpoint write.
