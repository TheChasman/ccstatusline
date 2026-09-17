import {
    beforeEach,
    describe,
    expect,
    it
} from 'vitest';

import type {
    GitCommandOptions,
    GitCommandRunner,
    RenderContext
} from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import { clearGitCache } from '../../utils/git';
import { GitDirtyWidget } from '../GitDirty';

interface WorktreeState {
    path: string;
    dirty: boolean;
}

function createGitCommandRunner(config: {
    insideWorkTree?: boolean;
    hasUpstream?: boolean;
    ahead?: number;
    behind?: number;
    defaultBranch?: string;
    currentBranch?: string;
    fallbackAhead?: number;
    fallbackBehind?: number;
    worktrees?: WorktreeState[];
} = {}): GitCommandRunner {
    const {
        insideWorkTree = true,
        hasUpstream = true,
        ahead = 0,
        behind = 0,
        defaultBranch,
        currentBranch,
        fallbackAhead = 0,
        fallbackBehind = 0,
        worktrees = [{ path: '/repo', dirty: false }]
    } = config;

    return (command: string, options: GitCommandOptions) => {
        const sub = command.replace(/^git\s+/, '');

        if (sub === 'rev-parse --is-inside-work-tree')
            return insideWorkTree ? 'true\n' : 'false\n';

        if (sub === 'rev-list --left-right --count HEAD...@{upstream}') {
            if (!hasUpstream)
                throw new Error('fatal: no upstream configured for branch');
            return `${ahead}\t${behind}\n`;
        }

        if (defaultBranch && sub === `rev-list --left-right --count HEAD...${defaultBranch}`)
            return `${fallbackAhead}\t${fallbackBehind}\n`;

        if (sub === 'symbolic-ref --short refs/remotes/origin/HEAD') {
            if (!defaultBranch)
                throw new Error(`unexpected git call: ${sub}`);
            return `origin/${defaultBranch}\n`;
        }

        if (sub === 'rev-parse --abbrev-ref HEAD') {
            if (!currentBranch)
                throw new Error(`unexpected git call: ${sub}`);
            return `${currentBranch}\n`;
        }

        if (sub === 'worktree list --porcelain') {
            return worktrees
                .map(wt => `worktree ${wt.path}\nHEAD abc\nbranch refs/heads/main\n`)
                .join('\n');
        }

        if (sub === '--no-optional-locks status --porcelain') {
            const match = worktrees.find(wt => wt.path === options.cwd);
            return match?.dirty ? ' M src/file.ts\n' : '';
        }

        throw new Error(`unexpected git call: ${sub} (cwd=${options.cwd ?? ''})`);
    };
}

function render(options: {
    isPreview?: boolean;
    gitCommandRunner?: GitCommandRunner;
    worktreePath?: string;
} = {}) {
    const widget = new GitDirtyWidget();
    const context: RenderContext = {
        isPreview: options.isPreview,
        data: {
            cwd: '/repo',
            ...(options.worktreePath ? { worktree: { path: options.worktreePath } } : {})
        },
        gitCommandRunner: options.gitCommandRunner ?? createGitCommandRunner()
    };
    const item: WidgetItem = { id: 'git-dirty', type: 'git-dirty' };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('GitDirtyWidget', () => {
    beforeEach(() => {
        clearGitCache();
    });

    it('returns preview string', () => {
        expect(render({ isPreview: true })).toBe('↑2↓3●1');
    });

    it('returns null when not inside a git repo', () => {
        expect(render({ gitCommandRunner: createGitCommandRunner({ insideWorkTree: false }) })).toBeNull();
    });

    it('shows zeros when repo is fully clean', () => {
        expect(render({ gitCommandRunner: createGitCommandRunner({ ahead: 0, behind: 0 }) })).toBe('↑0↓0●0');
    });

    it('shows all parts when only ahead', () => {
        expect(render({ gitCommandRunner: createGitCommandRunner({ ahead: 3, behind: 0 }) })).toBe('↑3↓0●0');
    });

    it('falls back to the default branch when the feature branch has no upstream', () => {
        expect(render({
            gitCommandRunner: createGitCommandRunner({
                hasUpstream: false,
                defaultBranch: 'main',
                currentBranch: 'feature/test',
                fallbackAhead: 1,
                fallbackBehind: 0
            })
        })).toBe('↑1↓0●0');
    });

    it('shows zeros on a clean default branch with no upstream', () => {
        // The fallback rev-list would report 5 ahead / 2 behind; the guard
        // that skips the fallback when already on the default branch must win.
        expect(render({
            gitCommandRunner: createGitCommandRunner({
                hasUpstream: false,
                defaultBranch: 'main',
                currentBranch: 'main',
                fallbackAhead: 5,
                fallbackBehind: 2
            })
        })).toBe('↑0↓0●0');
    });

    it('shows all parts when only behind', () => {
        expect(render({ gitCommandRunner: createGitCommandRunner({ ahead: 0, behind: 2 }) })).toBe('↑0↓2●0');
    });

    it('shows all parts when only worktrees are dirty', () => {
        expect(render({
            gitCommandRunner: createGitCommandRunner({
                ahead: 0,
                behind: 0,
                worktrees: [{ path: '/repo', dirty: true }]
            })
        })).toBe('↑0↓0●1');
    });

    it('counts only the active worktree when an explicit path is provided', () => {
        expect(render({
            worktreePath: '/active',
            gitCommandRunner: createGitCommandRunner({
                worktrees: [
                    { path: '/repo', dirty: true },
                    { path: '/active', dirty: false }
                ]
            })
        })).toBe('↑0↓0●0');
    });

    it('shows all three parts when all are non-zero', () => {
        expect(render({
            gitCommandRunner: createGitCommandRunner({
                ahead: 2,
                behind: 3,
                worktrees: [{ path: '/repo', dirty: true }]
            })
        })).toBe('↑2↓3●1');
    });

    it('has correct metadata', () => {
        const widget = new GitDirtyWidget();
        const item: WidgetItem = { id: 'git-dirty', type: 'git-dirty' };

        expect(widget.getDefaultColor()).toBe('red');
        expect(widget.getDisplayName()).toBe('Git Dirty');
        expect(widget.getCategory()).toBe('Git');
        expect(widget.supportsRawValue()).toBe(false);
        expect(widget.supportsColors(item)).toBe(true);
    });
});
