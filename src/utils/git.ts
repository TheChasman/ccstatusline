import { execFileSync } from 'child_process';
import * as childProcess from 'child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type {
    GitCommandOptions,
    GitCommandRunner,
    RenderContext
} from '../types/RenderContext';

export interface GitChangeCounts {
    insertions: number;
    deletions: number;
}

export interface GitFileStatusCounts {
    staged: number;
    unstaged: number;
    untracked: number;
}

interface GitRepoMetadata {
    cachePath: string;
    headMtimeMs: number | null;
    indexMtimeMs: number | null;
}

interface GitCacheEntry {
    output: string | null;
    createdAt: number;
    headMtimeMs: number | null;
    indexMtimeMs: number | null;
}

interface PersistentGitCache {
    version: 1;
    cwd: string | null;
    entries: Record<string, GitCacheEntry>;
}

const DEFAULT_GIT_CACHE_TTL_SECONDS = 5;
const GIT_CACHE_SCHEMA_VERSION = 1 as const;

// In-process cache keeps cwd in the key; the persistent cache stores cwd once
// at the file level and keys entries by command.
const gitCommandCache = new Map<string, GitCacheEntry>();

function getCacheDir(): string {
    return path.join(os.homedir(), '.cache', 'ccstatusline');
}

function getCachePath(gitDir: string): string {
    const repoHash = createHash('sha256')
        .update(gitDir)
        .digest('hex')
        .slice(0, 16);

    return path.join(getCacheDir(), 'git-cache', `git-${repoHash}.json`);
}

function getMtimeMs(filePath: string): number | null {
    try {
        return fs.statSync(filePath).mtimeMs;
    } catch {
        return null;
    }
}

function normalizeDirectory(candidate: string): string | null {
    try {
        const resolved = path.resolve(candidate);
        const stats = fs.statSync(resolved);
        return stats.isDirectory()
            ? resolved
            : path.dirname(resolved);
    } catch {
        return null;
    }
}

function readGitDirFile(gitFilePath: string): string | null {
    try {
        const content = fs.readFileSync(gitFilePath, 'utf-8').trim();
        const match = /^gitdir:\s*(.+)$/i.exec(content);
        if (!match?.[1]) {
            return null;
        }

        return path.resolve(path.dirname(gitFilePath), match[1]);
    } catch {
        return null;
    }
}

function discoverGitDir(startDir: string): string | null {
    let current = startDir;

    for (;;) {
        const gitPath = path.join(current, '.git');

        try {
            const stats = fs.statSync(gitPath);
            if (stats.isDirectory()) {
                return gitPath;
            }
            if (stats.isFile()) {
                return readGitDirFile(gitPath);
            }
        } catch {
            // Keep walking up.
        }

        const parent = path.dirname(current);
        if (parent === current) {
            return null;
        }
        current = parent;
    }
}

function getGitRepoMetadata(cwd: string | undefined): GitRepoMetadata | null {
    if (!cwd) {
        return null;
    }

    const startDir = normalizeDirectory(cwd);
    if (!startDir) {
        return null;
    }

    const gitDir = discoverGitDir(startDir);
    if (!gitDir) {
        return null;
    }

    return {
        cachePath: getCachePath(gitDir),
        headMtimeMs: getMtimeMs(path.join(gitDir, 'HEAD')),
        indexMtimeMs: getMtimeMs(path.join(gitDir, 'index'))
    };
}

function getGitCacheTtlMs(context: RenderContext): number {
    const ttlSeconds = context.gitCacheTtlSeconds;
    if (typeof ttlSeconds !== 'number' || !Number.isFinite(ttlSeconds)) {
        return DEFAULT_GIT_CACHE_TTL_SECONDS * 1000;
    }

    return Math.min(60, Math.max(0, ttlSeconds)) * 1000;
}

function isCacheEntry(value: unknown): value is GitCacheEntry {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const entry = value as Record<string, unknown>;
    return (typeof entry.output === 'string' || entry.output === null)
        && typeof entry.createdAt === 'number'
        && (typeof entry.headMtimeMs === 'number' || entry.headMtimeMs === null)
        && (typeof entry.indexMtimeMs === 'number' || entry.indexMtimeMs === null);
}

function isCacheEntryFresh(
    entry: GitCacheEntry,
    metadata: GitRepoMetadata | null,
    ttlMs: number,
    now: number
): boolean {
    if (metadata) {
        if (entry.headMtimeMs !== metadata.headMtimeMs || entry.indexMtimeMs !== metadata.indexMtimeMs) {
            return false;
        }
    }

    return ttlMs === 0 || now - entry.createdAt <= ttlMs;
}

