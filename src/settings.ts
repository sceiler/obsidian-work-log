import { App, PluginSettingTab, Setting } from 'obsidian';
import type WorkLogPlugin from './main';
import { CATEGORY_LABELS, CATEGORY_DESCRIPTIONS, type Category } from './types';

export class WorkLogSettingTab extends PluginSettingTab {
	plugin: WorkLogPlugin;

	constructor(app: App, plugin: WorkLogPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h1', { text: 'Work Log Settings' });

		// ============ FILE SETTINGS ============
		containerEl.createEl('h2', { text: 'File Settings' });

		new Setting(containerEl)
			.setName('Log file path')
			.setDesc('Path to your work log file (relative to vault root)')
			.addText(text => text
				.setPlaceholder('work-log.md')
				.setValue(this.plugin.settings.logFilePath)
				.onChange(async (value) => {
					this.plugin.settings.logFilePath = value || 'work-log.md';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Date format')
			.setDesc('Format for dates (uses moment.js format)')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD')
				.setValue(this.plugin.settings.dateFormat)
				.onChange(async (value) => {
					this.plugin.settings.dateFormat = value || 'YYYY-MM-DD';
					await this.plugin.saveSettings();
				}));

		// ============ ENTRY SETTINGS ============
		containerEl.createEl('h2', { text: 'Entry Settings' });

		new Setting(containerEl)
			.setName('Default category')
			.setDesc('Pre-selected category when adding new entries')
			.addDropdown(dropdown => {
				const categories: Category[] = ['demo', 'customer', 'technical', 'collaboration', 'win'];
				categories.forEach(cat => {
					dropdown.addOption(cat, `${CATEGORY_LABELS[cat]}`);
				});
				dropdown.setValue(this.plugin.settings.defaultCategory);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultCategory = value as Category;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Show timestamps')
			.setDesc('Include time (HH:mm) in entries')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showTimestamps)
				.onChange(async (value) => {
					this.plugin.settings.showTimestamps = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show category in work log')
			.setDesc('Include category label (e.g., **Customer**) in work log entries')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCategoryInLog)
				.onChange(async (value) => {
					this.plugin.settings.showCategoryInLog = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show category in related notes')
			.setDesc('Include category label in entries added to related notes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCategoryInRelatedNote)
				.onChange(async (value) => {
					this.plugin.settings.showCategoryInRelatedNote = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Separate entries with blank line')
			.setDesc('Add a blank line between entries within the same date')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.separateEntriesWithBlankLine)
				.onChange(async (value) => {
					this.plugin.settings.separateEntriesWithBlankLine = value;
					await this.plugin.saveSettings();
				}));

		// ============ WORK LOG FORMATTING ============
		containerEl.createEl('h2', { text: 'Work Log Formatting' });

		new Setting(containerEl)
			.setName('Date heading level')
			.setDesc('Heading level for date sections in work log')
			.addDropdown(dropdown => {
				dropdown.addOption('##', '## (H2)');
				dropdown.addOption('###', '### (H3)');
				dropdown.setValue(this.plugin.settings.workLogDateHeadingLevel);
				dropdown.onChange(async (value) => {
					this.plugin.settings.workLogDateHeadingLevel = value as '##' | '###';
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName('Date as wiki link')
			.setDesc('Format dates as [[2026-02-05]] instead of plain text')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.workLogDateAsLink)
				.onChange(async (value) => {
					this.plugin.settings.workLogDateAsLink = value;
					await this.plugin.saveSettings();
				}));

		// ============ RELATED NOTES ============
		containerEl.createEl('h2', { text: 'Related Notes' });

		new Setting(containerEl)
			.setName('Create note if missing')
			.setDesc('Automatically create the related note if it doesn\'t exist')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.createRelatedNoteIfMissing)
				.onChange(async (value) => {
					this.plugin.settings.createRelatedNoteIfMissing = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('New note folder')
			.setDesc('Folder where new related notes are created (leave empty for vault root)')
			.addText(text => text
				.setPlaceholder('References')
				.setValue(this.plugin.settings.newRelatedNoteFolder)
				.onChange(async (value) => {
					this.plugin.settings.newRelatedNoteFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Section heading')
			.setDesc('Heading for the notes section in related notes (e.g., ## Notes)')
			.addText(text => text
				.setPlaceholder('## Notes')
				.setValue(this.plugin.settings.relatedNoteSectionHeading)
				.onChange(async (value) => {
					this.plugin.settings.relatedNoteSectionHeading = value || '## Notes';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Date heading level')
			.setDesc('Heading level for date subsections in related notes')
			.addDropdown(dropdown => {
				dropdown.addOption('###', '### (H3)');
				dropdown.addOption('####', '#### (H4)');
				dropdown.setValue(this.plugin.settings.relatedNoteDateHeadingLevel);
				dropdown.onChange(async (value) => {
					this.plugin.settings.relatedNoteDateHeadingLevel = value as '###' | '####';
					await this.plugin.saveSettings();
				});
			});

		// ============ AUTO-LINKING ============
		containerEl.createEl('h2', { text: 'Auto-Linking' });

		new Setting(containerEl)
			.setName('Enable auto-linking')
			.setDesc('Automatically convert note names in your entries to [[wiki links]]')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableAutoLink)
				.onChange(async (value) => {
					this.plugin.settings.enableAutoLink = value;
					await this.plugin.saveSettings();
				}));

		// ============ CATEGORY REFERENCE ============
		containerEl.createEl('h2', { text: 'Category Reference' });

		const categoryList = containerEl.createEl('div', { cls: 'work-log-category-reference' });
		const categories: Category[] = ['demo', 'customer', 'technical', 'collaboration', 'win'];

		for (const cat of categories) {
			const item = categoryList.createEl('div', { cls: 'work-log-category-item' });
			item.createEl('strong', { text: CATEGORY_LABELS[cat] });
			item.createEl('span', { text: ` — ${CATEGORY_DESCRIPTIONS[cat]}` });
		}
	}
}
