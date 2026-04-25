import { execSync } from 'child_process';

import type { RenderContext } from '../types/RenderContext';

export interface GitChangeCounts {
    insertions: number;
    deletions: number;
}

// Cache for git commands - key is "command|cwd"
const gitCommandCache = new Map<string, string | null>();

export function resolveGitCwd(context: RenderContext): string | undefined {
    const candidates = [
        context.data?.cwd,
        context.data?.workspace?.current_dir,
        context.data?.workspace?.project_dir
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate;
        }
    }

    return undefined;
}

export function runGit(command: string, context: RenderContext): string | null {
    const cwd = resolveGitCwd(context);
    const cacheKey = `${command}|${cwd ?? ''}`;

    // Check cache first
    if (gitCommandCache.has(cacheKey)) {
        return gitCommandCache.get(cacheKey) ?? null;
    }

    try {
        const output = execSync(`git ${command}`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            ...(cwd ? { cwd } : {})
        }).trimEnd();

        const result = output.length > 0 ? output : null;
        gitCommandCache.set(cacheKey, result);
        return result;
    } catch {
        gitCommandCache.set(cacheKey, null);
        return null;
    }
}

export function runGitInDir(command: string, dir: string): string | null {
    const cacheKey = `dir:${dir}|${command}`;

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

export function getWorktreePaths(context: RenderContext): string[] {
    const output = runGit('worktree list --porcelain', context);
    if (!output)
        return [];

    const paths: string[] = [];
    for (const line of output.split('\n')) {
        if (line.startsWith('worktree ')) {
            paths.push(line.slice('worktree '.length));
        }
    }
    return paths;
}

export interface TotalAheadBehind {
    ahead: number;
    behind: number;
}

export function getTotalAheadBehind(context: RenderContext): TotalAheadBehind {
    const output = runGit(`for-each-ref '--format=%(ahead-behind:@{push})' refs/heads`, context);
    if (!output)
        return { ahead: 0, behind: 0 };

    let ahead = 0;
    let behind = 0;

    for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length === 2) {
            const a = parseInt(parts[0] ?? '0', 10);
            const b = parseInt(parts[1] ?? '0', 10);
            if (!isNaN(a))
                ahead += a;
            if (!isNaN(b))
                behind += b;
        }
    }

    return { ahead, behind };
}

export function getDirtyWorktreeCount(context: RenderContext): number {
    const paths = getWorktreePaths(context);
    let count = 0;
    for (const path of paths) {
        const status = runGitInDir('--no-optional-locks status --porcelain', path);
        if (status) {
            count++;
        }
    }
    return count;
}

/**
 * Clear git command cache - for testing only
 */
export function clearGitCache(): void {
    gitCommandCache.clear();
}

export function isInsideGitWorkTree(context: RenderContext): boolean {
    return runGit('rev-parse --is-inside-work-tree', context) === 'true';
}

function parseDiffShortStat(stat: string): GitChangeCounts {
    const insertMatch = /(\d+)\s+insertions?/.exec(stat);
    const deleteMatch = /(\d+)\s+deletions?/.exec(stat);

    return {
        insertions: insertMatch?.[1] ? parseInt(insertMatch[1], 10) : 0,
        deletions: deleteMatch?.[1] ? parseInt(deleteMatch[1], 10) : 0
    };
}

function getDefaultBranch(context: RenderContext): string | null {
    const originHead = runGit('symbolic-ref --short refs/remotes/origin/HEAD', context);
    if (originHead?.startsWith('origin/')) {
        return originHead.slice('origin/'.length);
    }
    if (runGit('rev-parse --verify main', context)) {
        return 'main';
    }
    if (runGit('rev-parse --verify master', context)) {
        return 'master';
    }
    return null;
}

function getCurrentBranch(context: RenderContext): string | null {
    const branch = runGit('rev-parse --abbrev-ref HEAD', context);
    return branch && branch !== 'HEAD' ? branch : null;
}

