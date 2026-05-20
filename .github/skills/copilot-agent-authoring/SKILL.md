---
name: copilot-agent-authoring
description: Create and review custom agent files (.agent.md) in .github/agents/. Use this skill when asked to create a new agent, review an existing agent, grade agent quality, or get guidance on agent frontmatter fields. Applies best practices from 2,500+ analyzed repositories.
---

# Agent Authoring

Create, review, and grade custom agent files following established best practices.

## Reference

Best practices guide: `.github/skills/copilot-agent-authoring/agent-best-practices.md`

> This reference distills guidance from the VS Code docs, GitHub CLI docs, GitHub Blog analysis of 2,500+ repos, and the Copilot Academy developer guide. Read it before creating or reviewing any agent.

Key principles:

- **Specific beats generic** — "You are a helpful assistant" fails; "You are a .NET testing specialist targeting 80%+ coverage" works
- **Commands early** — put executable commands (`npm test`, `dotnet build`) near the top
- **Boundaries are mandatory** — define what the agent must never touch
- **Six core areas** — commands, testing, project structure, code style, git workflow, boundaries

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
3. Write YAML frontmatter (see Frontmatter Reference below)
4. Write body content: identity, workflow, standards, boundaries
5. Run the review checklist below
6. Iterate until the agent passes review

## Frontmatter Reference

All `.agent.md` files begin with YAML frontmatter between `---` fences.

### Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `description` | string | 50–150 chars recommended | Shown as placeholder text in chat. Must clearly state what the agent does. |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | filename without `.agent.md` | Display name in the agents dropdown. Use lowercase with hyphens for programmatic use. |
| `argument-hint` | string | — | Hint text guiding users on what input to provide (e.g., "Describe what you want to test"). |
| `tools` | string[] | all tools | Restrict available tools. **Omit to allow all.** See tool selection strategy in best practices. |
| `model` | string \| string[] | user's selected model | AI model override. Use `"Model Name (vendor)"` format. Array = fallback priority list. |
| `agents` | string[] | — | Sub-agents this agent can invoke. Use `['*']` for all, `[]` for none. |
| `target` | string | both | `"vscode"` or `"github-copilot"`. Omit for cross-platform availability. |
| `user-invokable` | boolean | `true` | Set `false` to hide from dropdown (sub-agent only). |
| `disable-model-invocation` | boolean | `false` | Set `true` to prevent other agents from invoking this one as a sub-agent. |
| `mcp-servers` | object[] | — | MCP server configurations for GitHub Copilot coding agent. |
| `handoffs` | object[] | — | Suggested next-step buttons for agent chaining. |
| `hooks` | object | — | Hook commands scoped to this agent (Preview feature). |

### Handoffs Schema

```yaml
handoffs:
  - label: "Button Text"        # Required: display text
    agent: target-agent          # Required: agent to switch to
    prompt: "Instructions..."    # Optional: pre-filled prompt
    send: false                  # Optional: false=user clicks send, true=auto-submit
    model: "GPT-5.2 (copilot)"  # Optional: model override for this step
```

### Tools — Common Built-in Names

| Tool | Capability |
|------|-----------|
| `search` | Search workspace files by text |
| `codebase` | Semantic code search |
| `editFiles` | Create and edit files |
| `runCommands` | Execute terminal commands |
| `runTests` | Run test suite |
| `findTestFiles` | Locate test files |
| `testFailure` | Get test failure details |
| `problems` | Get compile/lint errors |
| `changes` | View git changes |
| `usages` | Find symbol usages |
| `fetch` | Fetch web content |
| `githubRepo` | Search GitHub repos |

### Frontmatter Validation Rules

- `description` is the only practically required field (agents without it have no discoverability)
- `name` should use lowercase letters and hyphens for CLI compatibility
- `tools` as an empty array `[]` means the agent has NO tool access (read-only conversation)
- `model` format must match exactly: `"Claude Sonnet 4 (copilot)"`, not just `"claude-sonnet-4"`
- `agents` requires the `agent` tool to be in the `tools` list (or tools omitted entirely)
- Frontmatter must be valid YAML — watch for unquoted strings containing colons

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
4. Report findings grouped by agent with the grade report format
5. Prioritize improvements by impact (F→D agents first, then D→C, etc.)

## Platform Differences

| Feature | VS Code | CLI | GitHub Copilot (Cloud) |
|---------|---------|-----|----------------------|
| File location | `.github/agents/` | `.github/agents/` or `~/.copilot/agents/` | `.github/agents/` |
| Invocation | Agents dropdown / `@mention` | `/agent`, `--agent`, or by inference | Automatic |
| `target` field | `"vscode"` | Not applicable | `"github-copilot"` |
| `mcp-servers` | Not used | Not used | Supported |
| `handoffs` | Supported | Not applicable | Not applicable |
| `hooks` | Supported (Preview) | Not applicable | Not applicable |
| Tool names | VS Code tool IDs | CLI tool IDs | GitHub tool IDs |
