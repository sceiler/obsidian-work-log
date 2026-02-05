import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type WorkLogPlugin from './main';
import { type CategoryConfig } from './types';

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
				for (const cat of this.plugin.settings.categories) {
					dropdown.addOption(cat.id, cat.label);
				}
				dropdown.setValue(this.plugin.settings.defaultCategory);
				dropdown.onChange(async (value) => {
					this.plugin.settings.defaultCategory = value;
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

		// ============ CATEGORIES ============
		containerEl.createEl('h2', { text: 'Categories' });

		new Setting(containerEl)
			.setDesc('Add, edit, reorder, or remove categories. Changes also update quick-add commands.')
			.addButton(btn => btn
				.setButtonText('Add Category')
				.setCta()
				.onClick(() => {
					this.showAddCategoryForm(containerEl);
				}));

		const categoriesContainer = containerEl.createDiv();
		this.renderCategoryList(categoriesContainer);
	}

	private renderCategoryList(container: HTMLElement): void {
		container.empty();
		const categories = this.plugin.settings.categories;

		for (let i = 0; i < categories.length; i++) {
			const cat = categories[i];
			const isDefault = cat.id === this.plugin.settings.defaultCategory;

			const catContainer = container.createDiv({ cls: 'work-log-category-container' });

			const setting = new Setting(catContainer)
				.setName(cat.label + (isDefault ? ' (default)' : ''))
				.setDesc(cat.description);

			// Move up
			if (i > 0) {
				setting.addExtraButton(btn => btn
					.setIcon('arrow-up')
					.setTooltip('Move up')
					.onClick(async () => {
						[categories[i - 1], categories[i]] = [categories[i], categories[i - 1]];
						await this.plugin.saveSettings();
						this.display();
					}));
			}

			// Move down
			if (i < categories.length - 1) {
				setting.addExtraButton(btn => btn
					.setIcon('arrow-down')
					.setTooltip('Move down')
					.onClick(async () => {
						[categories[i], categories[i + 1]] = [categories[i + 1], categories[i]];
						await this.plugin.saveSettings();
						this.display();
					}));
			}

			// Set as default
			if (!isDefault) {
				setting.addExtraButton(btn => btn
					.setIcon('star')
					.setTooltip('Set as default')
					.onClick(async () => {
						this.plugin.settings.defaultCategory = cat.id;
						await this.plugin.saveSettings();
						this.display();
					}));
			}

			// Edit
			setting.addExtraButton(btn => btn
				.setIcon('pencil')
				.setTooltip('Edit category')
				.onClick(() => {
					this.showEditCategoryForm(catContainer, i);
				}));

			// Delete (only if more than 1 category)
			if (categories.length > 1) {
				setting.addExtraButton(btn => btn
					.setIcon('trash')
					.setTooltip('Delete category')
					.onClick(async () => {
						const removedId = categories[i].id;
						categories.splice(i, 1);
						if (this.plugin.settings.defaultCategory === removedId) {
							this.plugin.settings.defaultCategory = categories[0].id;
						}
						await this.plugin.saveSettings();
						this.display();
					}));
			}
		}
	}

	private showEditCategoryForm(container: HTMLElement, index: number): void {
		const cat = this.plugin.settings.categories[index];
		container.empty();

		container.createEl('h3', { text: `Editing: ${cat.label}` });

		new Setting(container)
			.setName('ID')
			.setDesc('Internal identifier (cannot be changed)')
			.addText(text => {
				text.setValue(cat.id);
				text.setDisabled(true);
			});

		new Setting(container)
			.setName('Label')
			.setDesc('Display name shown in dropdowns and entries')
			.addText(text => text
				.setValue(cat.label)
				.onChange(value => { cat.label = value; }));

		new Setting(container)
			.setName('Description')
			.setDesc('Help text shown below the category dropdown')
			.addText(text => text
				.setValue(cat.description)
				.onChange(value => { cat.description = value; }));

		new Setting(container)
			.setName('Placeholder')
			.setDesc('Example text shown in the description field')
			.addText(text => text
				.setValue(cat.placeholder)
				.onChange(value => { cat.placeholder = value; }));

		new Setting(container)
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					if (!cat.label.trim()) {
						new Notice('Label is required');
						return;
					}
					await this.plugin.saveSettings();
					this.display();
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.display();
				}));
	}

	private showAddCategoryForm(parentEl: HTMLElement): void {
		// Remove existing add form if any
		const existing = parentEl.querySelector('.work-log-add-category-form');
		if (existing) {
			existing.remove();
			return;
		}

		const formEl = parentEl.createDiv({ cls: 'work-log-add-category-form' });

		const newCat: CategoryConfig = { id: '', label: '', description: '', placeholder: '' };

		new Setting(formEl)
			.setName('ID')
			.setDesc('Unique identifier (lowercase letters, numbers, hyphens)')
			.addText(text => text
				.setPlaceholder('e.g., meeting')
				.onChange(value => { newCat.id = value.toLowerCase().replace(/[^a-z0-9-]/g, ''); }));

		new Setting(formEl)
			.setName('Label')
			.setDesc('Display name')
			.addText(text => text
				.setPlaceholder('e.g., Meeting')
				.onChange(value => { newCat.label = value; }));

		new Setting(formEl)
			.setName('Description')
			.addText(text => text
				.setPlaceholder('e.g., Team meetings, standups, 1:1s')
				.onChange(value => { newCat.description = value; }));

		new Setting(formEl)
			.setName('Placeholder')
			.addText(text => text
				.setPlaceholder('e.g., Led sprint planning for Q3 release')
				.onChange(value => { newCat.placeholder = value; }));

		new Setting(formEl)
			.addButton(btn => btn
				.setButtonText('Add')
				.setCta()
				.onClick(async () => {
					if (!newCat.id || !newCat.label.trim()) {
						new Notice('ID and Label are required');
						return;
					}
					if (this.plugin.settings.categories.some(c => c.id === newCat.id)) {
						new Notice(`Category with ID "${newCat.id}" already exists`);
						return;
					}
					this.plugin.settings.categories.push({ ...newCat });
					await this.plugin.saveSettings();
					this.display();
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.display();
				}));
	}
}
