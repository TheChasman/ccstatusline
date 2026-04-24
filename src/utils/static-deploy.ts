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