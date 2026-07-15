---
name: launching-iisexpress
version: 1.1.1
description: Launches .NET Framework ASP.NET projects with IIS Express from the command line, mirroring Visual Studio local debugging. Use when the user needs to start, run, debug, test, or verify a .NET Framework ASP.NET MVC, Web API, or Web Forms app locally, especially during migration. Do not use for ASP.NET Core or modern .NET apps; use dotnet run instead.
---

# Launching IIS Express

Start a .NET Framework ASP.NET web project with IIS Express from the terminal by generating a repo-local launch script from the template in this skill.

## Workflow

1. **Verify the installed release**: Resolve the installed `launching-iisexpress` skill directory, then run its verifier before using its template:

   ```powershell
   node <installed-skill-dir>\verify.mjs --skill-dir <installed-skill-dir>
   ```

   Stop if this fails. The verifier requires the installed `SKILL.md` version to match this release and the behavioral template's normalized SHA-256 fingerprint to match the canonical v1.1.1 contract. It intentionally does not hash `SKILL.md`, so repo-local workflow clarification can coexist with an exact canonical template.
2. **Check generated-script provenance**: Look for `Start-IISExpress.ps1` in the solution root or a `scripts/` directory.
   - If no script exists, generate one in step 6.
   - If a script exists, validate its machine-readable marker:

     ```powershell
     node <installed-skill-dir>\verify.mjs --skill-dir <installed-skill-dir> --generated-script <path-to-Start-IISExpress.ps1>
     ```

   - If the marker is absent or its version is older than the installed skill, do not launch or patch the stale script. Replace it by regenerating from the installed template in step 6.
   - If the generated script reports a newer version than the installed skill, stop and update the installed skill instead of downgrading the script.
   - Reuse an exact-version script only after confirming its generated project settings still match the target project. Regenerate it when it lacks port conflict checks, `/config` + `/site` process matching, or URL scheme/host/path alignment.
3. **Discover project settings** from the target `.csproj`:
   - Site name: the web project name.
   - URL parts: scheme, host, port, and path from `ProjectExtensions > VisualStudio > FlavorProperties > WebProjectProperties > IISUrl`.
   - Web project path: the absolute path to the folder containing `Web.config`.
   - Solution root: the absolute path to the folder containing the `.sln`.
4. **Check the port before launch**:
   - Use `Get-NetTCPConnection -LocalPort <port> -State Listen` to detect local listeners. Do not use `Test-NetConnection`; it tests reachability, not bind availability.
   - Treat any listener on the same port as a conflict, including `0.0.0.0`, `127.0.0.1`, `::1`, or another local address.
   - If the listener is `iisexpress.exe`, only treat it as this skill's instance when its command line matches both `/config:"<solution-root>\.vs\config\applicationhost.config"` and `/site:"<site-name>"`.
   - For unrelated listeners, report the current port, PID, process name, and command line when available.
5. **Resolve port conflicts with approval**:
   - Ask before changing `.csproj` or stopping unrelated processes.
   - Propose a free replacement port and re-check it immediately before writing.
   - For `https://localhost:<port>`, scan the IIS Express SSL-friendly `44300..44399` range unless the user chooses otherwise.
   - For `http://localhost:<port>`, scan nearby ports first, then a practical local range such as `5000..65000`.
   - A candidate port is free when `Get-NetTCPConnection -LocalPort <candidate> -State Listen` returns no listeners.
   - Update only the port in `ProjectExtensions > VisualStudio > FlavorProperties > WebProjectProperties > IISUrl`; preserve the scheme, host, path, encoding, BOM, and line endings. Legacy `.csproj` files usually use the MSBuild XML namespace, so namespace-aware XML handling is required if editing structurally.
6. **Generate or replace the script**: Read `<installed-skill-dir>/references/Start-IISExpress.template.ps1`, replace every placeholder in memory, and write the complete result to the solution root as `Start-IISExpress.ps1`. Do not modify a stale generated script in place. The template's `IISExpressSkill-Provenance` marker is literal release metadata and must remain unchanged.

| Placeholder | Replace with |
|---|---|
| `{{SITE_NAME}}` | Project/site name |
| `{{SITE_PORT}}` | Port from `IISUrl`, or the approved replacement port |
| `{{SITE_SCHEME}}` | Scheme from `IISUrl`, usually `http` or `https` |
| `{{SITE_HOST}}` | Host from `IISUrl`, usually `localhost` |
| `{{APPLICATION_PATH}}` | Path from `IISUrl`, or `/` when omitted |
| `{{WEB_PROJECT_PATH}}` | Absolute web project directory |
| `{{SOLUTION_ROOT}}` | Absolute solution root |

   Use exact literal placeholder replacement so Windows paths and the application path are preserved:

   ```powershell
   $rendered = Get-Content "<installed-skill-dir>\references\Start-IISExpress.template.ps1" -Raw
   function ConvertTo-PowerShellSingleQuotedContent {
       param([AllowEmptyString()][string]$Value)
       $Value.Replace("'", "''")
   }
   $replacements = [ordered]@{
       "{{SITE_NAME}}" = (ConvertTo-PowerShellSingleQuotedContent "<site-name>")
       "{{SITE_PORT}}" = "<port>"
       "{{SITE_SCHEME}}" = (ConvertTo-PowerShellSingleQuotedContent "<scheme>")
       "{{SITE_HOST}}" = (ConvertTo-PowerShellSingleQuotedContent "<host>")
       "{{APPLICATION_PATH}}" = (ConvertTo-PowerShellSingleQuotedContent "<application-path>")
       "{{WEB_PROJECT_PATH}}" = (ConvertTo-PowerShellSingleQuotedContent "<absolute-web-project-path>")
       "{{SOLUTION_ROOT}}" = (ConvertTo-PowerShellSingleQuotedContent "<absolute-solution-root>")
   }
   foreach ($entry in $replacements.GetEnumerator()) {
       $rendered = $rendered.Replace($entry.Key, $entry.Value)
   }
   if ($rendered -match "\{\{[A-Z_]+\}\}") {
       throw "Generated IIS Express script still contains unresolved placeholders."
   }
   [System.IO.File]::WriteAllText(
       (Join-Path "<absolute-solution-root>" "Start-IISExpress.ps1"),
       $rendered,
       [System.Text.UTF8Encoding]::new($false)
   )
   ```

   Re-run the generated-script verifier from step 2 after writing the file.
