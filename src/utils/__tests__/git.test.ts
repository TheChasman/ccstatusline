import { execSync } from 'child_process';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import {
    clearGitCache,
    getGitChangeCounts,
    getGitStatus,
    isInsideGitWorkTree,
    resolveGitCwd,
    runGit
} from '../git';

vi.mock('child_process', () => ({ execSync: vi.fn() }));

const mockExecSync = execSync as unknown as {
    mock: { calls: unknown[][] };
    mockImplementation: (impl: () => never) => void;
    mockReturnValue: (value: string) => void;
    mockReturnValueOnce: (value: string) => void;
};

describe('git utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearGitCache();
    });

    describe('resolveGitCwd', () => {
        it('prefers context.data.cwd when available', () => {
            const context: RenderContext = {
                data: {
                    cwd: '/repo/from/cwd',
                    workspace: {
                        current_dir: '/repo/from/current-dir',
                        project_dir: '/repo/from/project-dir'
                    }
                }
            };

            expect(resolveGitCwd(context)).toBe('/repo/from/cwd');
        });

        it('falls back to workspace.current_dir', () => {
            const context: RenderContext = {
                data: {
                    workspace: {
                        current_dir: '/repo/from/current-dir',
                        project_dir: '/repo/from/project-dir'
                    }
                }
            };

            expect(resolveGitCwd(context)).toBe('/repo/from/current-dir');
        });

        it('falls back to workspace.project_dir', () => {
            const context: RenderContext = { data: { workspace: { project_dir: '/repo/from/project-dir' } } };

            expect(resolveGitCwd(context)).toBe('/repo/from/project-dir');
        });

        it('skips empty candidate values', () => {
            const context: RenderContext = {
                data: {
                    cwd: '   ',
                    workspace: {
                        current_dir: '',
                        project_dir: '/repo/from/project-dir'
                    }
                }
            };

            expect(resolveGitCwd(context)).toBe('/repo/from/project-dir');
        });

        it('returns undefined when no candidates are available', () => {
            expect(resolveGitCwd({})).toBeUndefined();
        });
    });

    describe('runGit', () => {
        it('runs git command with resolved cwd and trims trailing whitespace', () => {
            mockExecSync.mockReturnValueOnce('feature/worktree\n');
            const context: RenderContext = { data: { cwd: '/tmp/repo' } };

            const result = runGit('branch --show-current', context);

            expect(result).toBe('feature/worktree');
            expect(mockExecSync.mock.calls[0]?.[0]).toBe('git branch --show-current');
            expect(mockExecSync.mock.calls[0]?.[1]).toEqual({
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'ignore'],
                cwd: '/tmp/repo'
            });
        });

        it('runs git command without cwd when no context directory exists', () => {
            mockExecSync.mockReturnValueOnce('true\n');

            const result = runGit('rev-parse --is-inside-work-tree', {});

            expect(result).toBe('true');
            expect(mockExecSync.mock.calls[0]?.[1]).toEqual({
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'ignore']
            });
        });

        it('returns null when the command fails', () => {
            mockExecSync.mockImplementation(() => { throw new Error('git failed'); });

            expect(runGit('status --short', {})).toBeNull();
        });
    });

    describe('isInsideGitWorkTree', () => {
        it('returns true when git reports true', () => {
            mockExecSync.mockReturnValueOnce('true\n');

            expect(isInsideGitWorkTree({})).toBe(true);
        });

        it('returns false when git reports false', () => {
            mockExecSync.mockReturnValueOnce('false\n');

            expect(isInsideGitWorkTree({})).toBe(false);
        });

        it('returns false when git command fails', () => {
            mockExecSync.mockImplementation(() => { throw new Error('git failed'); });

            expect(isInsideGitWorkTree({})).toBe(false);
        });
    });

    describe('getGitChangeCounts', () => {
        /**
         * Drive the branch-aware counter. Callers set return values keyed by the
         * git sub-command that getGitChangeCounts issues, in the order it issues them.
         */
        function setupGitResponses(responses: Record<string, string | null>) {
            mockExecSync.mockImplementation(((cmd: string) => {
                const sub = cmd.replace(/^git\s+/, '');
                const value = Object.prototype.hasOwnProperty.call(responses, sub)
                    ? responses[sub]
                    : null;
                if (value === null || value === undefined) {
                    throw new Error(`no response for ${sub}`);
                }
                return value;
            }) as unknown as () => never);
        }

        it('diffs against merge-base with default branch when on a feature branch', () => {
            setupGitResponses({
                'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
                'rev-parse --abbrev-ref HEAD': 'feat/x',
                'merge-base HEAD main': 'abc123',
                'diff abc123 --shortstat': '4 files changed, 42 insertions(+), 9 deletions(-)'
            });

            expect(getGitChangeCounts({})).toEqual({ insertions: 42, deletions: 9 });
        });

        it('diffs against HEAD~1 when on the default branch', () => {
            setupGitResponses({
                'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
                'rev-parse --abbrev-ref HEAD': 'main',
                'rev-parse --verify HEAD~1': 'deadbeef',
                'diff HEAD~1 --shortstat': '1 file changed, 3 insertions(+), 1 deletion(-)'
            });

            expect(getGitChangeCounts({})).toEqual({ insertions: 3, deletions: 1 });
        });

        it('falls back to main when origin/HEAD is unset', () => {
            setupGitResponses({
                'symbolic-ref --short refs/remotes/origin/HEAD': '',
                'rev-parse --verify main': 'mainsha',
                'rev-parse --abbrev-ref HEAD': 'topic',
                'merge-base HEAD main': 'basesha',
                'diff basesha --shortstat': '1 file changed, 5 insertions(+)'
            });

            expect(getGitChangeCounts({})).toEqual({ insertions: 5, deletions: 0 });
        });

        it('falls back to master when main is unavailable', () => {
            setupGitResponses({
                'symbolic-ref --short refs/remotes/origin/HEAD': '',
                'rev-parse --verify main': '',
                'rev-parse --verify master': 'mastersha',
                'rev-parse --abbrev-ref HEAD': 'topic',
                'merge-base HEAD master': 'basesha',
                'diff basesha --shortstat': '1 file changed, 2 deletions(-)'
            });

            expect(getGitChangeCounts({})).toEqual({ insertions: 0, deletions: 2 });
        });

        it('falls back to uncommitted diff when on root commit of default branch', () => {
            setupGitResponses({
                'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
                'rev-parse --abbrev-ref HEAD': 'main',
                'rev-parse --verify HEAD~1': '',
                'diff --shortstat': '1 file changed, 7 insertions(+)',
                'diff --cached --shortstat': '1 file changed, 2 deletions(-)'
            });

            expect(getGitChangeCounts({})).toEqual({ insertions: 7, deletions: 2 });
        });

        it('falls back to uncommitted diff when HEAD is detached', () => {
            setupGitResponses({
                'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
                'rev-parse --abbrev-ref HEAD': 'HEAD',
                'rev-parse --verify HEAD~1': '',
                'diff --shortstat': '',
                'diff --cached --shortstat': ''
            });

            expect(getGitChangeCounts({})).toEqual({ insertions: 0, deletions: 0 });
        });

        it('returns zero counts when git commands fail outright', () => {
            mockExecSync.mockImplementation(() => { throw new Error('git failed'); });

            expect(getGitChangeCounts({})).toEqual({ insertions: 0, deletions: 0 });
        });
    });

    describe('getGitStatus', () => {
        it('returns all false when no git output', () => {
            mockExecSync.mockReturnValueOnce('');

            expect(getGitStatus({})).toEqual({
                staged: false,
                unstaged: false,
                untracked: false,
                conflicts: false
            });
        });

        it('detects staged modification', () => {
            mockExecSync.mockReturnValueOnce('M  file.txt');

            const result = getGitStatus({});
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(false);
            expect(result.conflicts).toBe(false);
        });

        it('detects unstaged modification', () => {
            mockExecSync.mockReturnValueOnce(' M file.txt');

            const result = getGitStatus({});
            expect(result.staged).toBe(false);
            expect(result.unstaged).toBe(true);
            expect(result.conflicts).toBe(false);
        });

        it('detects both staged and unstaged modification', () => {
            mockExecSync.mockReturnValueOnce('MM file.txt');

            const result = getGitStatus({});
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
            expect(result.conflicts).toBe(false);
        });

        it('detects unstaged deletion', () => {
            mockExecSync.mockReturnValueOnce(' D file.txt');

            const result = getGitStatus({});
            expect(result.staged).toBe(false);
            expect(result.unstaged).toBe(true);
            expect(result.conflicts).toBe(false);
        });

        it('detects staged deletion', () => {
            mockExecSync.mockReturnValueOnce('D  file.txt');

            const result = getGitStatus({});
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(false);
            expect(result.conflicts).toBe(false);
        });

        it('detects untracked files', () => {
            mockExecSync.mockReturnValueOnce('?? newfile.txt');

            const result = getGitStatus({});
            expect(result.untracked).toBe(true);
            expect(result.staged).toBe(false);
            expect(result.unstaged).toBe(false);
            expect(result.conflicts).toBe(false);
        });

        it('detects merge conflict: both modified (UU)', () => {
            mockExecSync.mockReturnValueOnce('UU file.txt');

            const result = getGitStatus({});
            expect(result.conflicts).toBe(true);
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
        });

        it('detects merge conflict: added by us (AU)', () => {
            mockExecSync.mockReturnValueOnce('AU file.txt');

            const result = getGitStatus({});
            expect(result.conflicts).toBe(true);
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
        });

        it('detects merge conflict: deleted by us (DU)', () => {
            mockExecSync.mockReturnValueOnce('DU file.txt');

            const result = getGitStatus({});
            expect(result.conflicts).toBe(true);
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
        });

        it('detects merge conflict: both added (AA)', () => {
            mockExecSync.mockReturnValueOnce('AA file.txt');

            const result = getGitStatus({});
            expect(result.conflicts).toBe(true);
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
        });

        it('detects merge conflict: added by them (UA)', () => {
            mockExecSync.mockReturnValueOnce('UA file.txt');

            const result = getGitStatus({});
            expect(result.conflicts).toBe(true);
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
        });

        it('detects merge conflict: deleted by them (UD)', () => {
            mockExecSync.mockReturnValueOnce('UD file.txt');

            const result = getGitStatus({});
            expect(result.conflicts).toBe(true);
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
        });

        it('detects merge conflict: both deleted (DD)', () => {
            mockExecSync.mockReturnValueOnce('DD file.txt');

            const result = getGitStatus({});
            expect(result.conflicts).toBe(true);
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
        });

        it('detects renamed file in index (staged)', () => {
            mockExecSync.mockReturnValueOnce('R  oldname.txt -> newname.txt');

            const result = getGitStatus({});
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(false);
            expect(result.conflicts).toBe(false);
        });

        it('detects copied file in index (staged)', () => {
            mockExecSync.mockReturnValueOnce('C  original.txt -> copy.txt');

            const result = getGitStatus({});
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(false);
            expect(result.conflicts).toBe(false);
        });

        it('ignores rename source path in porcelain -z output', () => {
            mockExecSync.mockReturnValueOnce('R  new-name.txt\0DUCK.txt\0');

            const result = getGitStatus({});
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(false);
            expect(result.conflicts).toBe(false);
        });

        it('ignores copy source path in porcelain -z output', () => {
            mockExecSync.mockReturnValueOnce('C  copy.txt\0MOUSE.txt\0');

            const result = getGitStatus({});
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(false);
            expect(result.conflicts).toBe(false);
        });

        it('detects type changed file in index (staged)', () => {
            mockExecSync.mockReturnValueOnce('T  file.txt');

            const result = getGitStatus({});
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(false);
            expect(result.conflicts).toBe(false);
        });

        it('detects mixed status with multiple files', () => {
            mockExecSync.mockReturnValueOnce('M  staged.txt\0 M unstaged.txt\0?? untracked.txt');

            const result = getGitStatus({});
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
            expect(result.untracked).toBe(true);
            expect(result.conflicts).toBe(false);
        });

        it('detects mixed status with conflicts', () => {
            mockExecSync.mockReturnValueOnce('UU conflict.txt\0M  staged.txt\0 M unstaged.txt\0?? untracked.txt');

            const result = getGitStatus({});
            expect(result.conflicts).toBe(true);
            expect(result.staged).toBe(true);
            expect(result.unstaged).toBe(true);
            expect(result.untracked).toBe(true);
        });

        it('handles git command failure', () => {
            mockExecSync.mockImplementation(() => { throw new Error('git failed'); });

            expect(getGitStatus({})).toEqual({
                staged: false,
                unstaged: false,
                untracked: false,
                conflicts: false
            });
        });
    });
});