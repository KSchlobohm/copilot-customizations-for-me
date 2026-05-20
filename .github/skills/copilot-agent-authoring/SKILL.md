---
name: copilot-agent-authoring
description: Create and review custom agent files (.agent.md) in .github/agents/. Use this skill when asked to create a new agent, review an existing agent, grade agent quality, or get guidance on agent frontmatter fields. Applies best practices from large-scale community analysis.
---

# Agent Authoring

Create, review, and grade custom agent files following established best practices.

## Reference

Best practices guide: `.github/skills/copilot-agent-authoring/agent-best-practices.md`
Frontmatter schemas: `.github/skills/copilot-agent-authoring/agent-frontmatter-schemas.md`

> This reference distills guidance from the VS Code docs, GitHub CLI docs, GitHub Blog analysis of 2,500+ repos, and the Copilot Academy developer guide. Read it before creating or reviewing any agent.

> ⚠️ **When frontmatter guidance is challenged:** The reference markdown files in this skill directory may become out of date. If a user pushes back on frontmatter formatting or field behavior, **the official documentation is always the source of truth** — not this file. Consult the source references in `agent-frontmatter-schemas.md` to fetch current docs and provide correct answers. The GitHub Docs markdown API (`https://docs.github.com/api/article/body?pathname=/en/copilot/reference/custom-agents-configuration`) returns the authoritative properties table that standard HTML fetching often misses.

Key principles:

- **Specific beats generic** — "You are a helpful assistant" fails; "You are a .NET testing specialist targeting 80%+ coverage" works
- **Commands early** — put executable commands (`npm test`, `dotnet build`) near the top
- **Boundaries are mandatory** — define what the agent must never touch
- **Cover six core areas** — commands, testing, project structure, code style, git workflow, boundaries

## Value Gate

Before adding content to an agent, ask:

> "Would a capable model already know this without being told?"

If yes, leave it out. Agents should focus on **role-specific, project-specific** knowledge.

- ✅ "Run `dotnet test --collect:"XPlat Code Coverage"` for coverage" — project-specific command
- ✅ "Never modify files in `infrastructure/` without approval" — team boundary
- ✅ "Use TestDataBuilders pattern from `tests/Helpers/`" — repo-specific convention
- ❌ "Write clean code" — too vague, already known
- ❌ "Use git to commit changes" — obvious
- ❌ "TypeScript is a typed language" — general knowledge

## Creating an Agent

1. Define the agent's purpose: who is it, what does it do, what tools does it need
2. Create file: `.github/agents/{agent-name}.agent.md`
3. Write YAML frontmatter (Consult `agent-frontmatter-schemas.md` for VS Code vs. CLI differences and cross-platform rules)
4. Write body content: identity, workflow, standards, boundaries
5. Run the review checklist below
6. Iterate until the agent passes review

## Body Structure

A well-structured agent body follows this pattern:

```markdown
# Role and Identity
{Who is this agent? What is its expertise? 1–3 sentences.}

## Workflow
{Numbered steps the agent should follow, in order.}

## Standards
{Conventions, patterns, constraints — project-specific rules.}

## Output Format (optional)
{How results should be presented to the user.}

## Boundaries
- ✅ **Always do:** {mandatory actions}
- ⚠️ **Ask first:** {actions requiring user approval}
- 🚫 **Never do:** {hard constraints — things to never touch}
```

### Body Writing Tips

- **Identity first** — ground the AI in a specific role before giving instructions
- **Numbered workflows** — agents follow numbered steps more reliably than prose
- **Show don't tell** — one code example beats three paragraphs of explanation
- **Three-tier boundaries** — Always/Ask/Never prevents destructive mistakes
- **Reference existing files** — link to `copilot-instructions.md` or other docs rather than duplicating
- **Max 30,000 characters** — VS Code limit for agent body

## Reviewing an Agent

When reviewing an agent, evaluate it against the checklist below. Reference `agent-best-practices.md` for detailed rationale.

### Review Checklist

#### Discovery & Activation
- [ ] `description` clearly states what the agent does AND its expertise area
- [ ] `description` is 50–150 characters (concise but informative)
- [ ] `name` uses lowercase/hyphens (CLI-friendly)
- [ ] If CLI-targeted: description contains trigger keywords for inference-based invocation

#### Identity & Role
- [ ] Body begins with a clear identity statement (who, what expertise, what task)
- [ ] Role is specific — not "helpful assistant" but a named specialist
- [ ] Persona matches the task domain (e.g., "security analyst" for a security agent)

