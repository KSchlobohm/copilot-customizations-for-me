// Run with: node --test .github/skills/launching-iisexpress/verify.test.mjs

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

import {
    CANONICAL_TEMPLATE_SHA256,
    CANONICAL_VERSION,
    inspectGeneratedScript,
    verifySkillDirectory,
} from "./verify.mjs";

const SKILL_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = join(SKILL_DIRECTORY, "references", "Start-IISExpress.template.ps1");
const TEMP_ROOT = await mkdtemp(join(tmpdir(), "launching-iisexpress-"));

after(async () => {
    await rm(TEMP_ROOT, { recursive: true, force: true });
});

function renderTemplate(template, replacements) {
    let rendered = template;
    for (const [placeholder, value] of Object.entries(replacements)) {
        const replacement =
            placeholder === "SITE_PORT" ? String(value) : String(value).replaceAll("'", "''");
        rendered = rendered.replaceAll(`{{${placeholder}}}`, replacement);
    }
    assert.doesNotMatch(rendered, /\{\{[A-Z_]+\}\}/, "all template placeholders must be replaced");
    return rendered;
}

async function prepareFixture(name, applicationPath) {
    const fixtureRoot = join(TEMP_ROOT, name);
    const solutionRoot = join(fixtureRoot, "solution");
    const webProjectPath = join(solutionRoot, "WebProject");
    const programFiles = join(fixtureRoot, "Program Files");
    const iisExpressRoot = join(programFiles, "IIS Express");
    const iisTemplateDirectory = join(
        iisExpressRoot,
        "config",
        "templates",
        "PersonalWebServer"
    );
    await Promise.all([
        mkdir(webProjectPath, { recursive: true }),
        mkdir(iisTemplateDirectory, { recursive: true }),
    ]);
    await writeFile(join(iisExpressRoot, "iisexpress.exe"), "");
    await writeFile(
        join(iisTemplateDirectory, "applicationhost.config"),
        `<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.applicationHost>
    <sites>
      <site name="WebSite1" id="1">
        <application path="/">
          <virtualDirectory path="/" physicalPath="C:\\placeholder" />
        </application>
        <bindings>
          <binding protocol="http" bindingInformation="*:8080:localhost" />
        </bindings>
      </site>
    </sites>
  </system.applicationHost>
</configuration>
`
    );

    const template = await readFile(TEMPLATE_PATH, "utf8");
    const rendered = renderTemplate(template, {
        SITE_NAME: "WebProject",
        SITE_PORT: "65431",
        SITE_SCHEME: "http",
        SITE_HOST: "localhost",
        APPLICATION_PATH: applicationPath,
        WEB_PROJECT_PATH: webProjectPath,
        SOLUTION_ROOT: solutionRoot,
    });
    const scriptPath = join(solutionRoot, "Start-IISExpress.ps1");
    await writeFile(scriptPath, rendered);

    const result = spawnSync(
        "powershell.exe",
        [
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            scriptPath,
            "-PrepareConfigOnly",
        ],
        {
            encoding: "utf8",
            env: {
                ...process.env,
                ProgramFiles: programFiles,
                "ProgramFiles(x86)": "",
            },
        }
    );
    assert.equal(result.status, 0, `rendered template failed:\n${result.stderr}\n${result.stdout}`);

    const configPath = join(solutionRoot, ".vs", "config", "applicationhost.config");
    return { configPath, scriptPath, solutionRoot, webProjectPath };
}

function applicationMappings(configXml) {
    return [...configXml.matchAll(
        /<application\b[^>]*\bpath="([^"]+)"[^>]*>[\s\S]*?<virtualDirectory\b[^>]*\bphysicalPath="([^"]+)"/g
    )].map((match) => ({ path: match[1], physicalPath: match[2] }));
}

