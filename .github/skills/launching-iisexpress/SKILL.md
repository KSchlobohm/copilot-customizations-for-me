---
name: launching-iisexpress
description: Launches .NET Framework ASP.NET projects with IIS Express from the command line, mirroring Visual Studio local debugging. Use when the user needs to start, run, debug, test, or verify a .NET Framework ASP.NET MVC, Web API, or Web Forms app locally, especially during migration. Do not use for ASP.NET Core or modern .NET apps; use dotnet run instead.
---

# Launching IIS Express

Start a .NET Framework ASP.NET web project with IIS Express from the terminal by generating a repo-local launch script from the template in this skill.

## Workflow

1. **Check for an existing script**: Look for `Start-IISExpress.ps1` in the solution root or a `scripts/` directory. If one exists, inspect and reuse it when appropriate.
2. **Discover project settings** from the target `.csproj`:
   - Site name: the web project name.
   - URL parts: scheme, host, port, and path from `ProjectExtensions > VisualStudio > FlavorProperties > WebProjectProperties > IISUrl`.
   - Web project path: the absolute path to the folder containing `Web.config`.
   - Solution root: the absolute path to the folder containing the `.sln`.
   - If reusing an existing launch script, update or regenerate it when it lacks port conflict checks, `/config` + `/site` process matching, or URL scheme/host/path alignment.
3. **Check the port before launch**:
   - Use `Get-NetTCPConnection -LocalPort <port> -State Listen` to detect local listeners. Do not use `Test-NetConnection`; it tests reachability, not bind availability.
   - Treat any listener on the same port as a conflict, including `0.0.0.0`, `127.0.0.1`, `::1`, or another local address.
   - If the listener is `iisexpress.exe`, only treat it as this skill's instance when its command line matches both `/config:"<solution-root>\.vs\config\applicationhost.config"` and `/site:"<site-name>"`.
   - For unrelated listeners, report the current port, PID, process name, and command line when available.
4. **Resolve port conflicts with approval**:
   - Ask before changing `.csproj` or stopping unrelated processes.
   - Propose a free replacement port and re-check it immediately before writing.
   - For `https://localhost:<port>`, scan the IIS Express SSL-friendly `44300..44399` range unless the user chooses otherwise.
   - For `http://localhost:<port>`, scan nearby ports first, then a practical local range such as `5000..65000`.
   - A candidate port is free when `Get-NetTCPConnection -LocalPort <candidate> -State Listen` returns no listeners.
   - Update only the port in `ProjectExtensions > VisualStudio > FlavorProperties > WebProjectProperties > IISUrl`; preserve the scheme, host, path, encoding, BOM, and line endings. Legacy `.csproj` files usually use the MSBuild XML namespace, so namespace-aware XML handling is required if editing structurally.
5. **Create the script**: Copy `.github/skills/launching-iisexpress/references/Start-IISExpress.template.ps1` to the solution root as `Start-IISExpress.ps1`, then replace these placeholders:

| Placeholder | Replace with |
|---|---|
| `{{SITE_NAME}}` | Project/site name |
| `{{SITE_PORT}}` | Port from `IISUrl`, or the approved replacement port |
| `{{SITE_SCHEME}}` | Scheme from `IISUrl`, usually `http` or `https` |
| `{{SITE_HOST}}` | Host from `IISUrl`, usually `localhost` |
| `{{APPLICATION_PATH}}` | Path from `IISUrl`, or `/` when omitted |
| `{{WEB_PROJECT_PATH}}` | Absolute web project directory |
| `{{SOLUTION_ROOT}}` | Absolute solution root |

6. **Restore and build** before launch:

```powershell
msbuild <solution-path> /t:Restore /p:RestorePackagesConfig=true
msbuild <solution-path> /p:Configuration=Debug
```

7. **Launch IIS Express**:

```powershell
.\Start-IISExpress.ps1
```

The generated script writes `.vs/config/applicationhost.config` with the selected port, starts IIS Express with `Start-Process`, and returns control to the terminal after confirming the site is listening. IIS Express reads the binding from `applicationhost.config`; `.csproj` `IISUrl` is the durable project setting for future runs and Visual Studio alignment.

8. **Verify** with the discovered or approved URL:

```powershell
curl <scheme>://<host>:<port><path>
```

For HTTPS localhost URLs, certificate trust warnings can be expected on some machines; use the equivalent curl option for ignoring certificate validation only when the user accepts that local-only tradeoff.

9. **Stop the launched site**:

```powershell
.\Start-IISExpress.ps1 -Stop
```

## Notes

- IIS Express is usually installed at `C:\Program Files\IIS Express\iisexpress.exe`.
- The template writes `.vs/config/applicationhost.config` under the solution root and configures `Clr4IntegratedAppPool`.
- Re-running `Start-IISExpress.ps1` automatically stops the IIS Express instance previously launched for the same generated config/site, so the new run can take over. It does not affect IIS Express processes from other sites or solutions.
- Stop only the IIS Express process launched for the generated config/site. Do not kill all `iisexpress.exe` processes by name.
- Visual Studio can regenerate `.vs/config/applicationhost.config`; keep `.csproj` `IISUrl` aligned so future generated configs use the approved port.
- If multiple web projects exist, scope edits and process checks to the single target project/site.
- IIS Express rejects non-`localhost` host headers by default unless run elevated and explicitly configured; keep `IISUrl` host as `localhost` unless the user has set up otherwise.
- For HTTPS, the template enforces ports in the IIS Express SSL-friendly `44300-44399` range. Other HTTPS ports require a manual `netsh http add sslcert` binding and will be rejected at launch.
- When `IISUrl` includes a virtual path (for example `http://localhost:6001/MyApp`), the template keeps the root `/` application and adds a second application at the virtual path so requests to `/` and `/MyApp` both work.
