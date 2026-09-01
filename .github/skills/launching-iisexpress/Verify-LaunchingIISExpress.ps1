<#
.SYNOPSIS
    Verifies the canonical launching-iisexpress release contract.
.DESCRIPTION
    Checks the installed skill version and normalized template SHA-256. When a
    generated launcher is supplied, also checks its machine-readable provenance
    and the required v1.1.2 mapping and hidden-launch safety invariants.
.PARAMETER SkillDirectory
    Path to the installed launching-iisexpress skill. Defaults to this script's directory.
.PARAMETER GeneratedScript
    Optional path to a generated Start-IISExpress.ps1 to validate before launch.
.PARAMETER AsJson
    Writes the structured verification result as JSON.
#>
param(
    [string]$SkillDirectory = $PSScriptRoot,
    [string]$GeneratedScript,
    [switch]$AsJson
)

$ErrorActionPreference = "Stop"

$canonicalVersion = "1.1.2"
$canonicalTemplateSha256 = "7515d5acbf84b153e5a585d9bd9dfe3e5e6d163b6b3b3b55cc24a26e76434990"
$provenancePattern = "(?m)^# IISExpressSkill-Provenance: skill=launching-iisexpress; version=(\d+\.\d+\.\d+)\r?$"

function Get-NormalizedSha256 {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content
    )

    $normalized = $Content.Replace("`r`n", "`n").Replace("`r", "`n")
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hash = $sha256.ComputeHash($bytes)
    } finally {
        $sha256.Dispose()
    }

    return ([System.BitConverter]::ToString($hash)).Replace("-", "").ToLowerInvariant()
}

