# MCP Tools for Copilot

## What Are MCP Tools?

MCP (Model Context Protocol) tools extend what Copilot can do beyond reading and writing code. They give Copilot access to external capabilities — browsing the web, querying package registries, running specialized analysis — that make it dramatically more effective for certain tasks.

## Why MCP Tools Matter

Without MCP tools, Copilot operates only on the files in your workspace and its training data. With MCP tools, Copilot can:

- **See your running app** — take screenshots, navigate pages, verify visual outcomes
- **Query live data** — check package versions, read documentation, search registries
- **Run specialized tools** — execute framework-specific analysis, migrations, modernization

## Always-On vs Situational

I configure MCP tools based on how broadly useful they are:

### Always-on tools
These provide value in nearly every session. The cost of having them available is low, and the benefit is frequent.

→ [Playwright MCP](playwright-mcp/README.md) — testing + visual verification

### Workspace-specific tools
These are valuable when working in a particular ecosystem. I configure them per-workspace or per-project so they're available when relevant but don't clutter unrelated work.

→ [.NET NuGet MCP Server](dotnet-nuget-mcp/README.md) — .NET package management and features

### Situational tools
These are powerful but narrow. I enable them only when I'm doing the specific task they support, then disable them to keep sessions focused.

→ [Modernization MCP](modernization-mcp/README.md) — .NET modernization tasks

## Configuration: VS Code vs Copilot CLI

MCP tools can be configured differently depending on your client:

| Client | Config location | Scope |
|--------|----------------|-------|
| VS Code | `.vscode/mcp.json` (workspace) or User Settings (global) | Per-workspace or global |
| Copilot CLI | `~/.config/github-copilot/mcp.json` or workspace `.copilot/mcp.json` | Global or per-workspace |

This distinction matters because:
- **VS Code** users might want tools available in the editor's Copilot Chat
- **Copilot CLI** users might want tools available in terminal-based workflows
- Some tools make sense in both; others are better suited to one context
