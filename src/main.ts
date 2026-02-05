import { Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, CATEGORY_LABELS, type Category, type LogEntry, type WorkLogSettings } from './types';
import { WorkLogSettingTab } from './settings';
import { LogManager } from './log-manager';
import { EntryModal } from './entry-modal';
import { AutoLinker } from './auto-linker';

export default class WorkLogPlugin extends Plugin {
	settings: WorkLogSettings;
	private logManager: LogManager;
	private autoLinker: AutoLinker;

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

		// Quick add commands for each category
		const categories: Category[] = ['demo', 'customer', 'technical', 'collaboration', 'win'];
		for (const category of categories) {
			this.addCommand({
				id: `quick-${category}`,
				name: `Quick add: ${CATEGORY_LABELS[category]}`,
				callback: () => {
					this.openEntryModal(category);
				}
			});
		}

		// Add settings tab
		this.addSettingTab(new WorkLogSettingTab(this.app, this));
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

			// Also add to related note if specified
			if (entry.relatedNote) {
				try {
					await this.logManager.addToRelatedNote(entry.relatedNote, entry);
					new Notice(`Added ${CATEGORY_LABELS[entry.category]} to work log and [[${entry.relatedNote}]]`);
				} catch (relatedError) {
					console.error('Failed to add to related note:', relatedError);
					new Notice(`Added to work log, but failed to add to [[${entry.relatedNote}]]: ${relatedError}`);
				}
			} else {
				new Notice(`Added ${CATEGORY_LABELS[entry.category]} entry for ${entry.date}`);
			}
		} catch (error) {
			console.error('Failed to add entry:', error);
			new Notice('Failed to add entry. Check console for details.');
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.logManager.updateSettings(this.settings);
	}
}
