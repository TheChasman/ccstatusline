# Static Deploy on Exit & Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every TUI save, rebuild the bundle and copy it to a path-independent static location (`~/.config/ccstatusline/ccstatusline.js`), repointing `~/.bun/bin/ccstatusline` at the copy. Renaming the project folder must no longer break the `ccstatusline` command.

**Architecture:** A new `src/utils/static-deploy.ts` module exposes `isSourceMode()` and `deployStatic()` plus small internal helpers (copy, chmod, ensure package.json, ensure symlink). `saveSettings` in `src/utils/config.ts` calls `deployStatic()` after writing settings when `isSourceMode()` is true, returns a `DeployResult | null`. The two TUI save call sites in `src/tui/App.tsx` surface any error via the existing `flashMessage` mechanism.

**Tech Stack:** TypeScript, Bun runtime, Node.js `fs`/`fs/promises`, `child_process.execFileSync` for invoking `bun run build`. Vitest for tests (existing setup).

**Spec:** `docs/superpowers/specs/2026-04-24-static-deploy-design.md`.

**Key constants** (defined once in `src/utils/static-deploy.ts` and reused):
- `STATIC_DIR` = `path.join(os.homedir(), '.config', 'ccstatusline')`
- `STATIC_JS` = `path.join(STATIC_DIR, 'ccstatusline.js')`
- `STATIC_PKG` = `path.join(STATIC_DIR, 'package.json')`
- `BUN_BIN_LINK` = `path.join(os.homedir(), '.bun', 'bin', 'ccstatusline')`

All filesystem operations run in the user's real `$HOME` in production; tests override `os.homedir()` via dependency injection (see Task 1).

---

### Task 1: Scaffold `static-deploy.ts` with DI-friendly path helpers

**Files:**
- Create: `src/utils/static-deploy.ts`
- Create: `src/utils/__tests__/static-deploy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/__tests__/static-deploy.test.ts
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { resolvePaths } from '../static-deploy';

describe('resolvePaths', () => {
    it('derives all four paths from a given home dir', () => {
        const p = resolvePaths('/fake/home');
        expect(p.staticDir).toBe(path.join('/fake/home', '.config', 'ccstatusline'));
        expect(p.staticJs).toBe(path.join('/fake/home', '.config', 'ccstatusline', 'ccstatusline.js'));
        expect(p.staticPkg).toBe(path.join('/fake/home', '.config', 'ccstatusline', 'package.json'));
        expect(p.bunBinLink).toBe(path.join('/fake/home', '.bun', 'bin', 'ccstatusline'));
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: FAIL — `Cannot find module '../static-deploy'`.

- [ ] **Step 3: Create the module**

```ts
// src/utils/static-deploy.ts
import * as os from 'os';
import * as path from 'path';

export interface StaticPaths {
    staticDir: string;
    staticJs: string;
    staticPkg: string;
    bunBinLink: string;
}

