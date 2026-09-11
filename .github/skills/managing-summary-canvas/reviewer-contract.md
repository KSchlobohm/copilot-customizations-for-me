# Reviewer Result and Recommendation Contract

Use this reference when preparing reviewer prompts, validating their results,
or synthesizing the council's combined recommendation.

## Reviewer result contract

Include this contract in every reviewer prompt, filling in its perspective and question:

```text
Perspective: <assigned perspective>
Question: <exact owned question>
Assessment: <✅ Pass / ⚠️ Pass with concerns / ❌ Fail / ⛔ Blocked: required content inaccessible>
Rationale: <brief evidence supporting that assessment>
Findings: <actionable concerns in this scope, or None; each gives problem,
           impact, location when known, and blocking/non-blocking severity>
Cross-cutting blockers: <obvious blockers outside this scope, or None;
                        each gives problem, impact, and location when known>
```

Do not request a merge vote, answers to other perspectives' questions, or a
combined recommendation from an individual reviewer. Missing required fields,
mismatched perspective/question, invalid status, or contradictory assessment/findings
are unusable output; apply the retry rule rather than inferring a Pass.
Keep rationale in synthesis, not a new column; effective metadata needs runtime evidence.

## Combined recommendation

The coordinating agent writes one recommendation with a brief deliverable-specific
rationale. Synthesize evidence and concerns, not majority votes or model rankings.
Apply these rules in order:

| Condition | Combined recommendation |
|---|---|
| Reviews have not started or any seat is still running | ⏳ Pending |
| All seats terminal, but any is Unavailable or Blocked | 🚫 Incomplete |
| Complete coverage, with any Fail or unresolved blocking concern | ❌ Not ready |
| Complete coverage, with any Pass with concerns or unresolved non-blocking review concern | ⚠️ Ready with concerns |
| Complete coverage, all Pass, and no unresolved review concerns | ✅ Ready |

Complete coverage means all three perspectives have usable assessments.
Always surface known blockers and missing coverage in the rationale, including
while Pending or Incomplete. A cross-cutting blocker prevents Ready even if
all owned questions pass. Reconcile known unresolved blocking Action Items;
do not ignore them merely because a fresh reviewer omitted them. Ordinary open
tasks are not automatically review blockers. Never automatically dispose items.

Independent sessions are not evidence of model diversity when models repeat.
This result supports the user's decision and is not an automated merge gate
or permission to publish.
