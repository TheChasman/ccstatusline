# Git Dirty Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `GitDirtyWidget` that shows `↑N↓N●N` (unpushed/unpulled across all branches, dirty worktree count) and is absent when the repo is fully clean.

**Architecture:** Four new functions in `src/utils/git.ts` provide the raw data; a new `GitDirtyWidget` composes them. All git subprocess calls go through the existing `execSync`-based `runGit` or the new `runGitInDir` helper, sharing the module-level cache. The widget is registered in the manifest and exported from the widget index.

**Tech Stack:** TypeScript, Bun, Vitest, `child_process.execSync`, existing widget/git utility patterns.

---

## Files

| Action | Path | Purpose |
|---|---|---|
| Modify | `src/utils/git.ts` | Add `runGitInDir`, `getWorktreePaths`, `getTotalAheadBehind`, `getDirtyWorktreeCount` |
| Create | `src/utils/__tests__/git-dirty.test.ts` | Unit tests for the four new git functions |
| Create | `src/widgets/GitDirty.ts` | The widget |
| Create | `src/widgets/__tests__/GitDirty.test.ts` | Widget render tests |
| Modify | `src/widgets/index.ts` | Export `GitDirtyWidget` |
| Modify | `src/utils/widget-manifest.ts` | Register `'git-dirty'` type |

---

## Task 1: Add `runGitInDir` to `git.ts`

**Files:**
- Modify: `src/utils/git.ts`
- Create: `src/utils/__tests__/git-dirty.test.ts`

- [ ] **Step 1: Create the test file with a failing test for `runGitInDir`**

Create `src/utils/__tests__/git-dirty.test.ts`:

```typescript
import { execSync } from 'child_process';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import { clearGitCache, runGitInDir } from '../git';

vi.mock('child_process', () => ({ execSync: vi.fn() }));

const mockExecSync = execSync as unknown as {
    mockReturnValue: (v: string) => void;
    mockImplementation: (impl: (cmd: string, opts: { cwd?: string }) => string) => void;
};

describe('runGitInDir', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('runs git command in the specified directory', () => {
        mockExecSync.mockReturnValue('abc123\n');
        const result = runGitInDir('rev-parse HEAD', '/some/dir');
        expect(result).toBe('abc123');
        expect(execSync).toHaveBeenCalledWith(
            'git rev-parse HEAD',
            expect.objectContaining({ cwd: '/some/dir' })
        );
    });

    it('returns null on error', () => {
        mockExecSync.mockImplementation(() => { throw new Error('not a repo'); });
        expect(runGitInDir('status', '/not/git')).toBeNull();
    });

    it('returns null for empty output', () => {
        mockExecSync.mockReturnValue('\n');
        expect(runGitInDir('status --porcelain', '/clean')).toBeNull();
    });

    it('caches results — does not call execSync twice for the same command+dir', () => {
        mockExecSync.mockReturnValue('abc\n');
        runGitInDir('status', '/repo');
        runGitInDir('status', '/repo');
        expect(execSync).toHaveBeenCalledTimes(1);
    });

    it('treats different dirs as different cache keys', () => {
        mockExecSync.mockReturnValue('abc\n');
        runGitInDir('status', '/repo/a');
        runGitInDir('status', '/repo/b');
        expect(execSync).toHaveBeenCalledTimes(2);
    });
});
```

- [ ] **Step 2: Run the test — verify it fails with "runGitInDir is not exported"**

```bash
bun test src/utils/__tests__/git-dirty.test.ts
```

Expected: import error or test failure.

- [ ] **Step 3: Add `runGitInDir` to `src/utils/git.ts`**

Add after the `runGit` function (around line 50):

```typescript
export function runGitInDir(command: string, dir: string): string | null {
    const cacheKey = `${command}|${dir}`;

    if (gitCommandCache.has(cacheKey)) {
        return gitCommandCache.get(cacheKey) ?? null;
    }

    try {
        const output = execSync(`git ${command}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            cwd: dir
        }).trimEnd();

        const result = output.length > 0 ? output : null;
        gitCommandCache.set(cacheKey, result);
        return result;
    } catch {
        gitCommandCache.set(cacheKey, null);
        return null;
    }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
bun test src/utils/__tests__/git-dirty.test.ts
```

Expected: 5 passing tests under `runGitInDir`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/git.ts src/utils/__tests__/git-dirty.test.ts
git commit -m "feat(git): add runGitInDir helper with caching"
```

---

## Task 2: Add `getWorktreePaths` to `git.ts`

**Files:**
- Modify: `src/utils/git.ts`
- Modify: `src/utils/__tests__/git-dirty.test.ts`

- [ ] **Step 1: Add failing tests for `getWorktreePaths`**

