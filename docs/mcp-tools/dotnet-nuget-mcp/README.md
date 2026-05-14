# .NET NuGet MCP Server

## What Is It?

The [NuGet MCP Server](https://learn.microsoft.com/en-us/nuget/concepts/nuget-mcp-server) gives Copilot real-time access to NuGet package feeds. Instead of relying on stale training data about package versions and vulnerabilities, Copilot can query live NuGet sources to detect security issues, plan upgrades, and understand your dependency graph.

## Why I Recommend It

This is a **workspace-specific** tool. When you're working in .NET, it's invaluable. When you're not, it's noise.

Key capabilities:

- **Fix known vulnerabilities** — detects CVEs in your dependencies (including transitive ones) and computes the smallest safe version upgrade
- **Upgrade packages** — plans upgrades respecting your target frameworks and dependency constraints
- **Get package context** — retrieves AI-optimized `AGENTS.md` files from packages (or their README) so Copilot understands how to use them
- **Version lookups** — checks the latest available version of any package from configured feeds

### What makes it different from `dotnet list package --vulnerable`?

The MCP server uses NuGetSolver (developed with Microsoft Research) to resolve dependency conflicts automatically. It doesn't just report vulnerabilities — it computes a fix that keeps your entire dependency graph compatible.

## Prerequisites

| Requirement | Details |
|---|---|
| **.NET 10 SDK** | Provides the `dnx` command that downloads and runs the MCP server on-demand |
| **VS Code** or **VS 2022 17.14+** | For IDE integration (VS 2026 ships it built-in) |
| **GitHub Copilot** | Must be signed in |

Verify .NET 10 is installed:

```bash
dotnet --info
```

Download .NET 10 SDK: https://dotnet.microsoft.com/en-us/download/dotnet/10.0

## Configuration

### The Setup Pattern

Workspace-specific tools need **two config files** — one for Copilot CLI, one for VS Code — because they use different property names:

| File | Used by | Root property |
|------|---------|---------------|
| `.mcp.json` (workspace root) | Copilot CLI | `mcpServers` |
| `.vscode/mcp.json` | VS Code | `servers` |

### VS Code — `.vscode/mcp.json`

```json
{
  "servers": {
    "nuget": {
      "type": "stdio",
      "command": "dnx",
      "args": [
        "NuGet.Mcp.Server",
        "--source", "https://api.nuget.org/v3/index.json",
        "--yes"
      ]
    }
  }
}
```

### Copilot CLI — `.mcp.json` at workspace root

```json
{
  "mcpServers": {
    "nuget": {
      "type": "stdio",
      "command": "dnx",
      "args": [
        "NuGet.Mcp.Server",
        "--source", "https://api.nuget.org/v3/index.json",
        "--yes"
      ],
      "tools": ["*"]
    }
  }
}
```

### Key Configuration Options

| Option | Description |
|--------|-------------|
| `--source <URL>` | NuGet feed URL — can be a private Azure DevOps feed |
| `--yes` | Auto-accept download prompts (required for non-interactive MCP mode) |
| `--prerelease` | Allow prerelease versions of the MCP server itself |
| `NuGet.Mcp.Server@1.4.3` | Pin to an exact version for stability |

**Version pinning example** (recommended for shared team configs):

```json
{
  "servers": {
    "nuget": {
      "type": "stdio",
      "command": "dnx",
      "args": [
        "NuGet.Mcp.Server@1.4.3",
        "--source", "https://api.nuget.org/v3/index.json",
        "--yes"
      ]
    }
  }
}
```

> ⚠️ When pinning a version, you must manually update the version number as new releases are published. Omitting `@version` always fetches the latest stable.

### Notes

- `dnx` downloads and caches the server on first use — no separate install step needed
- The server reads your existing `nuget.config` for feed authentication — no separate credential setup in `mcp.json`
- For Azure DevOps private feeds: run `dotnet restore --interactive` once to prime the credential cache before the MCP server can authenticate non-interactively

## Verification

After configuration, verify the setup is working:

### Step 1: Confirm MCP server starts

In VS Code, open the Output panel and select the MCP channel. You should see the NuGet MCP server initialize without errors.

In Copilot CLI, start a session and ask:
```
What MCP tools do you have available?
```
You should see NuGet-related tools listed (e.g., `fix_vulnerable_packages`, `upgrade_packages_to_latest`, `get_latest_package_version`).

### Step 2: Test a package lookup

Ask Copilot:
```
What is the latest version of Newtonsoft.Json?
```

If Copilot returns a current version number (not from its training data), the MCP server is working.

## Workshop

See the [Vulnerability Fix Workshop](workshop-vulnerability-fix.md) for a hands-on walkthrough demonstrating the value of the NuGet MCP server — detecting and fixing a real CVE in under a minute.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `dnx: command not found` | .NET 10 SDK not installed | Install from https://dotnet.microsoft.com/en-us/download/dotnet/10.0 and restart terminal |
| MCP server hangs on startup | Azure DevOps credential cache empty | Run `dotnet restore --interactive` to prime credentials, then restart the MCP server |
| "Unable to load service index" | Private feed auth failed | Install v2 credential provider: `dotnet tool install --global Microsoft.Artifacts.CredentialProvider.NuGet.Tool` |
| Tools not appearing in Copilot | `mcp.json` in wrong location | Verify the file is at `.vscode/mcp.json` (VS Code) or `.mcp.json` at workspace root (CLI) |
| Old package versions returned | Stale NuGet HTTP cache | Add `--no-http-cache` to the `args` array temporarily |

## Next Steps

Once comfortable with vulnerability detection:
- Try `"Update all my packages to the latest compatible versions"` for bulk upgrades
- Explore `get_package_context` — packages with `AGENTS.md` give Copilot richer usage guidance
- Combine with [Community.Mcp.DotNet](https://github.com/jongalloway/dotnet-mcp) for a full .NET SDK MCP stack (build, test, EF migrations, and more)
