// Small, dependency-free Markdown -> HTML renderer.
//
// This is a pragmatic GFM subset, not a full CommonMark implementation:
// headings, bold/italic, inline code, fenced code blocks, unordered/ordered
// lists (incl. GFM task list checkboxes), pipe tables, links, images,
// blockquotes, horizontal rules, paragraphs, and a sanitized <details>/
// <summary> passthrough (so "collapse this section" authoring works without
// extra syntax). Rendered output is injected into an iframe via
// `innerHTML`, so this renderer treats all input as untrusted: no arbitrary
// raw HTML, attributes are always stripped from <details>/<summary>, and
// link/image URLs are scheme-validated (http/https/mailto/tel/relative
// only) to block `javascript:`/`data:` injection. It intentionally does not
// support nested lists.

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Inline-level formatting, in careful order:
//  1. Code spans are extracted first (escaped once), so their contents are
//     immune to everything else.
//  2. Links/images are extracted from the *raw* (not yet escaped) text, so
//     their `"title"` syntax still has literal quotes to match, and each
//     piece (label/href/src/title) is escaped exactly once when building the
//     replacement HTML. Hrefs/srcs are scheme-validated to block
//     `javascript:`/`data:`/etc. — disallowed schemes drop the link/image
//     entirely and fall back to plain (escaped) text.
//  3. The remaining plain text is escaped, then bold/italic/strikethrough
//     run on it, using boundary-aware underscore rules so identifiers like
//     `variable_name_here` aren't misread as emphasis.
//  4. Both placeholder kinds are restored, code last (so restored code
//     contents can't be re-interpreted by the emphasis regexes).
const SAFE_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

// Browsers strip ASCII control characters (the C0 range plus DEL) from a URL
// before resolving its scheme, so a raw control byte placed immediately
// before `javascript:`/`data:` can otherwise slip past a naive "starts with
// a letter" scheme check (the leading byte isn't whitespace, so .trim()
// alone won't remove it). Strip them up front so the safety check and the
// rendered href/src see exactly what a browser will act on.
function sanitizeUrlChars(url) {
    return url.replace(/[\u0000-\u001F\u007F]/g, "");
}

