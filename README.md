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

## Current Inventory

| Type | Name | Problem it solves | Entry point |
|------|------|-------------------|-------------|
| Skill | `copilot-customization-skill-authoring` | Helps create or review skill files that are concise, discoverable, and effective | `.github/skills/copilot-customization-skill-authoring/SKILL.md` |
| Skill | `copilot-customization-advisor` | Helps new Copilot users decide whether they need instructions, a prompt file, a skill, an agent, a sub-agent, or a hook | `.github/skills/copilot-customization-advisor/SKILL.md` |

## How to Navigate

Start with the inventory above to find the relevant artifact, then open that artifact's entry point.

- Read `SKILL.md` first for the high-level behavior and activation guidance.
- Follow linked supporting files when the skill points to deeper reference material.
- Treat this README as the index, not the full documentation for each customization.
