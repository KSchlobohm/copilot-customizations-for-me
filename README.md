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
| `.github/skills/copilot-customization-agent-authoring/` | Guidance for creating, reviewing, and grading custom agent files |
| `.github/skills/launching-iisexpress/` | Guidance for launching .NET Framework ASP.NET projects with IIS Express |
| `.github/skills/managing-summary-canvas/` | A reusable Copilot App side-panel canvas skill for tracking and resuming engineering work across sessions (requires the Copilot App's canvas support) |
| `docs/` | Recommended tool setup guides, installation steps, and workshops |
| `docs/lessons-learned/` | Focused notes on practical AI-assisted engineering lessons worth revisiting |
| `docs/mcp-tools/` | MCP tool configuration guides with rationale and walkthroughs |
| `docs/reading-list.md` | Shared reading list of reference material and useful articles |
| `prompts/` | Reusable Copilot prompt templates for common engineering tasks |

## Current Inventory

| Type | Name | Problem it solves | Entry point |
|------|------|-------------------|-------------|
| Skill | `copilot-customization-skill-authoring` | Helps create or review skill files that are concise, discoverable, and effective | `.github/skills/copilot-customization-skill-authoring/SKILL.md` |
| Skill | `copilot-customization-advisor` | Helps new Copilot users decide whether they need instructions, a prompt file, a skill, an agent, a sub-agent, or a hook | `.github/skills/copilot-customization-advisor/SKILL.md` |
| Skill | `copilot-customization-agent-authoring` | Helps create, review, and grade custom agent files (.agent.md) using best practices from large-scale community analysis | `.github/skills/copilot-customization-agent-authoring/SKILL.md` |
| Skill | `launching-iisexpress` | Helps launch and verify .NET Framework ASP.NET projects locally with IIS Express from the command line | `.github/skills/launching-iisexpress/SKILL.md` |
| Verification | `launching-iisexpress` release contract | Detects canonical template drift and stale generated IIS Express launch scripts using dependency-free PowerShell, release version, and a normalized SHA-256 fingerprint | `.github/skills/launching-iisexpress/Verify-LaunchingIISExpress.ps1` |
| Validation | `launching-iisexpress` regressions | Executes the rendered launcher under Windows PowerShell or PowerShell 7 to verify root and virtual-path mappings, provenance handling, and safe substitution without external modules | `.github/skills/launching-iisexpress/Verify-LaunchingIISExpress.Tests.ps1` |
| Skill | `managing-summary-canvas` | Opens, refreshes, and reads a reusable Copilot App side-panel summary canvas (linked issue header, pinned action items, collapsed build notes, learnings, reviewer verdict matrix) for tracking and resuming work across sessions — requires the Copilot App's canvas support | `.github/skills/managing-summary-canvas/SKILL.md` |
| Guide | Copilot CLI Chronicle lesson | Explains why `/chronicle` matters, what architectural idea sits behind it, and when to go deeper | `docs/lessons-learned/copilot-cli-chronicle.md` |
| Guide | Skill reuse vs knowledge reuse lesson | Explains when skills are personal accelerators vs shared knowledge artifacts, and when evals are worth the investment | `docs/lessons-learned/skill-reuse-is-knowledge-reuse.md` |
| Guide | Playwright MCP Setup | Full setup guide + workshop for visual verification with Playwright MCP | `docs/mcp-tools/playwright-mcp/README.md` |
| Guide | .NET NuGet MCP Server | Workspace-specific MCP for .NET package vulnerability detection and upgrades | `docs/mcp-tools/dotnet-nuget-mcp/README.md` |
| Guide | Modernization MCP | Workspace-specific MCP for .NET Framework to modern .NET migration | `docs/mcp-tools/modernization-mcp/README.md` |
| Prompt | `migration-prompt-template` | Generic, configurable prompt template for migrating a codebase from any source technology to a target technology - fill in the YAML frontmatter and replace or interpolate the bracketed placeholders before use | `prompts/migration-prompt-template.md` |

## How to Navigate

Start with the inventory above to find the relevant artifact, then open that artifact's entry point.

- Read `SKILL.md` first for the high-level behavior and activation guidance.
- Follow linked supporting files when the skill points to deeper reference material.
- Treat this README as the index, not the full documentation for each customization.
