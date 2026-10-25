# P04-03 — Short data protection impact assessment (DPIA)

## GOAL
The owner has a written assessment of the privacy risks in Laandet, and of how they are reduced, before real
people use it.

## CONTEXT
- `docs/PRIVACY.md` (records of processing, DPIA screening), `docs/THREAT_MODEL.md`, `docs/SECURITY.md`.
- Datatilsynet's list of processing that needs a DPIA. GDPR art. 35.

## INPUT
- PRIVACY.md §3 (screening result) and the implemented processing after Phase 03.

## OUTPUT
1. **`docs/DPIA.md`** (English, short):
   - a description of the processing;
   - necessity and proportionality;
   - risks to the people involved (likelihood × severity) with the measures in place and the residual risk;
   - consultation (the lawyer; Datatilsynet only if a high residual risk remains);
   - review date.
2. A clear header: **draft by the development team (AI-assisted), not legally reviewed**, to be confirmed by the lawyer and signed by the controller.

## CONSTRAINTS
- Only measures that exist in the code or in the runbooks are listed as in place. Everything else is listed as planned.

## TESTS
- Review: every measure named as in place points to a test, a file or a runbook.
