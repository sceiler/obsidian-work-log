import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, DEFAULT_CATEGORIES, getCategoryLabel, type Category, type LogEntry, type WorkLogSettings } from './types';
import { WorkLogSettingTab } from './settings';
import { LogManager } from './log-manager';
import { EntryModal } from './entry-modal';
import { AutoLinker } from './auto-linker';

export default class WorkLogPlugin extends Plugin {
	settings: WorkLogSettings;
	private logManager: LogManager;
	private autoLinker: AutoLinker;
	private registeredCategoryCommandIds: Set<string> = new Set();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.logManager = new LogManager(this.app, this.settings);

		// Register AutoLinker as child component for proper lifecycle management
		this.autoLinker = new AutoLinker(this.app);
		this.addChild(this.autoLinker);

		// Add ribbon icon for quick access
		this.addRibbonIcon('plus-circle', 'Add work log entry', () => {
			this.openEntryModal();
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

		// Register quick add commands for each category
		this.registerCategoryCommands();

		// Add settings tab
		this.addSettingTab(new WorkLogSettingTab(this.app, this));
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

	private async addEntry(entry: LogEntry): Promise<void> {
		try {
			// Always add to main work log
			await this.logManager.addEntry(entry);

			const label = getCategoryLabel(this.settings.categories, entry.category);

			// Also add to related note if specified
			if (entry.relatedNote) {
				try {
					await this.logManager.addToRelatedNote(entry.relatedNote, entry);
					new Notice(`Added ${label} to work log and [[${entry.relatedNote}]]`);
				} catch (relatedError) {
					console.error('Failed to add to related note:', relatedError);
					new Notice(`Added to work log, but failed to add to [[${entry.relatedNote}]]: ${relatedError}`);
				}
			} else {
				new Notice(`Added ${label} entry for ${entry.date}`);
			}
		} catch (error) {
			console.error('Failed to add entry:', error);
			new Notice('Failed to add entry. Check console for details.');
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Migration: ensure categories array exists
		if (!this.settings.categories || this.settings.categories.length === 0) {
			this.settings.categories = DEFAULT_CATEGORIES;
		}

		// Ensure defaultCategory references a valid category
		if (!this.settings.categories.some(c => c.id === this.settings.defaultCategory)) {
			this.settings.defaultCategory = this.settings.categories[0].id;
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.logManager.updateSettings(this.settings);
		this.registerCategoryCommands();
	}
}
