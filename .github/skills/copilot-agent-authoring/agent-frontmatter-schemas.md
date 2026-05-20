# Agent Frontmatter Schemas

This reference details the YAML frontmatter schema for `.agent.md` files, with a specific focus on the differences between VS Code, Copilot CLI, and GitHub Copilot Cloud endpoints. Use this to ensure agents are authored correctly for their intended environment.

## Cross-Platform Compatibility

Whenever possible, design agents to be cross-platform compatible. If an agent uses platform-specific features (like VS Code `handoffs`), it MUST explicitly set the `target` field or it will cause parsing errors on other platforms.

| Feature | VS Code | Copilot CLI | GitHub Copilot (Cloud) |
|---------|---------|-------------|------------------------|
| **File location** | `.github/agents/` | `.github/agents/` or `~/.copilot/agents/` | `.github/agents/` |
| **Invocation** | Agents dropdown / `@mention` | `/agent`, `--agent`, or by inference | Automatic |
| **Target Field** | `target: "vscode"` | Ignored / Not natively matching target string | `target: "github-copilot"` |
| **Tools Format** | VS Code tool IDs | CLI tool IDs / host defaults | GitHub tool IDs |
| **Handoffs** | Fully Supported | Not supported | Not supported |
| **Hooks** | Supported (Preview) | Not supported | Not supported |
| **MCP Servers** | Not used (workspace config) | Not used | Supported |

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
| `argument-hint` | string | — | Hint text guiding users on what input to provide. |
| `tools` | string[] | all tools | Restrict available tools. **Omit to allow host defaults (required for cross-platform agents).** |
| `model` | string \| string[] | user's chosen | AI model override. format: `"Model Name (vendor)"` |
| `agents` | string[] | — | Sub-agents this agent can invoke. Use `['*']` for all, `[]` for none. |
| `target` | string | both | `"vscode"` or `"github-copilot"`. Omit to serve all platforms. |
| `user-invokable` | boolean | `true` | Set `false` to hide from dropdown/invocation (sub-agent only). |
| `disable-model-invocation` | boolean | `false` | Set `true` to prevent other agents from invoking this one. |

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
- `description` MUST exist for discoverability (especially for CLI inference).
- `name` MUST use lowercase letters and hyphens.
- If `target` is omitted (cross-platform), do NOT include `handoffs`, `hooks`, or explicit `tools` arrays.
- Frontmatter must be valid YAML — wrap strings containing colons in quotes.
