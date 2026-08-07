# Versioned Skill Releases

This repository publishes its complete skill collection through GitHub releases. The current collection release is [`v0.1.0`](https://github.com/KSchlobohm/copilot-customizations-for-me/releases/tag/v0.1.0), and the full release history is available on the [Releases](https://github.com/KSchlobohm/copilot-customizations-for-me/releases) page.

Repository release versions identify the complete collection. A skill may also declare its own version when it has an independent behavioral contract, such as `launching-iisexpress`.

## Install a Specific Version

Confirm that the installed GitHub CLI includes the preview `skill` commands:

```powershell
gh skill --help
```

Preview a skill before installing it:

```powershell
gh skill preview KSchlobohm/copilot-customizations-for-me copilot-customization-advisor@v0.1.0 --allow-hidden-dirs
```

Install every skill for GitHub Copilot at user scope and pin the collection to `v0.1.0`:

```powershell
gh skill install KSchlobohm/copilot-customizations-for-me `
  --all `
  --allow-hidden-dirs `
  --agent github-copilot `
  --scope user `
  --pin v0.1.0
```

`--allow-hidden-dirs` is required because the published skills live under `.github/skills`. Pinning prevents an update from silently moving the installation to a different release.

## Adopt Manually Installed Skills

Manually copied skills appear in `gh skill list` without a source or version. Inspect them before migration:

```powershell
gh skill list `
  --agent github-copilot `
  --scope user `
  --json skillName,sourceURL,version,pinned,path
```

The normal pinned install refuses to replace an existing manual copy and reports that `--force` is required. Back up any local changes first:

```powershell
$skillNames = @(
  "copilot-customization-advisor"
  "copilot-customization-agent-authoring"
  "copilot-customization-skill-authoring"
  "launching-iisexpress"
  "managing-summary-canvas"
)
$backupRoot = Join-Path $HOME "copilot-skills-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
New-Item -ItemType Directory -Path $backupRoot | Out-Null

foreach ($skillName in $skillNames) {
  $installedPath = Join-Path $HOME ".copilot\skills\$skillName"
  if (Test-Path $installedPath) {
    Copy-Item $installedPath $backupRoot -Recurse
  }
}
```

Then adopt the published release, replacing files in the existing skill directories:

```powershell
gh skill install KSchlobohm/copilot-customizations-for-me `
  --all `
  --allow-hidden-dirs `
  --agent github-copilot `
  --scope user `
  --pin v0.1.0 `
  --force
```

Verify that the installed skills now report the repository source, `v0.1.0`, and `pinned: true`:

```powershell
gh skill list `
  --agent github-copilot `
  --scope user `
  --json skillName,sourceURL,version,pinned,path `
  --jq '.[] | select(.sourceURL | contains("KSchlobohm/copilot-customizations-for-me"))'
```

This migration path was validated on Windows against user-scoped skills that had previously been copied into `~/.copilot/skills` without `gh skill install`.

## Upgrade Deliberately

Pinned skills are skipped by `gh skill update`. To move to a known newer release, preview that tag and reinstall the collection with the new pin:

```powershell
$newVersion = "v0.2.0"

gh skill preview KSchlobohm/copilot-customizations-for-me `
  "copilot-customization-advisor@$newVersion" `
  --allow-hidden-dirs

gh skill install KSchlobohm/copilot-customizations-for-me `
  --all `
  --allow-hidden-dirs `
  --agent github-copilot `
  --scope user `
  --pin $newVersion `
  --force
```

Run the `gh skill list` verification command again after upgrading. Use `gh skill update --unpin` only when intentionally switching from version pins to automatic updates.

## Publish the Next Version

Collection tags follow semantic versioning:

- **MAJOR** for incompatible changes to installation or shared skill contracts.
- **MINOR** for backward-compatible skills or capabilities.
- **PATCH** for backward-compatible fixes.

Before publishing, update the relevant skill versions and release guidance, then validate the complete collection:

```powershell
gh skill publish .github --dry-run
```

After the release commit is merged to `main`, publish a GitHub release from a clean `main` checkout:

```powershell
gh skill publish .github --tag v0.2.0
```

The command validates the Agent Skills specification, creates the tag and GitHub release, and generates release notes. Verify the published artifact without modifying an existing installation:

```powershell
$version = "v0.2.0"
$testDirectory = Join-Path $env:TEMP "copilot-customizations-$version"

gh skill install KSchlobohm/copilot-customizations-for-me `
  --all `
  --allow-hidden-dirs `
  --dir $testDirectory `
  --pin $version

gh skill list `
  --dir $testDirectory `
  --json skillName,sourceURL,version,pinned,path
```

## Release History

| Version | Published | Summary |
|---------|-----------|---------|
| [`v0.1.0`](https://github.com/KSchlobohm/copilot-customizations-for-me/releases/tag/v0.1.0) | 2026-08-06 | Initial versioned release of the five reusable skills |
