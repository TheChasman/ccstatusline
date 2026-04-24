import path from 'path';
import {
    describe,
    expect,
    it
} from 'vitest';

import { resolvePaths } from '../static-deploy';

describe('resolvePaths', () => {
    it('derives all four paths from a given home dir', () => {
        const p = resolvePaths('/fake/home');
        expect(p.staticDir).toBe(path.join('/fake/home', '.config', 'ccstatusline'));
        expect(p.staticJs).toBe(path.join('/fake/home', '.config', 'ccstatusline', 'ccstatusline.js'));
        expect(p.staticPkg).toBe(path.join('/fake/home', '.config', 'ccstatusline', 'package.json'));
        expect(p.bunBinLink).toBe(path.join('/fake/home', '.bun', 'bin', 'ccstatusline'));
    });
});