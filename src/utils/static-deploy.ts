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