function Test-GeneratedScriptSafetyInvariants {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptContent
    )

    function Get-CommandParameterArguments {
        param(
            [Parameter(Mandatory = $true)]
            [System.Management.Automation.Language.CommandAst]$Command,

            [Parameter(Mandatory = $true)]
            [string]$ParameterName
        )

        $arguments = @()
        $elements = $Command.CommandElements
        for ($index = 1; $index -lt $elements.Count; $index++) {
            $element = $elements[$index]
            if (
                $element -isnot [System.Management.Automation.Language.CommandParameterAst] -or
                $element.ParameterName -ne $ParameterName
            ) {
                continue
            }

            $argument = $element.Argument
            if (
                -not $argument -and
                $index + 1 -lt $elements.Count -and
                $elements[$index + 1] -isnot [System.Management.Automation.Language.CommandParameterAst]
            ) {
                $argument = $elements[$index + 1]
            }
            if ($null -ne $argument) {
                $arguments += $argument
            }
        }

        return $arguments
    }

    function Get-CommandParameters {
        param(
            [Parameter(Mandatory = $true)]
            [System.Management.Automation.Language.CommandAst]$Command,

            [Parameter(Mandatory = $true)]
            [string]$ParameterName
        )

        return @(
            $Command.CommandElements | Where-Object {
                $_ -is [System.Management.Automation.Language.CommandParameterAst] -and
                    $_.ParameterName -eq $ParameterName
            }
        )
    }

    function Get-StartProcessFilePathArguments {
        param(
            [Parameter(Mandatory = $true)]
            [System.Management.Automation.Language.CommandAst]$Command
        )

        $namedArguments = @(
            Get-CommandParameterArguments -Command $Command -ParameterName "FilePath"
        )
        if ($namedArguments.Count -gt 0) {
            return $namedArguments
        }

        if (
            $Command.CommandElements.Count -gt 1 -and
            $Command.CommandElements[1] -isnot [System.Management.Automation.Language.CommandParameterAst]
        ) {
            return @($Command.CommandElements[1])
        }

        return @()
    }

    function Test-AstReferencesVariable {
        param(
            [Parameter(Mandatory = $true)]
            [System.Management.Automation.Language.Ast]$Ast,

            [Parameter(Mandatory = $true)]
            [string]$VariableName
        )

        if (
            $Ast -is [System.Management.Automation.Language.VariableExpressionAst] -and
            $Ast.VariablePath.UserPath -eq $VariableName
        ) {
            return $true
        }

        return @(
            $Ast.FindAll(
                {
                    param($node)
                    $node -is [System.Management.Automation.Language.VariableExpressionAst] -and
                        $node.VariablePath.UserPath -eq $VariableName
                },
                $true
            )
        ).Count -gt 0
    }

    $invariantPatterns = [ordered]@{
        DedicatedBlankRoot = '(?m)^\$blankRootPath\s*=\s*Join-Path\s+\$configDir\s+"empty-root"\s*\r?$'
        ConditionalNonRootDetection = '(?m)^\$isNonRootApp\s*=\s*\$applicationPath\s+-ne\s+"/"\s*\r?$'
        ConditionalBlankRootCreation = '(?ms)^if\s*\(\$isNonRootApp\)\s*\{\s*\r?\n\s*New-Item\s+-ItemType\s+Directory\s+-Path\s+\$blankRootPath\s+-Force\s*\|\s*Out-Null\s*\r?\n\}'
        DistinctRootPathSelection = '(?m)^\$rootPhysicalPath\s*=\s*if\s*\(\$isNonRootApp\)\s*\{\s*\$blankRootPath\s*\}\s*else\s*\{\s*\$webProjectPath\s*\}\s*\r?$'
        RootPhysicalPathMapping = '(?m)^\$rootApp\.SelectSingleNode\("virtualDirectory"\)\.SetAttribute\("physicalPath",\s*\$rootPhysicalPath\)\s*\r?$'
        VirtualAppPhysicalPathMapping = '(?ms)^if\s*\(\$isNonRootApp\)\s*\{\s*\r?\n\s*\$subApp\s*=\s*\$rootApp\.CloneNode\(\$true\)[^{}]*^\s*\$subApp\.SelectSingleNode\("virtualDirectory"\)\.SetAttribute\("physicalPath",\s*\$webProjectPath\)\s*\r?$[^{}]*^\}'
    }

    $missingOrAmbiguous = @()
    foreach ($entry in $invariantPatterns.GetEnumerator()) {
        if ([regex]::Matches($ScriptContent, $entry.Value).Count -ne 1) {
            $missingOrAmbiguous += $entry.Key
        }
    }

    $launchInvariants = [ordered]@{
        HiddenWindowLaunch = @{
            ParameterName = "WindowStyle"
            LiteralValue = "Hidden"
        }
        StandardOutputRedirection = @{
            ParameterName = "RedirectStandardOutput"
            VariableName = "stdoutLogPath"
        }
        StandardErrorRedirection = @{
            ParameterName = "RedirectStandardError"
            VariableName = "stderrLogPath"
        }
        ProcessObjectReturn = @{
            ParameterName = "PassThru"
            Switch = $true
        }
    }
    $tokens = $null
    $parseErrors = $null
    $scriptAst = [System.Management.Automation.Language.Parser]::ParseInput(
        $ScriptContent,
        [ref]$tokens,
        [ref]$parseErrors
    )

    $logPathInvariants = [ordered]@{
        StandardOutputLogPath = @{
            VariableName = "stdoutLogPath"
            Pattern = '^\$stdoutLogPath\s*=\s*Join-Path\s+\$configDir\s+"iisexpress\.stdout\.log"\s*$'
        }
        StandardErrorLogPath = @{
            VariableName = "stderrLogPath"
            Pattern = '^\$stderrLogPath\s*=\s*Join-Path\s+\$configDir\s+"iisexpress\.stderr\.log"\s*$'
        }
    }
    foreach ($entry in $logPathInvariants.GetEnumerator()) {
        $assignments = @()
        if ($parseErrors.Count -eq 0) {
            $variableName = $entry.Value.VariableName
            $assignments = @(
                $scriptAst.FindAll(
                    {
                        param($node)
                        $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
                            $node.Left -is [System.Management.Automation.Language.VariableExpressionAst] -and
                            $node.Left.VariablePath.UserPath -eq $variableName
                    },
                    $true
                )
            )
        }
        $valid =
            $assignments.Count -eq 1 -and
            $assignments[0].Parent -is [System.Management.Automation.Language.NamedBlockAst] -and
            $assignments[0].Parent.Parent -eq $scriptAst -and
            [regex]::IsMatch($assignments[0].Extent.Text, $entry.Value.Pattern)
        if (-not $valid) {
            $missingOrAmbiguous += $entry.Key
        }
    }

    $iisExpressLaunches = @()
    $startProcessCommands = @()
    if ($parseErrors.Count -eq 0) {
        $startProcessCommands = @(
            $scriptAst.FindAll(
                {
                    param($node)
                    $node -is [System.Management.Automation.Language.CommandAst] -and
                        $node.GetCommandName() -eq "Start-Process"
                },
                $true
            )
        )
        foreach ($command in $startProcessCommands) {
            $filePathArguments = @(
                Get-StartProcessFilePathArguments -Command $command
            )
            if (
                $filePathArguments.Count -eq 1 -and
                $filePathArguments[0] -is [System.Management.Automation.Language.VariableExpressionAst] -and
                $filePathArguments[0].VariablePath.UserPath -eq "iisExpressExe"
            ) {
                $iisExpressLaunches += $command
            }
        }
    }
    if ($iisExpressLaunches.Count -ne 1) {
        $missingOrAmbiguous += @($launchInvariants.Keys)
    } else {
        $iisExpressLaunch = $iisExpressLaunches[0]
        $launchPipeline = $iisExpressLaunch.Parent
        $launchAssignment = $launchPipeline.Parent
        $procAssignments = @(
            $scriptAst.FindAll(
                {
                    param($node)
                    $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
                        $node.Left -is [System.Management.Automation.Language.VariableExpressionAst] -and
                        $node.Left.VariablePath.UserPath -eq "proc"
                },
                $true
            )
        )
        $topLevelProcLaunch =
            $launchPipeline -is [System.Management.Automation.Language.PipelineAst] -and
            $launchPipeline.PipelineElements.Count -eq 1 -and
            $procAssignments.Count -eq 1 -and
            $procAssignments[0] -eq $launchAssignment -and
            $launchAssignment -is [System.Management.Automation.Language.AssignmentStatementAst] -and
            $launchAssignment.Left -is [System.Management.Automation.Language.VariableExpressionAst] -and
            $launchAssignment.Left.VariablePath.UserPath -eq "proc" -and
            $launchAssignment.Right -eq $launchPipeline -and
            $launchAssignment.Parent -is [System.Management.Automation.Language.NamedBlockAst] -and
            $launchAssignment.Parent.Parent -eq $scriptAst
        if (-not $topLevelProcLaunch) {
            $missingOrAmbiguous += @($launchInvariants.Keys)
        }

        foreach ($entry in $launchInvariants.GetEnumerator()) {
            $parameters = @(
                Get-CommandParameters `
                    -Command $iisExpressLaunch `
                    -ParameterName $entry.Value.ParameterName
            )
            $arguments = @(
                Get-CommandParameterArguments `
                    -Command $iisExpressLaunch `
                    -ParameterName $entry.Value.ParameterName
            )
            $valid = $parameters.Count -eq 1
            if ($valid -and $entry.Value.Switch) {
                $valid = $arguments.Count -eq 0
            } elseif ($valid -and $entry.Value.LiteralValue) {
                $valid =
                    $arguments.Count -eq 1 -and
                    $arguments[0] -is [System.Management.Automation.Language.StringConstantExpressionAst] -and
                    $arguments[0].Value -eq $entry.Value.LiteralValue
            } elseif ($valid -and $entry.Value.VariableName) {
                $valid =
                    $arguments.Count -eq 1 -and
                    $arguments[0] -is [System.Management.Automation.Language.VariableExpressionAst] -and
                    $arguments[0].VariablePath.UserPath -eq $entry.Value.VariableName
            }
            if (-not $valid) {
                $missingOrAmbiguous += $entry.Key
            }
        }
    }

    $iisExpressStartProcessInvocations = @()
    foreach ($command in $startProcessCommands) {
        $filePathArguments = @(
            Get-StartProcessFilePathArguments -Command $command
        )
        if (
            @(
                $filePathArguments | Where-Object {
                    Test-AstReferencesVariable -Ast $_ -VariableName "iisExpressExe"
                }
            ).Count -gt 0
        ) {
            $iisExpressStartProcessInvocations += $command
        }
    }

    $alternateIISExpressInvocations = @()
    if ($parseErrors.Count -eq 0) {
        $alternateIISExpressInvocations = @(
            $scriptAst.FindAll(
                {
                    param($node)
                    $node -is [System.Management.Automation.Language.CommandAst] -and
                        $node.CommandElements.Count -gt 0 -and
                        (Test-AstReferencesVariable `
                            -Ast $node.CommandElements[0] `
                            -VariableName "iisExpressExe")
                },
                $true
            )
        )
    }
    if (
        $parseErrors.Count -gt 0 -or
        $iisExpressStartProcessInvocations.Count -ne 1 -or
        $alternateIISExpressInvocations.Count -gt 0
    ) {
        $missingOrAmbiguous += "NoAlternateIISExpressInvocation"
    }

    $directRootWebProjectMapping =
        '(?m)^[ \t]*\$rootApp\.SelectSingleNode\("virtualDirectory"\)\.SetAttribute\("physicalPath",\s*\$webProjectPath\)\s*\r?$'
    if ([regex]::IsMatch($ScriptContent, $directRootWebProjectMapping)) {
        $missingOrAmbiguous += "NoDirectRootWebProjectMapping"
    }

    $uniqueMissingOrAmbiguous = @($missingOrAmbiguous | Select-Object -Unique)
    return [pscustomobject]@{
        Valid = $uniqueMissingOrAmbiguous.Count -eq 0
        MissingOrAmbiguous = $uniqueMissingOrAmbiguous
    }
}

