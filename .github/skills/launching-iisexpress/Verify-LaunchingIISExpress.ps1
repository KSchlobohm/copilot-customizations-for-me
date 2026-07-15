<#
.SYNOPSIS
    Verifies the canonical launching-iisexpress release contract.
.DESCRIPTION
    Checks the installed skill version and normalized template SHA-256. When a
    generated launcher is supplied, also checks its machine-readable provenance
    and the required v1.1.1 non-root application safety invariants.
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

$canonicalVersion = "1.1.1"
$canonicalTemplateSha256 = "eabd6c61c9e325825332b70261e680dd2909ba2e7a6b77e8abf2b106e3aac0a0"
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
    $directRootWebProjectMapping =
        '(?m)^[ \t]*\$rootApp\.SelectSingleNode\("virtualDirectory"\)\.SetAttribute\("physicalPath",\s*\$webProjectPath\)\s*\r?$'
    if ([regex]::IsMatch($ScriptContent, $directRootWebProjectMapping)) {
        $missingOrAmbiguous += "NoDirectRootWebProjectMapping"
    }

    return [pscustomobject]@{
        Valid = $missingOrAmbiguous.Count -eq 0
        MissingOrAmbiguous = $missingOrAmbiguous
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
                    "non-root safety invariants (missing or ambiguous: " +
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
