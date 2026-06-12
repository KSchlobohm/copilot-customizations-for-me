# Tasks: Refactor x-to-y-migration-prompt-template.md to Generic Template

Goal: make `prompts/x-to-y-migration-prompt-template.md` reusable for any technology migration,
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
  - `knowledge_base` (replaces `KnowledgeBase Y` / `open_telemetry_on_azure_knowledge_base`)
  - `ecosystem.runtime` (e.g. `dotnet`, `node`, `java`)
  - `ecosystem.project_extension` (e.g. `.csproj`)
  - `ecosystem.package_tool_install` / `package_tool_uninstall`
  - `ecosystem.build_command` / `test_command`
  - `deployment.provider` (e.g. `Azure`)

- [x] **Normalize placeholder syntax throughout the body**
  - Current state mixes `[Technology X]`, `(Technology X)`, and bare `Technology X`
  - Standardized to `[source_technology]` / `[target_technology]`

- [x] **Replace .NET-specific prose with generic equivalents**
  - `.NET App Migration Prompt Template` → `Technology Migration Prompt Template`
  - `.NET or .NET Framework` → `[ecosystem.runtime]`
  - `.csproj` → `[project_extension]`
  - `net10.0` → removed (moved to frontmatter config)

- [x] **Replace hardcoded tool names with frontmatter references**
  - `nuget_packages_install_latest` → `[package_tool_install]`
  - `nuget_packages_uninstall` → `[package_tool_uninstall]`
  - `dotnet_dependency_management_knowledge_base` → `[package_tool_kb]`
  - `dotnet test ... --framework net10.0` → `[test_command]`

- [x] **Replace Azure hardcoding in the Deployment section**
  - `deploy the project to Azure` → `deploy the project to [deployment.provider]`

- [x] **Create the generic template file** at `prompts/migration-prompt-template.md`
- [x] **Update `README.md` inventory** to add the template as a discoverable artifact
  - Added `prompts/` row to Repository Map
  - Added Prompt entry to Current Inventory table
