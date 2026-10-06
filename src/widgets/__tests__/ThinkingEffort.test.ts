import chalk from 'chalk';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Mock } from 'vitest';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type {
    RenderContext,
    StatusJSON,
    WidgetItem
} from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import { loadClaudeSettingsSync } from '../../utils/claude-settings';
import {
    applyColors,
    updateColorMap
} from '../../utils/colors';
import { getTrafficLightColor } from '../../utils/traffic-light';
import { ThinkingEffortWidget } from '../ThinkingEffort';

// Mock claude-settings to avoid filesystem reads in tests
vi.mock('../../utils/claude-settings', () => ({ loadClaudeSettingsSync: vi.fn() }));

const mockedLoadSettings = loadClaudeSettingsSync as Mock;
const MODEL_WITH_HIGH_EFFORT = '<local-command-stdout>Set model to \u001b[1mopus (claude-opus-4-6)\u001b[22m with \u001b[1mhigh\u001b[22m effort</local-command-stdout>';
const MODEL_WITH_LOW_EFFORT = '<local-command-stdout>Set model to \u001b[1msonnet (claude-sonnet-4-5)\u001b[22m with \u001b[1mlow\u001b[22m effort</local-command-stdout>';
const MODEL_WITH_MAX_EFFORT = '<local-command-stdout>Set model to \u001b[1mopus (claude-opus-4-6)\u001b[22m with \u001b[1mmax\u001b[22m effort</local-command-stdout>';
const MODEL_WITH_XHIGH_EFFORT = '<local-command-stdout>Set model to \u001b[1mopus (claude-opus-4-7)\u001b[22m with \u001b[1mxhigh\u001b[22m effort</local-command-stdout>';
const MODEL_WITH_XHIGH_MIXED_CASE_EFFORT = '<local-command-stdout>Set model to \u001b[1mopus (claude-opus-4-7)\u001b[22m with \u001b[1mxHigh\u001b[22m effort</local-command-stdout>';
const MODEL_WITH_SUPER_MAX_EFFORT = '<local-command-stdout>Set model to \u001b[1mopus (claude-opus-4-8)\u001b[22m with \u001b[1msuper-max\u001b[22m effort</local-command-stdout>';
const MODEL_WITH_SUPER_MAX_MIXED_CASE_EFFORT = '<local-command-stdout>Set model to \u001b[1mopus (claude-opus-4-8)\u001b[22m with \u001b[1mSuper-Max\u001b[22m effort</local-command-stdout>';
const MODEL_WITHOUT_EFFORT = '<local-command-stdout>Set model to \u001b[1msonnet (claude-sonnet-4-5)\u001b[22m</local-command-stdout>';
const MODEL_WITH_AUTO_EFFORT = '<local-command-stdout>Set model to \u001b[1mopus (claude-opus-4-7)\u001b[22m with \u001b[1mauto\u001b[22m effort</local-command-stdout>';
const EFFORT_HIGH = '<local-command-stdout>Set effort level to \u001b[1mhigh\u001b[22m: Comprehensive implementation with extensive testing and documentation</local-command-stdout>';
const EFFORT_LOW = '<local-command-stdout>Set effort level to \u001b[1mlow\u001b[22m: Quick, minimal-effort response</local-command-stdout>';
const EFFORT_MEDIUM = '<local-command-stdout>Set effort level to \u001b[1mmedium\u001b[22m: Balanced response with good coverage</local-command-stdout>';
const EFFORT_MAX = '<local-command-stdout>Set effort level to \u001b[1mmax\u001b[22m (this session only): Maximum capability with deepest reasoning (Opus 4.6 only)</local-command-stdout>';

let tempDir: string;

function makeTranscriptEntry(content: string): string {
    return JSON.stringify({
        type: 'user',
        message: {
            role: 'user',
            content
        }
    });
}

function render(options: {
    transcriptPath?: string;
    fileContent?: string | null | undefined;
    rawValue?: boolean;
    isPreview?: boolean;
    statusData?: Partial<StatusJSON>;
    settingsValue?: unknown;
    transcriptThinkingEffort?: RenderContext['transcriptThinkingEffort'];
} = {}): string | null {
    const {
        transcriptPath = options.fileContent !== undefined ? path.join(tempDir, 'session.jsonl') : undefined,
        fileContent,
        rawValue = false,
        isPreview = false,
        statusData = {},
        settingsValue = {},
        transcriptThinkingEffort
    } = options;

    const widget = new ThinkingEffortWidget();
    const data: Partial<StatusJSON> = {
        ...statusData,
        ...(transcriptPath ? { transcript_path: transcriptPath } : {})
    };
    const context: RenderContext = {
        data: Object.keys(data).length > 0 ? data : undefined,
        isPreview,
        transcriptThinkingEffort
    };
    const item: WidgetItem = {
        id: 'thinking-effort',
        type: 'thinking-effort',
        rawValue
    };

    mockedLoadSettings.mockReturnValue(settingsValue);

    if (transcriptPath && fileContent !== undefined && fileContent !== null) {
        fs.writeFileSync(transcriptPath, fileContent, 'utf-8');
    }

    return widget.render(item, context, DEFAULT_SETTINGS);
}

