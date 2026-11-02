import { Notice, Plugin, TAbstractFile } from 'obsidian';
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES, getCategoryLabel, type Category, type LogEntry, type TaskEntry, type WorkLogSettings } from './types';
import { WorkLogSettingTab } from './settings';
import { LogManager } from './log-manager';
import { TaskManager } from './task-manager';
import { EntryModal } from './entry-modal';
import { TaskModal } from './task-modal';
import { AutoLinker } from './auto-linker';
import { ReviewInbox } from './review-inbox';
import { ReviewModal } from './review-modal';

export default class WorkLogPlugin extends Plugin {
	settings: WorkLogSettings;
	private logManager: LogManager;
	private taskManager: TaskManager;
	private autoLinker: AutoLinker;
	private registeredCategoryCommandIds: Set<string> = new Set();
	private reviewInbox: ReviewInbox;
	private reviewStatus: HTMLElement;
	private reviewTimer: ReturnType<typeof setTimeout> | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.logManager = new LogManager(this.app, this.settings);
		this.taskManager = new TaskManager(this.app, this.settings);
		this.reviewInbox = new ReviewInbox(this.app, this.settings, this.logManager);
		const openReview = () => new ReviewModal(this.app, this.reviewInbox, this.settings, () => this.scheduleReviewCount()).open();
		this.addCommand({ id: 'review-suggestions', name: 'Review suggestions', callback: openReview });
		this.addRibbonIcon('list-checks', 'Review work log suggestions', openReview);
		this.reviewStatus = this.addStatusBarItem();
		this.reviewStatus.addClass('work-log-review-status');
		this.reviewStatus.setAttribute('role', 'button');
		this.reviewStatus.setAttribute('tabindex', '0');
		this.reviewStatus.onclick = openReview;
		this.reviewStatus.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openReview(); } };
		const inboxChanged = (file: TAbstractFile) => { if (this.reviewInbox.contains(file.path)) this.scheduleReviewCount(); };
		this.registerEvent(this.app.vault.on('create', inboxChanged));
		this.registerEvent(this.app.vault.on('modify', inboxChanged));
		this.registerEvent(this.app.vault.on('delete', inboxChanged));
		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			if (this.reviewInbox.contains(file.path) || this.reviewInbox.contains(oldPath)) this.scheduleReviewCount();
		}));
		this.app.workspace.onLayoutReady(() => this.scheduleReviewCount());

		// Register AutoLinker as child component for proper lifecycle management
		this.autoLinker = new AutoLinker(this.app);
		this.addChild(this.autoLinker);

		// Add ribbon icon for quick access
		this.addRibbonIcon('plus-circle', 'Add work log entry', () => {
			this.openEntryModal();
		});

		// Add ribbon icon for tasks
		this.addRibbonIcon('check-square', 'Create task', () => {
			this.openTaskModal();
		});

		// Add command to open entry modal
		this.addCommand({
			id: 'add-entry',
			name: 'Add work log entry',
			callback: () => {
				this.openEntryModal();
			}
		});

		// Add command to open log file
		this.addCommand({
			id: 'open-log',
			name: 'Open work log',
			callback: () => {
				this.logManager.openLogFile();
			}
		});

		// Task commands
		this.addCommand({
			id: 'create-task',
			name: 'Create task',
			callback: () => {
				this.openTaskModal();
			}
		});

		this.addCommand({
			id: 'open-journal',
			name: "Open today's journal",
			callback: () => {
				this.taskManager.openJournalNote();
			}
		});

		this.addCommand({
			id: 'open-tasks',
			name: 'Open tasks index',
			callback: () => {
				this.taskManager.openTasksMoc();
			}
		});

		// Register quick add commands for each category
		this.registerCategoryCommands();

		// Add settings tab
		this.addSettingTab(new WorkLogSettingTab(this.app, this));
	}

	onunload(): void {
		// AutoLinker cleanup is handled by addChild() lifecycle
		if (this.reviewTimer !== null) clearTimeout(this.reviewTimer);
	}

	private scheduleReviewCount(): void {
		if (this.reviewTimer !== null) clearTimeout(this.reviewTimer);
		this.reviewTimer = setTimeout(async () => {
			this.reviewTimer = null;
			try {
				const scan = await this.reviewInbox.scan();
				const count = scan.entries.filter(item => item.suggestion.status === 'pending' || item.suggestion.status === 'applying').length;
				this.reviewStatus.setText(`Work Log: ${count} to review${scan.errors.length ? ` · ${scan.errors.length} invalid` : ''}`);
			} catch {
				this.reviewStatus.setText('Work Log: check review inbox settings');
			}
		}, 300);
	}

	private registerCategoryCommands(): void {
		for (const cmdId of this.registeredCategoryCommandIds) {
			this.removeCommand(cmdId);
		}
		this.registeredCategoryCommandIds.clear();

		for (const cat of this.settings.categories) {
			const cmdId = `quick-${cat.id}`;
			this.addCommand({
				id: cmdId,
				name: `Quick add: ${cat.label}`,
				callback: () => {
					this.openEntryModal(cat.id);
				}
			});
			this.registeredCategoryCommandIds.add(cmdId);
		}
	}

	private openEntryModal(presetCategory?: Category): void {
		const settings = presetCategory
			? { ...this.settings, defaultCategory: presetCategory }
			: this.settings;

		const modal = new EntryModal(
			this.app,
			settings,
			this.autoLinker,
			async (entry: LogEntry) => {
				await this.addEntry(entry);
			}
		);
		modal.open();
	}

	private openTaskModal(): void {
		const modal = new TaskModal(
			this.app,
			this.settings,
			this.autoLinker,
			async (task: TaskEntry) => {
				await this.addTask(task);
			}
		);
		modal.open();
	}

	private async addTask(task: TaskEntry): Promise<void> {
		try {
			await this.taskManager.addTask(task);

			if (task.relatedNote) {
				this.showTaskSuccessNotice(`Task added to [[${task.relatedNote}]]`, task);
			} else {
				this.showTaskSuccessNotice(`Task added to journal for ${task.date}`, task);
			}
		} catch (error) {
			console.error('Failed to add task:', error);
			new Notice('Failed to add task. Check console for details.');
			throw error;
		}
	}

	private showTaskSuccessNotice(message: string, task: TaskEntry): void {
		const fragment = document.createDocumentFragment();
		fragment.appendText(message + ' ');
		const link = document.createElement('a');
		link.textContent = 'View';
		link.addEventListener('click', () => {
			if (task.relatedNote) {
				const file = this.app.metadataCache.getFirstLinkpathDest(task.relatedNote, '');
				if (file) {
					this.app.workspace.getLeaf(false).openFile(file);
				}
			} else {
				this.taskManager.openJournalNote(task.date);
			}
		});
		fragment.appendChild(link);
		new Notice(fragment, 5000);
	}

	private async addEntry(entry: LogEntry): Promise<void> {
		try {
			// Always add to main work log
			await this.logManager.addEntry(entry);

			const label = getCategoryLabel(this.settings.categories, entry.category);

			// Also add to related note if specified
			if (entry.relatedNote) {
				try {
					await this.logManager.addToRelatedNote(entry.relatedNote, entry);
					this.showSuccessNotice(`Added ${label} to work log and [[${entry.relatedNote}]]`);
				} catch (relatedError) {
					console.error('Failed to add to related note:', relatedError);
					new Notice(`Added to work log, but failed to add to [[${entry.relatedNote}]]: ${relatedError}`);
				}
			} else {
				this.showSuccessNotice(`Added ${label} entry for ${entry.date}`);
			}
		} catch (error) {
			console.error('Failed to add entry:', error);
			new Notice('Failed to add entry. Check console for details.');
			throw error;
		}
	}

	private showSuccessNotice(message: string): void {
		const fragment = document.createDocumentFragment();
		fragment.appendText(message + ' ');
		const link = document.createElement('a');
		link.textContent = 'View';
		link.addEventListener('click', () => {
			this.logManager.openLogFile();
		});
		fragment.appendChild(link);
		new Notice(fragment, 5000);
	}

	async loadSettings(): Promise<void> {
		const saved = (await this.loadData()) ?? {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

		// Migration: ensure categories array exists
		if (!this.settings.categories || this.settings.categories.length === 0) {
			this.settings.categories = DEFAULT_CATEGORIES;
		}

		// Migration: ensure all category objects have required fields
		for (const cat of this.settings.categories) {
			if (cat.description === undefined) cat.description = '';
			if (cat.placeholder === undefined) cat.placeholder = '';
		}

		// Ensure defaultCategory references a valid category
		if (!this.settings.categories.some(c => c.id === this.settings.defaultCategory)) {
			this.settings.defaultCategory = this.settings.categories[0].id;
		}

		// Clean orphaned properties not in the settings interface
		const validKeys = new Set(Object.keys(DEFAULT_SETTINGS));
		for (const key of Object.keys(this.settings)) {
			if (!validKeys.has(key)) {
				delete (this.settings as unknown as Record<string, unknown>)[key];
			}
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.logManager.updateSettings(this.settings);
		this.taskManager.updateSettings(this.settings);
		this.reviewInbox.updateSettings(this.settings);
		this.scheduleReviewCount();
		this.registerCategoryCommands();
	}
}
