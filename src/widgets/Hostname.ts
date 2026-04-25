import { execSync } from 'child_process';
import os from 'os';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

function getShortHostname(): string {
    if (os.platform() === 'darwin') {
        try {
            const result = execSync('scutil --get LocalHostName', { encoding: 'utf8' }).trim();
            if (result)
                return result;
        } catch {
            // fall through to os.hostname fallback
        }
    }

    const hostname = os.hostname();
    const parts = hostname.split('.');
    return parts[0] ?? 'localhost';
}

export class HostnameWidget implements Widget {
    getDefaultColor(): string {
        return 'gray';
    }

    getDescription(): string {
        return 'Shows the machine\'s friendly local hostname';
    }

    getDisplayName(): string {
        return 'Hostname';
    }

    getCategory(): string {
        return 'Environment';
    }

    getEditorDisplay(_item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview)
            return item.rawValue ? 'Kirk' : 'Host: Kirk';

        const name = getShortHostname();
        return item.rawValue ? name : `Host: ${name}`;
    }

    supportsRawValue(): boolean {
        return true;
    }

    supportsColors(_item: WidgetItem): boolean {
        return true;
    }
}