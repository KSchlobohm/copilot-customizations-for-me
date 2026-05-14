# Prerequisite: Installing Playwright

Before configuring the Playwright MCP server, you need Playwright installed and working. This guide walks through the installation and verification steps.

## System Requirements

- **Node.js**: latest 20.x, 22.x, or 24.x
- **Windows**: Windows 11+, Windows Server 2019+, or WSL
- **macOS**: 14 (Sonoma) or later
- **Linux**: Debian 12/13, Ubuntu 22.04/24.04 (x86-64 or arm64)

## Step 1: Verify Node.js

Confirm you have a supported Node.js version:

```bash
node --version
```

You should see `v20.x`, `v22.x`, or `v24.x`. If not, install Node.js from [nodejs.org](https://nodejs.org/) or use a version manager like `nvm`.

## Step 2: Install Playwright

In your project directory (or a test project if you just want to set up the MCP tool):

```bash
npm init playwright@latest
```

When prompted:
- **Language**: TypeScript (recommended) or JavaScript
- **Tests folder**: `tests` (default) or `e2e`
- **GitHub Actions workflow**: Yes if you plan to run in CI
- **Install browsers**: Yes ← this is critical

This creates:
```
playwright.config.ts     # Test configuration
package.json             # With @playwright/test dependency
tests/
  example.spec.ts        # Starter test
```

## Step 3: Verify Browser Installation

Playwright downloads its own browser binaries (~200MB for Chromium). Confirm they're installed:

```bash
npx playwright install --with-deps
```

This downloads Chromium, Firefox, and WebKit along with any OS-level dependencies.

To install only Chromium (smaller, sufficient for MCP):

```bash
npx playwright install chromium
```

## Step 4: Run the Example Test

Verify everything works end-to-end:

```bash
npx playwright test
```

**Expected output**: Tests run against Chromium, Firefox, and WebKit (headless). You should see passing results.

To see the browser window during tests:

```bash
npx playwright test --headed
```

## Step 5: Verify with a Screenshot (Optional but Recommended)

This confirms the browser automation that the MCP server will rely on. Create a quick script:

```typescript
// verify-screenshot.ts
import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://github.com');
  await page.screenshot({ path: 'verify-screenshot.png' });
  await browser.close();
  console.log('Screenshot saved to verify-screenshot.png');
})();
```

Run it:

```bash
npx tsx verify-screenshot.ts
```

If you see the screenshot file created, Playwright is fully functional and ready for MCP.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `node --version` not found | Node.js not installed or not in PATH | Install from nodejs.org |
| Browser download fails | Network/proxy issue | Set `HTTPS_PROXY` env var, or try `npx playwright install --with-deps` |
| Tests fail with "browser not found" | Browsers weren't installed | Run `npx playwright install --with-deps` |
| Permission errors on Linux | Missing OS dependencies | Run `npx playwright install-deps` (installs system packages) |

## Next Step

Once Playwright is installed and verified, proceed to [Playwright MCP Setup](README.md) to configure the MCP server for Copilot.