describe('ThinkingEffortWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccstatusline-thinking-effort-'));
        mockedLoadSettings.mockReturnValue({});
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe('metadata', () => {
        it('has correct display name', () => {
            const widget = new ThinkingEffortWidget();
            expect(widget.getDisplayName()).toBe('Thinking Effort');
        });

        it('has correct category', () => {
            const widget = new ThinkingEffortWidget();
            expect(widget.getCategory()).toBe('Core');
        });

        it('supports raw value', () => {
            const widget = new ThinkingEffortWidget();
            expect(widget.supportsRawValue()).toBe(true);
        });

        it('supports colors', () => {
            const widget = new ThinkingEffortWidget();
            expect(widget.supportsColors({ type: 'thinking-effort' } as never)).toBe(true);
        });
    });

    describe('preview mode', () => {
        it('returns labelled preview', () => {
            const result = render({ isPreview: true });
            expect(result).toBe('Eff: H');
        });

        it('returns raw preview', () => {
            const result = render({ isPreview: true, rawValue: true });
            expect(result).toBe('H');
        });
    });

    describe('status JSON source', () => {
        it('reads max effort from status JSON', () => {
            const result = render({ statusData: { effort: { level: 'max' } } });
            expect(result).toBe('Eff: MAX');
        });

        it('shows a dash instead of the effort when the model is Auto Model', () => {
            const result = render({
                statusData: {
                    model: { display_name: 'Auto Model' },
                    effort: { level: 'high' },
                    thinking_effort: 'high'
                }
            });
            expect(result).toBe('Eff: -');
        });

        it('returns raw status JSON effort when requested', () => {
            const result = render({
                rawValue: true,
                statusData: { effort: { level: 'max' } }
            });
            expect(result).toBe('MAX');
        });

        it('prefers status JSON effort over transcript and settings fallbacks', () => {
            const result = render({
                fileContent: makeTranscriptEntry(MODEL_WITH_HIGH_EFFORT),
                settingsValue: { effortLevel: 'low' },
                statusData: { effort: { level: 'max' } }
            });
            expect(result).toBe('Eff: MAX');
        });

        it('supports xhigh effort from status JSON', () => {
            const result = render({ statusData: { effort: { level: 'xhigh' } } });
            expect(result).toBe('Eff: XH');
        });

        it('shows unknown-but-valid status JSON effort with trailing "?" marker', () => {
            const result = render({ statusData: { effort: { level: 'ultra' } } });
            expect(result).toBe('Eff: ultra?');
        });

        it('treats null status JSON effort as explicit default', () => {
            const result = render({
                fileContent: makeTranscriptEntry(MODEL_WITH_HIGH_EFFORT),
                settingsValue: { effortLevel: 'low' },
                statusData: { effort: { level: null } }
            });
            expect(result).toBe('Eff: D');
        });
    });

    describe('transcript source', () => {
        it('reads effort from the latest /model transcript stdout', () => {
            const result = render({
                fileContent: makeTranscriptEntry(MODEL_WITH_HIGH_EFFORT),
                settingsValue: { effortLevel: 'low' }
            });
            expect(result).toBe('Eff: H');
        });

        it('returns raw transcript effort when requested', () => {
            const result = render({
                fileContent: makeTranscriptEntry(MODEL_WITH_LOW_EFFORT),
                rawValue: true
            });
            expect(result).toBe('L');
        });

        it('supports max effort from transcript output', () => {
            const result = render({ fileContent: makeTranscriptEntry(MODEL_WITH_MAX_EFFORT) });
            expect(result).toBe('Eff: MAX');
        });

        it('reads xhigh effort from the latest /model transcript stdout', () => {
            const result = render({ fileContent: makeTranscriptEntry(MODEL_WITH_XHIGH_EFFORT) });
            expect(result).toBe('Eff: XH');
        });

        it('reads auto effort from the latest /model transcript stdout', () => {
            const result = render({ fileContent: makeTranscriptEntry(MODEL_WITH_AUTO_EFFORT) });
            expect(result).toBe('Eff: A');
        });

        it('supports xhigh effort from transcript output', () => {
            const result = render({ fileContent: makeTranscriptEntry(MODEL_WITH_XHIGH_EFFORT) });
            expect(result).toBe('Eff: XH');
        });

        it('supports mixed-case xHigh effort from transcript output', () => {
            const result = render({ fileContent: makeTranscriptEntry(MODEL_WITH_XHIGH_MIXED_CASE_EFFORT) });
            expect(result).toBe('Eff: XH');
        });

        it('shows unknown-but-valid effort with trailing "?" marker', () => {
            const result = render({ fileContent: makeTranscriptEntry(MODEL_WITH_SUPER_MAX_EFFORT) });
            expect(result).toBe('Eff: super-max?');
        });

        it('lowercases and marks mixed-case unknown effort', () => {
            const result = render({ fileContent: makeTranscriptEntry(MODEL_WITH_SUPER_MAX_MIXED_CASE_EFFORT) });
            expect(result).toBe('Eff: super-max?');
        });

        it('does not keep stale transcript effort when a newer /model output has no effort', () => {
            const result = render({
                fileContent: [
                    makeTranscriptEntry(MODEL_WITH_HIGH_EFFORT),
                    makeTranscriptEntry('<local-command-stdout>Bye!</local-command-stdout>'),
                    makeTranscriptEntry(MODEL_WITHOUT_EFFORT)
                ].join('\n'),
                settingsValue: { effortLevel: 'medium' }
            });
            expect(result).toBe('Eff: M');
        });

        it('uses effort precomputed by the shared transcript analysis', () => {
            const result = render({
                transcriptPath: path.join(tempDir, 'missing.jsonl'),
                transcriptThinkingEffort: { value: 'high', known: true },
                settingsValue: { effortLevel: 'low' }
            });

            expect(result).toBe('Eff: H');
        });
    });

    describe('/effort command source', () => {
        it('reads effort from /effort transcript stdout', () => {
            const result = render({ fileContent: makeTranscriptEntry(EFFORT_HIGH) });
            expect(result).toBe('Eff: H');
        });

        it('supports low effort from /effort command', () => {
            const result = render({ fileContent: makeTranscriptEntry(EFFORT_LOW) });
            expect(result).toBe('Eff: L');
        });

        it('supports medium effort from /effort command', () => {
            const result = render({ fileContent: makeTranscriptEntry(EFFORT_MEDIUM) });
            expect(result).toBe('Eff: M');
        });

        it('supports max effort from /effort command', () => {
            const result = render({ fileContent: makeTranscriptEntry(EFFORT_MAX) });
            expect(result).toBe('Eff: MAX');
        });

        it('returns raw effort from /effort command', () => {
            const result = render({ fileContent: makeTranscriptEntry(EFFORT_HIGH), rawValue: true });
            expect(result).toBe('H');
        });

        it('/effort overrides earlier /model when it is newer', () => {
            const result = render({
                fileContent: [
                    makeTranscriptEntry(MODEL_WITH_LOW_EFFORT),
                    makeTranscriptEntry(EFFORT_MAX)
                ].join('\n')
            });
            expect(result).toBe('Eff: MAX');
        });

        it('/model overrides earlier /effort when it is newer', () => {
            const result = render({
                fileContent: [
                    makeTranscriptEntry(EFFORT_MAX),
                    makeTranscriptEntry(MODEL_WITH_LOW_EFFORT)
                ].join('\n')
            });
            expect(result).toBe('Eff: L');
        });

        it('/effort overrides settings fallback', () => {
            const result = render({
                fileContent: makeTranscriptEntry(EFFORT_HIGH),
                settingsValue: { effortLevel: 'low' }
            });
            expect(result).toBe('Eff: H');
        });
    });

    describe('Claude settings fallback', () => {
        it('falls back to effortLevel when the latest /model output has no effort', () => {
            const result = render({
                fileContent: makeTranscriptEntry(MODEL_WITHOUT_EFFORT),
                settingsValue: { effortLevel: 'high' }
            });
            expect(result).toBe('Eff: H');
        });

        it('falls back to effortLevel when the transcript is unavailable', () => {
            const result = render({
                transcriptPath: path.join(tempDir, 'missing.jsonl'),
                fileContent: null,
                settingsValue: { effortLevel: 'high' }
            });
            expect(result).toBe('Eff: H');
        });

        it('handles case-insensitive effortLevel', () => {
            const result = render({ settingsValue: { effortLevel: 'HIGH' } });
            expect(result).toBe('Eff: H');
        });

        it('supports max effortLevel', () => {
            const result = render({ settingsValue: { effortLevel: 'max' } });
            expect(result).toBe('Eff: MAX');
        });

        it('supports xhigh effortLevel', () => {
            const result = render({ settingsValue: { effortLevel: 'xhigh' } });
            expect(result).toBe('Eff: XH');
        });

        it('supports auto effortLevel', () => {
            const result = render({ settingsValue: { effortLevel: 'auto' } });
            expect(result).toBe('Eff: A');
        });

        it('supports mixed-case xHigh effortLevel', () => {
            const result = render({ settingsValue: { effortLevel: 'xHigh' } });
            expect(result).toBe('Eff: XH');
        });

        it('shows unknown-but-valid effortLevel with trailing "?" marker', () => {
            const result = render({ settingsValue: { effortLevel: 'super-max' } });
            expect(result).toBe('Eff: super-max?');
        });

        it('marks unknown effortLevel still passes through case-insensitive match', () => {
            const result = render({ settingsValue: { effortLevel: 'Ultra' } });
            expect(result).toBe('Eff: ultra?');
        });

        it('displays default when effortLevel is not set', () => {
            const result = render();
            expect(result).toBe('Eff: D');
        });

        it('displays default when effortLevel fails the shape check', () => {
            const result = render({ settingsValue: { effortLevel: 'has space' } });
            expect(result).toBe('Eff: D');
        });

        it('displays default when effortLevel is too long', () => {
            const result = render({ settingsValue: { effortLevel: 'thisisaveryverylongeffortname' } });
            expect(result).toBe('Eff: D');
        });

        it('displays default when effortLevel is a single character', () => {
            const result = render({ settingsValue: { effortLevel: 'x' } });
            expect(result).toBe('Eff: D');
        });

        it('displays default when settings read fails', () => {
            mockedLoadSettings.mockImplementation(() => {
                throw new Error('settings unavailable');
            });
            const result = render();
            expect(result).toBe('Eff: D');
        });

        it('displays default when the latest /model output has no effort and settings are missing', () => {
            const result = render({ fileContent: makeTranscriptEntry(MODEL_WITHOUT_EFFORT) });
            expect(result).toBe('Eff: D');
        });

        it('displays raw default when fallback hits', () => {
            const result = render({ rawValue: true });
            expect(result).toBe('D');
        });
    });

    describe('getDynamicColors', () => {
        it('returns green for low effort', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: { thinking_effort: 'low' } };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('green', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns amber for medium effort', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: { thinking_effort: 'medium' } };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('orange', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns red for high effort', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: { thinking_effort: 'high' } };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: getTrafficLightColor('red', DEFAULT_SETTINGS.colorLevel) });
        });

        it('returns dark gray for Auto Model', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = {
                data: {
                    model: { display_name: 'Auto Model' },
                    thinking_effort: 'high'
                }
            };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({ color: 'brightBlack' });
        });

        it('returns white background + bold red for max effort (normal mode)', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: { thinking_effort: 'max' } };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };
            const settings = structuredClone(DEFAULT_SETTINGS);
            settings.powerline.enabled = false;

            const result = widget.getDynamicColors(item, context, settings);
            expect(result).toEqual({
                backgroundColor: 'bgWhite',
                color: getTrafficLightColor('red', settings.colorLevel),
                bold: true
            });
        });

        it('returns white background + bold red for max effort (powerline mode)', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: { thinking_effort: 'max' } };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };
            const settings = structuredClone(DEFAULT_SETTINGS);
            settings.powerline.enabled = true;

            const result = widget.getDynamicColors(item, context, settings);
            expect(result).toEqual({
                backgroundColor: 'bgWhite',
                color: getTrafficLightColor('red', settings.colorLevel),
                bold: true
            });
        });

        it('returns null when no effort data', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: {} };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toBeNull();
        });

        it('returns white on red for xhigh effort', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: { thinking_effort: 'xhigh' } };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };

            const result = widget.getDynamicColors(item, context, DEFAULT_SETTINGS);
            expect(result).toEqual({
                color: 'white',
                backgroundColor: getTrafficLightColor('red', DEFAULT_SETTINGS.colorLevel)
            });
        });

        it('returns purple for auto effort (normal mode)', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: { thinking_effort: 'auto' } };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };
            const settings = structuredClone(DEFAULT_SETTINGS);
            settings.powerline.enabled = false;

            const result = widget.getDynamicColors(item, context, settings);
            expect(result).toEqual({ color: getTrafficLightColor('purple', settings.colorLevel) });
        });

        it('returns purple background + black text for auto effort (powerline mode)', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: { thinking_effort: 'auto' } };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };
            const settings = structuredClone(DEFAULT_SETTINGS);
            settings.powerline.enabled = true;

            const result = widget.getDynamicColors(item, context, settings);
            expect(result).toEqual({
                backgroundColor: getTrafficLightColor('purple', settings.colorLevel),
                color: 'black'
            });
        });

        it('returns backgroundColor and black for powerline mode (low)', () => {
            const widget = new ThinkingEffortWidget();
            const context: RenderContext = { data: { thinking_effort: 'low' } };
            const item: WidgetItem = { id: '1', type: 'thinking-effort' };
            const settings = structuredClone(DEFAULT_SETTINGS);
            settings.powerline.enabled = true;

            const result = widget.getDynamicColors(item, context, settings);
            expect(result).toEqual({
                backgroundColor: getTrafficLightColor('green', settings.colorLevel),
                color: 'black'
            });
        });

        it('renders max effort with an actual white background and red foreground', () => {
            const previousLevel = chalk.level;
            try {
                chalk.level = 2;
                updateColorMap();
                const widget = new ThinkingEffortWidget();
                const context: RenderContext = { data: { effort: { level: 'max' } } };
                const settings = { ...DEFAULT_SETTINGS, colorLevel: 2 as const };
                const styles = widget.getDynamicColors({ id: '1', type: 'thinking-effort' }, context, settings);
                const output = applyColors('MAX', styles?.color, styles?.backgroundColor, styles?.bold, 'ansi256');

                expect(output).toContain('\x1b[48;5;188m');
                expect(output).toContain('\x1b[38;5;196m');
                expect(output).toContain('\x1b[1m');
            } finally {
                chalk.level = previousLevel;
                updateColorMap();
            }
        });

        for (const enabled of [false, true]) {
            it.each([
                {
                    level: 'low',
                    normal: { color: 'ansi256:34' },
                    powerline: { color: 'black', backgroundColor: 'ansi256:34' }
                },
                {
                    level: 'medium',
                    normal: { color: 'ansi256:214' },
                    powerline: { color: 'black', backgroundColor: 'ansi256:214' }
                },
                {
                    level: 'high',
                    normal: { color: 'ansi256:196' },
                    powerline: { color: 'black', backgroundColor: 'ansi256:196' }
                },
                {
                    level: 'xhigh',
                    normal: { color: 'white', backgroundColor: 'ansi256:196' },
                    powerline: { color: 'white', backgroundColor: 'ansi256:196' }
                },
                {
                    level: 'max',
                    normal: { color: 'ansi256:196', backgroundColor: 'bgWhite', bold: true },
                    powerline: { color: 'ansi256:196', backgroundColor: 'bgWhite', bold: true }
                }
            ])(`styles live $level effort with powerline=${enabled}`, ({ level, normal, powerline }) => {
                const widget = new ThinkingEffortWidget();
                const context: RenderContext = { data: { effort: { level } } };
                const settings = {
                    ...DEFAULT_SETTINGS,
                    colorLevel: 2 as const,
                    powerline: { ...DEFAULT_SETTINGS.powerline, enabled }
                };

                expect(widget.getDynamicColors({ id: '1', type: 'thinking-effort' }, context, settings))
                    .toEqual(enabled ? powerline : normal);
            });

            it.each([
                ['low', { color: 'hex:00AF00' }, { color: 'black', backgroundColor: 'hex:00AF00' }],
                ['medium', { color: 'hex:FFAF00' }, { color: 'black', backgroundColor: 'hex:FFAF00' }],
                ['high', { color: 'hex:FF0000' }, { color: 'black', backgroundColor: 'hex:FF0000' }],
                ['xhigh', { color: 'white', backgroundColor: 'hex:FF0000' }, { color: 'white', backgroundColor: 'hex:FF0000' }],
                ['max', { color: 'hex:FF0000', backgroundColor: 'bgWhite', bold: true }, { color: 'hex:FF0000', backgroundColor: 'bgWhite', bold: true }]
            ] as const)(`styles truecolour %s effort with powerline=${enabled}`, (level, normal, powerline) => {
                const widget = new ThinkingEffortWidget();
                const context: RenderContext = { data: { effort: { level } } };
                const settings = {
                    ...DEFAULT_SETTINGS,
                    colorLevel: 3 as const,
                    powerline: { ...DEFAULT_SETTINGS.powerline, enabled }
                };

                expect(widget.getDynamicColors({ id: '1', type: 'thinking-effort' }, context, settings))
                    .toEqual(enabled ? powerline : normal);
            });
        }
    });
});
