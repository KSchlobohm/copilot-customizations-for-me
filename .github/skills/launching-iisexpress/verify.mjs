#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CANONICAL_VERSION = "1.1.1";
export const CANONICAL_TEMPLATE_SHA256 = "eabd6c61c9e325825332b70261e680dd2909ba2e7a6b77e8abf2b106e3aac0a0";
export const PROVENANCE_PATTERN =
    /^# IISExpressSkill-Provenance: skill=launching-iisexpress; version=(\d+\.\d+\.\d+)$/m;

function normalizedSha256(content) {
    const normalized = content.replace(/\r\n/g, "\n");
    return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function parseSemver(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!match) {
        throw new Error(`Invalid semantic version '${version}'.`);
    }
    return match.slice(1).map(Number);
}

function compareSemver(left, right) {
    const leftParts = parseSemver(left);
    const rightParts = parseSemver(right);
    for (let index = 0; index < leftParts.length; index += 1) {
        if (leftParts[index] !== rightParts[index]) {
            return leftParts[index] < rightParts[index] ? -1 : 1;
        }
    }
    return 0;
}

export function parseSkillVersion(skillMarkdown) {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(skillMarkdown)?.[1];
    const version = frontmatter?.match(/^version:\s*(\d+\.\d+\.\d+)\s*$/m)?.[1];
    if (!version) {
        throw new Error("SKILL.md is missing a semantic version in its YAML frontmatter.");
    }
    return version;
}

export function inspectGeneratedScript(scriptContent, installedVersion = CANONICAL_VERSION) {
    const generatedVersion = PROVENANCE_PATTERN.exec(scriptContent)?.[1];
    if (!generatedVersion) {
        return {
            valid: false,
            reason: "Generated script has no launching-iisexpress provenance marker; regeneration is required.",
        };
    }

    const comparison = compareSemver(generatedVersion, installedVersion);
    if (comparison < 0) {
        return {
            valid: false,
            reason: `Generated script is stale (${generatedVersion} < ${installedVersion}); regeneration is required.`,
        };
    }
    if (comparison > 0) {
        return {
            valid: false,
            reason: `Generated script is newer (${generatedVersion} > ${installedVersion}); update the installed skill before launch.`,
        };
    }

    return { valid: true, version: generatedVersion };
}

export async function verifySkillDirectory(skillDirectory, generatedScriptPath) {
    const skillPath = resolve(skillDirectory, "SKILL.md");
    const templatePath = resolve(skillDirectory, "references", "Start-IISExpress.template.ps1");
    const [skillMarkdown, template] = await Promise.all([
        readFile(skillPath, "utf8"),
        readFile(templatePath, "utf8"),
    ]);

    const errors = [];
    const skillVersion = parseSkillVersion(skillMarkdown);
    if (skillVersion !== CANONICAL_VERSION) {
        errors.push(`SKILL.md version is ${skillVersion}; expected canonical release ${CANONICAL_VERSION}.`);
    }

    const templateSha256 = normalizedSha256(template);
    if (templateSha256 !== CANONICAL_TEMPLATE_SHA256) {
        errors.push(
            `Template fingerprint mismatch: ${templateSha256}; expected ${CANONICAL_TEMPLATE_SHA256}.`
        );
    }

    const templateProvenance = inspectGeneratedScript(template, CANONICAL_VERSION);
    if (!templateProvenance.valid) {
        errors.push(`Canonical template: ${templateProvenance.reason}`);
    }

    let generatedScript;
    if (generatedScriptPath) {
        const generatedContent = await readFile(resolve(generatedScriptPath), "utf8");
        generatedScript = inspectGeneratedScript(generatedContent, skillVersion);
        if (!generatedScript.valid) {
            errors.push(generatedScript.reason);
        }
    }

    return {
        valid: errors.length === 0,
        contract: {
            skill: "launching-iisexpress",
            version: CANONICAL_VERSION,
            templateSha256: CANONICAL_TEMPLATE_SHA256,
        },
        checked: {
            skillDirectory: resolve(skillDirectory),
            skillVersion,
            templateSha256,
            generatedScript: generatedScriptPath ? resolve(generatedScriptPath) : undefined,
            generatedScriptVersion: generatedScript?.version,
        },
        errors,
    };
}

function parseArguments(argv) {
    const arguments_ = {
        skillDirectory: dirname(fileURLToPath(import.meta.url)),
        generatedScriptPath: undefined,
        json: false,
    };

    function requireValue(option, index) {
        const value = argv[index + 1];
        if (!value || value.startsWith("--")) {
            throw new Error(`${option} requires a path.`);
        }
        return value;
    }

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--skill-dir") {
            arguments_.skillDirectory = requireValue(argument, index);
            index += 1;
        } else if (argument === "--generated-script") {
            arguments_.generatedScriptPath = requireValue(argument, index);
            index += 1;
        } else if (argument === "--json") {
            arguments_.json = true;
        } else {
            throw new Error(`Unknown argument '${argument}'.`);
        }
    }

    return arguments_;
}

async function main() {
    const arguments_ = parseArguments(process.argv.slice(2));
    const result = await verifySkillDirectory(
        arguments_.skillDirectory,
        arguments_.generatedScriptPath
    );

    if (arguments_.json) {
        console.log(JSON.stringify(result, null, 2));
    } else if (result.valid) {
        console.log(
            `launching-iisexpress ${result.contract.version} verified ` +
                `(template sha256 ${result.contract.templateSha256}).`
        );
    } else {
        for (const error of result.errors) {
            console.error(`ERROR: ${error}`);
        }
    }

    if (!result.valid) {
        process.exitCode = 1;
    }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(`ERROR: ${error.message}`);
        process.exitCode = 1;
    });
}
