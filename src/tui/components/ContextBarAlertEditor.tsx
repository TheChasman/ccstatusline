import {
    Box,
    Text,
    useInput
} from 'ink';
import React, { useState } from 'react';

import type { WidgetEditorProps } from '../../types/Widget';
import { resolveBrailleAlertLevels } from '../../utils/braille-context-bar';
import { shouldInsertInput } from '../../utils/input-guards';

function parsePercentage(input: string, fallback: number): number | null {
    if (input === '')
        return fallback;
    if (!/^\d+(?:\.\d+)?$/.test(input))
        return null;
    const value = Number(input);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export function renderContextBarAlertEditor(props: WidgetEditorProps): React.ReactElement {
    return <ContextBarAlertEditor {...props} />;
}

export const ContextBarAlertEditor: React.FC<WidgetEditorProps> = ({ widget, onComplete, onCancel }) => {
    const levels = resolveBrailleAlertLevels(widget.metadata);
    const [step, setStep] = useState<'warning' | 'critical'>('warning');
    const [warningInput, setWarningInput] = useState('');
    const [criticalInput, setCriticalInput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const input = step === 'warning' ? warningInput : criticalInput;
    const current = step === 'warning' ? levels.warning : levels.critical;

    useInput((value, key) => {
        if (key.escape) {
            onCancel();
            return;
        }

        if (key.return) {
            const parsed = parsePercentage(input, current);
            if (parsed === null) {
                setError('Enter a percentage from 0 to 100');
                return;
            }
            if (step === 'warning') {
                setStep('critical');
                setError(null);
                return;
            }

            const warning = parsePercentage(warningInput, levels.warning);
            if (warning === null || warning >= parsed) {
                setError('Warning must be below critical');
                return;
            }

            onComplete({
                ...widget,
                metadata: {
                    ...widget.metadata,
                    ...(warningInput && { brailleWarningAt: String(warning) }),
                    ...(criticalInput && { brailleCriticalAt: String(parsed) })
                }
            });
            return;
        }

        if (key.backspace || key.delete) {
            if (step === 'warning')
                setWarningInput(previous => previous.slice(0, -1));
            else
                setCriticalInput(previous => previous.slice(0, -1));
            setError(null);
            return;
        }

        if (shouldInsertInput(value, key) && /^[\d.]$/.test(value)) {
            if (step === 'warning')
                setWarningInput(previous => previous + value);
            else
                setCriticalInput(previous => previous + value);
            setError(null);
        }
    });

    return (
        <Box flexDirection='column'>
            <Text bold>Context Bar alert levels</Text>
            <Text>{`Warning: ${levels.warning}% · Critical: ${levels.critical}%`}</Text>
            <Box marginTop={1}>
                <Text>
                    {`${step === 'warning' ? 'Warning (amber)' : 'Critical (red)'} percentage:`}
                    {' '}
                    <Text inverse>{input || `(keep ${current}%)`}</Text>
                </Text>
            </Box>
            {error && <Text color='red'>{error}</Text>}
            <Text dimColor>Type a percentage, Enter to continue/save, Esc to cancel</Text>
        </Box>
    );
};
