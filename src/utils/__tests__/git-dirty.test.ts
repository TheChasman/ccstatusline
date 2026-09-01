import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type {
    GitCommandOptions,
    GitCommandRunner,
    RenderContext
} from '../../types/RenderContext';
import {
    clearGitCache,
    getDirtyWorktreeCount,
    getTotalAheadBehind,
    getWorktreePaths,
    runGitInDir
} from '../git';

const mockGitRunner = vi.fn<GitCommandRunner>();

describe('runGitInDir', () => {
    beforeEach(() => {
        mockGitRunner.mockReset();
        clearGitCache();
    });

    it('runs git command in the specified directory', () => {
        mockGitRunner.mockReturnValue('abc123\n');
        const result = runGitInDir('rev-parse HEAD', '/some/dir', mockGitRunner);
        expect(result).toBe('abc123');
        expect(mockGitRunner).toHaveBeenCalledWith(
            'git rev-parse HEAD',
            expect.objectContaining({ cwd: '/some/dir' })
        );
    });

    it('returns null on error', () => {
        mockGitRunner.mockImplementation(() => { throw new Error('not a repo'); });
        expect(runGitInDir('status', '/not/git', mockGitRunner)).toBeNull();
    });

    it('returns null for empty output', () => {
        mockGitRunner.mockReturnValue('\n');
        expect(runGitInDir('status --porcelain', '/clean', mockGitRunner)).toBeNull();
    });

    it('does not cache injected runner results', () => {
        mockGitRunner.mockReturnValue('abc\n');
        runGitInDir('status', '/repo', mockGitRunner);
        runGitInDir('status', '/repo', mockGitRunner);
        expect(mockGitRunner).toHaveBeenCalledTimes(2);
    });

    it('passes each directory to the injected runner', () => {
        mockGitRunner.mockReturnValue('abc\n');
        runGitInDir('status', '/repo/a', mockGitRunner);
        runGitInDir('status', '/repo/b', mockGitRunner);
        expect(mockGitRunner.mock.calls.map(([, options]) => options.cwd)).toEqual(['/repo/a', '/repo/b']);
    });
});

describe('getWorktreePaths', () => {
    const context: RenderContext = {
        data: { cwd: '/repo' },
        gitCommandRunner: mockGitRunner
    };

    beforeEach(() => {
        mockGitRunner.mockReset();
        clearGitCache();
    });

    it('returns paths parsed from worktree list --porcelain output', () => {
        mockGitRunner.mockImplementation((cmd: string) => {
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
        });

        expect(getWorktreePaths(context)).toEqual(['/repo/main', '/repo/feat']);
    });

    it('returns a single path for a repo with no extra worktrees', () => {
        mockGitRunner.mockImplementation((cmd: string) => {
            if (cmd.includes('worktree list --porcelain')) {
                return 'worktree /repo\nHEAD abc\nbranch refs/heads/main\n';
            }
            throw new Error(`unexpected: ${cmd}`);
        });

        expect(getWorktreePaths(context)).toEqual(['/repo']);
    });

    it('returns empty array when git is unavailable', () => {
        mockGitRunner.mockImplementation(() => { throw new Error('no git'); });
        expect(getWorktreePaths(context)).toEqual([]);
    });
});

describe('getTotalAheadBehind', () => {
    const context: RenderContext = {
        data: { cwd: '/repo' },
        gitCommandRunner: mockGitRunner
    };

    beforeEach(() => {
        mockGitRunner.mockReset();
        clearGitCache();
    });

    it('sums ahead and behind counts across all branches', () => {
        mockGitRunner.mockImplementation((cmd: string) => {
            if (cmd.includes('for-each-ref'))
                return '2 1\n1 0\n0 3\n';
            throw new Error(`unexpected: ${cmd}`);
        });

        expect(getTotalAheadBehind(context)).toEqual({ ahead: 3, behind: 4 });
    });

    it('skips empty lines (branches with no push upstream)', () => {
        mockGitRunner.mockImplementation((cmd: string) => {
            if (cmd.includes('for-each-ref'))
                return '2 0\n\n1 1\n';
            throw new Error(`unexpected: ${cmd}`);
        });

        expect(getTotalAheadBehind(context)).toEqual({ ahead: 3, behind: 1 });
    });

    it('returns zeros when all branches are in sync', () => {
        mockGitRunner.mockImplementation((cmd: string) => {
            if (cmd.includes('for-each-ref'))
                return '0 0\n0 0\n';
            throw new Error(`unexpected: ${cmd}`);
        });

        expect(getTotalAheadBehind(context)).toEqual({ ahead: 0, behind: 0 });
    });

    it('returns zeros when not in a git repo', () => {
        mockGitRunner.mockImplementation(() => { throw new Error('no git'); });
        expect(getTotalAheadBehind(context)).toEqual({ ahead: 0, behind: 0 });
    });
});

describe('getDirtyWorktreeCount', () => {
    const context: RenderContext = {
        data: { cwd: '/repo' },
        gitCommandRunner: mockGitRunner
    };

    beforeEach(() => {
        mockGitRunner.mockReset();
        clearGitCache();
    });

    it('counts worktrees with uncommitted changes', () => {
        mockGitRunner.mockImplementation((cmd: string, opts: GitCommandOptions) => {
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
                if (opts.cwd === '/repo/main')
                    return '';
                if (opts.cwd === '/repo/feat')
                    return ' M src/file.ts\n';
                if (opts.cwd === '/repo/fix')
                    return '?? new.ts\n';
            }
            throw new Error(`unexpected cmd=${cmd} cwd=${opts.cwd}`);
        });

        expect(getDirtyWorktreeCount(context)).toBe(2);
    });

    it('returns 0 when all worktrees are clean', () => {
        mockGitRunner.mockImplementation((cmd: string) => {
            if (cmd.includes('worktree list --porcelain'))
                return 'worktree /repo/main\nHEAD abc\nbranch refs/heads/main\n';
            if (cmd.includes('status --porcelain'))
                return '';
            throw new Error(`unexpected: ${cmd}`);
        });

        expect(getDirtyWorktreeCount(context)).toBe(0);
    });

    it('returns 0 when git is unavailable', () => {
        mockGitRunner.mockImplementation(() => { throw new Error('no git'); });
        expect(getDirtyWorktreeCount(context)).toBe(0);
    });
});
