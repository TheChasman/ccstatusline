const BRAILLE_RAMP = ['⠀', '⡀', '⡄', '⡆', '⡇', '⣇', '⣧', '⣷', '⣿'];
const DEFAULT_WIDTH = 25;

export function makeBrailleContextBar(used: number, limit: number, width: number, ascii = false): string {
    const cellWidth = Number.isFinite(width) ? Math.max(1, Math.trunc(width)) : DEFAULT_WIDTH;
    const rail = ascii ? '-' : '⣀';
    const start = ascii ? '|' : '┃';
    const end = start;

    if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0 || used <= 0) {
        return `${start}${rail.repeat(cellWidth)}${end}`;
    }

    const totalSteps = cellWidth * 8;
    let steps = Math.floor((used / limit) * totalSteps);
    steps = Math.min(totalSteps, Math.max(0, steps));
    if (steps === 0) {
        steps = 1;
    }

    const fullCells = Math.floor(steps / 8);
    const remainder = steps % 8;
    const partialCell = remainder > 0 ? (ascii ? '#' : (BRAILLE_RAMP[remainder] ?? '')) : '';
    const filled = `${ascii ? '#'.repeat(fullCells) : '⣿'.repeat(fullCells)}${partialCell}`;
    const trackCells = cellWidth - fullCells - (remainder > 0 ? 1 : 0);

    return `${start}${filled}${rail.repeat(trackCells)}${end}`;
}

export function resolveBrailleBarWidth(metadata?: Record<string, string>): number {
    const value = metadata?.brailleWidth;
    if (value === undefined || !/^\s*[+-]?\d+(?:\.\d+)?\s*$/.test(value)) {
        return DEFAULT_WIDTH;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_WIDTH;
    }
    return Math.min(80, Math.max(10, Math.trunc(parsed)));
}
