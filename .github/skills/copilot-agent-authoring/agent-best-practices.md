# Agent Best Practices

Deep-dive reference for creating effective custom agents. Read this file when SKILL.md points you here for detailed rationale, patterns, and examples.

> Distilled from: GitHub Blog analysis of 2,500+ repositories, VS Code custom agents documentation, and GitHub CLI agent documentation. The Copilot Academy Developer Guide informed best-practice patterns but is non-authoritative for schema definitions.

## Lessons from 2,500+ Repositories

Analysis of over 2,500 public `agents.md` files revealed a clear divide between agents that fail and agents that work. The successful agents share these traits:

### What Works

1. **Put commands early** — Executable commands in an early section: `npm test`, `dotnet build`, `pytest -v`. Include flags and options, not just tool names. The agent references these often.

2. **Code examples over explanations** — One real code snippet showing your style beats three paragraphs describing it. Show what good output looks like.

3. **Set clear boundaries** — Tell the AI what it should never touch (secrets, vendor directories, production configs, specific folders). "Never commit secrets" was the most common helpful constraint.

4. **Be specific about your stack** — Say "React 18 with TypeScript, Vite, and Tailwind CSS" not "React project." Include versions and key dependencies.

5. **Cover six core areas** — Hitting these puts you in the top tier:
   - **Commands**: Specific executables with flags
   - **Testing**: How to run and validate
   - **Project structure**: Key directories and their purpose
   - **Code style**: Naming conventions with examples
   - **Git workflow**: Commit message format, branch strategy
   - **Boundaries**: What to never touch

### What Fails

- "You are a helpful coding assistant" — too vague, no specialization
- Listing tool names without flags — `npm` is not a command, `npm test --coverage` is
- No boundaries — the agent will touch anything it thinks helps
- Duplicating general knowledge — explaining what TypeScript is wastes context
- Walls of text without structure — numbered steps are followed; prose is forgotten

## Tool Selection Strategy

Match tool access to the agent's role. This prevents accidental damage and makes the agent's capabilities explicit.

| Agent Archetype | Recommended Tools | Rationale |
|-----------------|------------------|-----------|
| **Planner / Read-only** | `skill`, `search`, `codebase`, `fetch`, `usages` | Prevents accidental code changes |
| **Implementation** | All tools (omit `tools`) | Needs full editing + running capability |
| **Testing** | `skill`, `search`, `codebase`, `editFiles`, `runTests`, `findTestFiles`, `testFailure`, `runCommands`, `problems` | Write tests, run them, diagnose failures |
| **Code Review** | `skill`, `search`, `codebase`, `changes`, `problems`, `usages` | Read-only analysis of changes |
| **Documentation** | `skill`, `search`, `codebase`, `editFiles`, `fetch`, `runCommands` | Read code, write docs, validate links |
| **Security Audit** | `skill`, `search`, `codebase`, `usages`, `problems` | Analyze without modifying |

### When to Omit `tools` Entirely

Omit the `tools` field (granting all tools) when the agent:
- Needs to iterate (build → test → fix → rebuild cycles)
- Must create AND validate its own work
- Operates autonomously on multi-step tasks

### When to Restrict Tools

Restrict tools when the agent:
- Should never modify code (planners, reviewers, auditors)
- Operates in a sensitive area (security, production configs)
- Is part of a handoff chain (each agent owns a specific phase)

> ⚠️ **When restricting tools, always include `skill`** so the agent can still discover and leverage skill files from `.github/skills/`. Without it, the agent loses access to skill-based knowledge and workflows that inform its behavior.

## Handoffs — Chaining Agents into Workflows

Handoffs create interactive buttons after an agent's response, allowing users to transition to the next agent.

### When to Use Handoffs

- Multi-step workflows where human review is needed between steps
- Learning a new workflow (keep the user in the loop)
- Planning → Implementation → Review chains

### Handoff Patterns

```yaml
# Plan → Implement → Review chain
# plan.agent.md
handoffs:
  - label: "Start Implementation"
    agent: implementer
    prompt: "Implement the plan outlined above."
    send: false

# implementer.agent.md
handoffs:
  - label: "Review Changes"
    agent: reviewer
    prompt: "Review the implementation above for quality and security."
    send: false
```

### Handoff vs. Sub-agent Decision

