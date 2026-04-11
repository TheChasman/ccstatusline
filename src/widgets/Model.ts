import type { RenderContext } from '../types/RenderContext';
import type {
    Settings
} from '../types/Settings';
import type {
    DynamicColors,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';
import { getTrafficLightColor } from '../utils/traffic-light';

export class ModelWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Displays the Claude model name (e.g., Claude 3.5 Sonnet)'; }
    getDisplayName(): string { return 'Model'; }
    getCategory(): string { return 'Core'; }
    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'Claude' : 'Model: Claude';
        }

        const model = context.data?.model;
        const modelDisplayName = typeof model === 'string'
            ? model
            : (model?.display_name ?? model?.id);

        if (modelDisplayName) {
            const shortName = modelDisplayName.replace(/\s*\(.*\)$/, '');
            return item.rawValue ? shortName : `Model: ${shortName}`;
        }
        return null;
    }

    getDynamicColors(
        item: WidgetItem,
        context: RenderContext,
        settings: Settings
    ): DynamicColors | null {
        const model = context.data?.model;
        const modelDisplayName = typeof model === 'string'
            ? model
            : (model?.display_name ?? model?.id);

        if (!modelDisplayName) {
            return null;
        }

        const lowerName = modelDisplayName.toLowerCase();
        let trafficLightLevel: 'green' | 'amber' | 'red' | null = null;

        if (lowerName.includes('haiku')) {
            trafficLightLevel = 'green';
        } else if (lowerName.includes('sonnet')) {
            trafficLightLevel = 'amber';
        } else if (lowerName.includes('opus')) {
            trafficLightLevel = 'red';
        } else {
            return null;
        }

        const color = getTrafficLightColor(trafficLightLevel, settings.colorLevel);

        if (settings.powerline.enabled) {
            return {
                backgroundColor: color,
                color: 'black'
            };
        }

        return {
            color
        };
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(item: WidgetItem): boolean { return true; }
}