function Get-SkillVersion {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SkillMarkdown
    )

    $frontmatter = [regex]::Match(
        $SkillMarkdown,
        "\A---\r?\n(?<frontmatter>[\s\S]*?)\r?\n---"
    )
    if (-not $frontmatter.Success) {
        throw "SKILL.md is missing YAML frontmatter."
    }

    $version = [regex]::Match(
        $frontmatter.Groups["frontmatter"].Value,
        "(?m)^version:\s*(?<version>\d+\.\d+\.\d+)\s*$"
    )
    if (-not $version.Success) {
        throw "SKILL.md is missing a semantic version in its YAML frontmatter."
    }

    return $version.Groups["version"].Value
}

function Test-GeneratedScriptProvenance {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ScriptContent,
        [Parameter(Mandatory = $true)]
        [string]$InstalledVersion
    )

    $marker = [regex]::Match($ScriptContent, $provenancePattern)
    if (-not $marker.Success) {
        return [pscustomobject]@{
            Valid = $false
            Version = $null
            Reason = "Generated script has no launching-iisexpress provenance marker; regeneration is required."
        }
    }

    $generatedVersionText = $marker.Groups[1].Value
    $generatedVersion = [version]$generatedVersionText
    $installedSemanticVersion = [version]$InstalledVersion
    if ($generatedVersion -lt $installedSemanticVersion) {
        return [pscustomobject]@{
            Valid = $false
            Version = $generatedVersionText
            Reason = "Generated script is stale ($generatedVersionText < $InstalledVersion); regeneration is required."
        }
    }
    if ($generatedVersion -gt $installedSemanticVersion) {
        return [pscustomobject]@{
            Valid = $false
            Version = $generatedVersionText
            Reason = "Generated script is newer ($generatedVersionText > $InstalledVersion); update the installed skill before launch."
        }
    }

    return [pscustomobject]@{
        Valid = $true
        Version = $generatedVersionText
        Reason = $null
    }
}

