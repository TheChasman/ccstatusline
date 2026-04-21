import type { Mock } from 'vitest';
import {
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type {
    RenderContext,
    WidgetItem
} from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import { loadClaudeSettingsSync } from '../../utils/claude-settings';
import { AutoEffortModeWidget } from '../AutoEffortMode';

vi.mock('../../utils/claude-settings', () => ({ loadClaudeSettingsSync: vi.fn() }));

const mockedLoadSettings = loadClaudeSettingsSync as Mock;
const ITEM: WidgetItem = { id: 'auto-effort-mode', type: 'auto-effort-mode' };
const ITEM_RAW: WidgetItem = { ...ITEM, rawValue: true };

function ctx(overrides: Partial<RenderContext> = {}): RenderContext {
    return { ...overrides };
}

describe('AutoEffortModeWidget', () => {
    describe('metadata', () => {
        it('has correct display name', () => {
            expect(new AutoEffortModeWidget().getDisplayName()).toBe('Auto Effort Mode');
        });

        it('has correct category', () => {
            expect(new AutoEffortModeWidget().getCategory()).toBe('Core');
        });

        it('supports raw value', () => {
            expect(new AutoEffortModeWidget().supportsRawValue()).toBe(true);
        });

        it('supports colors', () => {
            expect(new AutoEffortModeWidget().supportsColors(ITEM)).toBe(true);
        });

        it('returns displayName from getEditorDisplay', () => {
            expect(new AutoEffortModeWidget().getEditorDisplay(ITEM)).toEqual({ displayText: 'Auto Effort Mode' });
        });
    });

    describe('render() — labelled mode', () => {
        it('returns Auto(ON) when effortLevel is auto', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'auto' });
            expect(new AutoEffortModeWidget().render(ITEM, ctx(), DEFAULT_SETTINGS)).toBe('Auto(ON)');
        });

        it('returns Auto[OFF] when effortLevel is high', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'high' });
            expect(new AutoEffortModeWidget().render(ITEM, ctx(), DEFAULT_SETTINGS)).toBe('Auto[OFF]');
        });

        it('returns Auto[OFF] when effortLevel is absent', () => {
            mockedLoadSettings.mockReturnValue({});
            expect(new AutoEffortModeWidget().render(ITEM, ctx(), DEFAULT_SETTINGS)).toBe('Auto[OFF]');
        });

        it('returns Auto[OFF] when settings read throws', () => {
            mockedLoadSettings.mockImplementation(() => { throw new Error('no file'); });
            expect(new AutoEffortModeWidget().render(ITEM, ctx(), DEFAULT_SETTINGS)).toBe('Auto[OFF]');
        });

        it('is case-insensitive — AUTO is treated as auto', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'AUTO' });
            expect(new AutoEffortModeWidget().render(ITEM, ctx(), DEFAULT_SETTINGS)).toBe('Auto(ON)');
        });
    });

    describe('render() — rawValue mode', () => {
        it('returns on when effortLevel is auto', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'auto' });
            expect(new AutoEffortModeWidget().render(ITEM_RAW, ctx(), DEFAULT_SETTINGS)).toBe('on');
        });

        it('returns off when effortLevel is high', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'high' });
            expect(new AutoEffortModeWidget().render(ITEM_RAW, ctx(), DEFAULT_SETTINGS)).toBe('off');
        });
    });

    describe('render() — preview mode', () => {
        it('returns Auto(ON) in preview regardless of settings', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'high' });
            expect(new AutoEffortModeWidget().render(ITEM, ctx({ isPreview: true }), DEFAULT_SETTINGS)).toBe('Auto(ON)');
        });

        it('returns on in preview when rawValue is set', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'high' });
            expect(new AutoEffortModeWidget().render(ITEM_RAW, ctx({ isPreview: true }), DEFAULT_SETTINGS)).toBe('on');
        });
    });

    describe('getDynamicColors()', () => {
        it('returns bold:true when auto is ON', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'auto' });
            expect(new AutoEffortModeWidget().getDynamicColors(ITEM, ctx(), DEFAULT_SETTINGS)).toEqual({ bold: true });
        });

        it('returns null when auto is OFF', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'high' });
            expect(new AutoEffortModeWidget().getDynamicColors(ITEM, ctx(), DEFAULT_SETTINGS)).toBeNull();
        });

        it('returns bold:true in preview mode', () => {
            mockedLoadSettings.mockReturnValue({ effortLevel: 'high' });
            expect(new AutoEffortModeWidget().getDynamicColors(ITEM, ctx({ isPreview: true }), DEFAULT_SETTINGS)).toEqual({ bold: true });
        });
    });
});