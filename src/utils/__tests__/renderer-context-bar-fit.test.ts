import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import {
    DEFAULT_SETTINGS,
    type Settings
} from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import {
    getVisibleText,
    getVisibleWidth
} from '../ansi';
import {
    calculateMaxWidthsFromPreRendered,
    preRenderAllWidgets,
    renderStatusLine
} from '../renderer';

const widgets: WidgetItem[] = [
    { id: 'text', type: 'custom-text', customText: 'pre ' },
    { id: 'ctx', type: 'context-bar' }
];
const previousLocale = { LANG: process.env.LANG, LC_ALL: process.env.LC_ALL, LC_CTYPE: process.env.LC_CTYPE };

function renderConfigured(lineWidgets: WidgetItem[], terminalWidth: number, overrides: Partial<Settings> = {}): string {
    const settings: Settings = {
        ...DEFAULT_SETTINGS,
        flexMode: 'full',
        ...overrides,
        powerline: { ...DEFAULT_SETTINGS.powerline, ...(overrides.powerline ?? {}) }
    };
    const context: RenderContext = {
        terminalWidth,
        data: {
            context_window: {
                context_window_size: 100000,
                current_usage: {
                    input_tokens: 50000,
                    output_tokens: 0,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0
                }
            }
        }
    };
    const preRendered = preRenderAllWidgets([lineWidgets], settings, context);

    return renderStatusLine(
        lineWidgets,
        settings,
        context,
        preRendered[0] ?? [],
        calculateMaxWidthsFromPreRendered(preRendered, settings)
    );
}

function renderLine(terminalWidth: number, overrides: Partial<Settings> = {}): string {
    return renderConfigured(widgets, terminalWidth, overrides);
}

function railWidth(line: string): number {
    const rail = /┃([^┃]+)┃/u.exec(getVisibleText(line));
    return rail?.[1]?.length ?? 0;
}

