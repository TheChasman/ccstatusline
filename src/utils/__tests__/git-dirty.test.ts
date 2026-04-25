import { execSync } from 'child_process';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import {
    clearGitCache,
    getDirtyWorktreeCount,
    getTotalAheadBehind,
    getWorktreePaths,
    runGitInDir
} from '../git';

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

describe('getWorktreePaths', () => {
    const context = { data: { cwd: '/repo' } };

    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('returns paths parsed from worktree list --porcelain output', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
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

describe('getTotalAheadBehind', () => {
    const context = { data: { cwd: '/repo' } };

    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    it('sums ahead and behind counts across all branches', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('for-each-ref'))
                return '2 1\n1 0\n0 3\n';
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getTotalAheadBehind(context)).toEqual({ ahead: 3, behind: 4 });
    });

    it('skips empty lines (branches with no push upstream)', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('for-each-ref'))
                return '2 0\n\n1 1\n';
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getTotalAheadBehind(context)).toEqual({ ahead: 3, behind: 1 });
    });

    it('returns zeros when all branches are in sync', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('for-each-ref'))
                return '0 0\n0 0\n';
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getTotalAheadBehind(context)).toEqual({ ahead: 0, behind: 0 });
    });

    it('returns zeros when not in a git repo', () => {
        mockExecSync.mockImplementation(() => { throw new Error('no git'); });
        expect(getTotalAheadBehind(context)).toEqual({ ahead: 0, behind: 0 });
    });
});

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
                if (opts.cwd === '/repo/main')
                    return '';
                if (opts.cwd === '/repo/feat')
                    return ' M src/file.ts\n';
                if (opts.cwd === '/repo/fix')
                    return '?? new.ts\n';
            }
            throw new Error(`unexpected cmd=${cmd} cwd=${opts.cwd}`);
        }) as unknown as () => never);

        expect(getDirtyWorktreeCount(context)).toBe(2);
    });

    it('returns 0 when all worktrees are clean', () => {
        mockExecSync.mockImplementation(((cmd: string) => {
            if (cmd.includes('worktree list --porcelain'))
                return 'worktree /repo/main\nHEAD abc\nbranch refs/heads/main\n';
            if (cmd.includes('status --porcelain'))
                return '';
            throw new Error(`unexpected: ${cmd}`);
        }) as unknown as () => never);

        expect(getDirtyWorktreeCount(context)).toBe(0);
    });

    it('returns 0 when git is unavailable', () => {
        mockExecSync.mockImplementation(() => { throw new Error('no git'); });
        expect(getDirtyWorktreeCount(context)).toBe(0);
    });
});