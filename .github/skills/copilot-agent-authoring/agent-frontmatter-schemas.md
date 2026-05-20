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
| **Invocation** | Agents dropdown / `@mention` | `/agent`, `--agent`, or by inference | Automatic |
| **Target Field** | `target: "vscode"` | Ignored / Not natively matching target string | `target: "github-copilot"` |
| **Tools Format** | VS Code tool IDs | CLI tool IDs / host defaults | GitHub tool IDs |
| **Handoffs** | Fully Supported | Not supported | Not supported |
| **Hooks** | Supported (Preview) | Not supported | Not supported |
| **MCP Servers** | Recognized but not acted upon (cloud agent only) | Not used | Supported |

## Harness-Specific Guidelines

### Cross-Platform Target (Default & Recommended)
To make an agent work natively in **both** VS Code and Copilot CLI:
1. Omit the `target` property.
2. **Omit the `tools` property**. This is critical. Allowing the host to provide the default toolset prevents validation errors where CLI encounters the VS Code `editFiles` tool or vice-versa.
3. Omit `handoffs`, `hooks`, and `mcp-servers`.

### VS Code Target (`target: "vscode"`)
- **Tools**: VS Code relies on specific extension tool IDs (e.g., `search`, `codebase`, `editFiles`, `runCommands`). If you define the `tools` array, you MUST use valid VS Code tool names.
- **Handoffs**: You can use the `handoffs` array to chain agents.
- **Hooks**: You can bind workspace lifecycle events specifically to this agent.

### Copilot CLI Target
- **Tool Access**: The CLI often relies on inference and system-level execution. Hardcoding VS Code specific tools like `editFiles` will cause the CLI agent to fail or act unpredictably.
- **Invocation**: The CLI relies heavily on the `description` field to infer when to automatically trigger the agent if not explicitly invoked via `--agent`.

## Schema Definition

All `.agent.md` files begin with YAML frontmatter between `---` fences.

### Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `description` | string | 50–150 chars | Shown as placeholder text in chat. Must clearly state what the agent does. CLI heavily relies on this for inference-based invocation. |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `name` | string | filename | Display name. Use lowercase with hyphens for CLI programmatic compatibility. |
| `argument-hint` | string | — | Hint text guiding users on what input to provide. *(VS Code/IDE only; ignored by cloud agent)* |
| `tools` | string[] | all tools | Restrict available tools. **Omit to allow host defaults (required for cross-platform agents).** |
| `model` | string \| string[] | user's chosen | AI model override. **Format differs by platform** — see note below. |
| `agents` | string[] | — | Sub-agents this agent can invoke. Use `['*']` for all, `[]` for none. |
| `target` | string | both | `"vscode"` or `"github-copilot"`. Omit to serve all platforms. |
| `user-invokable` | boolean | `true` | Set `false` to hide from dropdown/invocation (sub-agent only). |
| `disable-model-invocation` | boolean | `false` | Set `true` to prevent other agents from invoking this one. |

### Model Field — Platform Differences

The `model` field has conflicting documentation between platforms:

| Aspect | GitHub Docs (cloud agent) | VS Code Docs |
|--------|---------------------------|--------------|
| **Type** | `string` only | `string \| string[]` (array for fallback) |
| **Format guidance** | None specified — just "Model to use" | Display name with `(vendor)` qualifier |
| **Example** | *(none given)* | `model: ['Claude Opus 4.5', 'GPT-5.2']` or `model: GPT-5.2 (copilot)` |
| **Source** | [GitHub Docs properties table][gh-config] | [VS Code custom agents docs][vscode-agents] |

> ⚠️ **Recommendation:** For VS Code agents, use display names with vendor qualifier (e.g., `"Claude Sonnet 4 (copilot)"`). Arrays are supported for fallback priority. For cloud agents, the GitHub docs specify only `string` type with no format guidance — test with your target environment. The `handoffs.model` field in VS Code explicitly states: "Use the qualified model name in the format `Model Name (vendor)`."

### VS Code Specific Schemas

**Handoffs (VS Code only)**
```yaml
handoffs:
  - label: "Button Text"        # Required: display text
    agent: target-agent          # Required: agent to switch to
    prompt: "Instructions..."    # Optional: pre-filled prompt
    send: false                  # Optional: false=user clicks send, true=auto-submit
```

**Common VS Code Tools**
*Only use these if `target: "vscode"` is explicitly defined or intended.*
- `search`: Search workspace files by text
- `codebase`: Semantic code search
- `editFiles`: Create and edit files
- `runCommands`: Execute terminal commands
- `runTests`: Run test suite
- `problems`: Get compile/lint errors
- `fetch`: Fetch web content

## Validation Rules
- `description` MUST exist for discoverability (especially for CLI inference). *(Source: [GitHub Docs][gh-config] — marked **Required**)*
- `name` SHOULD use lowercase letters and hyphens for CLI programmatic compatibility. *(Recommendation — not a documented constraint, but the CLI docs suggest it for `--agent` flag usage)*
- If `target` is omitted (cross-platform), do NOT include `handoffs`, `hooks`, or explicit `tools` arrays with platform-specific names. *(Source: [GitHub Docs][gh-config] — "All unrecognized tool names are ignored"; [VS Code Docs][vscode-agents] — `argument-hint` and `handoffs` "are ignored to ensure compatibility")*
- Frontmatter must be valid YAML — wrap strings containing colons in quotes.
- `tools: ["*"]` is equivalent to omitting `tools` — both enable all available tools. *(Source: [GitHub Docs][gh-config])*

## Source References

| Source | URL | What it covers |
|--------|-----|----------------|
| GitHub Docs — Custom Agents Configuration | [gh-config] | Authoritative properties table, tool aliases, MCP config, processing rules |
| VS Code Docs — Custom Agents | [vscode-agents] | File structure, all frontmatter fields, handoffs, hooks, examples |
| GitHub CLI Docs — Create Custom Agents | [cli-agents] | CLI-specific invocation, file locations, trigger words |
| Copilot Academy — Developer Guide | [dev-guide] | Step-by-step walkthrough, tool selection strategy, anatomy |

[gh-config]: https://docs.github.com/en/copilot/reference/custom-agents-configuration
[vscode-agents]: https://code.visualstudio.com/docs/copilot/customization/custom-agents#_custom-agent-file-structure
[cli-agents]: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli
[dev-guide]: https://copilot-academy.github.io/workshops/copilot-customization/custom_agent_developer_guide

> **For AI tools verifying this file:** The GitHub Docs properties table is best accessed via the markdown API:
> ```
> https://docs.github.com/api/article/body?pathname=/en/copilot/reference/custom-agents-configuration
> ```
> Standard HTML fetching often misses the table because it's inside a `<div class="ghd-tool rowheaders">` block that many markdown converters skip. The API endpoint returns clean markdown with the full table intact.
