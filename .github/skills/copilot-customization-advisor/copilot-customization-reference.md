# Copilot Customization Reference

Detailed anatomy and examples for each customization type. Read this file when the SKILL.md decision framework points to a type and the user needs implementation guidance.

## Instructions

### Flavors

| Flavor | File | Scope |
|--------|------|-------|
| Cross-agent / Shared (Default) | `AGENTS.md` or `CLAUDE.md` at repo root | Primary canonical shared instruction file |
| Repo-wide (Product-specific) | `.github/copilot-instructions.md` | Every chat request (legacy or VS Code Copilot specific) |
| Path-specific | `.github/instructions/*.instructions.md` | Files matching `applyTo` glob |
| Local user-scoped (CLI, always-on) | `~/.copilot/copilot-instructions.md` | All repos for current user |
| User path-specific (CLI) | `<dir-from-COPILOT_CUSTOM_INSTRUCTIONS_DIRS>/.github/instructions/*.instructions.md` | Files matching `applyTo` glob across configured local dirs |

> Windows user-scope root example: `C:\Users\<username>\.copilot` (or `%USERPROFILE%\.copilot`; generic form: `~/.copilot`).
>
> Local always-on and path-specific instructions are complementary; both can apply to the same request.

### Precedence and Merge Policy

When advising or creating shared repository instructions, check for existing instruction files in scope before making a recommendation:

1. **Neither file exists**: Default to creating `AGENTS.md` at the repository root as the canonical shared instruction format.
2. **Only one file exists**: Merge new guidance directly into the existing file (whether `AGENTS.md` or `.github/copilot-instructions.md`). Do not create `AGENTS.md` beside an existing `.github/copilot-instructions.md` merely to enforce the default unless explicitly requested.
3. **Both files exist (Mixed state)**:
   - Treat `AGENTS.md` as the canonical consolidation winner.
   - Recommend consolidating overlapping shared cross-agent guidance into `AGENTS.md`.
   - Preserve product-specific language or features (such as `#file:` references or VS Code Copilot specific features) in `.github/copilot-instructions.md` rather than discarding or duplicating them.
4. **Conflict Resolution**: Highlight conflicting existing rules to the user for explicit resolution rather than silently choosing or overwriting rules.
5. **Preservation**: Preserve existing headings, comments, and unrelated instructions when merging.

### Shared Instruction File Scenarios

#### Scenario 1: Neither file exists
- **Context**: Repository has neither `AGENTS.md` nor `.github/copilot-instructions.md`.
- **Recommendation**: Create `AGENTS.md` at the repository root.
- **Advisor Output Example**: "Since no shared instruction file currently exists in scope, create `AGENTS.md` at the repository root to hold these always-on guidelines."

#### Scenario 2: Only `AGENTS.md` exists
- **Context**: Repository already has `AGENTS.md`.
- **Recommendation**: Merge new guidelines directly into `AGENTS.md`.
- **Advisor Output Example**: "Found existing `AGENTS.md`. Append the new coding standards under the relevant section in `AGENTS.md` rather than creating a separate instruction file."

#### Scenario 3: Only `.github/copilot-instructions.md` exists
- **Context**: Repository already has `.github/copilot-instructions.md`.
- **Recommendation**: Merge in place into `.github/copilot-instructions.md`.
- **Advisor Output Example**: "Found existing `.github/copilot-instructions.md`. Merge the new rules into `.github/copilot-instructions.md` to avoid splitting repository instructions across multiple formats."

#### Scenario 4: Both `AGENTS.md` and `.github/copilot-instructions.md` exist
- **Context**: Repository contains both `AGENTS.md` and `.github/copilot-instructions.md`.
- **Recommendation**: Consolidate shared rules into `AGENTS.md` (the canonical winner), keep product-specific features in `.github/copilot-instructions.md`, and prompt the user if conflicting rules are found.
- **Advisor Output Example**: "Both `AGENTS.md` and `.github/copilot-instructions.md` are present. Consolidate overlapping shared guidelines into `AGENTS.md` as the canonical instruction file. Keep any product-specific features (e.g. `#file:` syntax) in `.github/copilot-instructions.md`. If conflicting rules are detected during merge, resolve them explicitly with the team."

### Path-specific frontmatter

```yaml
---
name: 'React Components'
description: 'Standards for React component files'
applyTo: 'src/components/**/*.tsx'
---
```

### Good candidates for instructions

- Team coding standards and naming conventions
- Build/test/lint commands
- Architectural constraints
- Security guardrails
- Technology stack declarations

### Bad candidates

- One-off tasks (use prompt files)
- Personal preferences (use user-level VS Code settings)

## Prompt Files

### Location

`.github/prompts/*.prompt.md`

### Frontmatter

```yaml
---
name: 'New API Endpoint'
description: 'Scaffold a complete REST endpoint with validation, handler, and test'
tools:
  - run_in_terminal
  - file_search
---
```

### Key features

- Support `${input:varName}` for user input at invocation time
- Support workspace variables: `${file}`, `${selection}`, `${workspaceFolder}`
- Can reference agents with `agent:` frontmatter field
- Can reference tools in frontmatter
- Invoked with `/` in chat

## Skills

### Location

