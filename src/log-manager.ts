import { App, TFile, moment } from 'obsidian';
import { getCategoryLabel, type LogEntry, type WorkLogSettings } from './types';

export class LogManager {
	private app: App;
	private settings: WorkLogSettings;
	private cachedWorkLogPattern: RegExp | null = null;
	private cachedRelatedNotePattern: RegExp | null = null;
	private cachedNextHeadingPattern: RegExp | null = null;

	constructor(app: App, settings: WorkLogSettings) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: WorkLogSettings): void {
		this.settings = settings;
		this.cachedWorkLogPattern = null;
		this.cachedRelatedNotePattern = null;
		this.cachedNextHeadingPattern = null;
	}

	/**
	 * Add entry to the main work log file
	 */
	async addEntry(entry: LogEntry): Promise<void> {
		const file = await this.getOrCreateLogFile();
		const content = await this.app.vault.read(file);
		const newContent = this.insertEntryToLog(content, entry);
		await this.app.vault.modify(file, newContent);
	}

	/**
	 * Add entry to a related note (person, org, project MOC)
	 * Inserts under configured section heading with date subsections
	 */
	async addToRelatedNote(noteName: string, entry: LogEntry): Promise<void> {
		let noteFile = this.findNoteByName(noteName);

		if (!noteFile) {
			if (this.settings.createRelatedNoteIfMissing) {
				noteFile = await this.createRelatedNote(noteName, entry);
				return; // Note created with entry already included
			} else {
				throw new Error(`Note "${noteName}" not found`);
			}
		}

		const content = await this.app.vault.read(noteFile);
		const newContent = this.insertEntryToRelatedNote(content, entry);
		await this.app.vault.modify(noteFile, newContent);
	}

	/**
	 * Find a note by name (case-insensitive)
	 */
	private findNoteByName(noteName: string): TFile | null {
		return this.app.metadataCache.getFirstLinkpathDest(noteName, '') ?? null;
	}

	/**
	 * Create a new related note with the entry
	 */
	private async createRelatedNote(noteName: string, entry: LogEntry): Promise<TFile> {
		// Build path with configured folder
		const folder = this.settings.newRelatedNoteFolder.trim();
		const path = folder ? `${folder}/${noteName}.md` : `${noteName}.md`;

		// Ensure folder exists
		if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		const dateHeading = `${this.settings.relatedNoteDateHeadingLevel} [[${entry.date}]]`;
		const entryLine = this.formatRelatedNoteEntry(entry);

		const content = `${this.settings.relatedNoteSectionHeading}\n\n${dateHeading}\n${entryLine}\n`;

		await this.app.vault.create(path, content);
		const file = this.app.vault.getAbstractFileByPath(path);

		if (!(file instanceof TFile)) {
			throw new Error(`Failed to create note "${noteName}"`);
		}

		return file;
	}

	private async getOrCreateLogFile(): Promise<TFile> {
		const path = this.settings.logFilePath;
		let file = this.app.vault.getAbstractFileByPath(path);

		if (!file) {
			// Ensure parent folder exists
			const folderPath = path.substring(0, path.lastIndexOf('/'));
			if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
				await this.app.vault.createFolder(folderPath);
			}

			const header = `# work-log\n\nA continuous log of work activities, achievements, and contributions.\n\n`;
			await this.app.vault.create(path, header);
			file = this.app.vault.getAbstractFileByPath(path);
		}

		if (!(file instanceof TFile)) {
			throw new Error(`${path} is not a file`);
		}

		return file;
	}

	/**
	 * Build the date heading based on settings
	 */
	private buildDateHeading(date: string, forWorkLog: boolean): string {
		const level = forWorkLog
			? this.settings.workLogDateHeadingLevel
			: this.settings.relatedNoteDateHeadingLevel;

		if (forWorkLog && this.settings.workLogDateAsLink) {
			return `${level} [[${date}]]`;
		} else if (!forWorkLog) {
			// Related notes always use [[date]] format
			return `${level} [[${date}]]`;
		} else {
			return `${level} ${date}`;
		}
	}

	/**
	 * Get cached regex pattern for matching date headings.
	 * Returns a new RegExp each call (with reset lastIndex) from the cached source.
	 */
	private buildDatePattern(forWorkLog: boolean): RegExp {
		if (forWorkLog) {
			if (!this.cachedWorkLogPattern) {
				const level = this.escapeHeadingLevel(this.settings.workLogDateHeadingLevel);
				const dateGroup = this.settings.workLogDateAsLink
					? `\\[\\[(\\d{4}-\\d{2}-\\d{2})\\]\\]`
					: `(\\d{4}-\\d{2}-\\d{2})`;
				this.cachedWorkLogPattern = new RegExp(`${level} ${dateGroup}`, 'g');
			}
			this.cachedWorkLogPattern.lastIndex = 0;
			return this.cachedWorkLogPattern;
		} else {
			if (!this.cachedRelatedNotePattern) {
				const level = this.escapeHeadingLevel(this.settings.relatedNoteDateHeadingLevel);
				this.cachedRelatedNotePattern = new RegExp(`${level} \\[\\[(\\d{4}-\\d{2}-\\d{2})\\]\\]`, 'g');
			}
			this.cachedRelatedNotePattern.lastIndex = 0;
			return this.cachedRelatedNotePattern;
		}
	}

	private escapeHeadingLevel(level: string): string {
		return level.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/**
	 * Insert entry into main work log in ASCENDING order (oldest first, read top to bottom)
	 */
	private insertEntryToLog(content: string, entry: LogEntry): string {
		const dateHeading = this.buildDateHeading(entry.date, true);
		const entryLine = this.formatLogEntry(entry);
		const datePattern = this.buildDatePattern(true);

		// Check if date heading exists
		const headingIndex = content.indexOf(dateHeading);

		if (headingIndex !== -1) {
			// Date exists - append entry to end of this section
			const afterHeading = content.substring(headingIndex + dateHeading.length);
			if (!this.cachedNextHeadingPattern) {
				this.cachedNextHeadingPattern = new RegExp(`\n${this.escapeHeadingLevel(this.settings.workLogDateHeadingLevel)} `);
			}
			const nextHeadingMatch = afterHeading.match(this.cachedNextHeadingPattern);

			let sectionEnd: number;
			if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
				sectionEnd = headingIndex + dateHeading.length + nextHeadingMatch.index;
			} else {
				sectionEnd = content.length;
			}

			// Insert at end of section
			const beforeSection = content.substring(0, sectionEnd).trimEnd();
			const afterSection = content.substring(sectionEnd);
			const separator = this.settings.separateEntriesWithBlankLine ? '\n\n' : '\n';
			return beforeSection + separator + entryLine + afterSection;
		} else {
			// Create new date section in ASCENDING order (oldest first)
			let match;
			let insertPosition = -1;

			while ((match = datePattern.exec(content)) !== null) {
				const existingDate = match[1];
				if (entry.date < existingDate) {
					insertPosition = match.index;
					break;
				}
			}

			const newSection = `${dateHeading}\n\n${entryLine}\n`;

			if (insertPosition === -1) {
				return content.trimEnd() + '\n\n' + newSection;
			} else {
				return content.substring(0, insertPosition) + newSection + '\n' + content.substring(insertPosition);
			}
		}
	}

	/**
	 * Insert entry into related note under configured section heading
	 * with date subsections in ASCENDING order
	 */
	private insertEntryToRelatedNote(content: string, entry: LogEntry): string {
		const dateHeading = this.buildDateHeading(entry.date, false);
		const entryLine = this.formatRelatedNoteEntry(entry);
		const sectionHeading = this.settings.relatedNoteSectionHeading;

		// Find section heading (e.g., ## Notes)
		const sectionPattern = new RegExp(`^${sectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm');
		const notesMatch = content.match(sectionPattern);

		if (!notesMatch || notesMatch.index === undefined) {
			// No section - create one at the top (after frontmatter if present)
			const frontmatterEnd = this.findFrontmatterEnd(content);
			const insertPos = frontmatterEnd;
			const notesSection = `${sectionHeading}\n\n${dateHeading}\n${entryLine}\n`;

			if (insertPos === 0) {
				return notesSection + '\n' + content;
			} else {
				return content.substring(0, insertPos) + '\n' + notesSection + '\n' + content.substring(insertPos);
			}
		}

		const notesSectionStart = notesMatch.index;

		// Find the end of section (next ## heading or end of file)
		const afterNotesSection = content.substring(notesSectionStart + notesMatch[0].length);
		const nextH2Match = afterNotesSection.match(/\n## [^#]/);
		const notesSectionEnd = nextH2Match && nextH2Match.index !== undefined
			? notesSectionStart + notesMatch[0].length + nextH2Match.index
			: content.length;

		const notesSection = content.substring(notesSectionStart, notesSectionEnd);

		// Check if date subsection already exists
		const dateSubsectionPattern = new RegExp(
			`${this.escapeHeadingLevel(this.settings.relatedNoteDateHeadingLevel)} \\[\\[${entry.date}\\]\\]`
		);
		const dateMatch = notesSection.match(dateSubsectionPattern);

		if (dateMatch && dateMatch.index !== undefined) {
			// Date exists - append entry to this subsection
			const dateHeadingPos = notesSectionStart + dateMatch.index;
			const afterDateHeading = content.substring(dateHeadingPos + dateMatch[0].length);

			// Find end of this date subsection
			const nextSubsectionMatch = afterDateHeading.match(/\n###? /);
			let insertPos: number;

			if (nextSubsectionMatch && nextSubsectionMatch.index !== undefined) {
				insertPos = dateHeadingPos + dateMatch[0].length + nextSubsectionMatch.index;
			} else {
				insertPos = notesSectionEnd;
			}

			// Insert with configured separator
			const separator = this.settings.separateEntriesWithBlankLine ? '\n\n' : '\n';
			return content.substring(0, insertPos).trimEnd() + separator + entryLine + '\n' + content.substring(insertPos);
		} else {
			// Date doesn't exist - find correct position (ascending order)
			const datePattern = this.buildDatePattern(false);
			let match;
			let insertPosition = -1;

			// Reset regex lastIndex since we're using the same pattern
			datePattern.lastIndex = 0;

			// Search within the notes section only
			while ((match = datePattern.exec(notesSection)) !== null) {
				const existingDate = match[1];
				if (entry.date < existingDate) {
					insertPosition = notesSectionStart + match.index;
					break;
				}
			}

			const newSubsection = `${dateHeading}\n${entryLine}\n`;

			if (insertPosition === -1) {
				// Append at end of notes section
				const beforeNextSection = content.substring(0, notesSectionEnd).trimEnd();
				const afterNextSection = content.substring(notesSectionEnd);
				return beforeNextSection + '\n' + newSubsection + afterNextSection;
			} else {
				return content.substring(0, insertPosition).trimEnd() + '\n' + newSubsection + content.substring(insertPosition);
			}
		}
	}

	/**
	 * Find end of YAML frontmatter if present
	 */
	private findFrontmatterEnd(content: string): number {
		if (!content.startsWith('---')) {
			return 0;
		}
		const endMatch = content.substring(3).match(/\n---\n/);
		if (endMatch && endMatch.index !== undefined) {
			return 3 + endMatch.index + 5;
		}
		return 0;
	}

	/**
	 * Format multi-line description, indenting subsequent lines that start with list markers
	 */
	private formatMultiLineDescription(description: string): string {
		const lines = description.split('\n');
		if (lines.length === 1) {
			return description;
		}

		// First line stays as-is, subsequent lines that start with - or * get indented
		return lines.map((line, index) => {
			if (index === 0) return line;
			// If line starts with a list marker, indent it
			if (/^\s*[-*]\s/.test(line)) {
				return '  ' + line.trim();
			}
			// Other continuation lines get indented too
			if (line.trim()) {
				return '  ' + line.trim();
			}
			return '';
		}).filter((line, idx) => line !== '' || idx === 0).join('\n');
	}

	/**
	 * Format entry for main work log
	 */
	private formatLogEntry(entry: LogEntry): string {
		const description = this.formatMultiLineDescription(entry.description);

		// Build metadata parts: category, related note, timestamp
		const parts: string[] = [];
		if (this.settings.showCategoryInLog) {
			parts.push(`**${getCategoryLabel(this.settings.categories, entry.category)}**`);
		}
		if (entry.relatedNote) {
			parts.push(`[[${entry.relatedNote}]]`);
		}
		if (this.settings.showTimestamps) {
			parts.push(moment(entry.timestamp).format('HH:mm'));
		}

		if (parts.length === 0) {
			return `- ${description}`;
		}

		// Category stands alone before parens: **Cat** (note, time): desc
		// or **Cat**: desc, or (note, time): desc
		const hasCategoryPrefix = this.settings.showCategoryInLog;
		const categoryPart = hasCategoryPrefix ? parts.shift() : '';
		const parenParts = parts;

		if (categoryPart && parenParts.length > 0) {
			return `- ${categoryPart} (${parenParts.join(', ')}): ${description}`;
		} else if (categoryPart) {
			return `- ${categoryPart}: ${description}`;
		} else {
			return `- (${parenParts.join(', ')}): ${description}`;
		}
	}

	/**
	 * Format entry for related note
	 */
	private formatRelatedNoteEntry(entry: LogEntry): string {
		const description = this.formatMultiLineDescription(entry.description);

		if (this.settings.showCategoryInRelatedNote) {
			const categoryLabel = getCategoryLabel(this.settings.categories, entry.category);
			if (this.settings.showTimestamps) {
				const time = moment(entry.timestamp).format('HH:mm');
				return `**${categoryLabel}** (${time}): ${description}`;
			}
			return `**${categoryLabel}**: ${description}`;
		}
		return description;
	}

	async openLogFile(): Promise<void> {
		const file = await this.getOrCreateLogFile();
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}
}
