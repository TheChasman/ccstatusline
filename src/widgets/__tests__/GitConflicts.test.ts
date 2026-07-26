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
import { GitConflictsWidget } from '../GitConflicts';

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
    gitCommandRunner?: GitCommandRunner;
    isPreview?: boolean;
    rawValue?: boolean;
    hideNoGit?: boolean;
} = {}) {
    const widget = new GitConflictsWidget();
    const context: RenderContext = {
        isPreview: options.isPreview,
        gitCommandRunner: options.gitCommandRunner ?? createGitCommandRunner()
    };
    const item: WidgetItem = {
        id: 'git-conflicts',
        type: 'git-conflicts',
        rawValue: options.rawValue,
        metadata: options.hideNoGit ? { hideNoGit: 'true' } : undefined
    };

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('GitConflictsWidget', () => {
    beforeEach(() => {
        clearGitCache();
    });

    it('renders preview content', () => {
        expect(render({ isPreview: true })).toBe('⚠ 2');
    });

    it('renders raw preview content as a count', () => {
        expect(render({ isPreview: true, rawValue: true })).toBe('2');
    });

    it('renders no git when outside a repository', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValue('false\n');

        expect(render({ gitCommandRunner })).toBe('(no git)');
    });

    it('hides no git when configured', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValue('false\n');

        expect(render({ hideNoGit: true, gitCommandRunner })).toBeNull();
    });

    it('renders zero conflicts instead of hiding the widget', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValueOnce('true\n');
        gitCommandRunner.mockReturnValueOnce('');

        expect(render({ gitCommandRunner })).toBe('⚠ 0');
    });

    it('renders raw zero conflicts as a numeric count', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValueOnce('true\n');
        gitCommandRunner.mockReturnValueOnce('');

        expect(render({ rawValue: true, gitCommandRunner })).toBe('0');
    });

    it('renders the conflict count', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValueOnce('true\n');
        gitCommandRunner.mockReturnValueOnce([
            '100644 hash 1\tconflict-a',
            '100644 hash 2\tconflict-a',
            '100644 hash 3\tconflict-a',
            '100644 hash 1\tconflict-b',
            '100644 hash 2\tconflict-b',
            '100644 hash 3\tconflict-b'
        ].join('\n'));

        expect(render({ gitCommandRunner })).toBe('⚠ 2');
    });

    it('renders raw conflicts as a numeric count', () => {
        const gitCommandRunner = createGitCommandRunner();
        gitCommandRunner.mockReturnValueOnce('true\n');
        gitCommandRunner.mockReturnValueOnce([
            '100644 hash 1\tconflict-a',
            '100644 hash 2\tconflict-a',
            '100644 hash 3\tconflict-a'
        ].join('\n'));

        expect(render({ rawValue: true, gitCommandRunner })).toBe('1');
    });
});