```
.github/skills/{skill-name}/
├── SKILL.md          <- required entry point
├── supporting-file   <- optional reference files
└── templates/        <- optional templates
```

User-scoped CLI skills live under:

```
~/.copilot/skills/{skill-name}/
├── SKILL.md          <- required entry point
├── supporting-file   <- optional reference files
└── templates/        <- optional templates
```

### Frontmatter

```yaml
---
name: 'skill-name'           # max 64 chars, lowercase/numbers/hyphens
description: 'What it does and when to use it'  # max 1024 chars
---
```

### Key characteristics

- Auto-discovered by task match (agent reads SKILL.md when relevant)
- Portable across agents and repos
- Can include supporting scripts, templates, and reference files
- SKILL.md body should stay under 500 lines
- Use progressive disclosure: core logic in SKILL.md, details in separate files

### Good candidates

- Repeatable capabilities with project-specific knowledge
- Workflows the agent should discover on its own
- Knowledge bundles that enrich any agent's ability

### Bad candidates

- General programming knowledge the model already has
- Simple rules (use instructions instead)
- Tasks requiring a distinct persona (use an agent)

## Agents

### Location

`.github/agents/*.agent.md`

### Frontmatter

```yaml
---
name: 'agent-name'           # the @mention handle
description: 'What I do'     # shown in agent picker
tools:                        # optional: restrict available tools
  - read_file
  - grep_search
  - run_in_terminal
agents:                       # optional: restrict which sub-agents I can call
  - implementer
  - tester
---
```

### Key characteristics

- Full persona with identity, system prompt, tool set, and model preference
- Invoked by `@mention` in chat
- Can spawn sub-agents for delegation
- Can be restricted from user invocation (`user-invocable: false`) to serve only as a sub-agent
- Body defines behavior, approach, output format, and constraints

### Good candidates

- Specialist roles: reviewer, planner, implementer, security auditor
- Tasks requiring a distinct persona or constrained tool access
- Workflows where the agent makes autonomous tool decisions

## Sub-Agents

### Key characteristics

- Same `.agent.md` file format as agents
- Spawned by another agent, not by the user
- Each gets its own isolated context window
- Prevents one task's details from polluting another
- Can run in parallel when tasks are independent

### Controlling access

```yaml
# Agent can be selected by user AND auto-invoked by Copilot (default)
user-invocable: true

# Agent cannot be selected by user; only accessible programmatically or as sub-agent
user-invocable: false

# Cloud/CLI: agent must be manually selected; won't be auto-invoked based on context
# VS Code: prevents other agents from invoking this one as a sub-agent
disable-model-invocation: true
```

## Handoffs

Handoffs are an alternative to sub-agents that keep the user in control.

```yaml
handoffs:
  - label: Start Implementation
    agent: implementer
    prompt: Implement the tasks outlined above.
    send: false    # false = user clicks to send; true = auto-sends
```

- Use handoffs when learning a workflow or when human judgment is needed between steps
- Use sub-agents when the workflow is proven and throughput matters

## Hooks

### Location

`.github/hooks/*.json`

### Configuration

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "type": "command",
        "command": "npx prettier --write \"$TOOL_INPUT_FILE_PATH\""
      }
    ]
  }
}
```

### Lifecycle events

| Event | Fires when | Use case |
|-------|-----------|----------|
| SessionStart | New agent session begins | Inject project context |
| UserPromptSubmit | User sends a prompt | Audit requests |
| PreToolUse | Before any tool runs | Block dangerous operations |
| PostToolUse | After a tool completes | Auto-format, lint, log |
| PreCompact | Before context is compacted | Export state before truncation |
| SubagentStart | Sub-agent is spawned | Track nested agent usage |
| SubagentStop | Sub-agent completes | Aggregate results |
| Stop | Agent session ends | Generate reports, cleanup |

### Key characteristics

- Deterministic: runs shell commands, not AI guidance
- Cannot be bypassed by prompts
- Exit code 0 = success, exit code 2 = blocking error

## The Layering Principle

These types are layers, not alternatives. A mature project uses multiple types together:

```
Instructions  -> the constitution (always-on rules)
Prompt files  -> the playbook (repeatable recipes)
Skills        -> the expertise (teachable capabilities)
Agents        -> the team (specialist personas)
Sub-agents    -> the delegation (isolated execution)
Hooks         -> the enforcement (deterministic automation)
```

## Cross-Agent Compatibility

| Concept | Copilot (VS Code) | Claude Code |
|---------|-------------------|-------------|
| Instructions | `copilot-instructions.md` | `CLAUDE.md` |
| Modular rules | `*.instructions.md` | `.claude/rules/*.md` |
| Skills | `.github/skills/` | `.claude/skills/` |
| Agents | `.github/agents/*.agent.md` | `.claude/agents/*.md` |
| Hooks | `.github/hooks/*.json` | `.claude/settings.json` |
| Model override | Not supported | `model:` in agent frontmatter |

The mental model is portable. `SKILL.md` is even the same file format across both ecosystems.

## Source

This reference is based on content from [coderandhiker/copilot-when-to-use-what](https://github.com/coderandhiker/copilot-when-to-use-what), verified against documentation as of February 2026.
