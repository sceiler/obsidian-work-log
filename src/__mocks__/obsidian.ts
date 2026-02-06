/**
 * Minimal Obsidian API mock for testing.
 * Only mocks the surface area actually used by the plugin.
 */

export class TFile {
	path: string;
	basename: string;
	extension: string;

	constructor(path: string) {
		this.path = path;
		this.basename = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
		this.extension = 'md';
	}
}

export class TAbstractFile {
	path: string;
	constructor(path: string) {
		this.path = path;
	}
}

export class Component {
	registerEvent(_event: unknown): void {}
	addChild<T extends Component>(child: T): T { return child; }
	onload(): void {}
	onunload(): void {}
}

export class Notice {
	constructor(_message: string) {}
}

export class App {
	vault: Vault;
	workspace: Workspace;
	metadataCache: MetadataCache;

	constructor() {
		this.vault = new Vault();
		this.workspace = new Workspace();
		this.metadataCache = new MetadataCache();
	}
}

export class Vault {
	private files: Map<string, string> = new Map();

	async read(file: TFile): Promise<string> {
		return this.files.get(file.path) ?? '';
	}

	async modify(file: TFile, content: string): Promise<void> {
		this.files.set(file.path, content);
	}

	async create(path: string, content: string): Promise<TFile> {
		this.files.set(path, content);
		return new TFile(path);
	}

	async createFolder(_path: string): Promise<void> {}

	getAbstractFileByPath(path: string): TFile | null {
		if (this.files.has(path)) {
			return new TFile(path);
		}
		return null;
	}

	getMarkdownFiles(): TFile[] {
		return Array.from(this.files.keys())
			.filter(p => p.endsWith('.md'))
			.map(p => new TFile(p));
	}

	// Test helper: set file content directly
	_setFile(path: string, content: string): void {
		this.files.set(path, content);
	}
}

export class Workspace {
	onLayoutReady(callback: () => void): void {
		callback();
	}

	getLeaf(_newLeaf?: boolean): { openFile: (file: TFile) => Promise<void> } {
		return { openFile: async () => {} };
	}
}

export class MetadataCache {
	private linkResolutions: Map<string, TFile> = new Map();

	getFirstLinkpathDest(linkpath: string, _sourcePath: string): TFile | null {
		return this.linkResolutions.get(linkpath) ?? null;
	}

	// Test helper
	_setLinkResolution(linkpath: string, file: TFile): void {
		this.linkResolutions.set(linkpath, file);
	}
}

// Re-export moment - use a simple implementation for testing
export function moment(timestamp?: number): { format: (fmt: string) => string } {
	const date = timestamp ? new Date(timestamp) : new Date();
	return {
		format: (fmt: string) => {
			if (fmt === 'HH:mm') {
				return date.toTimeString().substring(0, 5);
			}
			return date.toISOString();
		},
	};
}

export class AbstractInputSuggest<T> {
	constructor(_app: App, _inputEl: HTMLInputElement) {}
	getSuggestions(_query: string): T[] { return []; }
	renderSuggestion(_item: T, _el: HTMLElement): void {}
	selectSuggestion(_item: T): void {}
}

export class Modal {
	app: App;
	contentEl: HTMLElement;
	constructor(app: App) {
		this.app = app;
		this.contentEl = {} as HTMLElement;
	}
	open(): void {}
	close(): void {}
}

export class PluginSettingTab {
	app: App;
	containerEl: HTMLElement;
	constructor(app: App, _plugin: unknown) {
		this.app = app;
		this.containerEl = {} as HTMLElement;
	}
}

export class Plugin {
	app: App;
	manifest: unknown;
	constructor(app: App, manifest: unknown) {
		this.app = app;
		this.manifest = manifest;
	}
	addChild<T extends Component>(child: T): T { return child; }
	addCommand(_command: unknown): void {}
	addRibbonIcon(_icon: string, _title: string, _callback: () => void): void {}
	addSettingTab(_tab: unknown): void {}
	loadData(): Promise<unknown> { return Promise.resolve(null); }
	saveData(_data: unknown): Promise<void> { return Promise.resolve(); }
	registerEvent(_event: unknown): void {}
}

export class Setting {
	constructor(_containerEl: HTMLElement) {}
	setName(_name: string): this { return this; }
	setDesc(_desc: string): this { return this; }
	addText(_cb: (text: unknown) => unknown): this { return this; }
	addToggle(_cb: (toggle: unknown) => unknown): this { return this; }
	addDropdown(_cb: (dropdown: unknown) => unknown): this { return this; }
}