| Use Handoffs When... | Use Sub-agents When... |
|---------------------|----------------------|
| User should review between steps | Workflow is proven and reliable |
| Steps require human judgment | Throughput matters more than oversight |
| Learning a new workflow | Tasks are truly independent |
| Each step may need correction | One agent needs to orchestrate others |

## Sub-agents — Delegation with Context Isolation

Sub-agents get their own context window, preventing one task's details from polluting another.

### Configuration

```yaml
# orchestrator.agent.md
---
name: feature-builder
description: "Coordinates research and implementation"
tools: ['agent']
agents: ['researcher', 'implementer']
---
```

### Visibility Controls

```yaml
# Not user-selectable; only accessible programmatically or as sub-agent
user-invocable: false

# Cloud/CLI: prevents automatic invocation (must be manually selected)
# VS Code: prevents other agents from invoking this one as sub-agent
disable-model-invocation: true

# User-selectable and auto-invocable (default)
user-invocable: true
disable-model-invocation: false
```

## The Three-Tier Boundary Pattern

The most effective agents use a three-tier boundary system:

```markdown
## Boundaries
- ✅ **Always do:** Write to `tests/`, run tests before committing, follow naming conventions
- ⚠️ **Ask first:** Database schema changes, adding dependencies, modifying CI/CD config
- 🚫 **Never do:** Commit secrets or API keys, edit `node_modules/`, modify production configs
```

### Why Three Tiers Work

- **Always** — automatable, safe, expected behavior
- **Ask first** — higher risk but sometimes necessary; human stays in the loop
- **Never** — hard constraints that prevent catastrophic mistakes

### Common "Never" Items (from 2,500+ repos)

- Never commit secrets, API keys, or credentials
- Never modify vendor directories (`node_modules/`, `vendor/`)
- Never edit production configuration files
- Never remove failing tests (fix them or ask)
- Never modify files outside the agent's designated scope
- Never push directly to main/master branches

## Common Anti-Patterns and Fixes

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| "You are a helpful assistant" | No specialization, generic output | Define a specific role with domain expertise |
| Listing every possible task | Overwhelms context, dilutes focus | Pick ONE job per agent; use sub-agents for breadth |
| No commands section | Agent guesses how to build/test/run | Add specific commands with flags early in the body |
| Repeating general knowledge | Wastes context tokens | Apply the Value Gate — only include what the model doesn't know |
| Tools unrestricted for read-only agent | Risk of accidental edits | Restrict tools to match the agent's role |
| Boundaries as afterthought | Agent touches dangerous things | Put boundaries prominently with the three-tier pattern |
| Prose instructions | Skipped or partially followed | Convert to numbered steps or bullet points |
| No code examples | Agent invents its own style | Add 1–2 examples showing preferred patterns |

## Example Agents

### Documentation Agent

```yaml
---
name: docs-agent
description: "Expert technical writer. Reads source code and generates clear developer documentation."
tools: ['search', 'codebase', 'editFiles', 'fetch', 'runCommands']
---
```

```markdown
# Role and Identity
You are an expert technical writer for this project. You read TypeScript code
and produce clear, concise Markdown documentation for a developer audience.

## Workflow
1. Read relevant source files to understand the API/feature
2. Check existing docs in `docs/` for style and structure
3. Write or update documentation following existing conventions
4. Run `npm run docs:build` to validate (checks broken links)
5. Run `npx markdownlint docs/` to lint your output

## Standards
- Write for new developers — don't assume deep familiarity
- Use code examples liberally
- Keep paragraphs short (3–4 sentences max)
- Link to related docs rather than duplicating content

## Boundaries
- ✅ **Always:** Write to `docs/`, follow existing doc style, validate with markdownlint
- ⚠️ **Ask first:** Before deleting or restructuring existing docs
- 🚫 **Never:** Modify source code in `src/`, edit config files, commit secrets
```

### Testing Agent

```yaml
---
name: test-agent
description: "QA engineer writing comprehensive tests. Analyzes code for coverage gaps and generates tests targeting 80%+ coverage."
tools: ['search', 'codebase', 'editFiles', 'runTests', 'findTestFiles', 'testFailure', 'runCommands', 'problems']
---
```

