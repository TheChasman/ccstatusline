# Static Deploy on Exit & Save

## Problem

The `ccstatusline` command on this machine is a bun global symlink:

```
~/.bun/bin/ccstatusline → ~/.bun/install/global/node_modules/ccstatusline/dist/ccstatusline.js
~/.bun/install/global/node_modules/ccstatusline → /Users/chasnewport/Projects/CCStatusline-Chas   (OLD, broken)
```

Renaming the project folder (`CCStatusline-Chas` → `Cccstatusline`) breaks the second symlink. The command stops working until the link is rebuilt manually. This has happened more than once.

## Goal

Decouple the runtime command from the project folder. After every TUI **Exit & Save**, the `ccstatusline` command must keep working regardless of whether the project folder has been renamed, moved, or deleted.

## Solution

On Exit & Save (when running from source), build the current source and copy the bundle to a fixed, path-independent location. Point the PATH symlink at that copy. Never symlink into the project folder again.

### End state

| Path | Contents |
|---|---|
| `~/.config/ccstatusline/ccstatusline.js` | Real file. Overwritten on every save. Has `#!/usr/bin/env node` shebang. Mode `0755`. |
| `~/.config/ccstatusline/package.json` | `{"type": "module"}`. Silences Node's `MODULE_TYPELESS_PACKAGE_JSON` warning when the bundle runs outside the project tree. Written once if missing. |
| `~/.bun/bin/ccstatusline` | Symlink → `~/.config/ccstatusline/ccstatusline.js`. Stable. |
| `~/.config/ccstatusline/settings.json` | Unchanged — ccstatusline's own settings. |
| `~/.claude/settings.json` | Unchanged — `"statusLine.command": "ccstatusline"`. |

Renaming or deleting the project folder leaves all four intact.

## Exit & Save flow

On TUI save (existing `saveSettings` path in `src/utils/config.ts`):

1. Write ccstatusline settings to `~/.config/ccstatusline/settings.json` *(unchanged)*.
2. Sync widget hooks *(unchanged)*.
3. **New:** if in source mode, run static deploy:
   1. Run `bun build src/ccstatusline.ts --target=node --outfile=dist/ccstatusline.js --target-version=14` in a subprocess, cwd = project root.
   2. Run `scripts/replace-version.ts` (the existing `postbuild` step) against `dist/ccstatusline.js`.
   3. Copy `dist/ccstatusline.js` → `~/.config/ccstatusline/ccstatusline.js`.
   4. `chmod 0755` the destination.
   5. If `~/.config/ccstatusline/package.json` does not exist, write `{"type": "module"}` to it.
   6. Ensure `~/.bun/bin/ccstatusline` is a symlink to the destination. If it exists pointing elsewhere, replace it. If `~/.bun/bin/` does not exist, skip silently (no bun install).

### Source-mode detection

A "source mode" run is one where the TUI was launched from its own repo. Detect by:

- `package.json` exists in `process.cwd()`, AND
- its `name` field equals `ccstatusline`, AND
- `src/ccstatusline.ts` exists relative to `process.cwd()`.

If any check fails, skip the deploy step silently. Installed (npx/bunx) runs fall through unchanged.

### Failure handling

- **Build fails:** surface the bun build stderr in the TUI, keep the saved settings, do not touch the static file or the symlink. The previous good deploy remains in place.
- **Copy fails** (permissions, disk): surface the error, settings are already saved, symlink untouched.
- **Symlink update fails:** log a warning, continue. The static file is still current; only terminal-invoked `ccstatusline` might be stale.

Never half-deploy. Either the full sequence succeeds or the previous state is preserved.

## Components

### New: `src/utils/static-deploy.ts`

```ts
export interface DeployResult {
    deployed: boolean;         // false if not in source mode
    staticPath?: string;
    symlinkUpdated?: boolean;
    error?: string;            // human-readable, shown in TUI
}

export function isSourceMode(cwd?: string): boolean;
export async function deployStatic(cwd?: string): Promise<DeployResult>;
```

Responsibilities:
- `isSourceMode` — the three-check detection above.
- `deployStatic` — runs build, copies, chmods, updates symlink. Pure side-effects; returns a result object. No throws for expected failures (build fail, missing bun/bin dir) — return `error` instead.

### Modified: `src/utils/config.ts`

`saveSettings` gains a post-write deploy step:

```ts
export async function saveSettings(settings: Settings): Promise<DeployResult | null> {
    // ... existing write + hook sync
    if (isSourceMode()) {
        return await deployStatic();
    }
    return null;
}
```

Callers that care about the deploy result (the TUI save handler) can surface errors. Callers that don't can ignore the return value — the null case covers non-source runs.

### Modified: TUI save handler

Wherever Exit & Save is wired up today, show the deploy result:
- `{ deployed: true }` → quick "Deployed to `~/.config/ccstatusline/ccstatusline.js`" confirmation.
- `{ error }` → error shown to user, settings still saved.
- `null` → no message (not in source mode).

## Testing

- `isSourceMode` — unit test with a temp dir: returns true when package.json + src file present, false otherwise.
- `deployStatic` — integration test using a temp `HOME` and a minimal fake project: verify file is written, is executable, symlink is created/updated.
- Build-failure path — point at a syntax-broken source file, assert `error` is populated and destination file is unchanged.

Run via `bun test` (existing Vitest setup).

## Out of scope

- No new install option in the TUI install menu. Self-managed stays self-managed; the deploy is a side effect of saving from source, not a user-facing install type.
- No support for non-bun PATH layouts (`~/.local/bin`, `/usr/local/bin`). If bun isn't installed, the static file is still written; the user can wire it into PATH themselves.
- No rollback of the previous deploy on failure. The previous file is never touched until a new one is successfully written and ready to replace it (write to temp, rename).
