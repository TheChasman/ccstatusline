import * as fs from 'fs';
import path from 'path';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance
} from 'vitest';

import {
    CURRENT_VERSION,
    DEFAULT_SETTINGS,
    type Settings
} from '../../types/Settings';
import type { DeployResult } from '../static-deploy';

const MOCK_HOME_DIR = '/tmp/ccstatusline-config-test-home';
const ORIGINAL_CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR;

let loadSettings: () => Promise<Settings>;
let saveSettings: (settings: Settings) => Promise<DeployResult | null>;
let initConfigPath: (filePath?: string) => void;
let consoleErrorSpy: MockInstance<typeof console.error>;

function getSettingsPaths(): { configDir: string; settingsPath: string; backupPath: string } {
    const configDir = path.join(MOCK_HOME_DIR, '.config', 'ccstatusline');
    return {
        configDir,
        settingsPath: path.join(configDir, 'settings.json'),
        backupPath: path.join(configDir, 'settings.bak')
    };
}

function getClaudeConfigDir(): string {
    return path.join(MOCK_HOME_DIR, '.claude');
}

describe('config utilities', () => {
    beforeAll(async () => {
        const configModule = await import('../config');
        loadSettings = configModule.loadSettings;
        saveSettings = configModule.saveSettings;
        initConfigPath = configModule.initConfigPath;
    });

    beforeEach(() => {
        fs.rmSync(MOCK_HOME_DIR, { recursive: true, force: true });
        process.env.CLAUDE_CONFIG_DIR = getClaudeConfigDir();
        const { settingsPath } = getSettingsPaths();
        initConfigPath(settingsPath);
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    afterAll(() => {
        fs.rmSync(MOCK_HOME_DIR, { recursive: true, force: true });
        if (ORIGINAL_CLAUDE_CONFIG_DIR === undefined) {
            delete process.env.CLAUDE_CONFIG_DIR;
        } else {
            process.env.CLAUDE_CONFIG_DIR = ORIGINAL_CLAUDE_CONFIG_DIR;
        }
        initConfigPath();
    });

    it('writes defaults when settings file does not exist', async () => {
        const { settingsPath } = getSettingsPaths();

        const settings = await loadSettings();

        expect(settings.version).toBe(CURRENT_VERSION);
        expect(fs.existsSync(settingsPath)).toBe(true);

        const onDisk = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as {
            version?: number;
            lines?: unknown[];
        };
        expect(onDisk.version).toBe(CURRENT_VERSION);
        expect(Array.isArray(onDisk.lines)).toBe(true);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Default settings written to')
        );
    });

    it('backs up invalid JSON and recovers with defaults', async () => {
        const { settingsPath, backupPath, configDir } = getSettingsPaths();
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(settingsPath, '{ invalid json', 'utf-8');

        const settings = await loadSettings();

        expect(settings.version).toBe(CURRENT_VERSION);
        expect(fs.existsSync(backupPath)).toBe(true);
        expect(fs.readFileSync(backupPath, 'utf-8')).toBe('{ invalid json');

        const recovered = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as { version?: number };
        expect(recovered.version).toBe(CURRENT_VERSION);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to parse settings.json, backing up and using defaults'
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Bad settings backed up to')
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Default settings written to')
        );
    });

    it('backs up invalid v1 payloads and recovers with defaults', async () => {
        const { settingsPath, backupPath, configDir } = getSettingsPaths();
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(settingsPath, JSON.stringify({ flexMode: 123 }), 'utf-8');

        const settings = await loadSettings();

        expect(settings.version).toBe(CURRENT_VERSION);
        expect(fs.existsSync(backupPath)).toBe(true);
        const recovered = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as { version?: number };
        expect(recovered.version).toBe(CURRENT_VERSION);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Invalid v1 settings format:',
            expect.anything()
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Bad settings backed up to')
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Default settings written to')
        );
    });

    it('migrates older versioned settings and persists migrated result', async () => {
        const { settingsPath, configDir } = getSettingsPaths();
        fs.mkdirSync(configDir, { recursive: true });
        fs.writeFileSync(
            settingsPath,
            JSON.stringify({
                version: 2,
                lines: [[{ id: 'widget-1', type: 'model' }]]
            }),
            'utf-8'
        );

        const settings = await loadSettings();

        expect(settings.version).toBe(CURRENT_VERSION);
        const migrated = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as {
            version?: number;
            updatemessage?: { message?: string };
        };
        expect(migrated.version).toBe(CURRENT_VERSION);
        expect(migrated.updatemessage?.message).toContain('v2.0.2');
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('always saves current version in saveSettings', async () => {
        const { settingsPath } = getSettingsPaths();

        await saveSettings({
            ...DEFAULT_SETTINGS,
            version: 1
        });

        const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) as { version?: number };
        expect(saved.version).toBe(CURRENT_VERSION);
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
});

// Mutable state for the static-deploy mock so tests can control per-call behaviour
let mockIsSourceMode = false;
const mockDeployStatic = vi.fn<() => Promise<DeployResult>>();

vi.mock('../static-deploy', () => ({
    isSourceMode: () => mockIsSourceMode,
    deployStatic: () => mockDeployStatic()
}));

describe('saveSettings static deploy integration', () => {
    beforeEach(() => {
        mockIsSourceMode = false;
        mockDeployStatic.mockReset();
    });

    it('returns null when not in source mode', async () => {
        mockIsSourceMode = false;
        const { saveSettings: save } = await import('../config');
        const result = await save({ lines: [[]] } as unknown as Settings);
        expect(result).toBeNull();
        expect(mockDeployStatic).not.toHaveBeenCalled();
    });

    it('invokes deployStatic and returns its result when in source mode', async () => {
        const deployResult: DeployResult = { deployed: true, staticPath: '/tmp/fake.js' };
        mockIsSourceMode = true;
        mockDeployStatic.mockResolvedValue(deployResult);
        const { saveSettings: save } = await import('../config');
        const result = await save({ lines: [[]] } as unknown as Settings);
        expect(mockDeployStatic).toHaveBeenCalledOnce();
        expect(result).toEqual(deployResult);
    });
});