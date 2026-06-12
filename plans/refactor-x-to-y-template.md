# Tasks: Refactor x-to-y-migration-prompt-template.md to Generic Template

Goal: make `prompts/x-to-y-migration-prompt-template.md` reusable for any technology migration,
not just the current .NET Local File Logging → OpenTelemetry on Azure example.
Approach: Frontmatter-Driven YAML Config (recommended unanimously by Claude, GPT-5.4, Gemini 3.1 Pro).

---

## Task List

- [ ] **Remove the invocation preamble (lines 1–3)**
  - The opening lines hardcode `Local File Logging`, `OpenTelemetry`, and `open_telemetry_on_azure_knowledge_base`
  - These are caller-supplied values, not part of the reusable template body

- [ ] **Add a YAML frontmatter block** at the top of the file with fields:
  - `source_technology` (replaces `Technology X` / `Local File Logging`)
  - `target_technology` (replaces `Technology Y` / `OpenTelemetry`)
  - `knowledge_base` (replaces `KnowledgeBase Y` / `open_telemetry_on_azure_knowledge_base`)
  - `ecosystem.runtime` (e.g. `dotnet`, `node`, `java`)
  - `ecosystem.project_extension` (e.g. `.csproj`)
  - `ecosystem.package_tool_install` / `package_tool_uninstall`
  - `ecosystem.build_command` / `test_command`
  - `deployment.provider` (e.g. `Azure`)

- [ ] **Normalize placeholder syntax throughout the body**
  - Current state mixes `[Technology X]`, `(Technology X)`, and bare `Technology X`
  - Standardize to a single format, e.g. `[source_technology]` / `[target_technology]`

- [ ] **Replace .NET-specific prose with generic equivalents**
  - `.NET App Migration Prompt Template` → `Technology Migration Prompt Template`
  - `.NET or .NET Framework` → `[ecosystem.runtime]`
  - `.csproj` → `[ecosystem.project_extension]`
  - `net10.0` → remove or make a frontmatter variable

- [ ] **Replace hardcoded tool names with frontmatter references**
  - `nuget_packages_install_latest` → `[ecosystem.package_tool_install]`
  - `nuget_packages_uninstall` → `[ecosystem.package_tool_uninstall]`
  - `dotnet_dependency_management_knowledge_base` → `[knowledge_base]`
  - `dotnet test ... --framework net10.0` → `[ecosystem.test_command]`

- [ ] **Replace Azure hardcoding in the Deployment section**
  - `deploy the project to Azure` → `deploy the project to [deployment.provider]`

- [ ] **Rename the file** from `x-to-y-migration-prompt-template.md`
  to a name that does not imply a specific technology pair
  (e.g. `migration-prompt-template.md`)

- [ ] **Update `README.md` inventory** to add the template as a discoverable artifact
  - Add a row to the Current Inventory table: Type=Prompt, Name, problem it solves, entry point path
  - Add the `prompts/` path to the Repository Map table if not already present
