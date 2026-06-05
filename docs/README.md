# Recommended Copilot Tool Setup

This section documents my recommended tools, installations, configurations, and selected workflow notes for getting the most out of GitHub Copilot. Most entries capture **what** to install, **how** to configure it, and **why** it matters.

## Philosophy

Not every tool belongs in every session. I think about MCP tools on a spectrum:

| Category | Description | Example |
|----------|-------------|---------|
| **Always-on** | Valuable in nearly every coding session | Playwright MCP |
| **Workspace-specific** | Relevant to a technology or project type | .NET NuGet MCP Server, Modernization MCP |
| **Situational** | Needed at the right time and place, but adds noise otherwise | *(future entries)* |

## Guides

| Topic | Status | Guide |
|-------|--------|-------|
| Copilot CLI Chronicle | ✅ Complete | [Why it matters early](lessons-learned/copilot-cli-chronicle.md) |
| Playwright MCP | ✅ Complete | [Setup & Workshop](mcp-tools/playwright-mcp/README.md) |
| .NET NuGet MCP Server | ✅ Complete | [Setup & Workshop](mcp-tools/dotnet-nuget-mcp/README.md) |
| Microsoft.GitHubCopilot.Modernization.Mcp | ✅ Complete | [Setup Guide](mcp-tools/modernization-mcp/README.md) |

## How to Use These Guides

Most setup guides follow a consistent format:

1. **What & Why** — What the tool does and why I recommend it
2. **Setup** — Installation and configuration steps (VS Code + Copilot CLI)
3. **Verification** — How to confirm it's working
4. **Workshop** — A hands-on walkthrough demonstrating the value
