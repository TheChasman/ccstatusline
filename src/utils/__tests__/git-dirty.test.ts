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