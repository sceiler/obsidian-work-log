import { App, TFile, moment } from 'obsidian';
import { formatTaskLine, type TaskEntry, type WorkLogSettings } from './types';

export class TaskManager {
	private app: App;
	private settings: WorkLogSettings;

	constructor(app: App, settings: WorkLogSettings) {
		this.app = app;
		this.settings = settings;
	}

	updateSettings(settings: WorkLogSettings): void {
		this.settings = settings;
	}

	/**
	 * Add a task to the appropriate file.
	 * If the task has a related note, write to that note under ## Tasks.
	 * Otherwise, write to the journal note for that day.
	 */
	async addTask(task: TaskEntry): Promise<void> {
		const taskLine = formatTaskLine(task);

		// Ensure Tasks MOC exists on first task creation
		await this.getOrCreateTasksMoc();

		if (task.relatedNote) {
			await this.addTaskToRelatedNote(task.relatedNote, taskLine);
		} else {
			await this.addTaskToJournal(task.date, taskLine);
		}
	}

	/**
	 * Open (or create) today's journal note
	 */
	async openJournalNote(date?: string): Promise<void> {
		const targetDate = date || moment().format('YYYY-MM-DD');
		const file = await this.getOrCreateJournalNote(targetDate);
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}

	/**
	 * Open (or create) the Tasks MOC
	 */
	async openTasksMoc(): Promise<void> {
		const file = await this.getOrCreateTasksMoc();
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}

	/**
	 * Add a task line to a related note under the task section heading.
	 */
	private async addTaskToRelatedNote(noteName: string, taskLine: string): Promise<void> {
		let noteFile = this.app.metadataCache.getFirstLinkpathDest(noteName, '') ?? null;

		if (!noteFile) {
			if (this.settings.createRelatedNoteIfMissing) {
				noteFile = await this.createRelatedNoteWithTask(noteName, taskLine);
				return;
			} else {
				throw new Error(`Note "${noteName}" not found`);
			}
		}

		const content = await this.app.vault.read(noteFile);
		const newContent = this.insertTaskUnderHeading(
			content,
			this.settings.taskSectionHeading,
			taskLine
		);
		await this.app.vault.modify(noteFile, newContent);
	}

	/**
	 * Create a new related note with the task section and task line.
	 */
	private async createRelatedNoteWithTask(noteName: string, taskLine: string): Promise<TFile> {
		const folder = this.settings.newRelatedNoteFolder.trim();
		const path = folder ? `${folder}/${noteName}.md` : `${noteName}.md`;

		if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		const content = `${this.settings.taskSectionHeading}\n${taskLine}\n`;
		await this.app.vault.create(path, content);
		const file = this.app.vault.getAbstractFileByPath(path);

		if (!(file instanceof TFile)) {
			throw new Error(`Failed to create note "${noteName}"`);
		}

		return file;
	}

	/**
	 * Add a task line to the journal note for a given date.
	 */
	private async addTaskToJournal(date: string, taskLine: string): Promise<void> {
		const file = await this.getOrCreateJournalNote(date);
		const content = await this.app.vault.read(file);
		const newContent = this.insertTaskUnderHeading(
			content,
			this.settings.taskJournalSectionHeading,
			taskLine
		);
		await this.app.vault.modify(file, newContent);
	}

