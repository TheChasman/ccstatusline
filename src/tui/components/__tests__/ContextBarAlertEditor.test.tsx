import { render } from 'ink';
import { PassThrough } from 'node:stream';
import stripAnsi from 'strip-ansi';
import {
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type { WidgetItem } from '../../../types/Widget';
import { ContextBarWidget } from '../../../widgets/ContextBar';

class MockTtyStream extends PassThrough {
    isTTY = true;
    columns = 120;
    rows = 40;

    setRawMode() { return this; }
    ref() { return this; }
    unref() { return this; }
}

function createMockStdin(): NodeJS.ReadStream {
    return new MockTtyStream() as unknown as NodeJS.ReadStream;
}

function createMockStdout(): NodeJS.WriteStream & { getOutput: () => string } {
    const stream = new MockTtyStream();
    const chunks: string[] = [];
    stream.on('data', (chunk: Buffer | string) => chunks.push(chunk.toString()));
    return Object.assign(stream as unknown as NodeJS.WriteStream, { getOutput: () => stripAnsi(chunks.join('')) });
}

function flushInk() {
    return new Promise(resolve => setTimeout(resolve, 25));
}

async function typeInput(stdin: NodeJS.ReadStream, value: string) {
    for (const character of value) {
        stdin.push(character);
        await flushInk();
    }
}

const widget = new ContextBarWidget();

function openEditor(item: WidgetItem) {
    const stdin = createMockStdin();
    const stdout = createMockStdout();
    const stderr = createMockStdout();
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const element = widget.renderEditor({ widget: item, onComplete, onCancel, action: 'edit-alert-levels' });
    const instance = render(element, { stdin, stdout, stderr, debug: true, exitOnCtrlC: false, patchConsole: false });
    return { stdin, stdout, stderr, onComplete, onCancel, instance };
}

function closeEditor(editor: ReturnType<typeof openEditor>) {
    editor.instance.unmount();
    editor.instance.cleanup();
    editor.stdin.destroy();
    editor.stdout.destroy();
    editor.stderr.destroy();
}

describe('Context Bar alert editor', () => {
    it('shows defaults and saves both entered percentages without changing other metadata', async () => {
        const editor = openEditor({ id: 'ctx', type: 'context-bar', metadata: { brailleWidth: '30' } });
        try {
            await flushInk();
            expect(editor.stdout.getOutput()).toContain('Warning: 50%');
            expect(editor.stdout.getOutput()).toContain('Critical: 75%');
            await typeInput(editor.stdin, '52.5');
            editor.stdin.push('\r');
            await flushInk();
            expect(editor.onComplete).not.toHaveBeenCalled();
            await typeInput(editor.stdin, '80');
            editor.stdin.push('\r');
            await flushInk();
            const expectedMetadata = { brailleWidth: '30', brailleWarningAt: '52.5', brailleCriticalAt: '80' };
            expect(editor.onComplete).toHaveBeenCalledWith(expect.objectContaining({ metadata: expectedMetadata }));
        } finally {
            closeEditor(editor);
        }
    });

    it('keeps invalid ordering on screen and lets Escape cancel without saving', async () => {
        const editor = openEditor({ id: 'ctx', type: 'context-bar' });
        try {
            await flushInk();
            await typeInput(editor.stdin, '80');
            editor.stdin.push('\r');
            await flushInk();
            editor.stdin.push('\r');
            await flushInk();
            expect(editor.stdout.getOutput()).toContain('Warning must be below critical');
            expect(editor.onComplete).not.toHaveBeenCalled();
            editor.stdin.push('\u001b');
            await flushInk();
            expect(editor.onCancel).toHaveBeenCalledOnce();
        } finally {
            closeEditor(editor);
        }
    });

    it('rejects a 100 percent warning before advancing to critical', async () => {
        const editor = openEditor({ id: 'ctx', type: 'context-bar' });
        try {
            await flushInk();
            await typeInput(editor.stdin, '100');
            editor.stdin.push('\r');
            await flushInk();
            expect(editor.stdout.getOutput()).toContain('Warning must be below 100%');
            expect(editor.stdout.getOutput()).toContain('Warning (amber) percentage:');
            expect(editor.onComplete).not.toHaveBeenCalled();
        } finally {
            closeEditor(editor);
        }
    });
});
