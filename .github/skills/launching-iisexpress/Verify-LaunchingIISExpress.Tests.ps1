<#
.SYNOPSIS
    Runs dependency-free regression tests for launching-iisexpress v1.1.2.
.DESCRIPTION
    Execute with Windows PowerShell or PowerShell 7. No Pester installation or
    other external module is required.
#>

$ErrorActionPreference = "Stop"

$skillDirectory = $PSScriptRoot
$templatePath = Join-Path $skillDirectory "references\Start-IISExpress.template.ps1"
$verifierPath = Join-Path $skillDirectory "Verify-LaunchingIISExpress.ps1"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
    "launching-iisexpress-{0}" -f [guid]::NewGuid().ToString("N")
)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:passed = 0
$script:failed = 0

function Assert-True {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Assert-Equal {
    param(
        $Actual,
        $Expected,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if ($Actual -ne $Expected) {
        throw "$Message Expected '$Expected', got '$Actual'."
    }
}

function Assert-Match {
    param(
        [AllowEmptyString()]
        [string]$Actual,
        [Parameter(Mandatory = $true)]
        [string]$Pattern,
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if ($Actual -notmatch $Pattern) {
        throw "$Message Pattern '$Pattern' did not match '$Actual'."
    }
}

function Invoke-Test {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Body
    )

    try {
        & $Body
        $script:passed++
        Write-Host "PASS: $Name"
    } catch {
        $script:failed++
        Write-Host "FAIL: $Name"
        Write-Host "      $($_.Exception.Message)"
    }
}

function Get-PowerShellExecutable {
    $currentProcess = Get-Process -Id $PID
    if ($currentProcess.Path) {
        return $currentProcess.Path
    }

    $candidate = if ($PSVersionTable.PSEdition -eq "Core") {
        Join-Path $PSHOME "pwsh.exe"
    } else {
        Join-Path $PSHOME "powershell.exe"
    }
    if (-not (Test-Path -LiteralPath $candidate)) {
        throw "Unable to locate the current PowerShell executable."
    }
    return $candidate
}

function Invoke-PowerShellFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [string[]]$Arguments = @(),
        [hashtable]$Environment = @{}
    )

    $savedEnvironment = @{}
    foreach ($entry in $Environment.GetEnumerator()) {
        $savedEnvironment[$entry.Key] = [System.Environment]::GetEnvironmentVariable(
            $entry.Key,
            [System.EnvironmentVariableTarget]::Process
        )
        [System.Environment]::SetEnvironmentVariable(
            $entry.Key,
            $entry.Value,
            [System.EnvironmentVariableTarget]::Process
        )
    }

    try {
        $output = & $script:powerShellExecutable `
            -NoProfile `
            -NonInteractive `
            -ExecutionPolicy Bypass `
            -File $Path `
            @Arguments 2>&1
        return [pscustomobject]@{
            ExitCode = $LASTEXITCODE
            Output = ($output | Out-String).Trim()
        }
    } finally {
        foreach ($entry in $savedEnvironment.GetEnumerator()) {
            [System.Environment]::SetEnvironmentVariable(
                $entry.Key,
                $entry.Value,
                [System.EnvironmentVariableTarget]::Process
            )
        }
    }
}

function ConvertTo-PowerShellSingleQuotedContent {
    param(
        [AllowEmptyString()]
        [string]$Value
    )

    return $Value.Replace("'", "''")
}

function Render-Template {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Template,
        [Parameter(Mandatory = $true)]
        [System.Collections.IDictionary]$Replacements
    )

    $escapedReplacements = [ordered]@{}
    foreach ($entry in $Replacements.GetEnumerator()) {
        $escapedReplacements[$entry.Key] = if ($entry.Key -eq "{{SITE_PORT}}") {
            [string]$entry.Value
        } else {
            ConvertTo-PowerShellSingleQuotedContent -Value ([string]$entry.Value)
        }
    }

    return [regex]::Replace(
        $Template,
        "\{\{[A-Z_]+\}\}",
        {
            param($match)
            if (-not $escapedReplacements.Contains($match.Value)) {
                throw "Unknown IIS Express template placeholder: $($match.Value)"
            }
            [string]$escapedReplacements[$match.Value]
        }
    )
}

function New-RenderedFixture {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$ApplicationPath
    )

    $fixtureRoot = Join-Path $tempRoot $Name
    $solutionRoot = Join-Path $fixtureRoot "solution"
    $webProjectPath = Join-Path $solutionRoot "WebProject"
    $programFiles = Join-Path $fixtureRoot "Program Files"
    $iisExpressRoot = Join-Path $programFiles "IIS Express"
    $iisTemplateDirectory = Join-Path $iisExpressRoot "config\templates\PersonalWebServer"
    New-Item -ItemType Directory -Path $webProjectPath -Force | Out-Null
    New-Item -ItemType Directory -Path $iisTemplateDirectory -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $iisExpressRoot "iisexpress.exe"), "", $utf8NoBom)

    $iisTemplate = @'
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.applicationHost>
    <sites>
      <site name="WebSite1" id="1">
        <application path="/">
          <virtualDirectory path="/" physicalPath="C:\placeholder" />
        </application>
        <bindings>
          <binding protocol="http" bindingInformation="*:8080:localhost" />
        </bindings>
      </site>
    </sites>
  </system.applicationHost>
</configuration>
'@
    [System.IO.File]::WriteAllText(
        (Join-Path $iisTemplateDirectory "applicationhost.config"),
        $iisTemplate,
        $utf8NoBom
    )

    $template = [System.IO.File]::ReadAllText($templatePath)
    $replacements = [ordered]@{
        "{{SITE_NAME}}" = "WebProject"
        "{{SITE_PORT}}" = "65431"
        "{{SITE_SCHEME}}" = "http"
        "{{SITE_HOST}}" = "localhost"
        "{{APPLICATION_PATH}}" = $ApplicationPath
        "{{WEB_PROJECT_PATH}}" = $webProjectPath
        "{{SOLUTION_ROOT}}" = $solutionRoot
    }
    $rendered = Render-Template -Template $template -Replacements $replacements
    $scriptPath = Join-Path $solutionRoot "Start-IISExpress.ps1"
    [System.IO.File]::WriteAllText($scriptPath, $rendered, $utf8NoBom)

    $execution = Invoke-PowerShellFile `
        -Path $scriptPath `
        -Arguments @("-PrepareConfigOnly") `
        -Environment @{
            "ProgramFiles" = $programFiles
            "ProgramFiles(x86)" = ""
        }
    Assert-Equal `
        -Actual $execution.ExitCode `
        -Expected 0 `
        -Message "Rendered template execution failed: $($execution.Output)"

    return [pscustomobject]@{
        ConfigPath = Join-Path $solutionRoot ".vs\config\applicationhost.config"
        ScriptPath = $scriptPath
        SolutionRoot = $solutionRoot
        WebProjectPath = $webProjectPath
    }
}

function Get-ApplicationMappings {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath
    )

    $xml = [xml][System.IO.File]::ReadAllText($ConfigPath)
    $site = $xml.SelectSingleNode("//site")
    return @($site.SelectNodes("application") | ForEach-Object {
        [pscustomobject]@{
            Path = $_.GetAttribute("path")
            PhysicalPath = $_.SelectSingleNode("virtualDirectory").GetAttribute("physicalPath")
        }
    })
}

function Invoke-Verifier {
    param(
        [string]$SkillDirectory = $skillDirectory,
        [string]$GeneratedScript
    )

    $arguments = @("-SkillDirectory", $SkillDirectory, "-AsJson")
    if ($GeneratedScript) {
        $arguments += @("-GeneratedScript", $GeneratedScript)
    }
    return Invoke-PowerShellFile -Path $verifierPath -Arguments $arguments
}

$script:powerShellExecutable = Get-PowerShellExecutable
New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null

try {
    Invoke-Test "canonical verifier permits local SKILL prose but rejects template drift" {
        $fixtureSkill = Join-Path $tempRoot "customized-skill"
        New-Item -ItemType Directory -Path (Join-Path $fixtureSkill "references") -Force |
            Out-Null
        Copy-Item -LiteralPath $templatePath `
            -Destination (Join-Path $fixtureSkill "references\Start-IISExpress.template.ps1")
        $skillMarkdown = [System.IO.File]::ReadAllText(
            (Join-Path $skillDirectory "SKILL.md")
        )
        [System.IO.File]::WriteAllText(
            (Join-Path $fixtureSkill "SKILL.md"),
            "$skillMarkdown`nLocal workflow note.`n",
            $utf8NoBom
        )

        $customized = Invoke-Verifier -SkillDirectory $fixtureSkill
        Assert-Equal $customized.ExitCode 0 "Customized SKILL prose should be accepted."
        $customizedResult = $customized.Output | ConvertFrom-Json
        Assert-True $customizedResult.Valid "Customized skill verification should be valid."

        $fixtureTemplatePath = Join-Path $fixtureSkill "references\Start-IISExpress.template.ps1"
        $driftedTemplate = [System.IO.File]::ReadAllText($fixtureTemplatePath) + "`n# drift`n"
        [System.IO.File]::WriteAllText($fixtureTemplatePath, $driftedTemplate, $utf8NoBom)
        $drifted = Invoke-Verifier -SkillDirectory $fixtureSkill
        Assert-Equal $drifted.ExitCode 1 "Template drift should fail verification."
        Assert-Match $drifted.Output "Template fingerprint mismatch" `
            "Template drift should report a fingerprint mismatch."
    }

    Invoke-Test "non-root app maps root and virtual app to distinct directories" {
        $fixture = New-RenderedFixture -Name "non-root" -ApplicationPath "/MyApp"
        $mappings = @(Get-ApplicationMappings -ConfigPath $fixture.ConfigPath)
        Assert-Equal $mappings.Count 2 "Non-root config should contain two applications."
        Assert-Equal $mappings[0].Path "/" "First application should be the site root."
        Assert-Equal $mappings[1].Path "/MyApp" "Second application should be the virtual app."
        Assert-Equal `
            $mappings[0].PhysicalPath `
            (Join-Path $fixture.SolutionRoot ".vs\config\empty-root") `
            "Site root should use the blank directory."
        Assert-Equal $mappings[1].PhysicalPath $fixture.WebProjectPath `
            "Virtual app should use the web project."
        Assert-True `
            ($mappings[0].PhysicalPath -ne $mappings[1].PhysicalPath) `
            "Root and virtual app physical paths must differ."
    }

    Invoke-Test "root-hosted app maps root directly to the web project" {
        $fixture = New-RenderedFixture -Name "root" -ApplicationPath "/"
        $mappings = @(Get-ApplicationMappings -ConfigPath $fixture.ConfigPath)
        Assert-Equal $mappings.Count 1 "Root config should contain one application."
        Assert-Equal $mappings[0].Path "/" "Application should be hosted at root."
        Assert-Equal $mappings[0].PhysicalPath $fixture.WebProjectPath `
            "Root application should use the web project."
    }

    Invoke-Test "rendered launcher carries current provenance" {
        $fixture = New-RenderedFixture -Name "provenance" -ApplicationPath "/"
        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 0 "Current generated script should verify."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True $result.Valid "Current generated script should be valid."
        Assert-Equal $result.Checked.GeneratedScriptVersion "1.1.2" `
            "Generated marker should report v1.1.2."
        Assert-True $result.Checked.GeneratedSafetyValid `
            "Current generated script should satisfy the v1.1.2 safety invariants."
    }

    Invoke-Test "launcher is hidden and redirects stdout and stderr separately" {
        $template = [System.IO.File]::ReadAllText($templatePath)
        Assert-Match $template '(?m)^\s*-WindowStyle Hidden\s*`?\r?$' `
            "IIS Express should launch without opening a visible console window."
        Assert-Match $template '(?m)^\s*-RedirectStandardOutput \$stdoutLogPath\s*`?\r?$' `
            "IIS Express stdout should be redirected to its log file."
        Assert-Match $template '(?m)^\s*-RedirectStandardError \$stderrLogPath\s*`?\r?$' `
            "IIS Express stderr should be redirected to its log file."
        Assert-Match $template '(?m)^\$stdoutLogPath\s*=\s*Join-Path\s+\$configDir\s+"iisexpress\.stdout\.log"\s*\r?$' `
            "The stdout log should use a stable path under the generated config directory."
        Assert-Match $template '(?m)^\$stderrLogPath\s*=\s*Join-Path\s+\$configDir\s+"iisexpress\.stderr\.log"\s*\r?$' `
            "The stderr log should use a distinct stable path under the generated config directory."
    }

    Invoke-Test "visible generated launch requires regeneration" {
        $fixture = New-RenderedFixture -Name "visible-launch" -ApplicationPath "/"
        $content = [System.IO.File]::ReadAllText($fixture.ScriptPath).Replace(
            "    -WindowStyle Hidden ```r`n",
            ""
        ).Replace(
            "    -WindowStyle Hidden ```n",
            ""
        )
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "A generated script with a visible launch should fail verification."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "HiddenWindowLaunch") `
            "Visible launch should fail the hidden-window invariant."
    }

    Invoke-Test "unrelated hidden launch does not satisfy IIS Express invariants" {
        $fixture = New-RenderedFixture -Name "unrelated-hidden-launch" -ApplicationPath "/"
        $content = [regex]::Replace(
            [System.IO.File]::ReadAllText($fixture.ScriptPath),
            '(?m)^\s+-(?:WindowStyle Hidden|RedirectStandardOutput \$stdoutLogPath|RedirectStandardError \$stderrLogPath)\s*`?\r?\n',
            ""
        )
        $content += @'

