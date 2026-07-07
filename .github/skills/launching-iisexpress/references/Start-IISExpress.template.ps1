<#
.SYNOPSIS
    Launches IIS Express for a .NET Framework ASP.NET web project.
.DESCRIPTION
    Generates an IIS Express applicationhost.config for the target project,
    starts IIS Express with that config, and can stop only the process using
    the same generated config and site name.
.PARAMETER Stop
    Stops the IIS Express process for this generated config and site, then exits.
.NOTES
    Skill version: 1.1.0 (see .github/skills/launching-iisexpress/SKILL.md)
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
$blankRootPath = Join-Path $configDir "empty-root"

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

function Test-IISExpressHttpReady {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [Parameter(Mandatory = $true)]
        [string]$Scheme,
        [Parameter(Mandatory = $true)]
        [int]$TimeoutSeconds
    )

    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
        $arguments = @(
            "--silent",
            "--show-error",
            "--output", "NUL",
            "--max-time", "$TimeoutSeconds",
            "--write-out", "%{http_code}"
        )
        if ($Scheme -eq "https") {
            $arguments += "--insecure"
        }
        $arguments += $Url

        $statusCode = & $curl.Source @arguments 2>$null
        if ($LASTEXITCODE -eq 0 -and $statusCode -match "^\d{3}$") {
            return $true
        }

        return $false
    }

    $invokeWebRequestParams = @{
        Uri = $Url
        Method = "GET"
        TimeoutSec = $TimeoutSeconds
        ErrorAction = "Stop"
    }

    if ($PSVersionTable.PSVersion.Major -lt 6) {
        $invokeWebRequestParams["UseBasicParsing"] = $true
    }

    $restoreCertValidationCallback = $false
    $originalCertValidationCallback = $null
    if ($Scheme -eq "https") {
        if ($PSVersionTable.PSVersion.Major -ge 6) {
            $invokeWebRequestParams["SkipCertificateCheck"] = $true
        } else {
            $originalCertValidationCallback = [System.Net.ServicePointManager]::ServerCertificateValidationCallback
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
            $restoreCertValidationCallback = $true
        }
    }

    try {
        Invoke-WebRequest @invokeWebRequestParams | Out-Null
        return $true
    } catch {
        $response = $_.Exception.Response
        if ($response -and $response.StatusCode) {
            return $true
        }

        return $false
    } finally {
        if ($restoreCertValidationCallback) {
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = $originalCertValidationCallback
        }
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

# When the app is hosted at a non-root virtual path, the site root ("/") must
# resolve to a separate, blank physical folder rather than the real app
# folder. If both "/" and the virtual path point at the same folder, IIS
# Express loads that folder's Web.config for two different configuration
# scopes and fails to start with HTTP 500.19.
$isNonRootApp = $applicationPath -ne "/"
if ($isNonRootApp) {
    New-Item -ItemType Directory -Path $blankRootPath -Force | Out-Null
}
$rootPhysicalPath = if ($isNonRootApp) { $blankRootPath } else { $webProjectPath }

$xml = [xml](Get-Content $configPath -Raw)
$site = $xml.SelectSingleNode("//site[@name='WebSite1']")
if (-not $site) {
    throw "Could not find the default 'WebSite1' site in the IIS Express template config."
}

$site.SetAttribute("name", $siteName)
$rootApp = $site.SelectSingleNode("application")
$rootApp.SetAttribute("path", "/")
$rootApp.SetAttribute("applicationPool", "Clr4IntegratedAppPool")
$rootApp.SelectSingleNode("virtualDirectory").SetAttribute("physicalPath", $rootPhysicalPath)

if ($isNonRootApp) {
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
if ($isNonRootApp) {
    Write-Host "Root path ('/'):   $rootPhysicalPath (blank)"
    Write-Host "App path:          $applicationPath -> $webProjectPath"
} else {
    Write-Host "Physical path:     $webProjectPath"
}
Write-Host "URL:               $siteUrl"
Write-Host ""
Write-Host "Launching IIS Express..."

$proc = Start-Process -FilePath $iisExpressExe `
    -ArgumentList "/config:`"$configPath`" /site:`"$siteName`"" `
    -PassThru

Write-Host "IIS Express started (PID $($proc.Id)). Waiting for an HTTP response from $siteUrl..."

$ready = $false
$readinessTimeoutSeconds = 60
$readinessPollIntervalMilliseconds = 500
$readinessProbeTimeoutSeconds = 1
$readinessDeadline = (Get-Date).AddSeconds($readinessTimeoutSeconds)
while ((Get-Date) -lt $readinessDeadline) {
    Start-Sleep -Milliseconds $readinessPollIntervalMilliseconds

    $proc.Refresh()
    if ($proc.HasExited) {
        break
    }

    if (Test-IISExpressHttpReady -Url $siteUrl -Scheme $siteScheme -TimeoutSeconds $readinessProbeTimeoutSeconds) {
        $ready = $true
        break
    }
}

if ($ready) {
    Write-Host "IIS Express is responding at $siteUrl"
} else {
    if ($proc.HasExited) {
        throw "IIS Express exited before responding at $siteUrl. Check the IIS Express logs for startup errors."
    }

    $currentListener = @(Get-PortListener -Port $sitePort)
    if ($currentListener.Count -gt 0) {
        $details = Format-PortListener -Listener $currentListener
        throw "IIS Express did not return an HTTP response from $siteUrl within $readinessTimeoutSeconds seconds. Current listener details:$([Environment]::NewLine)$details"
    }

    throw "IIS Express did not return an HTTP response from $siteUrl within $readinessTimeoutSeconds seconds."
}
