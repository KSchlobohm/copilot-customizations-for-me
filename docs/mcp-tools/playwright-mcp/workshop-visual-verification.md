# Workshop: Visual Verification in Action

## Scenario: Compare Responsive Layouts

Let's walk through how Playwright MCP enables visual comparison — using a public site so there's nothing to set up.

## Prerequisites for this workshop
- Playwright MCP configured and verified (see [setup guide](README.md))
- That's it — no local app needed

---

## Step 1: Capture a desktop screenshot

```
Navigate to https://playwright.dev and take a screenshot at a 1440px viewport width.
```

**Expected outcome:** Copilot uses Playwright to navigate to the site and captures a full-width screenshot. You can see the desktop layout of the Playwright docs homepage.

## Step 2: Capture a mobile screenshot

```
Now take a screenshot of the same page at 375px viewport width.
```

**Expected outcome:** Copilot captures a mobile-width screenshot of the same page.

## Step 3: Ask Copilot to write a comparison report

```
Write a report comparing the desktop and mobile screenshots. What are the key
differences in layout, navigation, and content presentation between the two?
```

**Expected outcome:** Copilot writes a structured comparison — navigation changes (hamburger vs full nav), content reflow (stacked vs side-by-side), element visibility differences, spacing adjustments, etc.

---

## The "Aha" Moment

Notice what just happened:
1. **Copilot can see your page** — it's no longer coding blind when it comes to visual outcomes
2. **It can compare states** — before/after, desktop/mobile, expected/actual — without you describing the differences
3. **It can gather its own feedback** — when debugging web views, Copilot can now look at the result, identify what's wrong, and iterate — just like you would with DevTools open

This is the foundation for all visual debugging workflows. Once Copilot can see what the browser renders, it can reason about CSS, layout, responsiveness, and regressions on its own.
