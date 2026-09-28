import {
    describe,
    expect,
    it
} from 'vitest';

import {
    makeBrailleContextBar,
    resolveBrailleBarWidth
} from '../braille-context-bar';

const track = '⣀'.repeat(25);

describe('makeBrailleContextBar', () => {
    it.each([
        [0, `┃${track}┃`],
        [1, `┃⡄${'⣀'.repeat(24)}┃`],
        [2, `┃⡇${'⣀'.repeat(24)}┃`],
        [4, `┃⣿${'⣀'.repeat(24)}┃`],
        [5, `┃⣿⡄${'⣀'.repeat(23)}┃`],
        [20, `┃${'⣿'.repeat(5)}${'⣀'.repeat(20)}┃`],
        [100, `┃${'⣿'.repeat(25)}┃`]
    ])('renders %i percent at width 25', (percent, expected) => {
        expect(makeBrailleContextBar(percent, 100, 25)).toBe(expected);
    });

    it('lights one step for positive usage below one step', () => {
        expect(makeBrailleContextBar(1, 1_000_000, 25)).toBe(`┃⡀${'⣀'.repeat(24)}┃`);
    });

    it('clamps usage above the limit to a full rail', () => {
        expect(makeBrailleContextBar(101, 100, 25)).toBe(`┃${'⣿'.repeat(25)}┃`);
    });

    it('renders an empty track when the limit is zero', () => {
        expect(makeBrailleContextBar(10, 0, 25)).toBe(`┃${track}┃`);
    });

    it('keeps the closing delimiter in a constant column through a percent sweep', () => {
        const rails = Array.from({ length: 101 }, (_, percent) => makeBrailleContextBar(percent, 100, 25));
        expect(new Set(rails.map(rail => rail.length))).toEqual(new Set([27]));
        expect(rails.every(rail => rail.startsWith('┃') && rail.endsWith('┃'))).toBe(true);
    });

    it('uses only ASCII rail characters in fallback mode', () => {
        expect(makeBrailleContextBar(20, 100, 10, true)).toMatch(/^\|[#-]{10}\|$/);
        expect(makeBrailleContextBar(5, 100, 10, true)).toBe(`|#${'-'.repeat(9)}|`);
    });
});

describe('resolveBrailleBarWidth', () => {
    it.each([
        [undefined, 25],
        [{}, 25],
        [{ brailleWidth: '10' }, 10],
        [{ brailleWidth: '80' }, 80],
        [{ brailleWidth: '9' }, 10],
        [{ brailleWidth: '100' }, 80],
        [{ brailleWidth: '25.5' }, 25],
        [{ brailleWidth: 'wide' }, 25]
    ])('resolves metadata %o to width %i', (metadata, width) => {
        expect(resolveBrailleBarWidth(metadata)).toBe(width);
    });
});
