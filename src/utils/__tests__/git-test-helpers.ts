import { expect } from 'vitest';

export function expectGitExecOptions(options: unknown, cwd?: string, timeout: number | null = 5_000): void {
    expect(options).toEqual(expect.objectContaining({
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        ...(timeout === null ? {} : { timeout }),
        windowsHide: true,
        ...(cwd ? { cwd } : {})
    }));

    expect((options as { env?: Record<string, string | undefined> }).env?.GIT_OPTIONAL_LOCKS).toBe('0');

    if (!cwd)
        expect(options).not.toHaveProperty('cwd');
}
