# Agent Frontmatter Schemas

This reference details the YAML frontmatter schema for `.agent.md` files, with a specific focus on the differences between VS Code, Copilot CLI, and GitHub Copilot Cloud endpoints. Use this to ensure agents are authored correctly for their intended environment.

> **Sourcing note for AI tools:** The properties table on the GitHub docs page is rendered inside a `<div class="ghd-tool rowheaders">` element. Standard markdown-based web fetchers often fail to parse this table from the HTML. To get authoritative data, use the markdown API endpoint:
> `https://docs.github.com/api/article/body?pathname=/en/copilot/reference/custom-agents-configuration`
> This returns the raw markdown including the full properties table that HTML scrapers frequently miss.

## Cross-Platform Compatibility

Whenever possible, design agents to be cross-platform compatible. If an agent uses platform-specific features (like VS Code `handoffs` or `hooks`), it SHOULD set the `target` field to signal intent. Unsupported fields are ignored on other platforms (not rejected), but omitting `target` makes it unclear whether the agent was designed for cross-platform use.

| Feature | VS Code | Copilot CLI | GitHub Copilot (Cloud) |
|---------|---------|-------------|------------------------|
| **File location** | `.github/agents/` | `.github/agents/` or `~/.copilot/agents/` | `.github/agents/` |
| **Invocation** | Agents dropdown / `@mention` | `/agent`, `--agent`, or by inference | Automatic or manual selection |
| **Target Field** | `target: "vscode"` | Ignored / Not natively matching target string | `target: "github-copilot"` |
| **Tools Format** | VS Code tool IDs | CLI tool IDs / host defaults | GitHub tool IDs |
| **Handoffs** | Fully Supported | Not supported | Not supported |
| **Hooks** | Supported (Preview) | Not supported | Not supported |
| **MCP Servers** | Recognized but not acted upon (cloud agent only) | Not used | Supported |

## Harness-Specific Guidelines

### Cross-Platform Target (Default & Recommended)
To make an agent work natively in **both** VS Code and Copilot CLI:
1. **Omit the `tools` property** or use `tools: ["*"]` — both enable all available tools on any platform.
2. If restricting tools, use **cross-platform aliases** (`read`, `edit`, `search`, `execute`, `agent`, `web`, `todo`) instead of platform-specific names like `editFiles` or `runCommands`. Unrecognized tool names are silently ignored, not rejected. *(Source: [GitHub Docs][gh-config] — tool aliases table)*
3. **When explicitly listing tools, strongly include `skill`** so the agent can discover and use skill files (`.github/skills/`). Without it, agents with restricted tool lists lose access to skill-based knowledge and workflows.
4. Omit `handoffs`, `hooks`, and `mcp-servers`.

### VS Code Target (`target: "vscode"`)
- **Tools**: VS Code relies on specific extension tool IDs (e.g., `search`, `codebase`, `editFiles`, `runCommands`). If you define the `tools` array, you MUST use valid VS Code tool names.
- **MCP Tools**: You can reference tools from MCP servers and VS Code extensions using namespaced syntax:
  - `some-mcp-server/*` — enable all tools from a specific MCP server
  - `some-mcp-server/some-tool` — enable a single tool from a server
  - `azure.some-extension/some-tool` — reference a tool from a VS Code extension
- **Handoffs**: You can use the `handoffs` array to chain agents.
- **Hooks**: You can bind workspace lifecycle events specifically to this agent.

### Cloud Agent Target (`target: "github-copilot"`)
- **MCP Tools**: Cloud agent supports MCP servers configured in the agent profile or repository settings:
  - `some-mcp-server/*` — enable all tools from a configured MCP server
  - `some-mcp-server/some-tool` — enable a specific tool from a server
  - Out-of-the-box servers: `github/*`, `playwright/*` (see [GitHub Docs][gh-config])
- **Tool Access**: Uses the alias system (`execute`, `read`, `edit`, `search`, `agent`, `web`). Each alias maps to compatible names (e.g., `execute` accepts `shell`, `Bash`, `powershell`). *(Source: [GitHub Docs][gh-config] — tool aliases table)*

### Copilot CLI Target
- **Tool Access**: The CLI often relies on inference and system-level execution. Unrecognized tool names (like VS Code-specific `editFiles`) are silently ignored, which may leave the agent without the intended capabilities.
- **Invocation**: The CLI relies heavily on the `description` field to infer when to automatically trigger the agent if not explicitly invoked via `--agent`.

## Schema Definition

All `.agent.md` files begin with YAML frontmatter between `---` fences. The Markdown body below the frontmatter defines the agent's behavior and can be a maximum of **30,000 characters**.

### Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `description` | string | **Required**; keep brief (~50–150 chars recommended) | Shown as placeholder text in chat. Must clearly state what the agent does. CLI heavily relies on this for inference-based invocation. |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | filename | Display name. Use lowercase with hyphens for CLI programmatic compatibility. |
| `argument-hint` | string | — | Hint text guiding users on what input to provide. *(VS Code/IDE only; ignored by cloud agent)* |
| `tools` | list of strings, string | all tools | Restrict available tools. Supports both a comma-separated string and YAML string array. Use `tools: []` to disable all tools. **Omit to allow host defaults (required for cross-platform agents).** See [Tool Aliases](#tool-aliases). |
| `model` | string \| string[] | user's chosen | AI model override. **Format differs by platform** — see note below. |
| `agents` | string[] | — | Sub-agents this agent can invoke. Use `['*']` for all, `[]` for none. *(VS Code/IDE; not in GitHub Docs schema)* |
| `target` | string | both | `"vscode"` or `"github-copilot"`. Omit to serve all platforms. |
| `user-invocable` | boolean | `true` | Controls whether this agent can be selected by a user. When `false`, the agent can only be accessed programmatically or as a sub-agent. |
| `disable-model-invocation` | boolean | `false` | **Semantics differ by platform.** Cloud/CLI: disables automatic selection based on task context. VS Code: prevents other agents from invoking this one as a sub-agent. |
| `mcp-servers` | object | — | Additional MCP servers and tools for the agent. *(Cloud agent only; not used in VS Code/IDE agents)* |
| `metadata` | object | — | Allows annotation of the agent with name/value pairs. *(Cloud agent only; not used in VS Code/IDE agents)* |

### Model Field — Platform Differences

The `model` field has conflicting documentation between platforms:

| Aspect | GitHub Docs (cloud agent) | VS Code Docs |
|--------|---------------------------|--------------|
| **Type** | `string` only | `string \| string[]` (array for fallback) |
| **Format guidance** | None specified — just "Model to use" | Display name with `(vendor)` qualifier |
| **Example** | *(none given)* | `model: ['Claude Opus 4.5', 'GPT-5.2']` or `model: GPT-5.2 (copilot)` |
| **Source** | [GitHub Docs properties table][gh-config] | [VS Code custom agents docs][vscode-agents] |

> ⚠️ **Recommendation:** For VS Code `handoffs.model`, use qualified names in `"Model Name (vendor)"` format (explicitly required by VS Code docs). For top-level `model`, VS Code examples show both bare names (`'Claude Opus 4.5'`) and arrays for fallback priority. For cloud agents, the GitHub docs specify only `string` type with no format guidance — test with your target environment.

### VS Code Specific Schemas

**Handoffs (VS Code only)**
```yaml
handoffs:
  - label: "Button Text"        # Required: display text
    agent: target-agent          # Required: agent to switch to
    prompt: "Instructions..."    # Optional: pre-filled prompt
    send: false                  # Optional: false=user clicks send, true=auto-submit
    model: "GPT-5.2 (copilot)"  # Optional: model override (use "Model Name (vendor)" format)
```

> **Note:** If `agents` is specified in frontmatter, ensure the `agent` tool is also included in the `tools` property.

**Common VS Code Tools**
*Only use these if `target: "vscode"` is explicitly defined or intended. This list may change — see [VS Code agent tools docs](https://code.visualstudio.com/docs/copilot/agents/agent-tools) for the current canonical list.*
- `search`: Search workspace files by text
- `codebase`: Semantic code search
- `editFiles`: Create and edit files
- `runCommands`: Execute terminal commands
- `runTests`: Run test suite
- `problems`: Get compile/lint errors
- `fetch`: Fetch web content
- `vscode/askQuestions`: Enables the agent to ask clarifying questions using an interactive carousel *(VS Code 1.109+, [release notes](https://code.visualstudio.com/updates/v1_109))*

### Tool Aliases

Cross-platform tool aliases from [GitHub Docs][gh-config]. All aliases are case insensitive. **Use these for cross-platform agents instead of VS Code-specific tool names.**

| Primary Alias | Compatible Aliases | Cloud Agent Mapping | Purpose |
|---------------|-------------------|---------------------|---------|
| `execute` | `shell`, `Bash`, `powershell` | Shell tools: `bash` or `powershell` | Execute a command in the appropriate shell for the OS |
| `read` | `Read`, `NotebookRead` | `view` | Read file contents |
| `edit` | `Edit`, `MultiEdit`, `Write`, `NotebookEdit` | Edit tools: e.g. `str_replace`, `str_replace_editor` | Allow LLM to edit files |
| `search` | `Grep`, `Glob` | `search` | Search for files or text in files |
| `agent` | `custom-agent`, `Task` | "Custom agent" tools | Invoke a different custom agent for a sub-task |
| `web` | `WebSearch`, `WebFetch` | Currently not applicable for cloud agent | Fetch content from URLs and perform web search |
| `todo` | `TodoWrite` | Currently not applicable for cloud agent | Create and manage structured task lists *(VS Code only)* |
| **`skill`** | — | Skill discovery | **Strongly recommended when tools are explicit.** Enables discovery of `.github/skills/` files so agents retain access to skill-based knowledge and workflows. |

## Validation Rules
- `description` MUST exist for discoverability (especially for CLI inference). *(Source: [GitHub Docs][gh-config] — marked **Required**)*
- `name` SHOULD use lowercase letters and hyphens for CLI programmatic compatibility. *(Recommendation — not a documented constraint, but the CLI docs suggest it for `--agent` flag usage)*
- If `target` is omitted (cross-platform), do NOT include `handoffs`, `hooks`, or explicit `tools` arrays with platform-specific names. *(Source: [GitHub Docs][gh-config] — "All unrecognized tool names are ignored"; [VS Code Docs][vscode-agents] — `argument-hint` and `handoffs` "are ignored to ensure compatibility")*
- If `tools` is explicitly defined, **strongly include `skill`** to ensure the agent can discover skill files. Omitting it cuts off access to `.github/skills/` knowledge.
- Frontmatter must be valid YAML — wrap strings containing colons in quotes.
- `tools: ["*"]` is equivalent to omitting `tools` — both enable all available tools. *(Source: [GitHub Docs][gh-config])*

## Removing Redundant Defaults

**If a frontmatter property is set to its default value, remove it.** Explicitly stating defaults adds noise, hurts maintainability, and can cause subtle cross-platform issues when defaults differ between harnesses.

### Properties with Defaults

| Property | Default Value | Remove if set to... |
|----------|--------------|---------------------|
| `name` | filename (without `.agent.md`) | the same string as the filename |
| `tools` | all tools enabled | `["*"]` or listing every available tool |
| `model` | user's chosen model | not overriding — only include if forcing a specific model |
| `target` | both (cross-platform) | omit unless intentionally restricting to one platform |
| `user-invocable` | `true` | `true` (only set when changing to `false`) |
| `disable-model-invocation` | `false` | `false` (only set when changing to `true`) |

### Why This Matters

1. **Maintainability** — Fewer properties means less to read and maintain. Reviewers immediately see which fields are intentional overrides vs. boilerplate.
2. **Cross-platform safety** — Defaults may differ between VS Code, CLI, and Cloud. Hardcoding a value that happens to match today's default on one platform can conflict with another platform's behavior or with future changes.
3. **Signal-to-noise** — When every field is explicit, intentional configuration choices (like restricting tools or forcing a model) get lost in the noise of redundant declarations.

### Examples

❌ **Redundant — remove these:**
```yaml
---
name: my-agent           # file is already named my-agent.agent.md
tools: ["*"]             # same as omitting tools entirely
user-invocable: true     # already the default
disable-model-invocation: false  # already the default
---
```

✅ **Clean — only intentional overrides:**
```yaml
---
description: "Security auditor scanning for vulnerabilities and secrets in source code."
tools: ['skill', 'search', 'codebase', 'usages', 'problems']
---
```

## Source References

| Source | URL | What it covers |
|--------|-----|----------------|
| GitHub Docs — Custom Agents Configuration | [gh-config] | Authoritative properties table, tool aliases, MCP config, processing rules |
| VS Code Docs — Custom Agents | [vscode-agents] | File structure, all frontmatter fields, handoffs, hooks, examples |
| GitHub CLI Docs — Create Custom Agents | [cli-agents] | CLI-specific invocation, file locations, trigger words |
| Copilot Academy — Developer Guide | [dev-guide] | Best practices and walkthrough *(non-authoritative for schema; use for patterns/examples only)* |

[gh-config]: https://docs.github.com/en/copilot/reference/custom-agents-configuration
[vscode-agents]: https://code.visualstudio.com/docs/copilot/customization/custom-agents#_custom-agent-file-structure
[cli-agents]: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli
[dev-guide]: https://copilot-academy.github.io/workshops/copilot-customization/custom_agent_developer_guide

> **For AI tools verifying this file:** The GitHub Docs properties table is best accessed via the markdown API:
> ```
> https://docs.github.com/api/article/body?pathname=/en/copilot/reference/custom-agents-configuration
> ```
> Standard HTML fetching often misses the table because it's inside a `<div class="ghd-tool rowheaders">` block that many markdown converters skip. The API endpoint returns clean markdown with the full table intact.
