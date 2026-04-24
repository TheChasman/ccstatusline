import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync
} from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it
} from 'vitest';

import {
    isSourceMode,
    resolvePaths,
    writeStaticFiles
} from '../static-deploy';

describe('resolvePaths', () => {
    it('derives all four paths from a given home dir', () => {
        const p = resolvePaths('/fake/home');
        expect(p.staticDir).toBe(path.join('/fake/home', '.config', 'ccstatusline'));
        expect(p.staticJs).toBe(path.join('/fake/home', '.config', 'ccstatusline', 'ccstatusline.js'));
        expect(p.staticPkg).toBe(path.join('/fake/home', '.config', 'ccstatusline', 'package.json'));
        expect(p.bunBinLink).toBe(path.join('/fake/home', '.bun', 'bin', 'ccstatusline'));
    });
});

describe('isSourceMode', () => {
    let dir: string;

    beforeEach(() => {
        dir = mkdtempSync(path.join(tmpdir(), 'ccsl-src-'));
    });

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    it('returns true when package.json has name "ccstatusline" and src/ccstatusline.ts exists', () => {
        writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'ccstatusline' }));
        mkdirSync(path.join(dir, 'src'));
        writeFileSync(path.join(dir, 'src', 'ccstatusline.ts'), '// entry');
        expect(isSourceMode(dir)).toBe(true);
    });

    it('returns false when package.json is missing', () => {
        mkdirSync(path.join(dir, 'src'));
        writeFileSync(path.join(dir, 'src', 'ccstatusline.ts'), '// entry');
        expect(isSourceMode(dir)).toBe(false);
    });

    it('returns false when package.json has a different name', () => {
        writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'other' }));
        mkdirSync(path.join(dir, 'src'));
        writeFileSync(path.join(dir, 'src', 'ccstatusline.ts'), '// entry');
        expect(isSourceMode(dir)).toBe(false);
    });

    it('returns false when src/ccstatusline.ts is missing', () => {
        writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'ccstatusline' }));
        expect(isSourceMode(dir)).toBe(false);
    });

    it('returns false when package.json is malformed', () => {
        writeFileSync(path.join(dir, 'package.json'), 'not json');
        mkdirSync(path.join(dir, 'src'));
        writeFileSync(path.join(dir, 'src', 'ccstatusline.ts'), '// entry');
        expect(isSourceMode(dir)).toBe(false);
    });
});

describe('writeStaticFiles', () => {
    let home: string;
    let srcBundle: string;

    beforeEach(() => {
        home = mkdtempSync(path.join(tmpdir(), 'ccsl-home-'));
        const project = mkdtempSync(path.join(tmpdir(), 'ccsl-proj-'));
        srcBundle = path.join(project, 'dist', 'ccstatusline.js');
        mkdirSync(path.dirname(srcBundle), { recursive: true });
        writeFileSync(srcBundle, '#!/usr/bin/env node\nconsole.log("hi")\n');
    });

    afterEach(() => {
        rmSync(home, { recursive: true, force: true });
    });

    it('copies the bundle to the static path', async () => {
        await writeStaticFiles(srcBundle, home);
        const target = path.join(home, '.config', 'ccstatusline', 'ccstatusline.js');
        expect(existsSync(target)).toBe(true);
        expect(readFileSync(target, 'utf-8')).toContain('console.log("hi")');
    });

    it('chmods the copy to 0o755', async () => {
        await writeStaticFiles(srcBundle, home);
        const target = path.join(home, '.config', 'ccstatusline', 'ccstatusline.js');
        const mode = statSync(target).mode & 0o777;
        expect(mode).toBe(0o755);
    });

    it('writes package.json with {"type":"module"} if missing', async () => {
        await writeStaticFiles(srcBundle, home);
        const pkg = path.join(home, '.config', 'ccstatusline', 'package.json');
        expect(existsSync(pkg)).toBe(true);
        expect(JSON.parse(readFileSync(pkg, 'utf-8'))).toEqual({ type: 'module' });
    });

    it('does not overwrite an existing package.json', async () => {
        mkdirSync(path.join(home, '.config', 'ccstatusline'), { recursive: true });
        const pkg = path.join(home, '.config', 'ccstatusline', 'package.json');
        writeFileSync(pkg, JSON.stringify({ type: 'module', custom: true }));
        await writeStaticFiles(srcBundle, home);
        expect(JSON.parse(readFileSync(pkg, 'utf-8'))).toEqual({ type: 'module', custom: true });
    });

    it('creates the static directory if it does not exist', async () => {
        await writeStaticFiles(srcBundle, home);
        expect(existsSync(path.join(home, '.config', 'ccstatusline'))).toBe(true);
    });

    it('atomically replaces an existing static bundle (no temp files left behind)', async () => {
        // First deploy
        await writeStaticFiles(srcBundle, home);
        const target = path.join(home, '.config', 'ccstatusline', 'ccstatusline.js');
        const firstContent = readFileSync(target, 'utf-8');
        expect(firstContent).toContain('console.log("hi")');

        // Second deploy with different source content
        const { writeFileSync: wf } = await import('fs');
        wf(srcBundle, '#!/usr/bin/env node\nconsole.log("v2")\n');
        await writeStaticFiles(srcBundle, home);
        expect(readFileSync(target, 'utf-8')).toContain('console.log("v2")');

        // Static dir should contain exactly one file + package.json, no leftover temp
        const { readdirSync } = await import('fs');
        const entries = readdirSync(path.join(home, '.config', 'ccstatusline'));
        expect(entries.sort()).toEqual(['ccstatusline.js', 'package.json']);
    });
});