function readPersistentCache(cachePath: string): PersistentGitCache | null {
    try {
        const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as unknown;
        if (typeof parsed !== 'object' || parsed === null) {
            return null;
        }

        const data = parsed as { version?: unknown; cwd?: unknown; entries?: unknown };
        if (
            data.version !== GIT_CACHE_SCHEMA_VERSION
            || (typeof data.cwd !== 'string' && data.cwd !== null)
            || typeof data.entries !== 'object'
            || data.entries === null
        ) {
            return null;
        }

        const entries: Record<string, GitCacheEntry> = {};
        for (const [key, value] of Object.entries(data.entries)) {
            if (isCacheEntry(value)) {
                entries[key] = value;
            }
        }

        return {
            version: GIT_CACHE_SCHEMA_VERSION,
            cwd: data.cwd,
            entries
        };
    } catch {
        return null;
    }
}

function writePersistentCache(cachePath: string, cache: PersistentGitCache): void {
    try {
        const cacheDir = path.dirname(cachePath);
        fs.mkdirSync(cacheDir, { recursive: true });
        const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(cache), 'utf-8');
        fs.renameSync(tempPath, cachePath);
    } catch {
        // Best-effort cache; statusline rendering should never fail because of it.
    }
}

function readPersistentCacheEntry(
    metadata: GitRepoMetadata | null,
    cacheKey: string,
    cwd: string | undefined,
    ttlMs: number,
    now: number
): GitCacheEntry | null {
    if (!metadata) {
        return null;
    }

    const cache = readPersistentCache(metadata.cachePath);
    if (cache?.cwd !== (cwd ?? null)) {
        return null;
    }

    const entry = cache.entries[cacheKey];
    if (!entry || !isCacheEntryFresh(entry, metadata, ttlMs, now)) {
        return null;
    }

    return entry;
}

function writePersistentCacheEntry(
    metadata: GitRepoMetadata | null,
    cacheKey: string,
    cwd: string | undefined,
    entry: GitCacheEntry
): void {
    if (!metadata) {
        return;
    }

    const cacheCwd = cwd ?? null;
    const existingCache = readPersistentCache(metadata.cachePath);
    const cache: PersistentGitCache = existingCache?.cwd === cacheCwd
        ? existingCache
        : {
            version: GIT_CACHE_SCHEMA_VERSION,
            cwd: cacheCwd,
            entries: {}
        };

    cache.entries[cacheKey] = entry;
    writePersistentCache(metadata.cachePath, cache);
}

function createCacheEntry(output: string | null, metadata: GitRepoMetadata | null, now: number): GitCacheEntry {
    return {
        output,
        createdAt: now,
        headMtimeMs: metadata?.headMtimeMs ?? null,
        indexMtimeMs: metadata?.indexMtimeMs ?? null
    };
}

function runGitCommand(command: string, options: GitCommandOptions, runner?: GitCommandRunner): string {
    return runner
        ? runner(command, options)
        : childProcess.execSync(command, options);
}

export function resolveGitCwd(context: RenderContext): string | undefined {
    const candidates = [
        context.data?.worktree?.path,
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
    const args = command.trim().split(/\s+/).filter(Boolean);
    return runGitArgs(args, context, command);
}

export function runGitArgs(args: string[], context: RenderContext, cacheCommand?: string): string | null {
    const cwd = resolveGitCwd(context);
    const cacheToken = cacheCommand ?? args.join('\0');
    const memoryCacheKey = `${cacheToken}|${cwd ?? ''}`;
    const persistentCacheKey = cacheToken;
    const metadata = getGitRepoMetadata(cwd);
    const ttlMs = getGitCacheTtlMs(context);
    const now = Date.now();
    const hasRunner = Boolean(context.gitCommandRunner);

    // Check cache first
    const memoryEntry = gitCommandCache.get(memoryCacheKey);
    if (memoryEntry && isCacheEntryFresh(memoryEntry, metadata, ttlMs, now)) {
        return memoryEntry.output;
    }

    // Skip persistent cache when using an injected runner (testing); the runner
    // may not touch a real .git dir so metadata-based invalidation is meaningless.
    if (!hasRunner) {
        const persistentEntry = readPersistentCacheEntry(metadata, persistentCacheKey, cwd, ttlMs, now);
        if (persistentEntry) {
            gitCommandCache.set(memoryCacheKey, persistentEntry);
            return persistentEntry.output;
        }
    }

    // --no-optional-locks (or GIT_OPTIONAL_LOCKS=0) prevents read-only commands
    // (diff, status, rev-list, ...) from racing on .git/index.lock when another
    // git process is writing it.
    // We use the environment variable instead of the CLI flag because older Git
    // versions (like 2.10.1) fail with "Unknown option: --no-optional-locks".
    // See https://git-scm.com/docs/git#Documentation/git.txt---no-optional-locks

    try {
        let output: string;
        if (hasRunner) {
            const options: GitCommandOptions = {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'ignore'],
                env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
                windowsHide: true,
                ...(cwd ? { cwd } : {})
            };
            output = runGitCommand(`git ${cacheCommand ?? args.join(' ')}`, options, context.gitCommandRunner).trimEnd();
        } else {
            output = execFileSync('git', args, {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'ignore'],
                env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
                windowsHide: true,
                ...(cwd ? { cwd } : {})
            }).trimEnd();
        }

        const result = output.length > 0 ? output : null;
        const entry = createCacheEntry(result, metadata, now);
        gitCommandCache.set(memoryCacheKey, entry);
        if (!hasRunner) {
            writePersistentCacheEntry(metadata, persistentCacheKey, cwd, entry);
        }
        return result;
    } catch {
        const entry = createCacheEntry(null, metadata, now);
        gitCommandCache.set(memoryCacheKey, entry);
        if (!hasRunner) {
            writePersistentCacheEntry(metadata, persistentCacheKey, cwd, entry);
        }
        return null;
    }
}

