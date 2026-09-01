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
import { expectGitExecOptions } from '../../utils/__tests__/git-test-helpers';
import { clearGitCache } from '../../utils/git';
import { GitDeletionsWidget } from '../GitDeletions';

type MockGitCommandRunner = GitCommandRunner & {
    calls: [string, GitCommandOptions][];
    mockImplementation: (impl: (command: string) => string) => void;
    mockReturnValue: (value: string) => void;
    mockReturnValueOnce: (value: string) => void;
};

function createGitCommandRunner(): MockGitCommandRunner {
    const calls: [string, GitCommandOptions][] = [];
    const queuedValues: string[] = [];
    let implementation: (command: string) => string = () => '';

    const runner = ((command: string, options: GitCommandOptions) => {
        calls.push([command, options]);
        const queuedValue = queuedValues.shift();
        return queuedValue ?? implementation(command);
    }) as MockGitCommandRunner;

    runner.calls = calls;
    runner.mockImplementation = (impl) => {
        implementation = impl;
    };
    runner.mockReturnValue = (value) => {
        implementation = () => value;
    };
    runner.mockReturnValueOnce = (value) => {
        queuedValues.push(value);
    };

    return runner;
}

function render(options: {
    cwd?: string;
    gitCommandRunner?: GitCommandRunner;
    hideNoGit?: boolean;
    isPreview?: boolean;
} = {}) {
    const widget = new GitDeletionsWidget();
    const context: RenderContext = {
        isPreview: options.isPreview,
        data: options.cwd ? { cwd: options.cwd } : undefined,
        gitCommandRunner: options.gitCommandRunner ?? createGitCommandRunner()
    };
    const item: WidgetItem = {
        id: 'git-deletions',
        type: 'git-deletions',
        metadata: options.hideNoGit ? { hideNoGit: 'true' } : undefined
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('GitDeletionsWidget', () => {
    beforeEach(() => {
        clearGitCache();
    });

    it('should render preview', () => {
        expect(render({ isPreview: true })).toBe('-10');
    });

    function setupGitResponses(runner: MockGitCommandRunner, responses: Record<string, string>) {
        runner.mockImplementation((cmd: string) => {
            const sub = cmd.replace(/^git\s+/, '');
            if (Object.prototype.hasOwnProperty.call(responses, sub))
                return responses[sub] ?? '';
            throw new Error(`unexpected git call: ${sub}`);
        });
    }

    it('should render cumulative deletions for the current branch vs default', () => {
        const gitCommandRunner = createGitCommandRunner();
        setupGitResponses(gitCommandRunner, {
            'rev-parse --is-inside-work-tree': 'true\n',
            'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
            'rev-parse --abbrev-ref HEAD': 'feat/x',
            'merge-base HEAD main': 'abc123',
            'diff abc123 --shortstat': '4 files changed, 2 insertions(+), 5 deletions(-)'
        });

        expect(render({ cwd: '/tmp/worktree', gitCommandRunner })).toBe('-5');
        expectGitExecOptions(gitCommandRunner.calls[0]?.[1], '/tmp/worktree');
        expectGitExecOptions(gitCommandRunner.calls[1]?.[1], '/tmp/worktree');
    });

    it('should render combined staged and unstaged deletions on the default branch', () => {
        const gitCommandRunner = createGitCommandRunner();
        setupGitResponses(gitCommandRunner, {
            'rev-parse --is-inside-work-tree': 'true\n',
            'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
            'rev-parse --abbrev-ref HEAD': 'main',
            'diff --shortstat': '1 file changed, 2 insertions(+), 1 deletion(-)',
            'diff --cached --shortstat': '1 file changed, 3 insertions(+), 4 deletions(-)'
        });

        expect(render({ cwd: '/tmp/worktree', gitCommandRunner })).toBe('-5');
    });

    it('should render zero count when repo is clean', () => {
        const gitCommandRunner = createGitCommandRunner();
        setupGitResponses(gitCommandRunner, {
            'rev-parse --is-inside-work-tree': 'true\n',
            'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
            'rev-parse --abbrev-ref HEAD': 'main',
            'diff --shortstat': '',
            'diff --cached --shortstat': ''
        });

        expect(render({ gitCommandRunner })).toBe('-0');
    });

    it('should render no git when probe returns false', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValue('false\n');

        expect(render({ gitCommandRunner })).toBe('(no git)');
    });

    it('should hide no git when configured', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValue('false\n');

        expect(render({ hideNoGit: true, gitCommandRunner })).toBeNull();
    });

    it('should render no git when command fails', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockImplementation(() => { throw new Error('No git'); });

        expect(render({ gitCommandRunner })).toBe('(no git)');
    });

    it('should disable raw value support', () => {
        const widget = new GitDeletionsWidget();

        expect(widget.supportsRawValue()).toBe(false);
    });
});
