import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import os from 'os';
import path from 'path';

export interface StaticPaths {
    staticDir: string;
    staticJs: string;
    staticPkg: string;
    bunBinLink: string;
}

export function resolvePaths(homeDir: string = os.homedir()): StaticPaths {
    const staticDir = path.join(homeDir, '.config', 'ccstatusline');
    return {
        staticDir,
        staticJs: path.join(staticDir, 'ccstatusline.js'),
        staticPkg: path.join(staticDir, 'package.json'),
        bunBinLink: path.join(homeDir, '.bun', 'bin', 'ccstatusline')
    };
}

export function isSourceMode(cwd: string = process.cwd()): boolean {
    const packageJsonPath = path.join(cwd, 'package.json');
    const entryPath = path.join(cwd, 'src', 'ccstatusline.ts');

    if (!fs.existsSync(packageJsonPath) || !fs.existsSync(entryPath)) {
        return false;
    }

    try {
        const raw = fs.readFileSync(packageJsonPath, 'utf-8');
        const parsed = JSON.parse(raw) as { name?: unknown };
        return parsed.name === 'ccstatusline';
    } catch {
        return false;
    }
}

export async function writeStaticFiles(sourceBundle: string, homeDir: string = os.homedir()): Promise<void> {
    const paths = resolvePaths(homeDir);
    await fsp.mkdir(paths.staticDir, { recursive: true });

    // Atomic write: copy to temp, chmod temp, then rename temp to final path.
    // This ensures the previous file is never touched until a new one is successfully
    // written and ready to replace it.
    const tmpPath = `${paths.staticJs}.tmp-${process.pid}-${Date.now()}`;
    try {
        await fsp.copyFile(sourceBundle, tmpPath);
        await fsp.chmod(tmpPath, 0o755);
        await fsp.rename(tmpPath, paths.staticJs);
    } catch (err) {
        // Clean up temp file on failure; ignore cleanup errors.
        try {
            await fsp.unlink(tmpPath);
        } catch {
            // swallow
        }
        throw err;
    }

    if (!fs.existsSync(paths.staticPkg)) {
        await fsp.writeFile(paths.staticPkg, JSON.stringify({ type: 'module' }) + '\n', 'utf-8');
    }
}

export interface SymlinkResult {
    updated: boolean;
    reason?: 'no-bun-bin' | 'already-correct';
}

export async function ensureBunBinSymlink(homeDir: string = os.homedir()): Promise<SymlinkResult> {
    const paths = resolvePaths(homeDir);
    const bunBinDir = path.dirname(paths.bunBinLink);

    if (!fs.existsSync(bunBinDir)) {
        return { updated: false, reason: 'no-bun-bin' };
    }

    let existing: fs.Stats | null = null;
    try {
        existing = fs.lstatSync(paths.bunBinLink);
    } catch {
        // Link/file doesn't exist, we'll create it
    }

    if (existing?.isSymbolicLink()) {
        const current = fs.readlinkSync(paths.bunBinLink);
        if (current === paths.staticJs) {
            return { updated: false, reason: 'already-correct' };
        }
    }

    if (existing) {
        await fsp.unlink(paths.bunBinLink);
    }
    await fsp.symlink(paths.staticJs, paths.bunBinLink);
    return { updated: true };
}

export interface DeployResult {
    deployed: boolean;
    staticPath?: string;
    symlinkUpdated?: boolean;
    error?: string;
}

export interface DeployOptions {
    cwd?: string;
    homeDir?: string;
    runBuild?: (cwd: string) => Promise<void>;
}

function defaultRunBuild(cwd: string): Promise<void> {
    return Promise.resolve().then(() => {
        execFileSync('bun', ['run', 'build'], { cwd, stdio: 'pipe' });
    });
}

export async function deployStatic(options: DeployOptions = {}): Promise<DeployResult> {
    const cwd = options.cwd ?? process.cwd();
    const homeDir = options.homeDir ?? os.homedir();
    const runBuild = options.runBuild ?? defaultRunBuild;
    const paths = resolvePaths(homeDir);

    try {
        await runBuild(cwd);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { deployed: false, error: msg };
    }

    const bundle = path.join(cwd, 'dist', 'ccstatusline.js');
    if (!fs.existsSync(bundle)) {
        return { deployed: false, error: `dist/ccstatusline.js not found after build (looked in ${bundle})` };
    }

    try {
        await writeStaticFiles(bundle, homeDir);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return { deployed: false, error: msg };
    }

    // Bundle is now staged at paths.staticJs. Symlink failure is a secondary error.
    try {
        const linkResult = await ensureBunBinSymlink(homeDir);
        return {
            deployed: true,
            staticPath: paths.staticJs,
            symlinkUpdated: linkResult.updated
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
            deployed: true,
            staticPath: paths.staticJs,
            symlinkUpdated: false,
            error: `bundle deployed but symlink update failed: ${msg}`
        };
    }
}