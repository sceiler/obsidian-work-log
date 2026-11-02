import { App, TFile, Component } from 'obsidian';

/**
 * Auto-links known note names in text.
 * Uses Obsidian's MetadataCache for efficient lookups.
 */
interface CachedNotePattern {
	name: string;
	originalName: string;
	matchPattern: RegExp;
}

export class AutoLinker extends Component {
	private app: App;
	private noteNames: Set<string> = new Set();
	private noteNamesLower: Map<string, string> = new Map(); // lowercase -> original
	private cachedPatterns: CachedNotePattern[] = []; // pre-compiled regexes
	private indexBuilt: boolean = false;
	private rebuildTimer: ReturnType<typeof setTimeout> | null = null;

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
			this.scheduleRebuild();
		}
	}

	/**
	 * Remove a single note from the index
	 */
	private removeNote(name: string): void {
		if (this.noteNames.has(name)) {
			this.noteNames.delete(name);
			this.noteNamesLower.delete(name.toLowerCase());
			this.scheduleRebuild();
		}
	}

	/**
	 * Debounce rebuildSortedList to avoid CPU spikes during bulk file operations
	 */
	private scheduleRebuild(): void {
		if (this.rebuildTimer !== null) {
			clearTimeout(this.rebuildTimer);
		}
		this.rebuildTimer = setTimeout(() => {
			this.rebuildTimer = null;
			this.rebuildSortedList();
		}, 150);
	}

	/**
	 * Rebuild cached patterns for matching (longest first).
	 * Pre-compiles regexes so processText doesn't recompile on every call.
	 */
	private rebuildSortedList(): void {
		const sorted = Array.from(this.noteNames)
			.filter(name => name.length > 2)
			.sort((a, b) => b.length - a.length);

		this.cachedPatterns = sorted.map(name => {
			const escaped = this.escapeRegex(name);
			const originalName = this.noteNamesLower.get(name.toLowerCase()) || name;
			return {
				name,
				originalName,
				matchPattern: new RegExp(`(?<![\\[\\w])${escaped}(?![\\]\\w])`, 'gi'),
			};
		});
	}

	/**
	 * Process text and add wiki links for known note names.
	 * Preserves existing [[links]], URLs, and doesn't double-link.
	 */
	processText(text: string): string {
		if (!text || this.cachedPatterns.length === 0) {
			return text;
		}

		// Extract URLs and existing [[links]] with placeholders to protect them
		const placeholders: string[] = [];
		const urlPattern = /https?:\/\/[^\s<>[\]]+/gi;
		let protectedText = text.replace(urlPattern, (match) => {
			placeholders.push(match);
			return `__PLACEHOLDER_${placeholders.length - 1}__`;
		});

		// Protect existing [[wiki links]] so they aren't partially re-matched
		const wikiLinkPattern = /\[\[[^\]]+\]\]/g;
		protectedText = protectedText.replace(wikiLinkPattern, (match) => {
			placeholders.push(match);
			return `__PLACEHOLDER_${placeholders.length - 1}__`;
		});

		// Apply auto-linking using pre-compiled patterns
		for (const cached of this.cachedPatterns) {
			// Reset lastIndex for the global regex
			cached.matchPattern.lastIndex = 0;

			// Replace with wiki link, preserving original case from vault
			protectedText = protectedText.replace(cached.matchPattern, (match) => {
				if (match !== cached.originalName) {
					return `[[${cached.originalName}|${match}]]`;
				}
				return `[[${cached.originalName}]]`;
			});
		}

		// Restore all placeholders
		const result = protectedText.replace(/__PLACEHOLDER_(\d+)__/g, (_, index) => {
			return placeholders[parseInt(index, 10)];
		});

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