function getUncommittedChangeCounts(context: RenderContext): GitChangeCounts {
    const unstagedStat = runGit('diff --shortstat', context) ?? '';
    const stagedStat = runGit('diff --cached --shortstat', context) ?? '';
    const unstagedCounts = parseDiffShortStat(unstagedStat);
    const stagedCounts = parseDiffShortStat(stagedStat);

    return {
        insertions: unstagedCounts.insertions + stagedCounts.insertions,
        deletions: unstagedCounts.deletions + stagedCounts.deletions
    };
}

/**
 * Returns cumulative insertions/deletions relevant to the current branch state:
 * - On a feature branch: diff between working tree and the merge-base with the
 *   default branch (so every commit made on the branch plus any uncommitted
 *   changes is reflected).
 * - On the default branch: diff between working tree and HEAD~1 (the last commit
 *   plus any uncommitted changes).
 * - Detached HEAD, root commit, or no default branch available: falls back to
 *   uncommitted changes only (working tree vs HEAD).
 */
export function getGitChangeCounts(context: RenderContext): GitChangeCounts {
    const defaultBranch = getDefaultBranch(context);
    const currentBranch = getCurrentBranch(context);

    let diffTarget: string | null = null;

    if (defaultBranch && currentBranch && currentBranch !== defaultBranch) {
        const base = runGit(`merge-base HEAD ${defaultBranch}`, context);
        if (base) {
            diffTarget = base;
        }
    } else if (runGit('rev-parse --verify HEAD~1', context)) {
        diffTarget = 'HEAD~1';
    }

    if (diffTarget) {
        const stat = runGit(`diff ${diffTarget} --shortstat`, context) ?? '';
        return parseDiffShortStat(stat);
    }

    return getUncommittedChangeCounts(context);
}

export interface GitStatus {
    staged: boolean;
    unstaged: boolean;
    untracked: boolean;
    conflicts: boolean;
}

export function getGitStatus(context: RenderContext): GitStatus {
    const output = runGit('--no-optional-locks status --porcelain -z', context);

    if (!output) {
        return { staged: false, unstaged: false, untracked: false, conflicts: false };
    }

    let staged = false;
    let unstaged = false;
    let untracked = false;
    let conflicts = false;

    const entries = output.split('\0');

    for (let index = 0; index < entries.length; index += 1) {
        const line = entries[index];
        if (typeof line !== 'string' || line.length < 2)
            continue;
        // Conflict detection: DD, AU, UD, UA, DU, AA, UU
        if (!conflicts && /^(DD|AU|UD|UA|DU|AA|UU)/.test(line))
            conflicts = true;
        if (!staged && /^[MADRCTU]/.test(line))
            staged = true;
        if (!unstaged && /^.[MADRCTU]/.test(line))
            unstaged = true;
        if (!untracked && line.startsWith('??'))
            untracked = true;
        if (staged && unstaged && untracked && conflicts)
            break;

        const indexStatus = line[0];
        if (indexStatus === 'R' || indexStatus === 'C') {
            index += 1;
        }
    }

    return { staged, unstaged, untracked, conflicts };
}

export interface GitAheadBehind {
    ahead: number;
    behind: number;
}

export function getGitAheadBehind(context: RenderContext): GitAheadBehind | null {
    const output = runGit('rev-list --left-right --count HEAD...@{upstream}', context);
    if (!output)
        return null;

    const parts = output.split(/\s+/);
    if (parts.length !== 2 || !parts[0] || !parts[1])
        return null;

    const ahead = parseInt(parts[0], 10);
    const behind = parseInt(parts[1], 10);

    if (isNaN(ahead) || isNaN(behind))
        return null;

    return { ahead, behind };
}

export function getGitConflictCount(context: RenderContext): number {
    const output = runGit('ls-files --unmerged', context);
    if (!output)
        return 0;

    // Count unique file paths (unmerged files appear 3 times in output)
    const files = new Set(output.split('\n').map((line) => {
        const parts = line.split(/\s+/).slice(3);
        return parts.join(' ');
    }).filter(path => path.length > 0));
    return files.size;
}

export function getGitShortSha(context: RenderContext): string | null {
    return runGit('rev-parse --short HEAD', context);
}