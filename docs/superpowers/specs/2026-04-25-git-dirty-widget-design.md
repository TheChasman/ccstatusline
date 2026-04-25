# Git Dirty Widget — Design Spec

**Date:** 2026-04-25  
**Status:** Approved

## Problem

When moving between machines, the user needs to know at a glance whether each machine is fully clean — nothing uncommitted, nothing unpushed, and nothing on the remote waiting to be pulled. Existing widgets cover these individually but require the user to read multiple values. The Dirty widget aggregates all three signals into one absent-or-present indicator.

## Display Format

`↑N↓N●N`

Each part is omitted when its count is zero. The widget is absent entirely when all are zero — absence means safe to switch.

| Output | Meaning |
|---|---|
| `↑2` | 2 commits unpushed across all local branches |
| `↓3` | 3 commits on remote not yet pulled |
| `●1` | 1 worktree with uncommitted changes |
| `↑2↓3●1` | All three outstanding |
| *(absent)* | Fully clean — safe to switch machines |

## Scope

- **`↑N` and `↓N`** — all local branches that have a configured push upstream. Branches with no upstream are skipped (no reference to measure against). Uses a single `git for-each-ref` call — one process regardless of branch count.
- **`●N`** — all worktrees (checked-out working directories). Uncommitted changes are only possible in a worktree. One `git status --porcelain` call per worktree.

## Git Plumbing

### New helper: `runGitInDir(command, dir)`

Same implementation as `runGit` but takes an explicit directory string instead of a `RenderContext`. Uses the same `gitCommandCache` with key `command|dir`. Needed for per-worktree status checks where we have a path rather than a context.

### New functions in `git.ts`

**`getWorktreePaths(context): string[]`**  
Runs `git worktree list --porcelain`, parses lines starting with `worktree `, returns absolute paths.

**`getTotalAheadBehind(context): { ahead: number; behind: number }`**  
Runs `git for-each-ref --format='%(ahead-behind:push)' refs/heads`. Each output line is `"A B"` (ahead behind) for branches with a push upstream, or empty for branches without one. Sums both columns across all branches.

**`getDirtyWorktreeCount(context): number`**  
Calls `getWorktreePaths`, then `runGitInDir('--no-optional-locks status --porcelain', path)` for each path. Counts paths with non-empty output.

### Process count per render

`2 + N` where N = number of worktrees:
- 1× `worktree list --porcelain`
- 1× `for-each-ref` (all branches, one call)
- N× `status --porcelain` (one per worktree)

The current worktree's status call hits the shared cache if another widget already ran it. Typical overhead for 2–3 worktrees is imperceptible on an M1.

## Widget

**File:** `src/widgets/GitDirty.ts`  
**Type:** `'git-dirty'`  
**Display name:** Git Dirty  
**Category:** Git  
**Default colour:** red  
**Supports colours:** yes  
**Supports raw value:** no  
**Preview output:** `↑2↓3●1`

Render logic:
1. Return `null` if not inside a git work tree.
2. Call `getTotalAheadBehind` and `getDirtyWorktreeCount`.
3. Return `null` if all values are zero.
4. Build output: prepend `↑{ahead}` if ahead > 0, `↓{behind}` if behind > 0, append `●{count}` if count > 0.

No custom keybinds. No hide-no-git toggle (widget already returns null outside git).

## Registration

- `src/widgets/index.ts` — export `GitDirtyWidget`
- `src/utils/widget-manifest.ts` — add `{ type: 'git-dirty', create: () => new widgets.GitDirtyWidget() }`
- `src/types/WidgetItemType.ts` (or equivalent union type) — add `'git-dirty'`

## Tests

**`src/utils/__tests__/git-dirty.test.ts`**
- `getTotalAheadBehind`: mocked `runGit` with for-each-ref output covering ahead-only, behind-only, mixed, empty lines (no upstream), and all-zero lines
- `getDirtyWorktreeCount`: mocked `getWorktreePaths` returning 3 paths, mocked `runGitInDir` returning dirty/clean combos

**`src/widgets/__tests__/GitDirty.test.ts`**
- clean → `null`
- unpushed only → `↑3`
- behind only → `↓2`
- dirty worktrees only → `●1`
- all three → `↑3↓2●1`
- not in git repo → `null`
- preview → `↑2↓3●1`
