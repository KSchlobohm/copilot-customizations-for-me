# Tasks: Refactor migration-prompt-template.md to Generic Template

Goal: make `prompts/migration-prompt-template.md` reusable for any technology migration,
not just the current .NET Local File Logging → OpenTelemetry on Azure example.
Approach: Frontmatter-Driven YAML Config (recommended unanimously by Claude, GPT-5.4, Gemini 3.1 Pro).

---

## Task List

- [x] **Remove the invocation preamble (lines 1–3)**
  - The opening lines hardcode `Local File Logging`, `OpenTelemetry`, and `open_telemetry_on_azure_knowledge_base`
  - These are caller-supplied values, not part of the reusable template body

- [x] **Add a YAML frontmatter block** at the top of the file with fields:
  - `source_technology` (replaces `Technology X` / `Local File Logging`)
  - `target_technology` (replaces `Technology Y` / `OpenTelemetry`)
  - Final implementation intentionally stops there: the earlier idea to add `knowledge_base`, `ecosystem.*`, and `deployment.*` fields was not carried forward.
  - Rationale: those extra fields created avoidable friction by forcing callers to encode tool/runtime details that the model can usually infer from the repository and natural-language instructions.
  - The template now relies on the simplified frontmatter plus generic body guidance instead of a larger schema.

- [x] **Normalize placeholder syntax throughout the body**
  - Current state mixes `[Technology X]`, `(Technology X)`, and bare `Technology X`
  - Standardized to `[source_technology]` / `[target_technology]`

- [x] **Replace .NET-specific prose with generic equivalents**
  - `.NET App Migration Prompt Template` → `Technology Migration Prompt Template`
  - Ecosystem-specific examples were rewritten into generic guidance in the body rather than being moved into new frontmatter keys
  - Tooling, runtime, and test/build details are intentionally described in natural language so the caller does not need to predeclare them in YAML

- [x] **Remove hardcoded ecosystem/tool assumptions**
  - Removed hardcoded NuGet/.NET-specific tool references instead of replacing them with new frontmatter fields
  - Replaced those specifics with generic instructions to detect the project's package manager, build system, and test runner from the repository

- [x] **Remove Azure-specific deployment assumptions**
  - Deployment guidance now stays out of scope rather than introducing a `deployment.provider` field

- [x] **Create the generic template file** at `prompts/migration-prompt-template.md`
- [x] **Update `README.md` inventory** to add the template as a discoverable artifact
  - Added `prompts/` row to Repository Map
  - Added Prompt entry to Current Inventory table
