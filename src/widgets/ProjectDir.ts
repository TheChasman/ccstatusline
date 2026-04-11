import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetItem
} from '../types/Widget';

export class ProjectDirWidget implements Widget {
    getDefaultColor(): string { return 'cyan'; }
    getDescription(): string { return 'Shows the project root directory name (stable across worktrees)'; }
    getDisplayName(): string { return 'Project Root'; }
    getCategory(): string { return 'Environment'; }
    getEditorDisplay(): WidgetEditorDisplay {
        return { displayText: this.getDisplayName() };
    }

    render(item: WidgetItem, context: RenderContext, _settings: Settings): string | null {
        if (context.isPreview) {
            return item.rawValue ? 'my-project' : 'Project: my-project';
        }

        const projectDir = context.data?.workspace?.project_dir ?? context.data?.cwd;
        if (!projectDir) return null;

        const name = projectDir.replace(/[\\/]+$/, '').split(/[\\/]/).filter(Boolean).pop() ?? projectDir;

        return item.rawValue ? name : `Project: ${name}`;
    }

    supportsRawValue(): boolean { return true; }
    supportsColors(): boolean { return true; }
    getCustomKeybinds(): CustomKeybind[] { return []; }
}
