# GitHub Packages + bunx Distribution Design

## Goal

Eliminate the commit → push → switch machine → pull → build → deploy friction. After this change, publishing a new version is `git push` (with a version bump in package.json), and picking it up on Mac 2 is `bunx @thechasman/ccstatusline@latest` once in a terminal.

## Overview

Publish ccstatusline to GitHub Packages (private npm registry) under the scoped name `@thechasman/ccstatusline`. GitHub Actions builds and publishes automatically when the version in `package.json` is bumped. Claude Code switches from the local binary to `bunx @thechasman/ccstatusline`. Each machine authenticates via a GitHub Personal Access Token stored in `~/.npmrc`.

---

## Section 1: Package & CI

### Package rename

- `package.json` `name` changes from `"ccstatusline"` to `"@thechasman/ccstatusline"`
- Add `publishConfig` to `package.json`:
  ```json
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
  ```
- Add `"release"` script for manual publishing if ever needed:
  ```json
  "release": "bun run build && npm publish"
  ```

### Project-level `.npmrc` (committed to git, no secrets)

New file `.npmrc` in the project root:
```
@thechasman:registry=https://npm.pkg.github.com
```
This tells npm/bun which registry to use for the `@thechasman` scope, for both CI publishing and local development.

### GitHub Actions workflow

New file `.github/workflows/publish.yml`:

```yaml
name: Publish to GitHub Packages

on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Check if version already published
        id: version_check
        run: |
          VERSION=$(node -p "require('./package.json').version")
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          if npm view @thechasman/ccstatusline@$VERSION version \
               --registry https://npm.pkg.github.com 2>/dev/null; then
            echo "exists=true" >> $GITHUB_OUTPUT
          else
            echo "exists=false" >> $GITHUB_OUTPUT
          fi
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build
        if: steps.version_check.outputs.exists == 'false'
        run: bun run build

      - name: Publish
        if: steps.version_check.outputs.exists == 'false'
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Key points:
- Uses `GITHUB_TOKEN` (auto-provided by Actions, no extra secret needed)
- Checks whether the current version already exists before publishing — skips silently if so
- Only builds when a publish will actually happen (saves CI time on non-version-bump pushes)

---

## Section 2: Machine Setup (one-time per Mac)

Each machine needs a GitHub Personal Access Token to authenticate with GitHub Packages for installation/execution.

### Create the PAT (once, shared across both Macs)

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens (or classic tokens)
2. Classic token scopes needed: `read:packages`
3. No expiry (or set a long expiry and note it)

### Configure `~/.npmrc` on each Mac

Add two lines to `~/.npmrc` (create the file if it doesn't exist):
```
@thechasman:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_PAT_HERE
```

This file lives in the home directory and is never committed to git.

### Verify (after first publish)

```bash
npm view @thechasman/ccstatusline --registry https://npm.pkg.github.com
```

---

## Section 3: Claude Code Config & TUI

### Claude Code `~/.claude/settings.json`

Change `statusLine.command` from:
```json
"command": "ccstatusline"
```
to:
```json
"command": "bunx @thechasman/ccstatusline"
```

bunx caches the package locally after the first fetch — subsequent runs are fast (no network hit per prompt). To pick up a new version: `bunx @thechasman/ccstatusline@latest` once in a terminal.

### TUI install option (`src/utils/claude-settings.ts`)

The TUI currently offers three install command options (npm, bunx, self-managed). Update the bunx constant to use `@thechasman/ccstatusline`:

- Old: `bunx ccstatusline` (public npm)
- New: `bunx @thechasman/ccstatusline` (GitHub Packages, private)

The self-managed option (`bun run deploy`) remains for local development iteration without publishing.

---

## Versioning

Manual SemVer — edit `package.json` version before pushing when you want to publish a new release. Pushes without a version bump are built by CI but not published.

Workflow for a new release:
1. Make changes, commit as usual
2. When ready: bump version in `package.json` (e.g. `2.2.8 → 2.2.9`), commit `chore: bump version to 2.2.9`, push
3. CI detects new version, builds and publishes automatically

---

## Files Changed

| Action | Path |
|---|---|
| Modify | `package.json` — rename, publishConfig, release script |
| Create | `.npmrc` — scope registry mapping |
| Create | `.github/workflows/publish.yml` — CI publish workflow |
| Modify | `src/utils/claude-settings.ts` — update bunx install command |
| Modify | `~/.claude/settings.json` — update statusLine command (Mac 1) |
| Document | `~/.npmrc` setup on each Mac (not a code change) |
