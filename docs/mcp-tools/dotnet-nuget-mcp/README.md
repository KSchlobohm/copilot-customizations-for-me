# .NET NuGet MCP Server

> 🚧 **Coming soon** — This guide is a placeholder for a future detailed writeup.

## What Is It?

The .NET NuGet MCP Server gives Copilot access to .NET-specific package management features — searching NuGet, checking package versions, understanding dependencies, and more.

## Why I Recommend It

This is a **workspace-specific** tool. When you're working in .NET, it's invaluable. When you're not, it's noise.

Key capabilities:
- Search and discover NuGet packages
- Check for outdated dependencies
- Understand package compatibility with your target framework
- Get .NET-specific guidance informed by real package data

## Configuration Notes

This tool can be configured differently for VS Code and Copilot CLI:

- **VS Code**: Best configured per-workspace in `.vscode/mcp.json` for .NET projects
- **Copilot CLI**: Can be added to workspace-level `.copilot/mcp.json` so it's only active when you're in a .NET repo

Full setup guide coming soon.