Add to the import line in `git-dirty.test.ts`:
```typescript
import { clearGitCache, getWorktreePaths, runGitInDir } from '../git';
```

Add a new `describe` block at the end of the file:

```typescript
describe('getWorktreePaths', () => {
    const context = { data: { cwd: '/repo' } };

    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('returns paths parsed from worktree list --porcelain output', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true\n';
            if (cmd.includes('worktree list --porcelain')) {
                return [
                    'worktree /repo/main',
                    'HEAD abc123',
                    'branch refs/heads/main',
                    '',
                    'worktree /repo/feat',
                    'HEAD def456',
                    'branch refs/heads/feat',
                    ''
                ].join('\n');
            }
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getWorktreePaths(context)).toEqual(['/repo/main', '/repo/feat']);
    });

    it('returns a single path for a repo with no extra worktrees', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true\n';
            if (cmd.includes('worktree list --porcelain')) {
                return 'worktree /repo\nHEAD abc\nbranch refs/heads/main\n';
            }
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getWorktreePaths(context)).toEqual(['/repo']);
    });

    it('returns empty array when git is unavailable', () => {
        mockExecSync.mockImplementation(() => { throw new Error('no git'); });
        expect(getWorktreePaths(context)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run tests — verify the new tests fail**

```bash
bun test src/utils/__tests__/git-dirty.test.ts
```

Expected: `getWorktreePaths is not exported` or similar.

- [ ] **Step 3: Add `getWorktreePaths` to `src/utils/git.ts`**

Add after `runGitInDir`:

```typescript
export function getWorktreePaths(context: RenderContext): string[] {
    const output = runGit('worktree list --porcelain', context);
    if (!output) return [];

    const paths: string[] = [];
    for (const line of output.split('\n')) {
        if (line.startsWith('worktree ')) {
            paths.push(line.slice('worktree '.length));
        }
    }
    return paths;
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
bun test src/utils/__tests__/git-dirty.test.ts
```

Expected: all tests in `runGitInDir` and `getWorktreePaths` pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/git.ts src/utils/__tests__/git-dirty.test.ts
git commit -m "feat(git): add getWorktreePaths"
```

---

## Task 3: Add `getTotalAheadBehind` to `git.ts`

**Files:**
- Modify: `src/utils/git.ts`
- Modify: `src/utils/__tests__/git-dirty.test.ts`

- [ ] **Step 1: Add failing tests**

Update the import in `git-dirty.test.ts`:
```typescript
import { clearGitCache, getTotalAheadBehind, getWorktreePaths, runGitInDir } from '../git';
```

Add a new `describe` block:

```typescript
describe('getTotalAheadBehind', () => {
    const context = { data: { cwd: '/repo' } };

    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('sums ahead and behind counts across all branches', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true\n';
            if (cmd.includes('for-each-ref')) return '2 1\n1 0\n0 3\n';
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getTotalAheadBehind(context)).toEqual({ ahead: 3, behind: 4 });
    });

    it('skips empty lines (branches with no push upstream)', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true\n';
            if (cmd.includes('for-each-ref')) return '2 0\n\n1 1\n';
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getTotalAheadBehind(context)).toEqual({ ahead: 3, behind: 1 });
    });

    it('returns zeros when all branches are in sync', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('rev-parse --is-inside-work-tree')) return 'true\n';
            if (cmd.includes('for-each-ref')) return '0 0\n0 0\n';
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getTotalAheadBehind(context)).toEqual({ ahead: 0, behind: 0 });
    });

    it('returns zeros when not in a git repo', () => {
        mockExecSync.mockImplementation(() => { throw new Error('no git'); });
        expect(getTotalAheadBehind(context)).toEqual({ ahead: 0, behind: 0 });
    });
});
```

- [ ] **Step 2: Run tests — verify the new tests fail**

```bash
bun test src/utils/__tests__/git-dirty.test.ts
```

Expected: `getTotalAheadBehind is not exported`.

- [ ] **Step 3: Add `getTotalAheadBehind` to `src/utils/git.ts`**

Add the interface and function after `getWorktreePaths`:

```typescript
export interface TotalAheadBehind {
    ahead: number;
    behind: number;
}

export function getTotalAheadBehind(context: RenderContext): TotalAheadBehind {
    const output = runGit("for-each-ref '--format=%(ahead-behind:push)' refs/heads", context);
    if (!output) return { ahead: 0, behind: 0 };

    let ahead = 0;
    let behind = 0;

    for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length === 2) {
            const a = parseInt(parts[0] ?? '0', 10);
            const b = parseInt(parts[1] ?? '0', 10);
            if (!isNaN(a)) ahead += a;
            if (!isNaN(b)) behind += b;
        }
    }

    return { ahead, behind };
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
bun test src/utils/__tests__/git-dirty.test.ts
```

Expected: all tests in `runGitInDir`, `getWorktreePaths`, and `getTotalAheadBehind` pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/git.ts src/utils/__tests__/git-dirty.test.ts
git commit -m "feat(git): add getTotalAheadBehind using for-each-ref"
```

---

## Task 4: Add `getDirtyWorktreeCount` to `git.ts`

**Files:**
- Modify: `src/utils/git.ts`
- Modify: `src/utils/__tests__/git-dirty.test.ts`

- [ ] **Step 1: Add failing tests**

Update the import in `git-dirty.test.ts`:
```typescript
import { clearGitCache, getDirtyWorktreeCount, getTotalAheadBehind, getWorktreePaths, runGitInDir } from '../git';
```

Add a new `describe` block:

```typescript
describe('getDirtyWorktreeCount', () => {
    const context = { data: { cwd: '/repo' } };

    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('counts worktrees with uncommitted changes', () => {
        mockExecSync.mockImplementation(((cmd: string, opts: { cwd?: string }) => {
            if (cmd.includes('worktree list --porcelain')) {
                return [
                    'worktree /repo/main',
                    'HEAD abc',
                    'branch refs/heads/main',
                    '',
                    'worktree /repo/feat',
                    'HEAD def',
                    'branch refs/heads/feat',
                    '',
                    'worktree /repo/fix',
                    'HEAD ghi',
                    'branch refs/heads/fix',
                    ''
                ].join('\n');
            }
            if (cmd.includes('status --porcelain')) {
                if (opts?.cwd === '/repo/main') return '';         // clean
                if (opts?.cwd === '/repo/feat') return ' M src/file.ts\n'; // dirty
                if (opts?.cwd === '/repo/fix') return '?? new.ts\n';      // dirty
            }
            throw new Error(`unexpected cmd=${cmd} cwd=${opts?.cwd}`);
        }) as unknown as () => never);

        expect(getDirtyWorktreeCount(context)).toBe(2);
    });

    it('returns 0 when all worktrees are clean', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('worktree list --porcelain')) {
                return 'worktree /repo/main\nHEAD abc\nbranch refs/heads/main\n';
            }
            if (cmd.includes('status --porcelain')) return '';
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getDirtyWorktreeCount(context)).toBe(0);
    });

    it('returns 0 when git is unavailable', () => {
        mockExecSync.mockImplementation(() => { throw new Error('no git'); });
        expect(getDirtyWorktreeCount(context)).toBe(0);
    });
});
```

- [ ] **Step 2: Run tests — verify the new tests fail**

```bash
bun test src/utils/__tests__/git-dirty.test.ts
```

Expected: `getDirtyWorktreeCount is not exported`.

- [ ] **Step 3: Add `getDirtyWorktreeCount` to `src/utils/git.ts`**

Add after `getTotalAheadBehind`:

```typescript
export function getDirtyWorktreeCount(context: RenderContext): number {
    const paths = getWorktreePaths(context);
    let count = 0;
    for (const path of paths) {
        const status = runGitInDir('--no-optional-locks status --porcelain', path);
        if (status) count++;
    }
    return count;
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
bun test src/utils/__tests__/git-dirty.test.ts
```

Expected: all 16 tests across all four describe blocks pass.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
bun test
```

Expected: all existing tests continue to pass.

- [ ] **Step 6: Commit**

```bash
git add src/utils/git.ts src/utils/__tests__/git-dirty.test.ts
git commit -m "feat(git): add getDirtyWorktreeCount"
```

---

## Task 5: Create `GitDirtyWidget`

**Files:**
- Create: `src/widgets/GitDirty.ts`
- Create: `src/widgets/__tests__/GitDirty.test.ts`

- [ ] **Step 1: Write the failing widget tests**

Create `src/widgets/__tests__/GitDirty.test.ts`:

```typescript
import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import { GitDirtyWidget } from '../GitDirty';

vi.mock('../../utils/git', () => ({
    isInsideGitWorkTree: vi.fn(),
    getTotalAheadBehind: vi.fn(),
    getDirtyWorktreeCount: vi.fn()
}));

import {
    getDirtyWorktreeCount,
    getTotalAheadBehind,
    isInsideGitWorkTree
} from '../../utils/git';

const mockIsInside = isInsideGitWorkTree as unknown as { mockReturnValue: (v: boolean) => void };
const mockAheadBehind = getTotalAheadBehind as unknown as { mockReturnValue: (v: { ahead: number; behind: number }) => void };
const mockDirty = getDirtyWorktreeCount as unknown as { mockReturnValue: (v: number) => void };

const widget = new GitDirtyWidget();
const item: WidgetItem = { id: 'git-dirty', type: 'git-dirty' };
const context: RenderContext = { data: { cwd: '/repo' } };

describe('GitDirtyWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns preview string', () => {
        const previewContext: RenderContext = { isPreview: true };
        expect(widget.render(item, previewContext, DEFAULT_SETTINGS)).toBe('↑2↓3●1');
    });

    it('returns null when not inside a git repo', () => {
        mockIsInside.mockReturnValue(false);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBeNull();
    });

    it('returns null when repo is fully clean', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 0, behind: 0 });
        mockDirty.mockReturnValue(0);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBeNull();
    });

    it('shows only unpushed commits when only ahead', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 3, behind: 0 });
        mockDirty.mockReturnValue(0);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('↑3');
    });

    it('shows only behind count when only behind', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 0, behind: 2 });
        mockDirty.mockReturnValue(0);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('↓2');
    });

    it('shows only dirty count when only worktrees are dirty', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 0, behind: 0 });
        mockDirty.mockReturnValue(1);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('●1');
    });

    it('shows all three parts when all are non-zero', () => {
        mockIsInside.mockReturnValue(true);
        mockAheadBehind.mockReturnValue({ ahead: 2, behind: 3 });
        mockDirty.mockReturnValue(1);
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('↑2↓3●1');
    });

    it('has correct metadata', () => {
        expect(widget.getDefaultColor()).toBe('red');
        expect(widget.getDisplayName()).toBe('Git Dirty');
        expect(widget.getCategory()).toBe('Git');
        expect(widget.supportsRawValue()).toBe(false);
        expect(widget.supportsColors(item)).toBe(true);
    });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
bun test src/widgets/__tests__/GitDirty.test.ts
```

Expected: module not found error for `../GitDirty`.

- [ ] **Step 3: Create `src/widgets/GitDirty.ts`**

```typescript
import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import {
    getDirtyWorktreeCount,
    getTotalAheadBehind,
    isInsideGitWorkTree
} from '../utils/git';

export class GitDirtyWidget implements Widget {
    getDefaultColor(): string { return 'red'; }
    getDescription(): string { return 'Shows outstanding changes: ↑ unpushed and ↓ unpulled across all branches, ● dirty worktree count — absent when clean'; }
    getDisplayName(): string { return 'Git Dirty'; }
    getCategory(): string { return 'Git'; }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(_item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview) return '↑2↓3●1';
        if (!isInsideGitWorkTree(context)) return null;

        const { ahead, behind } = getTotalAheadBehind(context);
        const dirty = getDirtyWorktreeCount(context);

        if (ahead === 0 && behind === 0 && dirty === 0) return null;

        const parts: string[] = [];
        if (ahead > 0) parts.push(`↑${ahead}`);
        if (behind > 0) parts.push(`↓${behind}`);
        if (dirty > 0) parts.push(`●${dirty}`);

        return parts.join('');
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(_item: WidgetItem): boolean { return true; }
}
```

- [ ] **Step 4: Run widget tests — verify they pass**

```bash
bun test src/widgets/__tests__/GitDirty.test.ts
```

Expected: 9 passing tests.

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/GitDirty.ts src/widgets/__tests__/GitDirty.test.ts
git commit -m "feat(widget): add GitDirtyWidget"
```

---

## Task 6: Register the widget

**Files:**
- Modify: `src/widgets/index.ts`
- Modify: `src/utils/widget-manifest.ts`

- [ ] **Step 1: Export the widget from `src/widgets/index.ts`**

Add after the last `GitWorktree*` export line (currently `GitWorktreeOriginalBranchWidget`):

```typescript
export { GitDirtyWidget } from './GitDirty';
```

- [ ] **Step 2: Register in `src/utils/widget-manifest.ts`**

Add after line 34 (`git-conflicts`):

```typescript
    { type: 'git-dirty', create: () => new widgets.GitDirtyWidget() },
```

- [ ] **Step 3: Run type check and lint**

```bash
bun run lint
```

Expected: no errors, no warnings.

- [ ] **Step 4: Run full test suite**

```bash
bun test
```

Expected: all tests pass.

- [ ] **Step 5: Smoke test with piped input**

```bash
echo '{"model":{"id":"claude-sonnet-4-6"},"transcript_path":"test.jsonl"}' | bun run src/ccstatusline.ts
```

Expected: status line renders without errors.

- [ ] **Step 6: Commit**

```bash
git add src/widgets/index.ts src/utils/widget-manifest.ts
git commit -m "feat(widget): register git-dirty widget type"
```
