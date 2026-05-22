# Sources of Truth for Skill Authoring

When a recommendation in this skill is challenged, consult the sources below to find current guidance, verify accuracy, and help the user make an informed decision. **AI-trained knowledge can go stale** — live documentation is always the authoritative source.

## How to Handle Pushback

When a user questions a best practice or frontmatter rule:

1. **Explain the rationale** behind the recommendation.
2. **Cite the relevant source** from the tables below.
3. **Identify the tradeoff** — why someone might reasonably choose differently.
4. **Ask the user which direction they prefer** — do not override a stated preference.

**Example:**
> User: "Why does the description have to be max 1024 characters? That seems arbitrary."
>
> Agent: "The 1024-character limit is defined in the Agent Skills specification (agentskills.io/specification). GitHub's Copilot docs don't currently state an explicit limit, so this is a spec-level constraint rather than a hard Copilot requirement. If you prefer to follow only GitHub-documented limits, you could keep descriptions under a practical length for readability without worrying about a strict character count. Which approach works better for your team?"

**If live web access is unavailable:** Cite the URL and note: *"My knowledge of this may be outdated — verify against the current docs before treating this as authoritative."*

---

## Source Authority Hierarchy

When sources conflict, use this priority order for GitHub Copilot skills:

| Priority | Source Type | Notes |
|----------|-------------|-------|
| 1 | **GitHub Docs** | Authoritative for Copilot-specific behavior, supported locations, and enforced requirements |
| 2 | **Agent Skills spec** (agentskills.io) | Broader ecosystem schema; stricter constraints than GitHub may document |
| 3 | **Anthropic / Claude platform docs** | Authoritative for Claude Skills; adapted as design guidance for Copilot, not enforced |
| 4 | **Community guides** (agentskills.io/skill-creation, Copilot Academy) | Useful heuristics and patterns; not normative |

---

## Sources by Question Type

### "Is this frontmatter valid?" / "What fields are required?"

| Source | Type | URL |
|--------|------|-----|
| GitHub Docs — CLI skills | GitHub-documented requirement | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills |
| GitHub Docs — Cloud agent skills | GitHub-documented requirement | https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills |
| Agent Skills specification | Agent Skills spec constraint | https://agentskills.io/specification |

Use GitHub Docs to confirm which frontmatter fields are recognized and required. Use the Agent Skills spec for character limits (`name` max 64 chars, `description` max 1024 chars) — note these limits come from the spec, not from GitHub's Copilot docs directly.

### "How should descriptions be written?"

| Source | Type | URL |
|--------|------|-----|
| Agent Skills — Best practices | Adopted best practice | https://agentskills.io/skill-creation/best-practices |
| Agent Skills — Optimizing descriptions | Adopted best practice | https://agentskills.io/skill-creation/optimizing-descriptions |
| Claude platform — Best practices | Anthropic-authoritative (adapted) | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices |

Third-person, trigger-oriented descriptions are a widely agreed-upon pattern across all sources. If a user disagrees with a stylistic choice (e.g., third person), cite these and note it's a convention, not a hard enforcement.

### "Should SKILL.md stay concise / under 500 lines?"

| Source | Type | URL |
|--------|------|-----|
| Claude platform — Best practices | Anthropic-authoritative (adapted) | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices |
| Agent Skills — Best practices | Adopted best practice | https://agentskills.io/skill-creation/best-practices |
| Agent Skills — Evaluating skills | Adopted best practice | https://agentskills.io/skill-creation/evaluating-skills |

Conciseness is a best practice, not a hard limit. The 500-line guidance is an adopted convention in this repo. If a user has a skill that genuinely needs more content, the recommendation is progressive disclosure (split into reference files) rather than padding the 500-line rule.

### "Should scripts or resources be split out?"

| Source | Type | URL |
|--------|------|-----|
| Agent Skills — Using scripts | Adopted best practice | https://agentskills.io/skill-creation/using-scripts |
| Agent Skills — Best practices | Adopted best practice | https://agentskills.io/skill-creation/best-practices |
| Claude platform — Best practices | Anthropic-authoritative (adapted) | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices |

### "Which skill directory locations are supported?"

| Source | Type | URL |
|--------|------|-----|
| GitHub Docs — CLI skills | GitHub-documented requirement | https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills |
| GitHub Docs — Cloud agent skills | GitHub-documented requirement | https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills |

### "General skill authoring concepts / how skills work"

| Source | Type | URL |
|--------|------|-----|
| Claude platform — Skills overview | Anthropic-authoritative (adapted) | https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview |
| Copilot Academy workshop | Community guide | https://copilot-academy.github.io/workshops/copilot-customization/agent_skills_developer_guide |
| Agent Skills — Evaluating skills | Adopted best practice | https://agentskills.io/skill-creation/evaluating-skills |

---

## Fetching a Source

If you have live web access, fetch the URL before citing it to confirm:
1. The page still exists and the content matches the claim.
2. The guidance hasn't changed since this file was last updated.

If the page has moved or contradicts this skill's guidance, **update this file** with the new URL or note the discrepancy so future interactions use the correct source.
