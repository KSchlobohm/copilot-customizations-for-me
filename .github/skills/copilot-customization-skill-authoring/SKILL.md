---
name: copilot-customization-skill-authoring
description: Creates and reviews skill files in .github/skills/. Use this skill when asked to create a new skill, review an existing skill, or improve skill quality. Applies best practices from agent-skills-best-practices.md to ensure skills are concise, discoverable, and effective.
---

# Skill Authoring

Create, review, and improve skill files following established best practices.

## Reference

Best practices guide: `.github/skills/copilot-customization-skill-authoring/agent-skills-best-practices.md`

Sources of truth (for handling pushback): `.github/skills/copilot-customization-skill-authoring/sources-of-truth.md`

Activation-alignment evaluation: `.github/skills/copilot-customization-skill-authoring/activation-alignment-evaluation.md`

> This is an external reference adapted from Anthropic's Claude skill-authoring docs. It uses Claude-specific terminology but the principles apply to Copilot skills. Where it says "Claude", read "the agent".

Read this file before creating or reviewing any skill. Key principles:

- **Concise is key** — only add context the agent doesn't already have
- **SKILL.md body under 500 lines** — use progressive disclosure for longer content
- **Description drives discovery** — write in third person, include what it does AND when to use it

## Value Gate

Before adding content to a skill, ask:

> "Would a capable model (e.g., GPT-3.5-Turbo) already know this without being told?"

If yes, leave it out. Skills should focus on **project-specific** knowledge — not general programming concepts. This keeps skills concise and avoids wasting context window tokens on things the agent already knows.

- ✅ "Run `python3 scripts/check_prerequisites.py` before starting the pipeline" — project-specific workflow
- ✅ "Use `uv` instead of `pip` for dependency management" — team decision
- ✅ "Source images go in `source/calendar-joke-images/`" — repo-specific path
- ❌ "Python virtual environments isolate dependencies" — general knowledge
- ❌ "Use `git add` to stage files" — any model knows this
- ❌ "JSON is a data format" — obvious

## Creating a Skill

1. Create directory: `.github/skills/{skill-name}/`
2. Create `SKILL.md` with YAML frontmatter (`name`, `description`)
3. Add body content: purpose, when to use, steps, examples
4. Run the activation-alignment evaluation (see below) to confirm the description triggers on the tasks the body handles
5. Run the review checklist below
6. Iterate until the skill passes review

### Frontmatter Rules

```yaml
---
name: my-skill-name      # max 64 chars, lowercase/numbers/hyphens only
description: Does X when Y happens. Use when the user asks about Z.  # max 1024 chars, third person
---
```

### Naming Conventions

- Prefer gerund form: `processing-pdfs`, `managing-todos`
- Acceptable alternatives: `pdf-processing`, `process-pdfs`
- Avoid: `helper`, `utils`, `tools`, `data` (too vague)

### Body Structure

A good SKILL.md body follows this pattern:

```markdown
# {Title}

{One-line summary of what this skill does.}

## When to Use (optional)
{Specific triggers — only include if the description doesn't fully convey when to activate.}

## {Core Instructions}
{Steps, rules, examples — the actionable content.}
```

A **When to Use** section is helpful when activation context is nuanced or multi-faceted. If the YAML `description` already has clear trigger terms, this section is redundant — don't repeat yourself.

## Activation Alignment

The `description` is the only thing the agent sees when deciding whether to trigger a
skill. A skill can be excellent inside and still never run because its description doesn't
match how users phrase the tasks it was built for. Always check that the description's
activation range matches the body's true purpose.

Run this quick evaluation whenever you create or review a skill:

1. **Derive purpose from the body only** — ignore the description. What tasks is the skill
   actually built to handle?
2. **Generate 5 probe scenarios** in real users' words: **3 clearly related** (should
   activate), **1 narrow/boundary** (judgment call), **1 unrelated** (should not activate).
3. **Blind-judge each scenario using the `description` only** — would it trigger?
4. **Compare.** A related scenario that wouldn't trigger = **under-trigger** (weak
   description). The unrelated scenario that would trigger = **over-trigger** (leaky
   description). Either is an activation mismatch.
5. **Fix the description and re-run** until related scenarios trigger and the unrelated one
   doesn't.

This is an activation test, not a capability test — it complements (does not replace) the
"Build evaluations first" guidance in `agent-skills-best-practices.md`. Full method,
interpretation table, and a worked example: [activation-alignment-evaluation.md](activation-alignment-evaluation.md).

## When Challenged

If a user questions a best practice recommendation or frontmatter rule:

1. **Explain the rationale** — don't just re-assert the rule.
2. **Cite the relevant source** from [sources-of-truth.md](sources-of-truth.md) — AI-trained knowledge can go stale, so point to live docs the user can verify themselves.
3. **Name the tradeoff** — there's usually a valid reason someone might choose differently.
4. **Ask which direction they prefer** — do not override a stated preference.