7. **Restore and build** before launch:

```powershell
msbuild <solution-path> /t:Restore /p:RestorePackagesConfig=true
msbuild <solution-path> /p:Configuration=Debug
```

8. **Launch IIS Express**:

```powershell
.\Start-IISExpress.ps1
```

The generated script writes `.vs/config/applicationhost.config` with the selected port, starts IIS Express with `Start-Process`, and returns control to the terminal after confirming the site responds over HTTP. IIS Express reads the binding from `applicationhost.config`; `.csproj` `IISUrl` is the durable project setting for future runs and Visual Studio alignment.

9. **Verify** with the discovered or approved URL:

```powershell
curl <scheme>://<host>:<port><path>
```

For HTTPS localhost URLs, certificate trust warnings can be expected on some machines; use the equivalent curl option for ignoring certificate validation only when the user accepts that local-only tradeoff.

10. **Stop the launched site**:

```powershell
.\Start-IISExpress.ps1 -Stop
```

## Notes

- IIS Express is usually installed at `C:\Program Files\IIS Express\iisexpress.exe`.
- The template writes `.vs/config/applicationhost.config` under the solution root and configures `Clr4IntegratedAppPool`.
- Re-running `Start-IISExpress.ps1` automatically stops the IIS Express instance previously launched for the same generated config/site, so the new run can take over. It does not affect IIS Express processes from other sites or solutions.
- Stop only the IIS Express process launched for the generated config/site. Do not kill all `iisexpress.exe` processes by name.
- IIS Express HTTP listeners can appear as `OwningProcess = 4` (`System`) because of HTTP.SYS. Do not use `Get-NetTCPConnection` ownership (`OwningProcess == iisexpress PID`) as a readiness check; use an HTTP-level probe to confirm startup.
- The template probes readiness for up to 60 seconds to accommodate slow startup work (for example, database seeding) and still fail within a bounded time.
- For HTTPS readiness probing, the template handles local development certificate trust differences across Windows PowerShell and PowerShell 7 so startup does not false-fail when the app is up.
- Visual Studio can regenerate `.vs/config/applicationhost.config`; keep `.csproj` `IISUrl` aligned so future generated configs use the approved port.
- If multiple web projects exist, scope edits and process checks to the single target project/site.
- IIS Express rejects non-`localhost` host headers by default unless run elevated and explicitly configured; keep `IISUrl` host as `localhost` unless the user has set up otherwise.
- For HTTPS, the template enforces ports in the IIS Express SSL-friendly `44300-44399` range. Other HTTPS ports require a manual `netsh http add sslcert` binding and will be rejected at launch.
- When `IISUrl` includes a virtual path (for example `http://localhost:6001/MyApp`), the template adds a second application at the virtual path pointing at the real project folder, and maps the root `/` application to a separate, blank folder (`.vs/config/empty-root`) so both applications can coexist without a physical-path collision.

## Troubleshooting: HTTP 500.19 on non-root virtual paths

**Symptom:** IIS Express fails to start (or a request fails) with HTTP 500.19 immediately after launch, even though the app code itself is fine, and only reproduces when `IISUrl` includes a virtual path segment (for example `/MyApp`).

**Root cause:** the site root (`/`) and the non-root virtual path both resolved to the same physical folder. IIS Express then loads that folder's `Web.config` for two different configuration scopes (`/` and `/MyApp`), which collide and produce a 500.19 configuration error.

**Detection:** inspect the generated `.vs/config/applicationhost.config` for the site and confirm the `application path="/"` and `application path="<virtual path>"` elements point at **different** `physicalPath` values. If they match, that's the bug.

**Remediation:** regenerate `Start-IISExpress.ps1` from the current template in this skill (`references/Start-IISExpress.template.ps1`, version 1.1.1+). The template points the root application at a blank, empty folder and only maps the virtual path to the real project folder. Do not hand-edit an existing generated config or stale generated script to "fix" this in place - regenerate from the installed template so the fix persists across future regenerations.

## Versioning

This skill (`SKILL.md` + `references/Start-IISExpress.template.ps1`) is the canonical upstream copy. Other locations that keep their own copy of this skill should treat this repository as the source of truth and sync from it rather than diverging independently.

- The `version` field in the frontmatter follows semantic versioning and must be bumped whenever the skill's workflow or template behavior changes.
- Before copying this skill elsewhere, run `node .github/skills/launching-iisexpress/verify.mjs`. The verifier checks both release version and the normalized SHA-256 fingerprint of `references/Start-IISExpress.template.ps1`; version equality alone is not sufficient.
- Downstream repositories may customize `SKILL.md` instructions while retaining the canonical `version` frontmatter. The verifier hashes the behavioral template, not the customizable prose.
- After generation, pass `--generated-script <path>` to detect scripts with missing, stale, or newer provenance before launch.
- When porting a fix here, bump the version and summarize the change in the pull request description.
