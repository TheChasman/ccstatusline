import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it
} from 'vitest';

import type { RenderContext } from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import { getVisibleText } from '../../utils/ansi';
import { ContextBarWidget } from '../ContextBar';

const widget = new ContextBarWidget();
const item: WidgetItem = { id: 'ctx', type: 'context-bar' };
const previousLocale = { LANG: process.env.LANG, LC_ALL: process.env.LC_ALL, LC_CTYPE: process.env.LC_CTYPE };

function contextFor(used: number, total = 100000): RenderContext {
    return {
        data: {
            context_window: {
                context_window_size: total,
                current_usage: {
                    input_tokens: used,
                    output_tokens: 10000,
                    cache_creation_input_tokens: 0,
                    cache_read_input_tokens: 0
                }
            }
        }
    };
}

describe('ContextBarWidget', () => {
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

    it('renders 25 Braille cells from raw counts with the existing numeric text', () => {
        const result = widget.render(item, contextFor(15000, 100000), DEFAULT_SETTINGS) ?? '';

        expect(getVisibleText(result)).toBe(`Ctxt: ┃${'⣿'.repeat(3)}⣧${'⣀'.repeat(21)}┃ 15k/100k (15%)`);
        expect(result).toMatch(/\x1b\[0m 15k\/100k \(15%\)$/);
    });

    it('keeps green, amber, and red fill adjacent at 80 percent', () => {
        const result = widget.render(item, contextFor(80000), DEFAULT_SETTINGS) ?? '';

        expect(result).toBe(`Ctxt: \x1b[38;5;244m┃\x1b[38;5;34m${'⣿'.repeat(12)}\x1b[38;5;214m${'⣿'.repeat(7)}\x1b[38;5;196m⣿\x1b[38;5;238m${'⣀'.repeat(5)}\x1b[38;5;244m┃\x1b[0m 80k/100k (80%)`);
        expect(widget.getDynamicColors(item, contextFor(80000), DEFAULT_SETTINGS)).toBeNull();
    });

    it('colours a partial cell from the band at its displayed position', () => {
        const result = widget.render(item, contextFor(51000), DEFAULT_SETTINGS) ?? '';

        expect(result).toContain(`\x1b[38;5;34m${'⣿'.repeat(12)}\x1b[38;5;214m⣧`);
    });

    it('uses the actual rail width when placing colour boundaries', () => {
        const narrow = { ...item, metadata: { brailleWidth: '10' } };
        const result = widget.render(narrow, contextFor(90000), DEFAULT_SETTINGS) ?? '';

        expect(result).toContain(`\x1b[38;5;34m${'⣿'.repeat(5)}\x1b[38;5;214m${'⣿'.repeat(2)}\x1b[38;5;196m${'⣿'.repeat(2)}`);
    });

    it('retains all three bands when the rail is full', () => {
        const result = widget.render(item, contextFor(100000), DEFAULT_SETTINGS) ?? '';

        expect(result).toContain(`\x1b[38;5;34m${'⣿'.repeat(12)}\x1b[38;5;214m${'⣿'.repeat(7)}\x1b[38;5;196m${'⣿'.repeat(6)}\x1b[38;5;244m┃`);
    });

    it('uses configured width, thresholds, and fill colour', () => {
        const configured = {
            ...item,
            metadata: {
                brailleWidth: '12',
                brailleWarningAt: '30',
                brailleCriticalAt: '40',
                brailleMediumColor: 'ansi256:23'
            }
        };
        const result = widget.render(configured, contextFor(35000), DEFAULT_SETTINGS) ?? '';

        expect(getVisibleText(result)).toBe(`Ctxt: ┃${'⣿'.repeat(4)}⡀${'⣀'.repeat(7)}┃ 35k/100k (35%)`);
        expect(result).toContain(`\x1b[38;5;34m${'⣿'.repeat(4)}\x1b[38;5;23m⡀`);
    });

    it('uses defaults when metadata is invalid', () => {
        const result = widget.render({
            ...item,
            metadata: {
                brailleWidth: 'bad',
                brailleWarningAt: '200',
                brailleCriticalAt: '-1',
                brailleMediumColor: 'no-such-colour'
            }
        }, contextFor(50000), DEFAULT_SETTINGS) ?? '';

        expect(getVisibleText(result)).toContain(`┃${'⣿'.repeat(12)}⡇${'⣀'.repeat(12)}┃`);
        expect(result).toContain(`\x1b[38;5;34m${'⣿'.repeat(12)}\x1b[38;5;214m⡇`);
    });

    it('shows an empty rail and no numeric text when counts are missing', () => {
        const result = widget.render(item, { data: { context_window: { context_window_size: 100000 } } }, DEFAULT_SETTINGS) ?? '';

        expect(getVisibleText(result)).toBe(`Ctxt: ┃${'⣀'.repeat(25)}┃`);
    });

    it('uses ASCII fallback under LANG=C', () => {
        process.env.LANG = 'C';
        process.env.LC_ALL = 'C';
        process.env.LC_CTYPE = 'C';
        const result = widget.render(item, contextFor(50000), DEFAULT_SETTINGS) ?? '';

        expect(getVisibleText(result)).toBe(`Ctxt: |${'#'.repeat(13)}${'-'.repeat(12)}| 50k/100k (50%)`);
        expect(result).toMatch(/\x1b\[0m 50k\/100k \(50%\)$/);
        expect(result).toContain(`\x1b[38;5;34m${'#'.repeat(12)}\x1b[38;5;214m#`);
    });

    it('uses ASCII fallback when locale variables are unset', () => {
        delete process.env.LANG;
        delete process.env.LC_ALL;
        delete process.env.LC_CTYPE;

        const result = widget.render(item, contextFor(50000), DEFAULT_SETTINGS) ?? '';

        expect(getVisibleText(result)).toBe(`Ctxt: |${'#'.repeat(13)}${'-'.repeat(12)}| 50k/100k (50%)`);
    });

    it('emits no ANSI codes when colours are disabled', () => {
        const result = widget.render(item, contextFor(50000), { ...DEFAULT_SETTINGS, colorLevel: 0 }) ?? '';

        expect(result).toBe(`Ctxt: ┃${'⣿'.repeat(12)}⡇${'⣀'.repeat(12)}┃ 50k/100k (50%)`);
        expect(result).not.toContain('\x1b[');
    });

    it('omits the rail when requested while keeping the numeric readout', () => {
        const result = widget.render(item, { ...contextFor(50000), contextBarWidth: 0 }, DEFAULT_SETTINGS);
        expect(getVisibleText(result ?? '')).toBe('Ctxt: 50k/100k (50%)');
    });

    it('keeps model and transcript fallback and raw mode', () => {
        const fallback: RenderContext = {
            data: { model: { id: 'Opus 4.6 (1M)' } },
            tokenMetrics: {
                inputTokens: 0,
                outputTokens: 0,
                cachedTokens: 0,
                totalTokens: 0,
                contextLength: 50000
            }
        };

        expect(getVisibleText(widget.render(item, fallback, DEFAULT_SETTINGS) ?? ''))
            .toMatch(/^Ctxt: ┃.{25}┃ 50k\/1\.0M \(5%\)$/u);
        expect(getVisibleText(widget.render({ ...item, rawValue: true }, contextFor(5000), DEFAULT_SETTINGS) ?? ''))
            .toMatch(/^┃.{25}┃ 5k\/100k \(5%\)$/u);
    });

    it('keeps long progress and slider modes', () => {
        const long = { ...item, metadata: { display: 'progress' } };
        const slider = { ...item, metadata: { display: 'slider' } };
        const sliderOnly = { ...item, metadata: { display: 'slider-only' } };

        expect(getVisibleText(widget.render(long, contextFor(50000), DEFAULT_SETTINGS) ?? ''))
            .toMatch(/^Ctxt: ┃.{25}┃ 50k\/100k \(50%\)$/u);
        expect(widget.render(slider, contextFor(50000), DEFAULT_SETTINGS)).toBe('Context: ▓▓▓▓▓░░░░░ 50k/100k (50%)');
        expect(widget.render(sliderOnly, contextFor(50000), DEFAULT_SETTINGS)).toBe('Context: ▓▓▓▓▓░░░░░');
        expect(widget.getDynamicColors(slider, contextFor(70000), DEFAULT_SETTINGS)?.backgroundColor).toContain('196');
    });

    it('renders the rail alone in rail-only mode', () => {
        const railOnly = { ...item, metadata: { display: 'rail-only' } };

        expect(getVisibleText(widget.render(railOnly, contextFor(15000, 100000), DEFAULT_SETTINGS) ?? ''))
            .toBe(`Ctxt: ┃${'⣿'.repeat(3)}⣧${'⣀'.repeat(21)}┃`);
        expect(getVisibleText(widget.render({ ...railOnly, rawValue: true }, contextFor(5000), DEFAULT_SETTINGS) ?? ''))
            .toMatch(/^┃.{25}┃$/u);
        expect(getVisibleText(widget.render(railOnly, { isPreview: true }, DEFAULT_SETTINGS) ?? ''))
            .toMatch(/^Ctxt: ┃.{25}┃$/u);
        expect(widget.render(railOnly, { ...contextFor(5000), contextBarWidth: 0 }, DEFAULT_SETTINGS)).toBeNull();
    });

    it('cycles display modes and formats the preview', () => {
        const first = widget.handleEditorAction('toggle-progress', item);
        const second = widget.handleEditorAction('toggle-progress', first ?? item);
        const third = widget.handleEditorAction('toggle-progress', second ?? item);
        const fourth = widget.handleEditorAction('toggle-progress', third ?? item);
        const fifth = widget.handleEditorAction('toggle-progress', fourth ?? item);

        expect([first, second, third, fourth, fifth].map(next => next?.metadata?.display))
            .toEqual(['progress', 'rail-only', 'slider', 'slider-only', 'progress-short']);
        expect(getVisibleText(widget.render({ ...item, numberFormat: { decimals: 2 } }, { isPreview: true }, DEFAULT_SETTINGS) ?? ''))
            .toMatch(/^Ctxt: ┃.{25}┃ 50\.00k\/200\.00k \(25\.00%\)$/u);
    });

    it('offers an alert-level editor from the Context Bar keybinds', () => {
        expect(widget.getCustomKeybinds()).toContainEqual({
            key: 'l',
            label: 'alert (l)evels',
            action: 'edit-alert-levels'
        });
    });
});