try {
    $resolvedSkillDirectory = (Resolve-Path -LiteralPath $SkillDirectory).Path
    $skillPath = Join-Path $resolvedSkillDirectory "SKILL.md"
    $templatePath = Join-Path $resolvedSkillDirectory "references\Start-IISExpress.template.ps1"
    $skillMarkdown = [System.IO.File]::ReadAllText($skillPath)
    $template = [System.IO.File]::ReadAllText($templatePath)

    $errors = New-Object System.Collections.Generic.List[string]
    $skillVersion = Get-SkillVersion -SkillMarkdown $skillMarkdown
    if ($skillVersion -ne $canonicalVersion) {
        $errors.Add("SKILL.md version is $skillVersion; expected canonical release $canonicalVersion.")
    }

    $templateSha256 = Get-NormalizedSha256 -Content $template
    if ($templateSha256 -ne $canonicalTemplateSha256) {
        $errors.Add(
            "Template fingerprint mismatch: $templateSha256; expected $canonicalTemplateSha256."
        )
    }

    $templateProvenance = Test-GeneratedScriptProvenance `
        -ScriptContent $template `
        -InstalledVersion $canonicalVersion
    if (-not $templateProvenance.Valid) {
        $errors.Add("Canonical template: $($templateProvenance.Reason)")
    }

    $resolvedGeneratedScript = $null
    $generatedScriptVersion = $null
    $generatedSafetyValid = $null
    $missingSafetyInvariants = @()
    if ($GeneratedScript) {
        $resolvedGeneratedScript = (Resolve-Path -LiteralPath $GeneratedScript).Path
        $generatedContent = [System.IO.File]::ReadAllText($resolvedGeneratedScript)
        $generatedProvenance = Test-GeneratedScriptProvenance `
            -ScriptContent $generatedContent `
            -InstalledVersion $skillVersion
        $generatedScriptVersion = $generatedProvenance.Version
        if (-not $generatedProvenance.Valid) {
            $errors.Add($generatedProvenance.Reason)
        }

        if ($generatedProvenance.Valid) {
            $safety = Test-GeneratedScriptSafetyInvariants -ScriptContent $generatedContent
            $generatedSafetyValid = $safety.Valid
            $missingSafetyInvariants = @($safety.MissingOrAmbiguous)
            if (-not $generatedSafetyValid) {
                $errors.Add(
                    "Generated script does not satisfy the required $canonicalVersion " +
                    "safety invariants (missing or ambiguous: " +
                    "$($missingSafetyInvariants -join ', ')); regeneration is required."
                )
            }
        }
    }

    $result = [pscustomobject]@{
        Valid = $errors.Count -eq 0
        Contract = [pscustomobject]@{
            Skill = "launching-iisexpress"
            Version = $canonicalVersion
            TemplateSha256 = $canonicalTemplateSha256
        }
        Checked = [pscustomobject]@{
            SkillDirectory = $resolvedSkillDirectory
            SkillVersion = $skillVersion
            TemplateSha256 = $templateSha256
            GeneratedScript = $resolvedGeneratedScript
            GeneratedScriptVersion = $generatedScriptVersion
            GeneratedSafetyValid = $generatedSafetyValid
            MissingSafetyInvariants = $missingSafetyInvariants
        }
        Errors = @($errors)
    }

    if ($AsJson) {
        $result | ConvertTo-Json -Depth 4
    } elseif ($result.Valid) {
        Write-Output (
            "launching-iisexpress {0} verified (template sha256 {1})." -f `
                $result.Contract.Version, `
                $result.Contract.TemplateSha256
        )
    } else {
        foreach ($verificationError in $result.Errors) {
            [Console]::Error.WriteLine("ERROR: $verificationError")
        }
    }

    if (-not $result.Valid) {
        exit 1
    }
} catch {
    [Console]::Error.WriteLine("ERROR: $($_.Exception.Message)")
    exit 1
}
