# Activation-Alignment Evaluation

A method to detect when a skill's `description` **under-triggers** or **over-triggers**
relative to what the skill's body content is actually built to do.

## Why this exists

The `description` is the *only* signal the agent sees when deciding whether to activate a
skill. Everything else — the body, the reference files — is invisible until after the
skill fires. So a skill can be excellent inside and still never run, because its
description doesn't match the way users phrase the tasks it was built for.

This is **activation mismatch**: the description's implied activation range diverges from
the content's true purpose.

- **Under-trigger (weak description):** the body handles a task, but the description
  wouldn't fire on a realistic request for it. The skill silently fails to engage. *This
  is the most common and most damaging failure — the skill might as well not exist.*
- **Over-trigger (leaky description):** the description fires on tasks the body has nothing
  to offer, wasting context and crowding out the right skill.

This evaluation is distinct from the capability evaluations in
`agent-skills-best-practices.md` ("Build evaluations first"), which test whether the skill
*does the task well once activated*. This one tests whether it *activates at the right
time at all*. Run both.

## The method

Run this whenever you create or review a skill. It is an in-conversation reasoning
exercise — no scripts or external tooling required.

### Step 1 — Derive the content's true purpose (body only)

Read the SKILL.md **body and reference files**, and deliberately **ignore the
`description`**. Write one or two sentences answering: *What tasks is this skill actually
built to handle?* Note the concrete verbs and nouns the content supports (e.g. "create",
"review", "grade", "agent files", ".agent.md", "frontmatter").

Deriving purpose from the body — not the description — is what makes this a real test. If
you read the description first, you'll just confirm it agrees with itself.

### Step 2 — Generate 5 probe scenarios

Write realistic user requests grounded in the purpose from Step 1:

| # | Type | Expected activation | Purpose |
|---|------|--------------------|---------|
| 1–3 | **Clearly related** | Should activate | Core tasks the body clearly handles, phrased the way real users would (vary the wording — don't echo the description's own terms) |
| 4 | **Narrow / boundary** | Judgment call | A tangential task at the edge of scope — reveals where the intended boundary sits |
| 5 | **Unrelated** | Should NOT activate | A plausible request in a nearby domain the body does not cover |

Phrasing rule: write the related scenarios in **users' words, not the skill's words**.
"Make me a sub-agent that runs my tests" should match an agent-authoring skill even though
it never says "agent file" or "frontmatter". Reusing the description's exact vocabulary
hides under-trigger bugs.

### Step 3 — Blind-judge using the description only

For each scenario, look **only at the `description`** (cover the body) and decide: would
this description cause the skill to trigger for this request? Answer **trigger / no-trigger**
and give a one-line reason. Be honest about weak keyword overlap — judge as a cold agent
that has never seen the body would.

### Step 4 — Compare and classify

Line up the Step 3 verdicts against the Step 2 expectations:

| Scenario expectation | Description verdict | Diagnosis |
|----------------------|---------------------|-----------|
| Related (should activate) | Trigger | ✅ Aligned |
| Related (should activate) | No-trigger | 🔴 **Under-trigger** — weak description |
| Unrelated (should not) | No-trigger | ✅ Aligned |
| Unrelated (should not) | Trigger | 🟠 **Over-trigger** — leaky description |
| Boundary | Either | ⚠️ Confirm the verdict matches your intended scope; adjust description if not |

**Any 🔴 or 🟠 is an activation mismatch:** the description's purpose is not aligned with
the content's purpose. The skill needs a description fix, not a body fix.

### Step 5 — Fix the description and re-run

- **Under-trigger:** add the missing task phrasings and trigger terms users actually say;
  broaden verbs (create *and* author *and* build); name the artifact and its synonyms
  (e.g. "agent files", "sub-agents", ".agent.md"). Keep it third person and specific.
- **Over-trigger:** tighten scope — qualify the domain, remove over-broad terms, or name
  what it is *not* for.

Re-run Steps 3–4 with the revised description until every related scenario triggers and the
unrelated scenario does not.

## Worked example

Skill body: creates, reviews, and grades custom agent files (`.agent.md`).

**Weak description:** `Applies community best practices to author files.`

| # | Scenario (user words) | Type | Expected | Verdict (desc only) |
|---|-----------------------|------|----------|---------------------|
| 1 | "Create a sub-agent that runs my .NET tests" | related | activate | 🔴 no-trigger ("agent" never appears) |
| 2 | "Review my .agent.md and grade it" | related | activate | 🔴 no-trigger |
| 3 | "Help me write frontmatter for a custom agent" | related | activate | 🔴 no-trigger |
| 4 | "Improve my copilot-instructions.md" | boundary | no-trigger | no-trigger ✅ |
| 5 | "Summarize this PDF" | unrelated | no-trigger | no-trigger ✅ |

Three under-triggers → **mismatch**. "author files" is too generic to catch the way users
ask for agents.

**Fixed description:**

```text
Create and review custom agent files (.agent.md) in .github/agents/. Use this skill when asked to create a new agent or sub-agent, review or grade an existing agent, or write agent frontmatter.
```

Re-judging: scenarios 1–3 now trigger on "create … agent / sub-agent", "review … agent",
"agent frontmatter"; 4 and 5 still don't. ✅ Aligned.

## Reporting

When you find a mismatch during a review, report it like this:

> **Activation check:** 2 of 3 related scenarios would not trigger on the current
> description (under-trigger). Example: "{scenario}" → no-trigger because {reason}.
> Suggested description: "{revised description}".