function isSafeUrl(url) {
    const trimmed = url.trim();
    // Relative/local URLs (no scheme, or fragment/absolute-path) are fine.
    if (/^[#/.]/.test(trimmed) || !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
        return true;
    }
    const scheme = trimmed.slice(0, trimmed.indexOf(":") + 1).toLowerCase();
    return SAFE_URL_SCHEMES.has(scheme);
}

// Applies bold/italic/strikethrough to already-escaped text. Shared by the
// main inline pass and by link labels (link labels are rendered as HTML
// content, `<a>...</a>`, so they should support the same emphasis as the
// surrounding text — unlike an <img> `alt` attribute, which is plain text
// and never gets this treatment).
function applyEmphasis(escapedText) {
    let out = escapedText;
    // Non-greedy and content-agnostic (not `[^*]+`) so bold can contain a
    // nested single-asterisk italic span, e.g. `**bold *italic* bold**` --
    // matching up to the *nearest* `**` rather than refusing to match at all
    // when the content contains any `*`. The italic pass below still runs
    // on the substituted text and picks up the inner `*italic*` normally.
    out = out.replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
    // Double/single underscore emphasis: GFM ignores underscores flanked by
    // word characters (e.g. `variable_name_here`), so require a non-word
    // boundary (start/whitespace/punctuation) on both sides.
    out = out.replace(/(^|[^\w])__([^_\s](?:[^_]*[^_\s])?)__(?=$|[^\w])/g, "$1<strong>$2</strong>");
    out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
    out = out.replace(/(^|[^\w])_([^_\s](?:[^_]*[^_\s])?)_(?=$|[^\w])/g, "$1<em>$2</em>");
    out = out.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    return out;
}

function renderInline(text) {
    const codeSpans = [];
    let out = text.replace(/`([^`]+)`/g, (_, code) => {
        codeSpans.push(escapeHtml(code));
        return `\u0000CODE${codeSpans.length - 1}\u0000`;
    });

    const htmlSpans = [];
    function stash(html) {
        htmlSpans.push(html);
        return `\u0000HTML${htmlSpans.length - 1}\u0000`;
    }

    // Images: ![alt](src "title") — matched against raw text, before escaping.
    out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (whole, alt, rawSrc, title) => {
        const src = sanitizeUrlChars(rawSrc);
        if (!isSafeUrl(src)) return stash(applyEmphasis(escapeHtml(alt)));
        const t = title ? ` title="${escapeHtml(title)}"` : "";
        return stash(`<img alt="${escapeHtml(alt)}" src="${escapeHtml(src)}"${t} style="max-width:100%;" />`);
    });
    // Links: [text](href "title")
    out = out.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (whole, label, rawHref, title) => {
        const href = sanitizeUrlChars(rawHref);
        const renderedLabel = applyEmphasis(escapeHtml(label));
        if (!isSafeUrl(href)) return stash(renderedLabel);
        const t = title ? ` title="${escapeHtml(title)}"` : "";
        return stash(`<a href="${escapeHtml(href)}"${t} target="_blank" rel="noopener noreferrer">${renderedLabel}</a>`);
    });

    out = escapeHtml(out);

    out = applyEmphasis(out);

    out = out.replace(/\u0000HTML(\d+)\u0000/g, (_, i) => htmlSpans[Number(i)]);
    out = out.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => `<code>${codeSpans[Number(i)]}</code>`);
    return out;
}

function isTableSeparator(line) {
    return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("-");
}

function splitTableRow(line) {
    let cells = line.trim();
    if (cells.startsWith("|")) cells = cells.slice(1);
    if (cells.endsWith("|")) cells = cells.slice(0, -1);
    return cells.split("|").map((c) => c.trim());
}

export function renderMarkdown(markdown) {
    const lines = (markdown ?? "").replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let i = 0;
    let listStack = null; // { type: 'ul'|'ol' }
    let inBlockquote = false;

    function closeList() {
        if (listStack) {
            html.push(listStack.type === "ol" ? "</ol>" : "</ul>");
            listStack = null;
        }
    }
    function closeBlockquote() {
        if (inBlockquote) {
            html.push("</blockquote>");
            inBlockquote = false;
        }
    }

    while (i < lines.length) {
        const line = lines[i];

        // <details>/<summary> passthrough, sanitized: attributes are always
        // stripped (no event-handler injection via e.g. `<details open
        // ontoggle=...>`), and any inline content on a <summary>...</summary>
        // line goes through the normal inline renderer rather than being
        // emitted raw.
        const detailsOpen = line.match(/^\s*<details\b[^>]*>\s*$/i);
        const detailsClose = line.match(/^\s*<\/details>\s*$/i);
        const summaryInline = line.match(/^\s*<summary\b[^>]*>(.*)<\/summary>\s*$/i);
        const summaryOpen = line.match(/^\s*<summary\b[^>]*>\s*$/i);
        const summaryClose = line.match(/^\s*<\/summary>\s*$/i);
        if (detailsOpen || detailsClose || summaryInline || summaryOpen || summaryClose) {
            closeList();
            closeBlockquote();
            if (detailsOpen) html.push("<details>");
            else if (detailsClose) html.push("</details>");
            else if (summaryInline) html.push(`<summary>${renderInline(summaryInline[1])}</summary>`);
            else if (summaryOpen) html.push("<summary>");
            else if (summaryClose) html.push("</summary>");
            i++;
            continue;
        }

        // Fenced code block.
        const fenceMatch = line.match(/^```(\w*)\s*$/);
        if (fenceMatch) {
            closeList();
            closeBlockquote();
            const lang = fenceMatch[1] ? ` class="language-${escapeHtml(fenceMatch[1])}"` : "";
            const codeLines = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // skip closing fence
            html.push(`<pre><code${lang}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
            continue;
        }

        // Blank line.
        if (line.trim() === "") {
            closeList();
            closeBlockquote();
            i++;
            continue;
        }

        // Horizontal rule.
        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
            closeList();
            closeBlockquote();
            html.push("<hr />");
            i++;
            continue;
        }

        // Headings.
        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            closeList();
            closeBlockquote();
            const level = headingMatch[1].length;
            html.push(`<h${level}>${renderInline(headingMatch[2].trim())}</h${level}>`);
            i++;
            continue;
        }

        // Blockquote.
        const quoteMatch = line.match(/^>\s?(.*)$/);
        if (quoteMatch) {
            closeList();
            if (!inBlockquote) {
                html.push("<blockquote>");
                inBlockquote = true;
            }
            html.push(`<p>${renderInline(quoteMatch[1])}</p>`);
            i++;
            continue;
        }
        closeBlockquote();

        // Pipe table: header line, separator line, then body rows.
        if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
            closeList();
            const headerCells = splitTableRow(line);
            i += 2;
            const bodyRows = [];
            while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
                bodyRows.push(splitTableRow(lines[i]));
                i++;
            }
            html.push("<table>");
            html.push("<thead><tr>" + headerCells.map((c) => `<th>${renderInline(c)}</th>`).join("") + "</tr></thead>");
            html.push("<tbody>");
            for (const row of bodyRows) {
                html.push("<tr>" + row.map((c) => `<td>${renderInline(c)}</td>`).join("") + "</tr>");
            }
            html.push("</tbody></table>");
            continue;
        }

        // GFM task list item: - [ ] / - [x]
        const taskMatch = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
        if (taskMatch) {
            if (!listStack || listStack.type !== "ul") {
                closeList();
                html.push('<ul class="task-list">');
                listStack = { type: "ul" };
            }
            const checked = taskMatch[1].toLowerCase() === "x";
            html.push(
                `<li class="task-list-item"><input type="checkbox" disabled${checked ? " checked" : ""} /> ${renderInline(
                    taskMatch[2]
                )}</li>`
            );
            i++;
            continue;
        }

        // Unordered list item.
        const ulMatch = line.match(/^\s*[-*+]\s+(.*)$/);
        if (ulMatch) {
            if (!listStack || listStack.type !== "ul") {
                closeList();
                html.push("<ul>");
                listStack = { type: "ul" };
            }
            html.push(`<li>${renderInline(ulMatch[1])}</li>`);
            i++;
            continue;
        }

        // Ordered list item.
        const olMatch = line.match(/^\s*\d+[.)]\s+(.*)$/);
        if (olMatch) {
            if (!listStack || listStack.type !== "ol") {
                closeList();
                html.push("<ol>");
                listStack = { type: "ol" };
            }
            html.push(`<li>${renderInline(olMatch[1])}</li>`);
            i++;
            continue;
        }

        closeList();

        // Paragraph: gather contiguous plain-text lines.
        const paraLines = [line];
        i++;
        while (
            i < lines.length &&
            lines[i].trim() !== "" &&
            !/^#{1,6}\s/.test(lines[i]) &&
            !/^```/.test(lines[i]) &&
            !/^\s*[-*+]\s+/.test(lines[i]) &&
            !/^\s*\d+[.)]\s+/.test(lines[i]) &&
            !/^>\s?/.test(lines[i]) &&
            !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) &&
            !/^\s*<\/?(details|summary)\b/i.test(lines[i])
        ) {
            paraLines.push(lines[i]);
            i++;
        }
        html.push(`<p>${renderInline(paraLines.join(" "))}</p>`);
    }

    closeList();
    closeBlockquote();
    return html.join("\n");
}
