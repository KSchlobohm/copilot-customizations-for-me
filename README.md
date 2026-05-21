# Copilot Customizations for Me

This repo is a growing library of GitHub Copilot customizations and supporting references. Each artifact is meant to explain itself and the scenario it solves; this README is the fast map so you can see what exists and where to start.

## Table of Contents

- [Purpose](#purpose)
- [Repository Map](#repository-map)
- [Current Inventory](#current-inventory)
- [How to Navigate](#how-to-navigate)

## Purpose

Use this repository to collect reusable Copilot customization building blocks, starting with skills that help design and author better customizations.

## Repository Map

| Path | Purpose |
|------|---------|
| `.github/skills/` | Reusable skills that Copilot can discover when relevant |
| `.github/skills/copilot-customization-skill-authoring/` | Guidance for creating and reviewing high-quality skills |
| `.github/skills/copilot-customization-advisor/` | Guidance for choosing the right customization type for a new idea |
| `.github/skills/copilot-agent-authoring/` | Guidance for creating, reviewing, and grading custom agent files |
| `docs/` | Recommended tool setup guides, installation steps, and workshops |
| `docs/mcp-tools/` | MCP tool configuration guides with rationale and walkthroughs |

## Current Inventory

| Type | Name | Problem it solves | Entry point |
|------|------|-------------------|-------------|
| Skill | `copilot-customization-skill-authoring` | Helps create or review skill files that are concise, discoverable, and effective | `.github/skills/copilot-customization-skill-authoring/SKILL.md` |
| Skill | `copilot-customization-advisor` | Helps new Copilot users decide whether they need instructions, a prompt file, a skill, an agent, a sub-agent, or a hook | `.github/skills/copilot-customization-advisor/SKILL.md` |
| Skill | `copilot-agent-authoring` | Helps create, review, and grade custom agent files (.agent.md) using best practices from large-scale community analysis | `.github/skills/copilot-agent-authoring/SKILL.md` |
| Guide | Playwright MCP Setup | Full setup guide + workshop for visual verification with Playwright MCP | `docs/mcp-tools/playwright-mcp/README.md` |
| Guide | .NET NuGet MCP Server | Workspace-specific MCP for .NET package vulnerability detection and upgrades | `docs/mcp-tools/dotnet-nuget-mcp/README.md` |
| Guide | Modernization MCP | Workspace-specific MCP for .NET Framework to modern .NET migration | `docs/mcp-tools/modernization-mcp/README.md` |

## How to Navigate

Start with the inventory above to find the relevant artifact, then open that artifact's entry point.

- Read `SKILL.md` first for the high-level behavior and activation guidance.
- Follow linked supporting files when the skill points to deeper reference material.
- Treat this README as the index, not the full documentation for each customization.
