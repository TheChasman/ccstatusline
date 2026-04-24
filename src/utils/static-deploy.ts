import * as fs from 'fs';
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