// Security regression tests for the Markdown renderer's URL scheme
// allow-list. These payloads mirror the exact vectors found and fixed
// across two independent 3-model reviews; keep each one here permanently
// so a future refactor of markdown.mjs can't silently reintroduce them.
//
// Run with: node --test .github/skills/managing-summary-canvas/extension/security.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

import { renderMarkdown } from "./markdown.mjs";

function assertNoScriptExecutionVector(html) {
    assert.doesNotMatch(html, /href="[^"]*javascript:/i);
    assert.doesNotMatch(html, /src="[^"]*javascript:/i);
    assert.doesNotMatch(html, /href="[^"]*data:/i);
    assert.doesNotMatch(html, /src="[^"]*data:/i);
}

test("plain javascript: link is dropped, not rendered as an anchor", () => {
    const html = renderMarkdown("[x](javascript:alert(1))");
    assertNoScriptExecutionVector(html);
    assert.doesNotMatch(html, /<a /);
});

test("data: URI image is dropped, not rendered as an <img>", () => {
    const html = renderMarkdown("![x](data:text/html,<script>alert(1)</script>)");
    assertNoScriptExecutionVector(html);
});

test("a leading C0 control character before javascript: does not bypass the scheme check", () => {
    // A raw \x01 immediately before the scheme isn't stripped by .trim()
    // and isn't matched by \s in the URL-capture regex, so a naive
    // "does this start with a letter" scheme test can be bypassed by it —
    // browsers strip C0 controls before resolving the scheme, so this is
    // exploitable if it slips through. See markdown.mjs's sanitizeUrlChars.
    const html = renderMarkdown("[x](\u0001javascript:alert`1`)");
    assertNoScriptExecutionVector(html);
    assert.doesNotMatch(html, /<a /);
});

test("a trailing/embedded C0 control character does not bypass the scheme check", () => {
    const html = renderMarkdown("[x](java\u0001script:alert`1`)");
    assertNoScriptExecutionVector(html);
});

test("uppercase/mixed-case JavaScript: scheme is still blocked", () => {
    const html = renderMarkdown("[x](JaVaScRiPt:alert`1`)");
    assertNoScriptExecutionVector(html);
});

test("http(s)/mailto/tel/relative URLs still render normally (no regression)", () => {
    assert.match(renderMarkdown("[ok](https://example.com/a)"), /<a href="https:\/\/example\.com\/a"/);
    assert.match(renderMarkdown("[ok](http://example.com)"), /<a href="http:\/\/example\.com"/);
    assert.match(renderMarkdown("[ok](mailto:a@b.com)"), /<a href="mailto:a@b\.com"/);
    assert.match(renderMarkdown("[ok](tel:+15555550100)"), /<a href="tel:\+15555550100"/);
    assert.match(renderMarkdown("[ok](/relative/path)"), /<a href="\/relative\/path"/);
    assert.match(renderMarkdown("[ok](#fragment)"), /<a href="#fragment"/);
});

test("ampersands in a safe URL are escaped exactly once (no double-escape)", () => {
    const html = renderMarkdown('[ok](https://example.com/a?b=1&c=2 "My Title")');
    assert.match(html, /href="https:\/\/example\.com\/a\?b=1&amp;c=2"/);
    assert.match(html, /title="My Title"/);
    assert.doesNotMatch(html, /&amp;amp;/);
});

test("raw <details>/<summary> attributes are always stripped", () => {
    const html = renderMarkdown(
        "<details ontoggle=\"alert(1)\">\n<summary onclick=\"alert(2)\">Label</summary>\n\nbody\n</details>"
    );
    assert.doesNotMatch(html, /ontoggle/);
    assert.doesNotMatch(html, /onclick/);
    assert.match(html, /<details>/);
    assert.match(html, /<summary>Label<\/summary>/);
});

test("bold/italic inside a link label still renders as HTML, not literal asterisks", () => {
    const html = renderMarkdown("[**bold** link](https://example.com)");
    assert.match(html, /<a href="https:\/\/example\.com"[^>]*><strong>bold<\/strong> link<\/a>/);
});

test("an ampersand in a link's fallback text (blocked URL) is escaped exactly once", () => {
    const html = renderMarkdown("[Tom & Jerry](javascript:alert(1))");
    assert.match(html, /Tom &amp; Jerry/);
    assert.doesNotMatch(html, /&amp;amp;/);
    assert.doesNotMatch(html, /<a /);
});

test("nested emphasis: an italic span inside a bold span still renders both", () => {
    const html = renderMarkdown("**bold *italic* bold**");
    assert.match(html, /<strong>bold <em>italic<\/em> bold<\/strong>/);
});
