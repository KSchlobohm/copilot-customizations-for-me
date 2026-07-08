// Extracts the "## Action Items" checklist from a Markdown document, so the
// extension can answer "what/how many tasks are left" without the caller
// having to keep the full Markdown in its own memory.

export function parseActionItems(markdown) {
    const lines = (markdown ?? "").replace(/\r\n/g, "\n").split("\n");
    const items = [];

    let inSection = false;
    for (const line of lines) {
        const heading = line.match(/^#{1,6}\s+(.*)$/);
        if (heading) {
            inSection = /^action items$/i.test(heading[1].trim());
            continue;
        }
        if (!inSection) continue;

        const task = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
        if (task) {
            items.push({ text: task[2].trim(), done: task[1].toLowerCase() === "x" });
        }
    }

    return items;
}

export function summarizeActionItems(markdown) {
    const items = parseActionItems(markdown);
    const done = items.filter((i) => i.done).length;
    return {
        items,
        total: items.length,
        done,
        remaining: items.length - done,
    };
}