export function resolvePaths(homeDir: string = os.homedir()): StaticPaths {
    const staticDir = path.join(homeDir, '.config', 'ccstatusline');
    return {
        staticDir,
        staticJs: path.join(staticDir, 'ccstatusline.js'),
        staticPkg: path.join(staticDir, 'package.json'),
        bunBinLink: path.join(homeDir, '.bun', 'bin', 'ccstatusline')
    };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/utils/static-deploy.ts src/utils/__tests__/static-deploy.test.ts
git commit -m "feat(static-deploy): add path resolver module skeleton"
```

---

### Task 2: Implement and test `isSourceMode`

**Files:**
- Modify: `src/utils/static-deploy.ts`
- Modify: `src/utils/__tests__/static-deploy.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/__tests__/static-deploy.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { isSourceMode } from '../static-deploy';

describe('isSourceMode', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), 'ccsl-src-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('returns true when package.json has name "ccstatusline" and src/ccstatusline.ts exists', () => {
        writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'ccstatusline' }));
        mkdirSync(path.join(dir, 'src'));
        writeFileSync(path.join(dir, 'src', 'ccstatusline.ts'), '// entry');
        expect(isSourceMode(dir)).toBe(true);
    });

    it('returns false when package.json is missing', () => {
        mkdirSync(path.join(dir, 'src'));
        writeFileSync(path.join(dir, 'src', 'ccstatusline.ts'), '// entry');
        expect(isSourceMode(dir)).toBe(false);
    });

    it('returns false when package.json has a different name', () => {
        writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'other' }));
        mkdirSync(path.join(dir, 'src'));
        writeFileSync(path.join(dir, 'src', 'ccstatusline.ts'), '// entry');
        expect(isSourceMode(dir)).toBe(false);
    });

    it('returns false when src/ccstatusline.ts is missing', () => {
        writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'ccstatusline' }));
        expect(isSourceMode(dir)).toBe(false);
    });

    it('returns false when package.json is malformed', () => {
        writeFileSync(path.join(dir, 'package.json'), 'not json');
        mkdirSync(path.join(dir, 'src'));
        writeFileSync(path.join(dir, 'src', 'ccstatusline.ts'), '// entry');
        expect(isSourceMode(dir)).toBe(false);
    });
});
```

Add these imports at the top of the test file if not already present: `beforeEach`, `afterEach` from `vitest`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: FAIL — `isSourceMode is not exported` or 5 failing assertions.

- [ ] **Step 3: Implement `isSourceMode`**

Append to `src/utils/static-deploy.ts`:

```ts
import * as fs from 'fs';