export function runGitInDir(command: string, dir: string, runner?: GitCommandRunner): string | null {
    const cacheKey = `dir:${dir}|${command}`;
    const shouldCache = !runner;

    if (shouldCache && gitCommandCache.has(cacheKey)) {
        return gitCommandCache.get(cacheKey)?.output ?? null;
    }

    try {
        const options: GitCommandOptions = {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore'],
            cwd: dir
        };
        const output = runGitCommand(`git ${command}`, options, runner).trimEnd();

        const result = output.length > 0 ? output : null;
        if (shouldCache)
            gitCommandCache.set(cacheKey, createCacheEntry(result, null, Date.now()));
        return result;
    } catch {
        if (shouldCache)
            gitCommandCache.set(cacheKey, createCacheEntry(null, null, Date.now()));
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
        const status = runGitInDir('--no-optional-locks status --porcelain', path, context.gitCommandRunner);
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

export function getGitWorktreeName(context: RenderContext): string | null {
    const worktreeDir = runGit('rev-parse --git-dir', context);
    if (!worktreeDir)
        return null;

    const normalizedGitDir = worktreeDir.replace(/\\/g, '/');

    if (normalizedGitDir.endsWith('/.git') || normalizedGitDir === '.git')
        return 'main';

    const repoMarker = '.git/worktrees/';
    const repoMarkerIndex = normalizedGitDir.lastIndexOf(repoMarker);
    if (repoMarkerIndex !== -1) {
        const worktree = normalizedGitDir.slice(repoMarkerIndex + repoMarker.length);
        return worktree.length > 0 ? worktree : null;
    }

    const bareMarker = '/worktrees/';
    const bareMarkerIndex = normalizedGitDir.lastIndexOf(bareMarker);
    if (bareMarkerIndex === -1)
        return null;

    const worktree = normalizedGitDir.slice(bareMarkerIndex + bareMarker.length);
    return worktree.length > 0 ? worktree : null;
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
 * - On the default branch or when no merge-base is available: uncommitted changes
 *   only (working tree vs HEAD), so the count is 0 on a clean committed tree.
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
    }

    if (diffTarget) {
        const stat = runGit(`diff ${diffTarget} --shortstat`, context) ?? '';
        return parseDiffShortStat(stat);
    }

    return getUncommittedChangeCounts(context);
}

function hasRenameOrCopyStatus(line: string): boolean {
    return line.startsWith('R') || line.startsWith('C') || line[1] === 'R' || line[1] === 'C';
}

export interface GitStatus {
    staged: boolean;
    unstaged: boolean;
    untracked: boolean;
    conflicts: boolean;
}

export function getGitStatus(context: RenderContext): GitStatus {
    const output = runGit('status --porcelain -z', context);

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

        if (hasRenameOrCopyStatus(line)) {
            index += 1;
        }
    }

    return { staged, unstaged, untracked, conflicts };
}

export function getGitFileStatusCounts(context: RenderContext): GitFileStatusCounts {
    const output = runGit('status --porcelain -z', context);

    if (!output) {
        return { staged: 0, unstaged: 0, untracked: 0 };
    }

    let staged = 0;
    let unstaged = 0;
    let untracked = 0;

    const entries = output.split('\0');

    for (let index = 0; index < entries.length; index += 1) {
        const line = entries[index];
        if (typeof line !== 'string' || line.length < 2)
            continue;

        if (line.startsWith('??')) {
            untracked += 1;
        } else {
            if (/^[MADRCTU]/.test(line))
                staged += 1;
            if (/^.[MADRCTU]/.test(line))
                unstaged += 1;
        }

        if (hasRenameOrCopyStatus(line)) {
            index += 1;
        }
    }

    return { staged, unstaged, untracked };
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
