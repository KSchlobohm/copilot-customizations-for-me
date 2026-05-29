<#
.SYNOPSIS
    Launches IIS Express for a .NET Framework ASP.NET web project.
.DESCRIPTION
    Generates an IIS Express applicationhost.config for the target project,
    starts IIS Express with that config, and can stop only the process using
    the same generated config and site name.
.PARAMETER Stop
    Stops the IIS Express process for this generated config and site, then exits.
#>
param(
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'

$siteName = "{{SITE_NAME}}"
$sitePort = {{SITE_PORT}}
$siteScheme = "{{SITE_SCHEME}}"
$siteHost = "{{SITE_HOST}}"
$applicationPath = "{{APPLICATION_PATH}}"
$webProjectPath = "{{WEB_PROJECT_PATH}}"
$solutionRoot = "{{SOLUTION_ROOT}}"

$configDir = Join-Path $solutionRoot ".vs\config"
$configPath = Join-Path $configDir "applicationhost.config"

function Get-IISExpressInstallRoot {
    $candidateRoots = @(
        $(if ($env:ProgramFiles) { Join-Path $env:ProgramFiles "IIS Express" }),
        $(if (${env:ProgramFiles(x86)}) { Join-Path ${env:ProgramFiles(x86)} "IIS Express" })
    ) | Where-Object { $_ } | Select-Object -Unique

    foreach ($candidateRoot in $candidateRoots) {
        $candidateExe = Join-Path $candidateRoot "iisexpress.exe"
        $candidateTemplate = Join-Path $candidateRoot "config\templates\PersonalWebServer\applicationhost.config"

        if ((Test-Path $candidateExe) -and (Test-Path $candidateTemplate)) {
            return $candidateRoot
        }
    }

    throw "Unable to locate IIS Express. Checked: $($candidateRoots -join ', '). Ensure IIS Express is installed, or update the script to point to the correct install location."
}

$iisExpressRoot = Get-IISExpressInstallRoot
$iisExpressExe = Join-Path $iisExpressRoot "iisexpress.exe"
$templatePath = Join-Path $iisExpressRoot "config\templates\PersonalWebServer\applicationhost.config"

function Test-GeneratedIISExpressCommandLine {
    param(
        [Parameter(Mandatory = $true)]
        [string]$CommandLine
    )

    $escapedConfigPath = [regex]::Escape($configPath)
    $escapedSiteName = [regex]::Escape($siteName)

    return $CommandLine -match "(?i)/config:\s*`"?$escapedConfigPath`"?" -and
        $CommandLine -match "(?i)/site:\s*`"?$escapedSiteName`"?"
}

function Get-GeneratedIISExpressProcess {
    Get-CimInstance Win32_Process -Filter "Name = 'iisexpress.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and (Test-GeneratedIISExpressCommandLine -CommandLine $_.CommandLine) }
}

function Get-PortListener {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    try {
        Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    } catch {
        throw "Unable to check whether port $Port is available: $($_.Exception.Message)"
    }
}

function Get-ProcessSummary {
    param(
        [Parameter(Mandatory = $true)]
        [int]$ProcessId
    )

    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if ($process) {
        return "PID $ProcessId ($($process.Name)): $($process.CommandLine)"
    }

    $fallback = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($fallback) {
        return "PID $ProcessId ($($fallback.ProcessName))"
    }

    return "PID $ProcessId"
}

function Format-PortListener {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Listener
    )

    ($Listener |
        Select-Object -ExpandProperty OwningProcess |
        Sort-Object -Unique |
        ForEach-Object { Get-ProcessSummary -ProcessId $_ }) -join [Environment]::NewLine
}

if ($siteScheme -notin @("http", "https")) {
    throw "Unsupported IIS Express scheme '$siteScheme'. Expected 'http' or 'https'."
}
if ([string]::IsNullOrWhiteSpace($siteHost)) {
    throw "Site host must not be empty."
}
if ($siteHost -ne "localhost") {
    Write-Warning "Site host '$siteHost' is not 'localhost'. IIS Express rejects non-localhost host headers by default unless explicitly configured and run elevated."
}
if ($siteScheme -eq "https" -and ($sitePort -lt 44300 -or $sitePort -gt 44399)) {
    throw "HTTPS port $sitePort is outside the IIS Express SSL-friendly range 44300-44399. Either pick a port in that range or manually register an SSL cert binding (netsh http add sslcert) before launching."
}
if ([string]::IsNullOrWhiteSpace($applicationPath)) {
    $applicationPath = "/"
}
if (-not $applicationPath.StartsWith("/")) {
    $applicationPath = "/$applicationPath"
}