describe('assembled Context Bar fitting', () => {
    beforeEach(() => {
        process.env.LANG = 'en_GB.UTF-8';
        process.env.LC_ALL = 'en_GB.UTF-8';
        process.env.LC_CTYPE = 'en_GB.UTF-8';
    });
    afterEach(() => {
        if (previousLocale.LANG === undefined)
            delete process.env.LANG;
        else
            process.env.LANG = previousLocale.LANG;
        if (previousLocale.LC_ALL === undefined)
            delete process.env.LC_ALL;
        else
            process.env.LC_ALL = previousLocale.LC_ALL;
        if (previousLocale.LC_CTYPE === undefined)
            delete process.env.LC_CTYPE;
        else
            process.env.LC_CTYPE = previousLocale.LC_CTYPE;
    });

    it('keeps all 25 rail cells on a wide regular line', () => {
        const line = renderLine(80);

        expect(railWidth(line)).toBe(25);
        expect(getVisibleText(line)).toContain('50k/100k (50%)');
        expect(getVisibleWidth(line)).toBeLessThanOrEqual(74);
    });

    it('shortens the rail around neighbouring text without truncating the readout', () => {
        const line = renderLine(50);
        const minimum = renderLine(43);

        expect(railWidth(line)).toBeGreaterThanOrEqual(10);
        expect(railWidth(line)).toBeLessThan(25);
        expect(railWidth(minimum)).toBe(10);
        expect(getVisibleText(line)).toContain('pre ');
        expect(getVisibleText(line)).toContain('50k/100k (50%)');
        expect(getVisibleText(line)).not.toContain('...');
        expect(getVisibleWidth(line)).toBeLessThanOrEqual(44);
    });

    it('drops the rail below ten cells and preserves the numeric readout', () => {
        const line = renderLine(42);

        expect(railWidth(line)).toBe(0);
        expect(getVisibleText(line)).toContain('Ctxt: 50k/100k (50%)');
        expect(getVisibleText(line)).not.toContain('...');
        expect(getVisibleWidth(line)).toBeLessThanOrEqual(36);
    });

    it('fits the rail inside powerline boundaries', () => {
        const powerline = { ...DEFAULT_SETTINGS.powerline, enabled: true };
        const wide = renderLine(90, { powerline });
        const medium = renderLine(55, { powerline });
        const narrow = renderLine(40, { powerline });

        expect(railWidth(wide)).toBe(25);
        expect(railWidth(medium)).toBeGreaterThanOrEqual(10);
        expect(railWidth(medium)).toBeLessThan(25);
        expect(railWidth(narrow)).toBe(0);
        for (const [line, width] of [[wide, 84], [medium, 49], [narrow, 34]] as const) {
            expect(getVisibleText(line)).toContain('50k/100k (50%)');
            expect(getVisibleText(line)).not.toContain('...');
            expect(getVisibleWidth(line)).toBeLessThanOrEqual(width);
        }
    });

    it('keeps trailing content when a fitted Powerline bar is auto-aligned', () => {
        const lineWidgets = [...widgets, { id: 'end', type: 'custom-text', customText: ' END' }];
        const basePowerline = { ...DEFAULT_SETTINGS.powerline, enabled: true };
        const withoutAlignment = renderConfigured(lineWidgets, 55, { powerline: basePowerline });
        const withAlignment = renderConfigured(lineWidgets, 55, { powerline: { ...basePowerline, autoAlign: true } });

        expect(getVisibleText(withoutAlignment)).toContain(' END');
        expect(getVisibleText(withAlignment)).toContain(' END');
        expect(getVisibleText(withAlignment)).not.toContain('...');
        expect(railWidth(withAlignment)).toBeGreaterThanOrEqual(10);
        expect(railWidth(withAlignment)).toBeLessThan(25);
        expect(getVisibleWidth(withAlignment)).toBeLessThanOrEqual(49);
    });

    it('preserves shared Powerline column alignment while fitting rails on two lines', () => {
        const settings: Settings = {
            ...DEFAULT_SETTINGS,
            flexMode: 'full',
            powerline: { ...DEFAULT_SETTINGS.powerline, enabled: true, autoAlign: true }
        };
        const lines: WidgetItem[][] = [
            [
                { id: 'a', type: 'custom-text', customText: 'a' },
                { id: 'bar-a', type: 'context-bar' },
                { id: 'end-a', type: 'custom-text', customText: ' END' }
            ],
            [
                { id: 'longer', type: 'custom-text', customText: 'LONGER' },
                { id: 'bar-b', type: 'context-bar' },
                { id: 'end-b', type: 'custom-text', customText: ' END' }
            ]
        ];
        const context: RenderContext = {
            terminalWidth: 55,
            data: {
                context_window: {
                    context_window_size: 100000,
                    current_usage: {
                        input_tokens: 50000,
                        output_tokens: 0,
                        cache_creation_input_tokens: 0,
                        cache_read_input_tokens: 0
                    }
                }
            }
        };
        const preRendered = preRenderAllWidgets(lines, settings, context);
        const maxWidths = calculateMaxWidthsFromPreRendered(preRendered, settings);
        const output = lines.map((line, index) => renderStatusLine(line, settings, context, preRendered[index] ?? [], maxWidths));
        const visible = output.map(getVisibleText);

        expect(visible[0]?.indexOf('')).toBe(visible[1]?.indexOf(''));
        expect(visible[0]?.indexOf('')).toBe(6);
        expect(visible[0]?.lastIndexOf('')).toBe(visible[1]?.lastIndexOf(''));
        for (const [line, plain] of output.map((line, index) => [line, visible[index]] as const)) {
            expect(plain).toContain(' END');
            expect(plain).not.toContain('...');
            expect(getVisibleWidth(line)).toBeLessThanOrEqual(49);
        }
    });

    it('shrinks two configured bars independently without widening the short one', () => {
        const bars: WidgetItem[] = [
            { id: 'wide', type: 'context-bar', metadata: { brailleWidth: '40' } },
            { id: 'short', type: 'context-bar', metadata: { brailleWidth: '10' } }
        ];
        const line = renderConfigured(bars, 100);
        const visible = getVisibleText(line);
        const railWidths = [...visible.matchAll(/┃([^┃]+)┃/gu)].map(match => match[1]?.length);

        expect(railWidths).toEqual([38, 10]);
        expect(visible.match(/50k\/100k \(50%\)/g)).toHaveLength(2);
        expect(visible).not.toContain('...');
        expect(getVisibleWidth(line)).toBeLessThanOrEqual(94);
    });

    it('lets a global foreground override own the entire rail in regular and powerline output', () => {
        const powerline = { ...DEFAULT_SETTINGS.powerline, enabled: true };
        for (const settings of [{ overrideForegroundColor: 'ansi256:26' }, { overrideForegroundColor: 'ansi256:26', powerline }]) {
            const line = renderLine(80, settings);

            expect(railWidth(line)).toBe(25);
            expect(line).toContain('\x1b[38;5;26m');
            expect(line).not.toContain('\x1b[38;5;214m');
            expect(line).not.toContain('\x1b[38;5;244m');
            expect(getVisibleText(line)).toContain('50k/100k (50%)');
        }
    });

    it('restores the powerline segment background after the rail reset', () => {
        const line = renderLine(90, { powerline: { ...DEFAULT_SETTINGS.powerline, enabled: true, theme: 'nord-aurora' } });
        const afterRailReset = line.slice(line.indexOf('\x1b[0m') + 4);

        expect(afterRailReset).toMatch(/^\x1b\[48;5;\d+m 50k\/100k \(50%\)/);
    });

    it('keeps unrelated long widgets subject to ordinary truncation', () => {
        const line = renderLine(18);
        expect(getVisibleWidth(line)).toBe(12);
        expect(getVisibleText(line)).toContain('...');
    });
});