```markdown
# Role and Identity
You are a senior QA engineer focused on test coverage. You analyze source
code for untested paths and generate comprehensive unit and integration tests.

## Workflow
1. Scan source code to identify untested classes and methods
2. Read existing tests to learn the project's test patterns
3. Generate tests following existing conventions (AAA pattern, descriptive names)
4. Run `npm test` to validate all tests pass
5. Report coverage summary and any remaining gaps

## Standards
- Test naming: `{MethodName}_{Scenario}_{ExpectedResult}`
- Every test uses Arrange-Act-Assert pattern
- One logical assertion per test
- Use test data builders for complex setup

## Boundaries
- ✅ **Always:** Write to `tests/`, run tests after writing, follow AAA pattern
- ⚠️ **Ask first:** Before modifying existing test helpers or fixtures
- 🚫 **Never:** Modify source code, remove failing tests, skip validation
```

### Planner Agent (Read-Only)

```yaml
---
name: planner
description: "Solution architect generating detailed implementation plans. Researches codebase without making changes."
tools: ['search', 'codebase', 'fetch', 'usages']
model: 'gpt-4o'
handoffs:
  - label: "Start Implementation"
    agent: agent
    prompt: "Implement the plan outlined above."
    send: false
---
```

```markdown
# Role and Identity
You are a solution architect. You research the codebase thoroughly and produce
detailed, actionable implementation plans. You never write code directly.

## Workflow
1. Understand the requirement fully — ask clarifying questions if needed
2. Search the codebase for relevant patterns and existing implementations
3. Identify affected files and potential impacts
4. Write a structured plan with clear steps, file paths, and code snippets
5. Flag risks, dependencies, and decisions that need human input

## Output Format
Plans must include:
- Overview (1–2 sentences)
- Requirements (bullet list)
- Implementation steps (numbered, with file paths)
- Testing strategy
- Risks and open questions

## Boundaries
- ✅ **Always:** Research thoroughly before planning, cite specific file paths
- ⚠️ **Ask first:** If requirements are ambiguous or multiple approaches exist
- 🚫 **Never:** Edit files, run commands that modify state, make assumptions about undocumented behavior
```

### Orchestrator Agent (Sub-agents)

```yaml
---
name: feature-builder
description: "Coordinates feature development by delegating research and implementation to specialized agents."
tools: ['agent']
agents: ['researcher', 'implementer', 'test-agent']
---
```

```markdown
# Role and Identity
You are a feature development coordinator. You break tasks into research,
implementation, and testing phases, delegating each to the right specialist.

## Workflow
1. Analyze the feature request to identify what research is needed
2. Delegate research to the researcher agent (gather context, find patterns)
3. Review research findings and create an implementation brief
4. Delegate implementation to the implementer agent
5. Delegate test writing to the test-agent
6. Review all results and report completion

## Boundaries
- ✅ **Always:** Delegate to specialists, review their output, report progress
- ⚠️ **Ask first:** If the feature scope is unclear or spans multiple services
- 🚫 **Never:** Implement directly (always delegate), skip the testing phase
```

## CLI-Specific Considerations

When creating agents for the GitHub Copilot CLI:

### Trigger Words for Inference

The CLI can invoke agents by inference based on the description. Include trigger keywords:

```yaml
description: "Security expert. Use when asked to check, audit, review, or scan code for vulnerabilities, secrets, or security issues. Trigger: seccheck"
```

### Programmatic Invocation

Agents can be called via `--agent` flag. Use a CLI-friendly name (lowercase, hyphens):

```bash
copilot --agent security-auditor --prompt "Check /src/app/validator.go"
```

### User-Level Agents for CLI

Place personal agents in `~/.copilot/agents/` for cross-project availability. User-level agents take priority over repo-level agents with the same name.

## Progressive Complexity

Start simple and iterate. The best agent files grow through experience, not upfront planning:

1. **Start minimal** — name, description, identity, one workflow, boundaries
2. **Add after mistakes** — when the agent does something wrong, add a rule
3. **Add examples after confusion** — when output style is wrong, show a code sample
4. **Add tools restrictions after accidents** — when the agent touches something it shouldn't, restrict tools
5. **Add handoffs after workflow discovery** — when you find yourself always doing X after Y, add a handoff

## Source References

- [How to write a great agents.md: Lessons from over 2,500 repositories](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/) — GitHub Blog
- [Custom agents for VS Code](https://code.visualstudio.com/docs/copilot/customization/custom-agents) — VS Code Documentation
- [Create custom agents for CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli) — GitHub Docs
- [Custom Agent Developer Guide](https://copilot-academy.github.io/workshops/copilot-customization/custom_agent_developer_guide) — Copilot Academy