if ($false) {
    Start-Process -FilePath $env:ComSpec `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLogPath `
        -RedirectStandardError $stderrLogPath
}
'@
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "Hidden flags on another process should not satisfy IIS Express launch invariants."
        $result = $verification.Output | ConvertFrom-Json
        foreach ($invariant in @(
            "HiddenWindowLaunch"
            "StandardOutputRedirection"
            "StandardErrorRedirection"
        )) {
            Assert-True `
                ($result.Checked.MissingSafetyInvariants -contains $invariant) `
                "The IIS Express launch should report missing $invariant."
        }
    }

    Invoke-Test "inert flag text does not satisfy IIS Express invariants" {
        $fixture = New-RenderedFixture -Name "inert-flag-text" -ApplicationPath "/"
        $content = [regex]::Replace(
            [System.IO.File]::ReadAllText($fixture.ScriptPath),
            '(?m)^\s+-(?:WindowStyle Hidden|RedirectStandardOutput \$stdoutLogPath|RedirectStandardError \$stderrLogPath)\s*`?\r?\n',
            ""
        )
        $lineEnding = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
        $inertArgumentList = @(
            '    -ArgumentList @('
            "@'"
            '    -WindowStyle Hidden `'
            '    -RedirectStandardOutput $stdoutLogPath `'
            '    -RedirectStandardError $stderrLogPath `'
            "'@"
            '    ) `'
        ) -join $lineEnding
        $content = [regex]::Replace(
            $content,
            '(?m)^\s+-ArgumentList\s+".*"\s*`\r?$',
            $inertArgumentList,
            1
        )
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "Flag text inside an argument should not satisfy IIS Express launch invariants."
        $result = $verification.Output | ConvertFrom-Json
        foreach ($invariant in @(
            "HiddenWindowLaunch"
            "StandardOutputRedirection"
            "StandardErrorRedirection"
        )) {
            Assert-True `
                ($result.Checked.MissingSafetyInvariants -contains $invariant) `
                "The IIS Express launch should report missing $invariant."
        }
    }

    Invoke-Test "inert canonical launch does not hide an alternate invocation" {
        $fixture = New-RenderedFixture -Name "alternate-invocation" -ApplicationPath "/"
        $content = [System.IO.File]::ReadAllText($fixture.ScriptPath)
        $lineEnding = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
        $launchBlock = @(
            '$proc = Start-Process -FilePath $iisExpressExe `'
            '    -ArgumentList "/config:`"$configPath`" /site:`"$siteName`"" `'
            '    -WindowStyle Hidden `'
            '    -RedirectStandardOutput $stdoutLogPath `'
            '    -RedirectStandardError $stderrLogPath `'
            '    -PassThru'
        ) -join $lineEnding
        $forgedLaunchBlock = @(
            'if ($false) {'
            '    $decoy = Start-Process -FilePath $iisExpressExe `'
            '        -ArgumentList "/config:`"$configPath`" /site:`"$siteName`"" `'
            '        -WindowStyle Hidden `'
            '        -RedirectStandardOutput $stdoutLogPath `'
            '        -RedirectStandardError $stderrLogPath `'
            '        -PassThru'
            '}'
            '$proc = & $iisExpressExe "/config:`"$configPath`" /site:`"$siteName`""'
        ) -join $lineEnding
        $content = $content.Replace($launchBlock, $forgedLaunchBlock)
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "An inert canonical launch should not hide an alternate IIS Express invocation."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "NoAlternateIISExpressInvocation") `
            "A direct IIS Express invocation should fail its negative invariant."
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "HiddenWindowLaunch") `
            "The canonical launch should be rejected when it is not the top-level proc assignment."
    }

    Invoke-Test "log path reassignment requires regeneration" {
        $fixture = New-RenderedFixture -Name "log-path-reassignment" -ApplicationPath "/"
        $content = [System.IO.File]::ReadAllText($fixture.ScriptPath)
        $lineEnding = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
        $content = $content.Replace(
            'Write-Host "Launching IIS Express..."',
            '$stderrLogPath = $stdoutLogPath' + $lineEnding +
                'Write-Host "Launching IIS Express..."'
        )
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "Reassigning a launch log path should fail verification."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "StandardErrorLogPath") `
            "The stderr log path should have one canonical top-level assignment."
    }

    Invoke-Test "missing PassThru requires regeneration" {
        $fixture = New-RenderedFixture -Name "missing-pass-thru" -ApplicationPath "/"
        $content = [regex]::Replace(
            [System.IO.File]::ReadAllText($fixture.ScriptPath),
            '(?m)^\s+-PassThru\s*\r?\n',
            ""
        )
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "A launch without PassThru should fail verification."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "ProcessObjectReturn") `
            "The IIS Express launch should require a process object for readiness tracking."
    }

    Invoke-Test "additional Start-Process launch requires regeneration" {
        $fixture = New-RenderedFixture -Name "additional-start-process" -ApplicationPath "/"
        $content = [System.IO.File]::ReadAllText($fixture.ScriptPath)
        $lineEnding = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
        $content += $lineEnding + (
            'Start-Process -FilePath "$iisExpressExe" ' +
                '-ArgumentList "/config:`"$configPath`" /site:`"$siteName`""'
        ) + $lineEnding
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "An additional IIS Express Start-Process launch should fail verification."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "NoAlternateIISExpressInvocation") `
            "All Start-Process forms that reference IIS Express should be counted."
    }

    Invoke-Test "positional Start-Process launch requires regeneration" {
        $fixture = New-RenderedFixture -Name "positional-start-process" -ApplicationPath "/"
        $content = [System.IO.File]::ReadAllText($fixture.ScriptPath)
        $lineEnding = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
        $content += $lineEnding + (
            'Start-Process $iisExpressExe ' +
                '-ArgumentList "/config:`"$configPath`" /site:`"$siteName`""'
        ) + $lineEnding
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "A positional IIS Express Start-Process launch should fail verification."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "NoAlternateIISExpressInvocation") `
            "Positional Start-Process FilePath arguments should be counted."
    }

    Invoke-Test "proc reassignment requires regeneration" {
        $fixture = New-RenderedFixture -Name "proc-reassignment" -ApplicationPath "/"
        $content = [System.IO.File]::ReadAllText($fixture.ScriptPath)
        $lineEnding = if ($content.Contains("`r`n")) { "`r`n" } else { "`n" }
        $content = $content.Replace(
            'Write-Host "IIS Express started (PID $($proc.Id)). Waiting for an HTTP response from $siteUrl..."',
            '$proc = Start-Process -FilePath $env:ComSpec -ArgumentList "/c exit 0" -PassThru' +
                $lineEnding +
                'Write-Host "IIS Express started (PID $($proc.Id)). Waiting for an HTTP response from $siteUrl..."'
        )
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "Reassigning the tracked process should fail verification."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "ProcessObjectReturn") `
            "The canonical launch should be the only proc assignment."
    }

    Invoke-Test "forged current marker does not hide a stale generated body" {
        $fixture = New-RenderedFixture -Name "forged-current" -ApplicationPath "/MyApp"
        $forgedContent = [System.IO.File]::ReadAllText($fixture.ScriptPath).Replace(
            '$rootPhysicalPath = if ($isNonRootApp) { $blankRootPath } else { $webProjectPath }',
            '$rootPhysicalPath = $webProjectPath'
        )
        Assert-Match $forgedContent `
            "(?m)^# IISExpressSkill-Provenance: skill=launching-iisexpress; version=1\.1\.2\r?$" `
            "Forged fixture should retain a current provenance marker."
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $forgedContent, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "A current marker on a stale body should fail verification."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True (-not $result.Checked.GeneratedSafetyValid) `
            "Forged generated script should fail the v1.1.2 safety invariants."
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "DistinctRootPathSelection") `
            "Forged script should report the missing distinct root path selection."
        Assert-Match ($result.Errors -join "`n") `
            "required 1\.1\.2 safety invariants.*regeneration is required" `
            "Forged current marker should not bypass safety verification."
    }

    Invoke-Test "virtual app mapping must remain inside the non-root block" {
        $fixture = New-RenderedFixture -Name "mapping-outside-block" -ApplicationPath "/MyApp"
        $mapping = '    $subApp.SelectSingleNode("virtualDirectory").SetAttribute("physicalPath", $webProjectPath)'
        $append = '    $rootApp.ParentNode.AppendChild($subApp) | Out-Null'
        $original = "$mapping`r`n$append`r`n}"
        $moved = "$append`r`n}`r`n$mapping"
        $content = [System.IO.File]::ReadAllText($fixture.ScriptPath)
        if (-not $content.Contains($original)) {
            $original = "$mapping`n$append`n}"
            $moved = "$append`n}`n$mapping"
        }
        $content = $content.Replace($original, $moved)
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "A virtual-app mapping outside the non-root block should fail verification."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "VirtualAppPhysicalPathMapping") `
            "Out-of-block mapping should fail the scoped virtual-app invariant."
    }

    Invoke-Test "root application cannot map directly to the web project" {
        $fixture = New-RenderedFixture -Name "direct-root-override" -ApplicationPath "/MyApp"
        $safeMapping =
            '$rootApp.SelectSingleNode("virtualDirectory").SetAttribute("physicalPath", $rootPhysicalPath)'
        $staleMapping =
            '    $rootApp.SelectSingleNode("virtualDirectory").SetAttribute("physicalPath", $webProjectPath)'
        $content = [System.IO.File]::ReadAllText($fixture.ScriptPath).Replace(
            $safeMapping,
            "$safeMapping`r`n$staleMapping"
        )
        [System.IO.File]::WriteAllText($fixture.ScriptPath, $content, $utf8NoBom)

        $verification = Invoke-Verifier -GeneratedScript $fixture.ScriptPath
        Assert-Equal $verification.ExitCode 1 `
            "A direct root-to-web-project mapping should fail verification."
        $result = $verification.Output | ConvertFrom-Json
        Assert-True `
            ($result.Checked.MissingSafetyInvariants -contains "NoDirectRootWebProjectMapping") `
            "Direct root mapping should fail its negative safety invariant."
    }

    Invoke-Test "missing provenance requires regeneration" {
        $path = Join-Path $tempRoot "Start-IISExpress.missing.ps1"
        [System.IO.File]::WriteAllText($path, "# no provenance`n", $utf8NoBom)
        $verification = Invoke-Verifier -GeneratedScript $path
        Assert-Equal $verification.ExitCode 1 "Missing marker should fail."
        Assert-Match $verification.Output `
            "no launching-iisexpress provenance marker; regeneration is required" `
            "Missing marker should require regeneration."
    }

    Invoke-Test "older provenance requires regeneration" {
        $path = Join-Path $tempRoot "Start-IISExpress.stale.ps1"
        [System.IO.File]::WriteAllText(
            $path,
            "# IISExpressSkill-Provenance: skill=launching-iisexpress; version=1.1.1`n",
            $utf8NoBom
        )
        $verification = Invoke-Verifier -GeneratedScript $path
        Assert-Equal $verification.ExitCode 1 "Older marker should fail."
        $result = $verification.Output | ConvertFrom-Json
        Assert-Match ($result.Errors -join "`n") `
            "stale \(1\.1\.1 < 1\.1\.2\); regeneration is required" `
            "Older marker should require regeneration."
    }

    Invoke-Test "newer provenance requires an installed skill update" {
        $path = Join-Path $tempRoot "Start-IISExpress.newer.ps1"
        [System.IO.File]::WriteAllText(
            $path,
            "# IISExpressSkill-Provenance: skill=launching-iisexpress; version=1.2.0`n",
            $utf8NoBom
        )
        $verification = Invoke-Verifier -GeneratedScript $path
        Assert-Equal $verification.ExitCode 1 "Newer marker should fail."
        $result = $verification.Output | ConvertFrom-Json
        Assert-Match ($result.Errors -join "`n") `
            "newer \(1\.2\.0 > 1\.1\.2\); update the installed skill before launch" `
            "Newer marker should require an installed skill update."
    }

    Invoke-Test "substitution preserves PowerShell metacharacters in physical paths" {
        $fixture = New-RenderedFixture -Name 'metachar-$repo''s' -ApplicationPath "/"
        $mappings = @(Get-ApplicationMappings -ConfigPath $fixture.ConfigPath)
        Assert-Equal $mappings[0].PhysicalPath $fixture.WebProjectPath `
            "Rendered physical path should preserve dollar signs and apostrophes."
    }

    Invoke-Test "substitution does not reinterpret placeholder-shaped values" {
        $fixture = New-RenderedFixture -Name "literal-{{SITE_PORT}}" -ApplicationPath "/"
        $mappings = @(Get-ApplicationMappings -ConfigPath $fixture.ConfigPath)
        Assert-Equal $mappings[0].PhysicalPath $fixture.WebProjectPath `
            "Rendered physical path should preserve placeholder-shaped text."
    }
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "$script:passed passed, $script:failed failed"
if ($script:failed -gt 0) {
    exit 1
}
