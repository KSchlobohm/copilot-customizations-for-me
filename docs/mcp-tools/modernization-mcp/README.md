# Microsoft.GitHubCopilot.Modernization.Mcp

## What Is It?

The [.NET Modernization Agent](https://github.com/dotnet/modernize-dotnet) is an AI-powered agent for upgrading and modernizing .NET applications. It can analyze your application, generate an upgrade plan, and apply changes to move to the latest .NET.

## Supported Scenarios

- Upgrade projects to the latest supported .NET version
- Migrate from .NET Framework to modern .NET

## Why It's a Workspace-Specific Tool

This tool belongs in the **workspace-specific** category — you configure it per-project where you're doing modernization work, not globally. Reasons:

- It adds MCP tools that are irrelevant during normal development
- It uses `dnx` (the .NET tool runner) and .NET-specific packages that only make sense in .NET workspaces
- Different modernization projects may need different companion tools alongside it

## Configuration

The key difference for workspace-specific MCP tools: you create config files **in the workspace** rather than in your global settings.

### The Setup Pattern

Workspace-specific tools need **two config files** — one for Copilot CLI, one for VS Code — because they use different property names:

| File | Used by | Root property |
|------|---------|---------------|
| `.mcp.json` (workspace root) | Copilot CLI | `mcpServers` |
| `.vscode/mcp.json` | VS Code | `servers` |

### Copilot CLI — `.mcp.json` at workspace root

```json
{
  "mcpServers": {
    "Microsoft.GitHubCopilot.AppModernization.Mcp": {
      "type": "stdio",
      "command": "dnx",
      "args": [
        "Microsoft.GitHubCopilot.Modernization.Mcp",
        "--yes",
        "--prerelease"
      ],
      "tools": ["*"]
    }
  }
}
```

### VS Code — `.vscode/mcp.json`

```json
{
  "servers": {
    "Microsoft.GitHubCopilot.AppModernization.Mcp": {
      "type": "stdio",
      "command": "dnx",
      "args": [
        "Microsoft.GitHubCopilot.Modernization.Mcp",
        "--yes",
        "--prerelease"
      ],
      "tools": ["*"]
    }
  }
}
```

### Using the Agent

<details>
<summary>VS Code</summary>

1. Install the [GitHub Copilot modernization](https://marketplace.visualstudio.com/items?itemName=vscjava.migrate-java-to-azure) extension from the VS Code Marketplace
2. Open a workspace containing your .NET project
3. Open Copilot Chat and select `modernize-dotnet` from the Agent picker
4. Prompt: `upgrade my project to .NET 10`

</details>

<details>
<summary>Copilot CLI (plugin install)</summary>

1. Add the marketplace:
   ```
   /plugin marketplace add dotnet/modernize-dotnet
   ```
2. Install the plugin:
   ```
   /plugin install modernize-dotnet@modernize-dotnet-plugins
   ```
3. Select the agent:
   ```
   /agent
   ```
   Then select `modernize-dotnet`
4. Prompt: `upgrade my project to .NET 10`

> **Note:** You may need to restart Copilot CLI after installing the plugin before the agent becomes available.

</details>

## Workspace Setup Automation

For a full workshop-style setup that configures both MCP servers and downloads companion skills/agents, see the [fx2dotnet workspace setup agent](https://github.com/KSchlobohm/fx2dotnet/blob/kschlobohm/setup-agent/agents/00-agent-workspace-setup.agent.md). It demonstrates:

- Downloading MCP config and producing both CLI and VS Code format files
- Pulling in companion skills and sub-agents for the modernization workflow
- Validating the setup before beginning assessment work
