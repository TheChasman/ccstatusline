import { execSync } from 'child_process';
import os from 'os';
import type { Mock } from 'vitest';
import {
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type { RenderContext } from '../../types/RenderContext';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import type { WidgetItem } from '../../types/Widget';
import { HostnameWidget } from '../Hostname';

vi.mock('child_process', () => ({ execSync: vi.fn() }));
vi.mock('os', () => ({
    default: {
        platform: vi.fn(),
        hostname: vi.fn()
    }
}));

const mockExecSync = execSync as Mock;
const mockPlatform = os.platform as Mock;
const mockHostname = os.hostname as Mock;

const widget = new HostnameWidget();
const item: WidgetItem = { id: 'hostname', type: 'hostname' };
const rawItem: WidgetItem = { id: 'hostname', type: 'hostname', rawValue: true };
const context: RenderContext = { data: { cwd: '/repo' } };

describe('HostnameWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns prefixed preview string', () => {
        expect(widget.render(item, { isPreview: true }, DEFAULT_SETTINGS)).toBe('Host: Kirk');
    });

    it('returns raw preview string', () => {
        expect(widget.render(rawItem, { isPreview: true }, DEFAULT_SETTINGS)).toBe('Kirk');
    });

    it('uses scutil on macOS', () => {
        mockPlatform.mockReturnValue('darwin');
        mockExecSync.mockReturnValue('SpocksPad\n');
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Host: SpocksPad');
        expect(mockExecSync).toHaveBeenCalledWith('scutil --get LocalHostName', { encoding: 'utf8' });
    });

    it('omits prefix in raw mode on macOS', () => {
        mockPlatform.mockReturnValue('darwin');
        mockExecSync.mockReturnValue('Kirk\n');
        expect(widget.render(rawItem, context, DEFAULT_SETTINGS)).toBe('Kirk');
    });

    it('falls back to os.hostname on non-macOS', () => {
        mockPlatform.mockReturnValue('linux');
        mockHostname.mockReturnValue('spock');
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Host: spock');
    });

    it('strips domain suffix from os.hostname', () => {
        mockPlatform.mockReturnValue('linux');
        mockHostname.mockReturnValue('kirk.local');
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Host: kirk');
    });

    it('falls back to os.hostname when scutil throws', () => {
        mockPlatform.mockReturnValue('darwin');
        mockExecSync.mockImplementation(() => { throw new Error('scutil not found'); });
        mockHostname.mockReturnValue('macbook.local');
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Host: macbook');
    });

    it('falls back to os.hostname when scutil returns empty string', () => {
        mockPlatform.mockReturnValue('darwin');
        mockExecSync.mockReturnValue('\n');
        mockHostname.mockReturnValue('macbook.local');
        expect(widget.render(item, context, DEFAULT_SETTINGS)).toBe('Host: macbook');
    });

    it('has correct metadata', () => {
        expect(widget.getDefaultColor()).toBe('gray');
        expect(widget.getDisplayName()).toBe('Hostname');
        expect(widget.getDescription()).toBe('Shows the machine\'s friendly local hostname');
        expect(widget.getCategory()).toBe('Environment');
        expect(widget.supportsRawValue()).toBe(true);
        expect(widget.supportsColors(item)).toBe(true);
    });
});