	/**
	 * Insert a task line under a heading. If the heading doesn't exist, create it.
	 */
	private insertTaskUnderHeading(content: string, heading: string, taskLine: string): string {
		const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const headingPattern = new RegExp(`^${escapedHeading}\\s*$`, 'm');
		const match = content.match(headingPattern);

		if (!match || match.index === undefined) {
			// Heading doesn't exist — insert after ## Notes section content,
			// so ## Tasks lands between ## Notes and ## Meetings/## People/etc.
			const headingLevel = heading.match(/^#+/)?.[0] ?? '##';
			const levelLen = headingLevel.length;

			// Find ## Notes heading, then find where its section ends
			const notesSectionHeading = this.settings.relatedNoteSectionHeading || '## Notes';
			const escapedNotes = notesSectionHeading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const notesPattern = new RegExp(`^${escapedNotes}\\s*$`, 'm');
			const notesMatch = content.match(notesPattern);

			if (notesMatch && notesMatch.index !== undefined) {
				// Find the next same-level heading after ## Notes
				const afterNotesStart = notesMatch.index + notesMatch[0].length;
				const afterNotes = content.substring(afterNotesStart);
				const nextSameLevelPattern = new RegExp(`^#{${levelLen}} [^#]`, 'm');
				const nextMatch = afterNotes.match(nextSameLevelPattern);

				if (nextMatch && nextMatch.index !== undefined) {
					// Insert right before the next same-level heading after ## Notes
					const insertPos = afterNotesStart + nextMatch.index;
					const before = content.substring(0, insertPos).trimEnd();
					const after = content.substring(insertPos);
					return before + '\n\n' + heading + '\n' + taskLine + '\n\n' + after;
				}
			}

			// Fallback: no ## Notes found, insert before the first same-level heading
			const sameLevelPattern = new RegExp(`^#{${levelLen}} [^#]`, 'gm');
			const firstHeadingMatch = sameLevelPattern.exec(content);

			if (firstHeadingMatch) {
				const before = content.substring(0, firstHeadingMatch.index).trimEnd();
				const after = content.substring(firstHeadingMatch.index);
				return before + '\n\n' + heading + '\n' + taskLine + '\n\n' + after;
			}

			// No headings at same level — append at end
			return content.trimEnd() + '\n\n' + heading + '\n' + taskLine + '\n';
		}

		// Find the end of this section (next heading of same or higher level, or EOF)
		const headingLevel = heading.match(/^#+/)?.[0] ?? '##';
		const levelCount = headingLevel.length;
		const afterHeading = content.substring(match.index + match[0].length);
		const nextHeadingPattern = new RegExp(`\n#{1,${levelCount}} [^#]`);
		const nextMatch = afterHeading.match(nextHeadingPattern);

		let insertPos: number;
		if (nextMatch && nextMatch.index !== undefined) {
			insertPos = match.index + match[0].length + nextMatch.index;
		} else {
			insertPos = content.length;
		}

		// Insert at end of section
		const before = content.substring(0, insertPos).trimEnd();
		const after = content.substring(insertPos);
		return before + '\n' + taskLine + '\n' + after;
	}

	/**
	 * Get or create the journal note for a given date.
	 */
	private async getOrCreateJournalNote(date: string): Promise<TFile> {
		const path = this.buildJournalPath(date);
		let file = this.app.vault.getAbstractFileByPath(path);

		if (!file) {
			// Ensure folder exists
			const folderPath = path.substring(0, path.lastIndexOf('/'));
			if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
				await this.app.vault.createFolder(folderPath);
			}

			const template = this.buildJournalTemplate(date);
			await this.app.vault.create(path, template);
			file = this.app.vault.getAbstractFileByPath(path);
		}

		if (!(file instanceof TFile)) {
			throw new Error(`${path} is not a file`);
		}

		return file;
	}

	/**
	 * Build the file path for a journal note.
	 * e.g., "Journal/2026-02-10 Journal.md" or "2026-02-10 Journal.md"
	 */
	private buildJournalPath(date: string): string {
		const folder = this.settings.taskJournalFolder.trim();
		const suffix = this.settings.taskJournalSuffix;
		const filename = `${date}${suffix}.md`;
		return folder ? `${folder}/${filename}` : filename;
	}

	/**
	 * Build the template content for a new journal note.
	 */
	private buildJournalTemplate(date: string): string {
		return `---
created: ${date}
tags:
  - note
  - journal
---
## Old Tasks
\`\`\`tasks
((not done) AND ((created before today) OR (no created date)))
\`\`\`

## New Tasks
\`\`\`tasks
((not done) AND ((created today)))
\`\`\`

${this.settings.taskJournalSectionHeading}

## Notes
-
`;
	}

	/**
	 * Get or create the Tasks MOC.
	 */
	private async getOrCreateTasksMoc(): Promise<TFile> {
		const path = this.settings.tasksMocPath;
		let file = this.app.vault.getAbstractFileByPath(path);

		if (!file) {
			const folderPath = path.substring(0, path.lastIndexOf('/'));
			if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
				await this.app.vault.createFolder(folderPath);
			}

			const template = this.buildTasksMocTemplate();
			await this.app.vault.create(path, template);
			file = this.app.vault.getAbstractFileByPath(path);
		}

		if (!(file instanceof TFile)) {
			throw new Error(`${path} is not a file`);
		}

		return file;
	}

	/**
	 * Build the template content for the Tasks MOC.
	 */
	private buildTasksMocTemplate(): string {
		return `# Tasks

## Do First (Urgent + Important)
\`\`\`tasks
not done
priority is highest
\`\`\`

## Delegate (Urgent)
\`\`\`tasks
not done
priority is high
\`\`\`

## Schedule (Important)
\`\`\`tasks
not done
priority is low
\`\`\`

## Low Priority
\`\`\`tasks
not done
priority is none
\`\`\`

## Completed (Last 7 Days)
\`\`\`tasks
done
done after 7 days ago
\`\`\`
`;
	}
}
