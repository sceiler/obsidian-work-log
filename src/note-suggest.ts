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

		// Filter and sort by relevance
		const matches = files
			.filter(file => file.basename.toLowerCase().includes(queryLower))
			.sort((a, b) => {
				const aLower = a.basename.toLowerCase();
				const bLower = b.basename.toLowerCase();
				// Prioritize starts-with matches
				const aStarts = aLower.startsWith(queryLower);
				const bStarts = bLower.startsWith(queryLower);
				if (aStarts && !bStarts) return -1;
				if (bStarts && !aStarts) return 1;
				// Then by length (shorter = more relevant)
				return a.basename.length - b.basename.length;
			})
			.slice(0, 10); // Limit to 10 suggestions

		return matches;
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