test("canonical verifier accepts customized SKILL prose but rejects template drift", async () => {
    const fixtureSkill = join(TEMP_ROOT, "customized-skill");
    await mkdir(join(fixtureSkill, "references"), { recursive: true });
    const [skillMarkdown] = await Promise.all([
        readFile(join(SKILL_DIRECTORY, "SKILL.md"), "utf8"),
        copyFile(TEMPLATE_PATH, join(fixtureSkill, "references", "Start-IISExpress.template.ps1")),
    ]);
    await writeFile(join(fixtureSkill, "SKILL.md"), `${skillMarkdown}\nLocal workflow note.\n`);

    const customized = await verifySkillDirectory(fixtureSkill);
    assert.equal(customized.valid, true);
    assert.equal(customized.contract.version, CANONICAL_VERSION);
    assert.equal(customized.contract.templateSha256, CANONICAL_TEMPLATE_SHA256);

    await writeFile(
        join(fixtureSkill, "references", "Start-IISExpress.template.ps1"),
        `${await readFile(TEMPLATE_PATH, "utf8")}\n# drift\n`
    );
    const drifted = await verifySkillDirectory(fixtureSkill);
    assert.equal(drifted.valid, false);
    assert.match(drifted.errors.join("\n"), /Template fingerprint mismatch/);
});

test("non-root rendered template maps root and virtual app to distinct physical directories", async () => {
    const fixture = await prepareFixture("non-root", "/MyApp");
    const mappings = applicationMappings(await readFile(fixture.configPath, "utf8"));
    assert.deepEqual(mappings.map((mapping) => mapping.path), ["/", "/MyApp"]);
    assert.equal(mappings[0].physicalPath, join(fixture.solutionRoot, ".vs", "config", "empty-root"));
    assert.equal(mappings[1].physicalPath, fixture.webProjectPath);
    assert.notEqual(mappings[0].physicalPath, mappings[1].physicalPath);
});

test("root-hosted rendered template maps root directly to the web project", async () => {
    const fixture = await prepareFixture("root", "/");
    const mappings = applicationMappings(await readFile(fixture.configPath, "utf8"));
    assert.deepEqual(mappings, [{ path: "/", physicalPath: fixture.webProjectPath }]);
});

test("rendered script carries current machine-readable provenance", async () => {
    const fixture = await prepareFixture("provenance", "/");
    const generated = await readFile(fixture.scriptPath, "utf8");
    assert.deepEqual(inspectGeneratedScript(generated), {
        valid: true,
        version: CANONICAL_VERSION,
    });
});

test("rendered template preserves PowerShell metacharacters in physical paths", async () => {
    const fixture = await prepareFixture("metachar-$repo's", "/");
    const mappings = applicationMappings(await readFile(fixture.configPath, "utf8"));
    assert.deepEqual(mappings, [{ path: "/", physicalPath: fixture.webProjectPath }]);
});

test("missing and stale provenance require regeneration", () => {
    const missing = inspectGeneratedScript("# generated script without provenance");
    assert.equal(missing.valid, false);
    assert.match(missing.reason, /no launching-iisexpress provenance marker.*regeneration is required/i);

    const stale = inspectGeneratedScript(
        "# IISExpressSkill-Provenance: skill=launching-iisexpress; version=1.1.0"
    );
    assert.equal(stale.valid, false);
    assert.match(stale.reason, /stale.*1\.1\.0 < 1\.1\.1.*regeneration is required/i);
});

test("verification entry point returns a nonzero status for a stale generated script", async () => {
    const staleScript = join(TEMP_ROOT, "Start-IISExpress.stale.ps1");
    await writeFile(
        staleScript,
        "# IISExpressSkill-Provenance: skill=launching-iisexpress; version=1.1.0\n"
    );
    const result = spawnSync(
        process.execPath,
        [join(SKILL_DIRECTORY, "verify.mjs"), "--generated-script", staleScript],
        { encoding: "utf8" }
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /stale.*regeneration is required/i);
});
