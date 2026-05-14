# Microsoft.GitHubCopilot.Modernization.Mcp

## What Is It?

The [.NET Modernization Agent](https://github.com/dotnet/modernize-dotnet) is an AI-powered agent for upgrading and modernizing .NET applications. It can analyze your application, generate an upgrade plan, and apply changes to move to the latest .NET.

Supported scenarios:

- Upgrade projects to the latest supported .NET version
- Migrate from .NET Framework to modern .NET

## Why I Recommend It

This is a **workspace-specific** tool. You configure it per-project where you're doing modernization work, not globally.

- It adds MCP tools that are irrelevant during normal development
- It uses `dnx` (the .NET tool runner) and .NET-specific packages that only make sense in .NET workspaces
- Different modernization projects may need different companion tools alongside it

## Prerequisites

| Requirement | Details |
|---|---|
| **.NET 10 SDK** | Provides the `dnx` command that downloads and runs the MCP server on-demand |
| **VS Code** or **VS 2022 17.14+** | For IDE integration |
| **GitHub Copilot** | Must be signed in |
| **A .NET Framework project** | The tool targets projects that need to be modernized |

## Configuration

If you want a **shared workspace setup**, use two config files — one for Copilot CLI, one for VS Code — because they use different property names:

| File | Used by | Root property |
|------|---------|---------------|
| `.mcp.json` (workspace root) | Copilot CLI | `mcpServers` |
| `.vscode/mcp.json` | VS Code | `servers` |

If you only want this configured for yourself in Copilot CLI, use `/mcp add` or edit `~/.copilot/mcp-config.json` instead.

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

### Using the Agent

<details>
<summary>VS Code</summary>

1. Install the [GitHub Copilot app modernization](https://marketplace.visualstudio.com/items?itemName=vscjava.migrate-java-to-azure) extension from the VS Code Marketplace
   - The marketplace identifier still says `migrate-java-to-azure`, but the extension also supports .NET modernization workflows
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

## Verification

After configuration, verify the setup is working:

### Step 1: Confirm MCP server starts

In VS Code, open the Output panel and select the MCP channel. You should see the Modernization MCP server initialize without errors.

In Copilot CLI, start a session and ask:
```
What MCP tools do you have available?
```
You should see modernization-related tools listed.

### Step 2: Test a project assessment

Open a workspace containing a .NET Framework project and ask Copilot:
```
Assess my project for modernization to .NET 10
```

If Copilot invokes the modernization tools and returns an analysis, the setup is confirmed working.

## Workshop

For a full workshop-style setup that configures both MCP servers and downloads companion skills/agents, see the [fx2dotnet workspace setup agent](https://github.com/KSchlobohm/fx2dotnet/blob/kschlobohm/setup-agent/agents/00-agent-workspace-setup.agent.md). It demonstrates:

- Downloading MCP config and producing both CLI and VS Code format files
- Pulling in companion skills and sub-agents for the modernization workflow
- Validating the setup before beginning assessment work

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `dnx: command not found` | .NET 10 SDK not installed | Install from https://dotnet.microsoft.com/en-us/download/dotnet/10.0 and restart terminal |
| Tools not appearing in Copilot | `mcp.json` in wrong location | Verify the file is at `.vscode/mcp.json` (VS Code) or `.mcp.json` at workspace root (CLI) |
| Agent not available in Copilot CLI | Plugin not installed | Run `/plugin marketplace add dotnet/modernize-dotnet` then restart CLI |

## Next Steps

Once comfortable with the modernization agent:
- Explore the [fx2dotnet workspace setup agent](https://github.com/KSchlobohm/fx2dotnet/blob/kschlobohm/setup-agent/agents/00-agent-workspace-setup.agent.md) for automated workspace configuration
- Combine with the [NuGet MCP Server](../dotnet-nuget-mcp/README.md) to manage package upgrades alongside framework migration
