import { App, TFile } from 'obsidian';
import { LogManager } from './log-manager';
import { parseSuggestion, safeVaultPath, serializeSuggestion, validDate, type Suggestion, type SuggestionEdit, type SuggestionFile } from './suggestion';
import type { WorkLogSettings } from './types';

export interface InboxScan { entries: SuggestionFile[]; errors: { path: string; message: string }[]; }

export class ReviewInbox {
	private busy = new Set<string>();
	constructor(private app: App, private settings: WorkLogSettings, private logManager: LogManager) {}
	updateSettings(settings: WorkLogSettings): void { this.settings = settings; }

	contains(path: string): boolean {
		const folder = this.settings.reviewInboxFolder;
		return safeVaultPath(folder) && path.startsWith(`${folder}/`) && path.endsWith('.md');
	}

	async scan(): Promise<InboxScan> {
		if (!safeVaultPath(this.settings.reviewInboxFolder)) throw new Error('Review inbox must be a folder inside the vault');
		const result: InboxScan = { entries: [], errors: [] };
		for (const file of this.app.vault.getMarkdownFiles().filter(file => this.contains(file.path))) {
			try {
				const raw = await this.app.vault.read(file);
				const suggestion = parseSuggestion(raw);
				if (suggestion) result.entries.push({ path: file.path, raw, suggestion });
			} catch (error) {
				result.errors.push({ path: file.path, message: String(error) });
			}
		}
		const counts = new Map<string, number>();
		for (const item of result.entries) counts.set(item.suggestion.id, (counts.get(item.suggestion.id) ?? 0) + 1);
		result.entries = result.entries.filter(item => {
			if (counts.get(item.suggestion.id) === 1) return true;
			result.errors.push({ path: item.path, message: `Duplicate suggestion ID: ${item.suggestion.id}` });
			return false;
		});
		result.entries.sort((a, b) => b.suggestion.date.localeCompare(a.suggestion.date) || a.path.localeCompare(b.path));
		return result;
	}

	private async replace(previous: SuggestionFile, next: Suggestion): Promise<SuggestionFile> {
		if (!this.contains(previous.path)) throw new Error('Suggestion is outside the review inbox');
		const file = this.app.vault.getAbstractFileByPath(previous.path);
		if (!(file instanceof TFile)) throw new Error('Suggestion file is missing');
		const raw = serializeSuggestion(next);
		await this.app.vault.process(file, current => {
			if (current !== previous.raw) throw new Error('This draft changed elsewhere. Reopen the review to load the latest version.');
			return raw;
		});
		return { path: previous.path, raw, suggestion: next };
	}

	async save(previous: SuggestionFile, edit: SuggestionEdit): Promise<SuggestionFile> {
		if (previous.suggestion.status !== 'pending') throw new Error('Only pending drafts can be edited');
		return this.replace(previous, { ...previous.suggestion, ...edit, updated_at: new Date().toISOString() });
	}

	async dismiss(previous: SuggestionFile): Promise<SuggestionFile> {
		if (previous.suggestion.status !== 'pending') throw new Error('A started submission must be completed before it can leave the queue');
		return this.replace(previous, { ...previous.suggestion, status: 'dismissed', reviewed_at: new Date().toISOString() });
	}

	private validate(suggestion: Suggestion): void {
		if (!validDate(suggestion.date)) throw new Error('Choose a valid entry date');
		if (!suggestion.description.trim()) throw new Error('Entry text is required');
		if (suggestion.description.includes('<!-- work-log:')) throw new Error('Entry text contains a reserved Work Log marker');
		if (!this.settings.categories.some(category => category.id === suggestion.category)) throw new Error('Choose an existing category');
		if (!safeVaultPath(this.settings.logFilePath) || !this.settings.logFilePath.endsWith('.md') || this.contains(this.settings.logFilePath)) {
			throw new Error('Work log must be a Markdown file outside the review inbox');
		}
		for (const path of suggestion.related_notes) {
			if (!safeVaultPath(path) || !path.endsWith('.md') || this.contains(path) || path === this.settings.logFilePath) {
				throw new Error(`Invalid related note: ${path}`);
			}
			if (!(this.app.vault.getAbstractFileByPath(path) instanceof TFile)) throw new Error(`Related note not found: ${path}`);
		}
	}

	async apply(previous: SuggestionFile): Promise<SuggestionFile> {
		const id = previous.suggestion.id;
		if (this.busy.has(id)) throw new Error('This entry is already being submitted');
		this.busy.add(id);
		try {
			// Re-read rather than trusting a possibly stale or duplicated entry in the window.
			const scan = await this.scan();
			let current = scan.entries.find(item => item.path === previous.path && item.suggestion.id === id);
			if (!current) throw new Error('Suggestion is missing or has a duplicate ID. Reopen the review.');
			if (current.raw !== previous.raw) throw new Error('This draft changed elsewhere. Reopen the review before submitting.');
			if (current.suggestion.status === 'applied') return current;
			if (current.suggestion.status === 'dismissed') throw new Error('This suggestion was dismissed');
			if (current.suggestion.status === 'pending') {
				this.validate(current.suggestion);
				const related = [...new Set(current.suggestion.related_notes)];
				current = await this.replace(current, {
					...current.suggestion,
					status: 'applying',
					submission: {
						log_path: this.settings.logFilePath,
						related_notes: related,
						entry: { date: current.suggestion.date, category: current.suggestion.category,
							description: current.suggestion.description.trim(), relatedNotes: [...related], timestamp: Date.now() }
					}
				});
			}
			const submission = current.suggestion.submission!;
			if (this.contains(submission.log_path) || submission.related_notes.some(path => this.contains(path) || path === submission.log_path)) {
				throw new Error('Saved submission points into the inbox or repeats the work log');
			}
			// Each destination is independently idempotent. A crash before marking applied is safe to retry.
			await this.logManager.writeReviewedEntry(submission.log_path, submission.entry, id, true);
			for (const path of submission.related_notes) await this.logManager.writeReviewedEntry(path, submission.entry, id, false);
			return await this.replace(current, { ...current.suggestion, status: 'applied', applied_at: new Date().toISOString() });
		} finally {
			this.busy.delete(id);
		}
	}
}
