import { App, AbstractInputSuggest, TFile } from 'obsidian';

/**
 * Autocomplete suggest for note names with debounce.
 * Shows suggestions as user types in the input field.
 */
export class NoteSuggest extends AbstractInputSuggest<TFile> {
	private textInputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.textInputEl = inputEl;
	}

	getSuggestions(query: string): TFile[] {
		if (!query || query.length < 2) {
			return [];
		}

		const queryLower = query.toLowerCase();
		const files = this.app.vault.getMarkdownFiles();
		const limit = 10;

		// Partition into starts-with and contains buckets to avoid sorting all matches
		const startsWith: TFile[] = [];
		const contains: TFile[] = [];

		for (const file of files) {
			const nameLower = file.basename.toLowerCase();
			if (nameLower.startsWith(queryLower)) {
				startsWith.push(file);
			} else if (nameLower.includes(queryLower)) {
				contains.push(file);
			}
		}

		// Sort each bucket by length (shorter = more relevant), only up to what we need
		const byLength = (a: TFile, b: TFile) => a.basename.length - b.basename.length;
		startsWith.sort(byLength);

		if (startsWith.length >= limit) {
			return startsWith.slice(0, limit);
		}

		contains.sort(byLength);
		return startsWith.concat(contains).slice(0, limit);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.addClass('work-log-suggest-item');

		// Note name
		const nameEl = el.createDiv({ cls: 'work-log-suggest-name' });
		nameEl.setText(file.basename);

		// Path (if in subfolder)
		if (file.parent && file.parent.path !== '/') {
			const pathEl = el.createDiv({ cls: 'work-log-suggest-path' });
			pathEl.setText(file.parent.path);
		}
	}

	selectSuggestion(file: TFile): void {
		this.textInputEl.value = file.basename;
		this.textInputEl.dispatchEvent(new Event('input'));
		this.close();
	}
}