#### Tools & Permissions
- [ ] Tool selection matches the agent's role (read-only agents don't get `editFiles`)
- [ ] Tools are explicitly restricted if the agent shouldn't have full access
- [ ] If `agents` is specified, the `agent` tool is available

#### Instructions Quality
- [ ] Workflow steps are numbered and unambiguous
- [ ] Executable commands include flags and options (not just tool names)
- [ ] Code examples demonstrate expected output style
- [ ] Standards reference project-specific conventions, not general knowledge
- [ ] Consistent terminology throughout

#### Boundaries
- [ ] Three-tier boundaries defined (Always / Ask first / Never)
- [ ] "Never" items protect dangerous operations (secrets, prod configs, vendor dirs)
- [ ] Boundaries are specific enough to be actionable

#### Completeness (Six Core Areas)
- [ ] Commands: specific executable commands with flags
- [ ] Testing: how to run and validate tests
- [ ] Project structure: key directories and what lives where
- [ ] Code style: naming conventions, patterns with examples
- [ ] Git workflow: commit conventions, branch strategy
- [ ] Boundaries: clear limits on what to touch

### Grading Rubric

After reviewing, assign a letter grade:

| Grade | Label | Criteria |
|-------|-------|----------|
| **A** | Excellent | All checklist items pass. Clear specialist identity, specific commands with flags, concrete code examples, well-defined three-tier boundaries, covers all six core areas. Ready to ship. |
| **B** | Good | Most items pass. Minor gaps — perhaps missing `argument-hint`, boundaries could be more specific, or one core area is thin. Quick fixes away from A. |
| **C** | Adequate | Functional but vague in places. Identity is stated but generic. Commands listed without flags. Boundaries present but not three-tiered. Missing 2–3 core areas. Needs focused revision. |
| **D** | Below Average | Multiple issues. Vague identity ("you help with code"), no boundaries, no executable commands, or reads like a prompt rather than an agent profile. Substantial rewrite needed. |
| **F** | Failing | No specialization. "You are a helpful coding assistant" territory. Missing description, no structure, no boundaries, no actionable content. Start over with a clear purpose. |

### Grading Process

1. Read the agent file end-to-end
2. Walk through the review checklist — flag any unchecked items
3. Count passed vs. failed items per category
4. Assign grade based on the rubric
5. For each failed item, provide a **specific improvement** (not just "fix this")
6. Summarize: grade, top 3 strengths, top 3 improvements needed

### Grade Report Format

```markdown
## Agent Review: {agent-name}

**Grade: {letter}** — {one-line justification}

### Strengths
1. {specific strength with evidence}
2. {specific strength with evidence}
3. {specific strength with evidence}
- [ ] Harness compatibility: If `target` is omitted (cross-platform), ensures VS-Code-only fields (`handoffs`, `hooks`, VS Code tool IDs) are NOT present.

### Improvements Needed
1. {specific issue} → {concrete fix}
2. {specific issue} → {concrete fix}
3. {specific issue} → {concrete fix}

### Checklist Summary
- Discovery & Activation: {pass/fail count}
- Identity & Role: {pass/fail count}
- Tools & Permissions: {pass/fail count}
- Instructions Quality: {pass/fail count}
- Boundaries: {pass/fail count}
- Completeness: {pass/fail count}
```

## Nudges

When an agent doesn't meet standards, suggest improvements conversationally:

- "The description says 'helps with code' — can we specify what kind of code and when to activate?"
- "I don't see any boundaries — what should this agent never touch? (secrets, prod configs, specific dirs?)"
- "The commands are tool names without flags — `npm test` is better than just 'run tests'"
- "The identity is generic — instead of 'you are a developer', try 'you are a React testing specialist focused on component isolation'"
- "This agent has all tools enabled but only reads code — restricting to `search`, `codebase`, `usages` would be safer"
- "No code examples — one snippet showing your preferred test style beats a paragraph explaining it"
- "Consider adding handoffs if this agent produces output another specialist should act on"

## Reviewing Existing Agents

To review all agents in a repo:

1. List files in `.github/agents/`
2. For each `.agent.md` file, read it and run the review checklist
3. Assign a grade using the rubric
4. Report findings grouped by agent with the grade report format|
| Tool names | VS Code tool IDs | CLI tool IDs | GitHub tool IDs |