export function isSourceMode(cwd: string = process.cwd()): boolean {
    const packageJsonPath = path.join(cwd, 'package.json');
    const entryPath = path.join(cwd, 'src', 'ccstatusline.ts');

    if (!fs.existsSync(packageJsonPath) || !fs.existsSync(entryPath)) {
        return false;
    }

    try {
        const raw = fs.readFileSync(packageJsonPath, 'utf-8');
        const parsed = JSON.parse(raw) as { name?: unknown };
        return parsed.name === 'ccstatusline';
    } catch {
        return false;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: PASS (6 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/utils/static-deploy.ts src/utils/__tests__/static-deploy.test.ts
git commit -m "feat(static-deploy): detect source mode via package.json + entry file"
```

---

### Task 3: Implement `writeStaticFiles` (copy + chmod + package.json)

This task handles the filesystem writes that stage the bundle at `~/.config/ccstatusline/`. Build invocation is a separate concern handled in Task 5.

**Files:**
- Modify: `src/utils/static-deploy.ts`
- Modify: `src/utils/__tests__/static-deploy.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/__tests__/static-deploy.test.ts`:

```ts
import { statSync, readFileSync, existsSync, symlinkSync } from 'fs';
import { writeStaticFiles } from '../static-deploy';

describe('writeStaticFiles', () => {
    let home: string;
    let srcBundle: string;

    beforeEach(() => {
        home = mkdtempSync(path.join(tmpdir(), 'ccsl-home-'));
        const project = mkdtempSync(path.join(tmpdir(), 'ccsl-proj-'));
        srcBundle = path.join(project, 'dist', 'ccstatusline.js');
        mkdirSync(path.dirname(srcBundle), { recursive: true });
        writeFileSync(srcBundle, '#!/usr/bin/env node\nconsole.log("hi")\n');
    });

    afterEach(() => {
        rmSync(home, { recursive: true, force: true });
    });

    it('copies the bundle to the static path', async () => {
        await writeStaticFiles(srcBundle, home);
        const target = path.join(home, '.config', 'ccstatusline', 'ccstatusline.js');
        expect(existsSync(target)).toBe(true);
        expect(readFileSync(target, 'utf-8')).toContain('console.log("hi")');
    });

    it('chmods the copy to 0o755', async () => {
        await writeStaticFiles(srcBundle, home);
        const target = path.join(home, '.config', 'ccstatusline', 'ccstatusline.js');
        const mode = statSync(target).mode & 0o777;
        expect(mode).toBe(0o755);
    });

    it('writes package.json with {"type":"module"} if missing', async () => {
        await writeStaticFiles(srcBundle, home);
        const pkg = path.join(home, '.config', 'ccstatusline', 'package.json');
        expect(existsSync(pkg)).toBe(true);
        expect(JSON.parse(readFileSync(pkg, 'utf-8'))).toEqual({ type: 'module' });
    });

    it('does not overwrite an existing package.json', async () => {
        mkdirSync(path.join(home, '.config', 'ccstatusline'), { recursive: true });
        const pkg = path.join(home, '.config', 'ccstatusline', 'package.json');
        writeFileSync(pkg, JSON.stringify({ type: 'module', custom: true }));
        await writeStaticFiles(srcBundle, home);
        expect(JSON.parse(readFileSync(pkg, 'utf-8'))).toEqual({ type: 'module', custom: true });
    });

    it('creates the static directory if it does not exist', async () => {
        await writeStaticFiles(srcBundle, home);
        expect(existsSync(path.join(home, '.config', 'ccstatusline'))).toBe(true);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: FAIL — `writeStaticFiles is not exported`.

- [ ] **Step 3: Implement `writeStaticFiles`**

Append to `src/utils/static-deploy.ts`:

```ts
import * as fsp from 'fs/promises';

export async function writeStaticFiles(sourceBundle: string, homeDir: string = os.homedir()): Promise<void> {
    const paths = resolvePaths(homeDir);
    await fsp.mkdir(paths.staticDir, { recursive: true });
    await fsp.copyFile(sourceBundle, paths.staticJs);
    await fsp.chmod(paths.staticJs, 0o755);
    if (!fs.existsSync(paths.staticPkg)) {
        await fsp.writeFile(paths.staticPkg, JSON.stringify({ type: 'module' }) + '\n', 'utf-8');
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: PASS (11 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/utils/static-deploy.ts src/utils/__tests__/static-deploy.test.ts
git commit -m "feat(static-deploy): write bundle + package.json to static dir"
```

---

### Task 4: Implement `ensureBunBinSymlink`

**Files:**
- Modify: `src/utils/static-deploy.ts`
- Modify: `src/utils/__tests__/static-deploy.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/__tests__/static-deploy.test.ts`:

```ts
import { lstatSync, readlinkSync } from 'fs';
import { ensureBunBinSymlink } from '../static-deploy';

describe('ensureBunBinSymlink', () => {
    let home: string;
    let target: string;

    beforeEach(() => {
        home = mkdtempSync(path.join(tmpdir(), 'ccsl-link-'));
        target = path.join(home, '.config', 'ccstatusline', 'ccstatusline.js');
        mkdirSync(path.dirname(target), { recursive: true });
        writeFileSync(target, '// target');
    });

    afterEach(() => {
        rmSync(home, { recursive: true, force: true });
    });

    it('returns { updated: false } when ~/.bun/bin does not exist', async () => {
        const result = await ensureBunBinSymlink(home);
        expect(result).toEqual({ updated: false, reason: 'no-bun-bin' });
    });

    it('creates the symlink when ~/.bun/bin exists and link is absent', async () => {
        mkdirSync(path.join(home, '.bun', 'bin'), { recursive: true });
        const result = await ensureBunBinSymlink(home);
        const linkPath = path.join(home, '.bun', 'bin', 'ccstatusline');
        expect(result).toEqual({ updated: true });
        expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
        expect(readlinkSync(linkPath)).toBe(target);
    });

    it('replaces an existing symlink pointing elsewhere', async () => {
        mkdirSync(path.join(home, '.bun', 'bin'), { recursive: true });
        const linkPath = path.join(home, '.bun', 'bin', 'ccstatusline');
        symlinkSync('/some/other/path', linkPath);
        const result = await ensureBunBinSymlink(home);
        expect(result).toEqual({ updated: true });
        expect(readlinkSync(linkPath)).toBe(target);
    });

    it('is a no-op when the symlink already points to the target', async () => {
        mkdirSync(path.join(home, '.bun', 'bin'), { recursive: true });
        const linkPath = path.join(home, '.bun', 'bin', 'ccstatusline');
        symlinkSync(target, linkPath);
        const result = await ensureBunBinSymlink(home);
        expect(result).toEqual({ updated: false, reason: 'already-correct' });
    });

    it('replaces a regular file at the link path', async () => {
        mkdirSync(path.join(home, '.bun', 'bin'), { recursive: true });
        const linkPath = path.join(home, '.bun', 'bin', 'ccstatusline');
        writeFileSync(linkPath, 'not a symlink');
        const result = await ensureBunBinSymlink(home);
        expect(result).toEqual({ updated: true });
        expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
        expect(readlinkSync(linkPath)).toBe(target);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: FAIL — `ensureBunBinSymlink is not exported`.

- [ ] **Step 3: Implement `ensureBunBinSymlink`**

Append to `src/utils/static-deploy.ts`:

```ts
export interface SymlinkResult {
    updated: boolean;
    reason?: 'no-bun-bin' | 'already-correct';
}

export async function ensureBunBinSymlink(homeDir: string = os.homedir()): Promise<SymlinkResult> {
    const paths = resolvePaths(homeDir);
    const bunBinDir = path.dirname(paths.bunBinLink);

    if (!fs.existsSync(bunBinDir)) {
        return { updated: false, reason: 'no-bun-bin' };
    }

    // Check existing entry at link path
    let existing: fs.Stats | null = null;
    try {
        existing = fs.lstatSync(paths.bunBinLink);
    } catch {
        existing = null;
    }

    if (existing?.isSymbolicLink()) {
        const current = fs.readlinkSync(paths.bunBinLink);
        if (current === paths.staticJs) {
            return { updated: false, reason: 'already-correct' };
        }
    }

    if (existing) {
        await fsp.unlink(paths.bunBinLink);
    }
    await fsp.symlink(paths.staticJs, paths.bunBinLink);
    return { updated: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: PASS (16 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/utils/static-deploy.ts src/utils/__tests__/static-deploy.test.ts
git commit -m "feat(static-deploy): ensure ~/.bun/bin/ccstatusline symlink"
```

---

### Task 5: Implement `deployStatic` orchestrator

Runs `bun run build` in the project, then calls `writeStaticFiles` + `ensureBunBinSymlink`. Returns a `DeployResult` capturing success/failure without throwing.

**Files:**
- Modify: `src/utils/static-deploy.ts`
- Modify: `src/utils/__tests__/static-deploy.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/__tests__/static-deploy.test.ts`:

```ts
import { deployStatic, type DeployResult } from '../static-deploy';

describe('deployStatic', () => {
    let project: string;
    let home: string;

    beforeEach(() => {
        project = mkdtempSync(path.join(tmpdir(), 'ccsl-deploy-'));
        home = mkdtempSync(path.join(tmpdir(), 'ccsl-deploy-home-'));
        // Minimal fake project: package.json + src entry + a pre-built dist file.
        // We stub the build by providing a custom runBuild that just touches dist/ccstatusline.js.
        writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'ccstatusline' }));
        mkdirSync(path.join(project, 'src'));
        writeFileSync(path.join(project, 'src', 'ccstatusline.ts'), '// entry');
    });

    afterEach(() => {
        rmSync(project, { recursive: true, force: true });
        rmSync(home, { recursive: true, force: true });
    });

    it('returns { deployed: true } and writes all files on success', async () => {
        const result: DeployResult = await deployStatic({
            cwd: project,
            homeDir: home,
            runBuild: async (cwd) => {
                mkdirSync(path.join(cwd, 'dist'), { recursive: true });
                writeFileSync(path.join(cwd, 'dist', 'ccstatusline.js'), '#!/usr/bin/env node\n// built\n');
            }
        });
        expect(result.deployed).toBe(true);
        expect(result.error).toBeUndefined();
        expect(existsSync(path.join(home, '.config', 'ccstatusline', 'ccstatusline.js'))).toBe(true);
        expect(result.staticPath).toBe(path.join(home, '.config', 'ccstatusline', 'ccstatusline.js'));
    });

    it('returns { deployed: false, error } when the build throws', async () => {
        const result = await deployStatic({
            cwd: project,
            homeDir: home,
            runBuild: async () => { throw new Error('bun build failed: syntax error'); }
        });
        expect(result.deployed).toBe(false);
        expect(result.error).toContain('bun build failed: syntax error');
        // Static file must not be created when build fails.
        expect(existsSync(path.join(home, '.config', 'ccstatusline', 'ccstatusline.js'))).toBe(false);
    });

    it('returns { deployed: false, error } when dist/ccstatusline.js is missing after build', async () => {
        const result = await deployStatic({
            cwd: project,
            homeDir: home,
            runBuild: async () => { /* no-op, produces no output */ }
        });
        expect(result.deployed).toBe(false);
        expect(result.error).toContain('dist/ccstatusline.js not found');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: FAIL — `deployStatic is not exported`.

- [ ] **Step 3: Implement `deployStatic`**

Append to `src/utils/static-deploy.ts`:

```ts
import { execFileSync } from 'child_process';

export interface DeployResult {
    deployed: boolean;
    staticPath?: string;
    symlinkUpdated?: boolean;
    error?: string;
}

export interface DeployOptions {
    cwd?: string;
    homeDir?: string;
    runBuild?: (cwd: string) => Promise<void>;
}

async function defaultRunBuild(cwd: string): Promise<void> {
    execFileSync('bun', ['run', 'build'], { cwd, stdio: 'pipe' });
}

export async function deployStatic(options: DeployOptions = {}): Promise<DeployResult> {
    const cwd = options.cwd ?? process.cwd();
    const homeDir = options.homeDir ?? os.homedir();
    const runBuild = options.runBuild ?? defaultRunBuild;
    const paths = resolvePaths(homeDir);

    try {
        await runBuild(cwd);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { deployed: false, error: msg };
    }

    const bundle = path.join(cwd, 'dist', 'ccstatusline.js');
    if (!fs.existsSync(bundle)) {
        return { deployed: false, error: `dist/ccstatusline.js not found after build (looked in ${bundle})` };
    }

    try {
        await writeStaticFiles(bundle, homeDir);
        const linkResult = await ensureBunBinSymlink(homeDir);
        return {
            deployed: true,
            staticPath: paths.staticJs,
            symlinkUpdated: linkResult.updated
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { deployed: false, error: msg };
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/utils/__tests__/static-deploy.test.ts`
Expected: PASS (19 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/utils/static-deploy.ts src/utils/__tests__/static-deploy.test.ts
git commit -m "feat(static-deploy): orchestrate build + copy + symlink in deployStatic"
```

---

### Task 6: Wire `deployStatic` into `saveSettings`

`saveSettings` already writes the settings file and syncs widget hooks. Add a post-save deploy when in source mode, and change the return type to `Promise<DeployResult | null>` so callers can surface errors.

**Files:**
- Modify: `src/utils/config.ts`
- Modify: `src/utils/__tests__/config.test.ts`

- [ ] **Step 1: Read the existing saveSettings**

Run: `grep -n "saveSettings" src/utils/config.ts`
Expected: shows lines around 151 where `saveSettings` is defined.

- [ ] **Step 2: Write the failing test**

Append to `src/utils/__tests__/config.test.ts` (imports may need merging with existing top-of-file imports):

```ts
import { vi } from 'vitest';

describe('saveSettings static deploy integration', () => {
    it('returns null when not in source mode', async () => {
        vi.doMock('../static-deploy', () => ({
            isSourceMode: () => false,
            deployStatic: vi.fn()
        }));
        vi.resetModules();
        const { saveSettings: save } = await import('../config');
        const result = await save({ lines: [[]] } as unknown as Settings);
        expect(result).toBeNull();
        vi.doUnmock('../static-deploy');
    });

    it('invokes deployStatic and returns its result when in source mode', async () => {
        const deployResult = { deployed: true, staticPath: '/tmp/fake.js' };
        const deployStub = vi.fn().mockResolvedValue(deployResult);
        vi.doMock('../static-deploy', () => ({
            isSourceMode: () => true,
            deployStatic: deployStub
        }));
        vi.resetModules();
        const { saveSettings: save } = await import('../config');
        const result = await save({ lines: [[]] } as unknown as Settings);
        expect(deployStub).toHaveBeenCalledOnce();
        expect(result).toEqual(deployResult);
        vi.doUnmock('../static-deploy');
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test src/utils/__tests__/config.test.ts`
Expected: FAIL — return type is `void`, assertions on `result` fail.

- [ ] **Step 4: Modify `saveSettings`**

Replace the existing `saveSettings` in `src/utils/config.ts`:

```ts
export async function saveSettings(settings: Settings): Promise<DeployResult | null> {
    const paths = getSettingsPaths();

    // Always include version when saving
    const settingsWithVersion = {
        ...settings,
        version: CURRENT_VERSION
    };

    await writeSettingsJson(settingsWithVersion, paths);

    // Sync widget hooks to Claude settings
    try {
        const { syncWidgetHooks } = await import('./hooks');
        await syncWidgetHooks(settings);
    } catch { /* ignore hook sync failures */ }

    // Deploy the built bundle to a path-independent static location when
    // running from the ccstatusline source tree. Returns null otherwise.
    const { isSourceMode, deployStatic } = await import('./static-deploy');
    if (!isSourceMode()) {
        return null;
    }
    return await deployStatic();
}
```

Add the type import at the top of `src/utils/config.ts`:

```ts
import type { DeployResult } from './static-deploy';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/utils/__tests__/config.test.ts`
Expected: PASS (all existing tests still pass + 2 new).

- [ ] **Step 6: Run the whole test suite to catch regressions**

Run: `bun test`
Expected: PASS — including existing `saveSettings` tests. If any existing test fails because the return type changed, update the test to allow a nullable return (the value was previously discarded anyway).

- [ ] **Step 7: Commit**

```bash
git add src/utils/config.ts src/utils/__tests__/config.test.ts
git commit -m "feat(config): trigger static deploy from saveSettings in source mode"
```

---

### Task 7: Surface deploy result in TUI save handlers

`src/tui/App.tsx` has two save call sites: the Ctrl+S global shortcut (line ~172) and the main menu `'save'` case (line ~294). Both need to show errors when deploy fails, and a subtle success message when it deploys (so the user knows something useful happened).

No unit test — this is React/Ink UI plumbing verified by manual TUI run.

**Files:**
- Modify: `src/tui/App.tsx`

- [ ] **Step 1: Add a shared deploy-message helper**

Near the top of `App.tsx`, inside the component, add:

```tsx
const applyDeployFlash = (
    result: Awaited<ReturnType<typeof saveSettings>>,
    baseMessage: string
) => {
    if (!result) {
        setFlashMessage({ text: baseMessage, color: 'green' });
        return;
    }
    if (result.error) {
        setFlashMessage({
            text: `${baseMessage} — deploy failed: ${result.error}`,
            color: 'red'
        });
        return;
    }
    setFlashMessage({
        text: `${baseMessage} — deployed to ~/.config/ccstatusline/ccstatusline.js`,
        color: 'green'
    });
};
```

Place this alongside the other helpers in the component body (e.g., near `handleInstallSelection`).

- [ ] **Step 2: Update the Ctrl+S handler**

Replace the existing Ctrl+S block (around lines 170–180) with:

```tsx
if (key.ctrl && input === 's' && settings) {
    void (async () => {
        const result = await saveSettings(settings);
        setOriginalSettings(cloneSettings(settings));
        setHasChanges(false);
        applyDeployFlash(result, '✓ Configuration saved');
    })();
}
```

- [ ] **Step 3: Update the `'save'` main-menu case**

Replace the existing `case 'save':` block (around lines 293–298) with:

```tsx
case 'save': {
    const result = await saveSettings(settings);
    setOriginalSettings(cloneSettings(settings));
    setHasChanges(false);
    if (result?.error) {
        // Surface the error before exiting so the user sees it in their terminal.
        console.error(`Deploy failed: ${result.error}`);
    }
    exit();
    break;
}
```

Note the braces around the case — they create a block scope for the `result` binding, matching existing patterns where other cases use blocks.

- [ ] **Step 4: Type-check and lint**

Run: `bun run lint`
Expected: PASS.

- [ ] **Step 5: Manual TUI verification**

Run: `bun run start`
- Make any change (e.g., toggle a widget).
- Press Ctrl+S. Expected: green flash "✓ Configuration saved — deployed to ~/.config/ccstatusline/ccstatusline.js".
- Exit TUI. Verify `~/.config/ccstatusline/ccstatusline.js` mtime just changed (`ls -la ~/.config/ccstatusline/ccstatusline.js`).
- Verify `~/.bun/bin/ccstatusline` still resolves (`ls -la ~/.bun/bin/ccstatusline`).
- Verify the command still runs (`echo '{"model":{"id":"x"},"transcript_path":"/tmp/x"}' | ccstatusline`).

- [ ] **Step 6: Commit**

```bash
git add src/tui/App.tsx
git commit -m "feat(tui): surface static deploy status on save"
```

---

### Task 8: End-to-end verification and README note

- [ ] **Step 1: Rename-resilience manual test**

From outside the project (e.g. in `/tmp`), run: `echo '{"model":{"id":"claude-sonnet-4-5-20250929"},"transcript_path":"/tmp/nonexistent"}' | ccstatusline`
Expected: statusline renders without errors.

Rename the project folder temporarily:

```bash
mv /Users/chasnewport/Projects/Cccstatusline /Users/chasnewport/Projects/Cccstatusline-renamed-test
echo '{"model":{"id":"claude-sonnet-4-5-20250929"},"transcript_path":"/tmp/nonexistent"}' | ccstatusline
```

Expected: still renders (static path is unaffected). Then rename back:

```bash
mv /Users/chasnewport/Projects/Cccstatusline-renamed-test /Users/chasnewport/Projects/Cccstatusline
```

- [ ] **Step 2: Update README with a brief note**

In the "Development" or similar section of `README.md`, add:

```markdown
### Static deploy on save

When you run the TUI from this repo and hit Exit & Save (or Ctrl+S), the
build is re-run and the resulting bundle is copied to
`~/.config/ccstatusline/ccstatusline.js`. The global `ccstatusline` command
is symlinked there (via `~/.bun/bin/ccstatusline`), so renaming or moving
this project folder no longer breaks the command. Installed copies
(`npx`/`bunx`) are unaffected — the static deploy only runs when the TUI
detects it is executing from the `ccstatusline` source tree.
```

- [ ] **Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: note static-deploy behaviour for development builds"
```

---

## Self-Review Notes

**Spec coverage:** every bullet under "End state", "Exit & Save flow", "Source-mode detection", "Failure handling", and "Components" maps to a task (1 → paths; 2 → source mode; 3 → copy + chmod + package.json; 4 → symlink; 5 → orchestrator with failure paths; 6 → wire into saveSettings; 7 → TUI surface; 8 → e2e + docs). The "Out of scope" items (no new install option, no non-bun PATH, no rollback) are respected — no tasks add them.

**Placeholder scan:** no TBDs. All code shown inline; all commands runnable; all file paths explicit.

**Type consistency:** `DeployResult`, `SymlinkResult`, `DeployOptions`, `StaticPaths` defined once in Task 1/3/4/5 and reused in Task 6 without rename. `isSourceMode`, `writeStaticFiles`, `ensureBunBinSymlink`, `deployStatic` signatures are stable across tasks.
