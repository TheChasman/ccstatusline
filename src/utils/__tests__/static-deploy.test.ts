import {
    mkdirSync,
    mkdtempSync,
    rmSync,
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
    resolvePaths
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