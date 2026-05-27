---
name: launching-iisexpress
description: Launches .NET Framework ASP.NET projects with IIS Express from the command line, mirroring Visual Studio local debugging. Use when the user needs to start, run, test, or verify a legacy ASP.NET MVC, Web API, or Web Forms app locally during migration. Do not use for ASP.NET Core or modern .NET apps; use dotnet run instead.
---

# Launching IIS Express

Start a .NET Framework ASP.NET web project with IIS Express from the terminal by generating a repo-local launch script from the template in this skill.

## Workflow

1. **Check for an existing script**: Look for `Start-IISExpress.ps1` in the solution root or a `scripts/` directory. If one exists, inspect and reuse it when appropriate.
2. **Discover project settings** from the target `.csproj`:
   - Site name: the web project name.
   - Port: `ProjectExtensions > VisualStudio > FlavorProperties > WebProjectProperties > IISUrl`.
   - Web project path: the absolute path to the folder containing `Web.config`.
   - Solution root: the absolute path to the folder containing the `.sln`.
3. **Check the port before launch**:
   - Use `Get-NetTCPConnection -LocalPort <port> -State Listen` to detect local listeners. Do not use `Test-NetConnection`; it tests reachability, not bind availability.
   - Treat any listener on the same port as a conflict, including `0.0.0.0`, `127.0.0.1`, `::1`, or another local address.
   - If the listener is `iisexpress.exe`, only treat it as this skill's instance when its command line matches both `/config:"<solution-root>\.vs\config\applicationhost.config"` and `/site:"<site-name>"`.
   - For unrelated listeners, report the current port, PID, process name, and command line when available.
4. **Resolve port conflicts with approval**:
   - Ask before changing `.csproj` or stopping unrelated processes.
   - Propose a free replacement port and re-check it immediately before writing.
   - For `https://localhost:<port>`, prefer the IIS Express SSL-friendly `44300-44399` range unless the user chooses otherwise.
   - For `http://localhost:<port>`, prefer a nearby free localhost port unless the user chooses otherwise.
   - Update only the port in `ProjectExtensions > VisualStudio > FlavorProperties > WebProjectProperties > IISUrl`; preserve the scheme, host, path, encoding, BOM, and line endings. Legacy `.csproj` files usually use the MSBuild XML namespace, so namespace-aware XML handling is required if editing structurally.
5. **Create the script**: Copy `references/Start-IISExpress.template.ps1` to the solution root as `Start-IISExpress.ps1`, then replace these placeholders:

| Placeholder | Replace with |
|---|---|
| `{{SITE_NAME}}` | Project/site name |
| `{{SITE_PORT}}` | Port from `IISUrl`, or the approved replacement port |
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
curl http://localhost:<port>/
```

9. **Stop the launched site**:

```powershell
.\Start-IISExpress.ps1 -Stop
```

## Notes

- IIS Express is usually installed at `C:\Program Files\IIS Express\iisexpress.exe`.
- The template writes `.vs/config/applicationhost.config` under the solution root and configures `Clr4IntegratedAppPool`.
- Stop only the IIS Express process launched for the generated config/site. Do not kill all `iisexpress.exe` processes by name.
- Visual Studio can regenerate `.vs/config/applicationhost.config`; keep `.csproj` `IISUrl` aligned so future generated configs use the approved port.
- If multiple web projects exist, scope edits and process checks to the single target project/site.