> **Note:** Not all constraints come from the same authority. Some are GitHub-documented requirements; others come from the Agent Skills spec or are adopted conventions in this repo. [sources-of-truth.md](sources-of-truth.md) labels each source so you can cite accurately.

## Reviewing a Skill

When creating or reviewing a skill, evaluate it against the checklist below. Reference `agent-skills-best-practices.md` for detailed rationale.

### Review Checklist

#### Discovery
- [ ] Description is specific and includes key trigger terms
- [ ] Description states both what the skill does AND when to use it
- [ ] Description is written in third person
- [ ] Name uses lowercase/hyphens, max 64 characters
- [ ] Activation alignment: description triggers on every content-derived related scenario (no under-trigger)
- [ ] Activation alignment: description does not trigger on the unrelated scenario (no over-trigger)

#### Content Quality
- [ ] SKILL.md body is under 500 lines
- [ ] Only includes context the agent doesn't already have
- [ ] Examples are concrete, not abstract
- [ ] Consistent terminology throughout
- [ ] No time-sensitive information

#### Structure
- [ ] Progressive disclosure used — details in separate files if needed
- [ ] File references are one level deep (no chains of references)
- [ ] Workflows have clear, numbered steps
- [ ] Repo-relative paths and links use forward slashes; OS-specific absolute paths are allowed when required
- [ ] Long-running processes (servers, watchers) use background terminal pattern — see [long-running-processes.md](long-running-processes.md)

#### Actionability
- [ ] Steps are specific enough to follow without guessing
- [ ] Error handling and edge cases are addressed
- [ ] Degrees of freedom are appropriate — prescriptive for fragile/critical steps, flexible where the agent can reasonably decide
- [ ] When challenged on a rule, agent cites [sources-of-truth.md](sources-of-truth.md) rather than asserting without evidence

### Review Process

After creating or modifying a skill:

1. Read the skill file end-to-end
2. Run the activation-alignment evaluation (see [activation-alignment-evaluation.md](activation-alignment-evaluation.md)) by deriving the purpose from the body, probing with related, boundary, and unrelated scenarios, and flagging any under-trigger or over-trigger
3. Walk through the review checklist above (and flag any unchecked items)
4. Generate the report following the **Skill Review Report Format** below to explicitly document the activation evaluation and checklist results
5. For each flag or activation mismatch, suggest a specific improvement (not just "fix this")
6. Apply fixes and re-check until all items pass
7. If the skill references scripts or tools, verify they exist and work

### Skill Review Report Format

Use this markdown pattern to present the findings of a skill review:

```markdown
## Skill Review: {skill-name}

{One-line summary status (e.g., Passed, Mismatch, or Blocked by Under-trigger)}

### Activation-Alignment Evaluation
- **Derived Purpose:** {1-2 sentences of body-derived purpose}

| # | Probe Scenario (User Words) | Expected | Verdict (Description Only) | Diagnosis |
|---|---|---|---|---|
| 1 | {Clearly related 1} | Activate | {Trigger / No-trigger} | {Aligned / Under-trigger} |
| 2 | {Clearly related 2} | Activate | {Trigger / No-trigger} | {Aligned / Under-trigger} |
| 3 | {Clearly related 3} | Activate | {Trigger / No-trigger} | {Aligned / Under-trigger} |
| 4 | {Boundary} | Judgment | {Trigger / No-trigger} | {Aligned / Boundary Confirm} |
| 5 | {Unrelated} | Should NOT | {Trigger / No-trigger} | {Aligned / Over-trigger} |

### Checklist Summary
- Discovery: {pass/fail count}
- Content Quality: {pass/fail count}
- Structure: {pass/fail count}
- Actionability: {pass/fail count}

### Specific Improvements Needed
1. {un-checked checklist item or activation mismatch} -> {concrete fix}
```

### Nudges

When a skill doesn't meet standards, suggest improvements conversationally:

- "The description says 'helps with X' — can we make it more specific about when to activate?"
- "I tried a few realistic requests for what this skill does, and the description wouldn't trigger on most of them — that's an under-trigger. Can we add the terms users actually say?"
- "This SKILL.md is getting long — want to move the reference tables into a separate file?"
- "The steps assume the agent knows about Y — should we add a quick note?"
- "This name is pretty generic — would `managing-deployments` be clearer than `deploy`?"

## Reviewing Existing Skills

To review all skills in the repo:

1. List directories in `.github/skills/`
2. For each skill, read `SKILL.md` and run the review checklist
3. Execute the activation-alignment evaluation (deriving its body-purpose and testing 5 scenarios)
4. Report findings grouped by skill, using the **Skill Review Report Format** described above to present the evaluation and checklist status
