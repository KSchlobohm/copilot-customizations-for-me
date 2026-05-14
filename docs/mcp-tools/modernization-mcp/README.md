# Microsoft.GitHubCopilot.Modernization.Mcp

> 🚧 **Coming soon** — This guide is a placeholder for a future detailed writeup.

## What Is It?

The Modernization MCP tool provides specialized assistance for .NET modernization tasks — migrating from .NET Framework to .NET (Core), updating deprecated APIs, and navigating breaking changes.

## Why It's Situational

This is a **right-time, right-place** tool. I explicitly do NOT want it in every Copilot session because:

- It adds context and tool options that are irrelevant during normal development
- Its value is concentrated during active modernization efforts
- Having it always-on could lead Copilot to suggest migrations when you just want to fix a bug

## When to Enable It

Enable this tool when you are:
- Actively migrating a project from .NET Framework to .NET 8+
- Updating deprecated API usage across a codebase
- Planning a modernization effort and need analysis of what needs to change

Disable it when the modernization work is complete.

## Configuration Philosophy

Unlike always-on tools, I configure this one so it's easy to toggle:
- Keep the config ready but commented out, or
- Use a separate MCP config profile that you activate only during modernization sprints

Full setup guide coming soon.
