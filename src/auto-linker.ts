import { App, TFile, Component } from 'obsidian';

/**
 * Auto-links known note names in text.
 * Uses Obsidian's MetadataCache for efficient lookups.
 */
export class AutoLinker extends Component {
	private app: App;
	private noteNames: Set<string> = new Set();
	private noteNamesLower: Map<string, string> = new Map(); // lowercase -> original
	private sortedNames: string[] = []; // cached sorted list for matching
	private indexBuilt: boolean = false;

	constructor(app: App) {
		super();
		this.app = app;
	}

	onload(): void {
		// Build initial index once vault is ready
		this.app.workspace.onLayoutReady(() => {
			this.buildInitialIndex();
		});

		// Incremental updates on file changes using Obsidian's event system
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.addNote(file.basename);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile && file.extension === 'md') {
					this.removeNote(file.basename);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile && file.extension === 'md') {
					// Extract old basename from path
					const oldBasename = oldPath.split('/').pop()?.replace(/\.md$/, '') || '';
					this.removeNote(oldBasename);
					this.addNote(file.basename);
				}
			})
		);
	}

	/**
	 * Build initial index from vault - runs once on plugin load
	 */
	private buildInitialIndex(): void {
		if (this.indexBuilt) return;

		// Use vault.getMarkdownFiles() - this is already indexed by Obsidian
		const files = this.app.vault.getMarkdownFiles();
		for (const file of files) {
			const name = file.basename;
			this.noteNames.add(name);
			this.noteNamesLower.set(name.toLowerCase(), name);
		}

		this.rebuildSortedList();
		this.indexBuilt = true;
	}

	/**
	 * Add a single note to the index
	 */
	private addNote(name: string): void {
		if (!this.noteNames.has(name)) {
			this.noteNames.add(name);
			this.noteNamesLower.set(name.toLowerCase(), name);
			this.rebuildSortedList();
		}
	}

	/**
	 * Remove a single note from the index
	 */
	private removeNote(name: string): void {
		if (this.noteNames.has(name)) {
			this.noteNames.delete(name);
			this.noteNamesLower.delete(name.toLowerCase());
			this.rebuildSortedList();
		}
	}

	/**
	 * Rebuild sorted list for matching (longest first)
	 */
	private rebuildSortedList(): void {
		this.sortedNames = Array.from(this.noteNames)
			.filter(name => name.length > 2) // Skip very short names
			.sort((a, b) => b.length - a.length);
	}

	/**
	 * Process text and add wiki links for known note names.
	 * Preserves existing [[links]] and doesn't double-link.
	 */
	processText(text: string): string {
		if (!text || this.sortedNames.length === 0) {
			return text;
		}

		let result = text;

		for (const noteName of this.sortedNames) {
			// Skip if this exact name is already linked somewhere
			const linkedPattern = new RegExp(`\\[\\[${this.escapeRegex(noteName)}(\\|[^\\]]*)?\\]\\]`, 'i');
			if (linkedPattern.test(result)) continue;

			// Find the note name as a whole word (case-insensitive)
			// Negative lookbehind: not preceded by [[ or word char
			// Negative lookahead: not followed by ]] or word char
			const pattern = new RegExp(
				`(?<![\\[\\w])${this.escapeRegex(noteName)}(?![\\]\\w])`,
				'gi'
			);

			// Replace with wiki link, preserving original case from vault
			const originalName = this.noteNamesLower.get(noteName.toLowerCase()) || noteName;
			result = result.replace(pattern, (match) => {
				// If match case differs from note name, use alias syntax
				if (match !== originalName) {
					return `[[${originalName}|${match}]]`;
				}
				return `[[${originalName}]]`;
			});
		}

		return result;
	}

	/**
	 * Check if a note exists (for external use)
	 */
	noteExists(name: string): boolean {
		return this.noteNamesLower.has(name.toLowerCase());
	}

	/**
	 * Get all note names (for debugging/testing)
	 */
	getNoteCount(): number {
		return this.noteNames.size;
	}

	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
}