$siteUrl = "{0}://{1}:{2}{3}" -f $siteScheme, $siteHost, $sitePort, $applicationPath

$existing = Get-GeneratedIISExpressProcess
if ($existing) {
    Write-Host "Stopping the IIS Express instance previously launched for site '$siteName' so this run can take over..."
    $existing | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Start-Sleep -Seconds 1
} elseif ($Stop) {
    Write-Host "No matching IIS Express process found for site '$siteName'."
}

if ($Stop) {
    return
}

if (-not (Test-Path $webProjectPath)) {
    throw "Web project not found at: $webProjectPath"
}
if (-not (Test-Path $iisExpressExe)) {
    throw "IIS Express not found at: $iisExpressExe"
}
if (-not (Test-Path $templatePath)) {
    throw "IIS Express template not found at: $templatePath"
}

$conflictingListener = @(Get-PortListener -Port $sitePort)
if ($conflictingListener.Count -gt 0) {
    $details = Format-PortListener -Listener $conflictingListener
    throw "Port $sitePort is already in use. Choose a free port, update the project's IISUrl, regenerate this script, and try again.$([Environment]::NewLine)$details"
}

Write-Host "Preparing applicationhost.config..."
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
Copy-Item $templatePath $configPath -Force

$xml = [xml](Get-Content $configPath -Raw)
$site = $xml.SelectSingleNode("//site[@name='WebSite1']")
if (-not $site) {
    throw "Could not find the default 'WebSite1' site in the IIS Express template config."
}

$site.SetAttribute("name", $siteName)
$rootApp = $site.SelectSingleNode("application")
$rootApp.SetAttribute("path", "/")
$rootApp.SetAttribute("applicationPool", "Clr4IntegratedAppPool")
$rootApp.SelectSingleNode("virtualDirectory").SetAttribute("physicalPath", $webProjectPath)

if ($applicationPath -ne "/") {
    $subApp = $rootApp.CloneNode($true)
    $subApp.SetAttribute("path", $applicationPath)
    $subApp.SetAttribute("applicationPool", "Clr4IntegratedAppPool")
    $subApp.SelectSingleNode("virtualDirectory").SetAttribute("physicalPath", $webProjectPath)
    $rootApp.ParentNode.AppendChild($subApp) | Out-Null
}

$binding = $site.SelectSingleNode("bindings/binding")
$binding.SetAttribute("protocol", $siteScheme)
$binding.SetAttribute("bindingInformation", "*:${sitePort}:$siteHost")

$xml.Save($configPath)

Write-Host "Config written to: $configPath"
Write-Host "Physical path:     $webProjectPath"
Write-Host "URL:               $siteUrl"
Write-Host ""
Write-Host "Launching IIS Express..."

$proc = Start-Process -FilePath $iisExpressExe `
    -ArgumentList "/config:`"$configPath`" /site:`"$siteName`"" `
    -PassThru

Write-Host "IIS Express started (PID $($proc.Id)). Waiting for it to listen on port $sitePort..."

$ready = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500

    $proc.Refresh()
    if ($proc.HasExited) {
        break
    }

    $listener = @(Get-PortListener -Port $sitePort | Where-Object { $_.OwningProcess -eq $proc.Id })
    if ($listener.Count -gt 0) {
        $ready = $true
        break
    }
}

if ($ready) {
    Write-Host "IIS Express is listening on $siteUrl"
} else {
    $currentListener = @(Get-PortListener -Port $sitePort)
    if ($currentListener.Count -gt 0) {
        $details = Format-PortListener -Listener $currentListener
        throw "IIS Express did not own port $sitePort after launch. Current listener details:$([Environment]::NewLine)$details"
    }

    if ($proc.HasExited) {
        throw "IIS Express exited before listening on $siteUrl. Check the IIS Express logs for startup errors."
    }

    throw "IIS Express did not start listening on $siteUrl within the expected time."
}
