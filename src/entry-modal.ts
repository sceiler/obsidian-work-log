import { App, Modal, Setting, moment, TextAreaComponent, DropdownComponent } from 'obsidian';
import {
	CATEGORY_LABELS,
	CATEGORY_DESCRIPTIONS,
	CATEGORY_PLACEHOLDERS,
	type Category,
	type LogEntry,
	type WorkLogSettings
} from './types';
import { AutoLinker } from './auto-linker';
import { NoteSuggest } from './note-suggest';

export class EntryModal extends Modal {
	private settings: WorkLogSettings;
	private onSubmit: (entry: LogEntry) => void;
	private autoLinker: AutoLinker;

	private selectedDate: string;
	private selectedCategory: Category;
	private description: string = '';
	private relatedNote: string = '';
	private descriptionEl: TextAreaComponent | null = null;
	private noteSuggest: NoteSuggest | null = null;

	constructor(
		app: App,
		settings: WorkLogSettings,
		autoLinker: AutoLinker,
		onSubmit: (entry: LogEntry) => void
	) {
		super(app);
		this.settings = settings;
		this.autoLinker = autoLinker;
		this.onSubmit = onSubmit;
		this.selectedDate = moment().format('YYYY-MM-DD');
		this.selectedCategory = settings.defaultCategory;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		contentEl.addClass('work-log-modal');
		modalEl.addClass('work-log-modal-container');

		contentEl.createEl('h2', { text: 'Add Work Log Entry' });

		// Date picker section
		const dateSection = contentEl.createDiv({ cls: 'work-log-date-section' });
		this.createDatePicker(dateSection);

		// Related note with autocomplete
		this.createRelatedNoteField(contentEl);

		// Category dropdown with descriptions
		const categorySetting = new Setting(contentEl)
			.setName('Category');

		const categoryDesc = contentEl.createDiv({ cls: 'work-log-category-desc' });
		categoryDesc.setText(CATEGORY_DESCRIPTIONS[this.selectedCategory]);

		categorySetting.addDropdown((dropdown: DropdownComponent) => {
			const categories: Category[] = ['demo', 'customer', 'technical', 'collaboration', 'win'];
			categories.forEach(cat => {
				dropdown.addOption(cat, CATEGORY_LABELS[cat]);
			});
			dropdown.setValue(this.selectedCategory);
			dropdown.onChange((value: string) => {
				this.selectedCategory = value as Category;
				categoryDesc.setText(CATEGORY_DESCRIPTIONS[this.selectedCategory]);
				if (this.descriptionEl) {
					this.descriptionEl.setPlaceholder(CATEGORY_PLACEHOLDERS[this.selectedCategory]);
				}
			});
		});

		// Description textarea
		new Setting(contentEl)
			.setName('Description')
			.setDesc('What did you accomplish? Note names will be auto-linked.')
			.addTextArea((text: TextAreaComponent) => {
				this.descriptionEl = text;
				text.setPlaceholder(CATEGORY_PLACEHOLDERS[this.selectedCategory]);
				text.inputEl.rows = 5;
				text.inputEl.addClass('work-log-description');
				text.onChange((value: string) => {
					this.description = value;
				});
			});

		// Auto-link indicator
		if (this.settings.enableAutoLink) {
			const autoLinkNote = contentEl.createDiv({ cls: 'work-log-autolink-note' });
			autoLinkNote.setText('Names of existing notes will be automatically linked');
		}

		// Submit button
		const buttonContainer = contentEl.createDiv({ cls: 'work-log-buttons' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const submitBtn = buttonContainer.createEl('button', {
			text: 'Add Entry',
			cls: 'mod-cta'
		});
		submitBtn.addEventListener('click', () => this.submit());

		// Handle keyboard shortcuts
		contentEl.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				this.submit();
			}
			if (e.key === 'Escape') {
				this.close();
			}
		});
	}

	private createRelatedNoteField(container: HTMLElement): void {
		const setting = new Setting(container)
			.setName('Related note')
			.setDesc('Optional: Log this entry to a person/org/project note');

		setting.addText(text => {
			text.setPlaceholder('Start typing to search...');
			text.inputEl.addClass('work-log-related-note-input');

			// Create autocomplete suggest
			this.noteSuggest = new NoteSuggest(this.app, text.inputEl);

			text.onChange((value: string) => {
				this.relatedNote = value;
			});

			// Focus this field first for quick selection
			setTimeout(() => text.inputEl.focus(), 50);
		});

		// Info text
		const infoEl = container.createDiv({ cls: 'work-log-related-note-info' });
		infoEl.setText('Entry will be added under ## Notes → ### [[date]] in the selected note');
	}

	private createDatePicker(container: HTMLElement): void {
		container.createEl('div', {
			cls: 'work-log-date-label',
			text: 'Date'
		});

		const dateRow = container.createDiv({ cls: 'work-log-date-row' });

		// Quick date buttons
		const quickButtons = dateRow.createDiv({ cls: 'work-log-quick-dates' });

		const todayBtn = quickButtons.createEl('button', {
			text: 'Today',
			cls: 'work-log-date-btn work-log-date-btn-active'
		});
		todayBtn.addEventListener('click', () => {
			this.setDate(moment());
			this.updateActiveButton(quickButtons, todayBtn);
		});

		const yesterdayBtn = quickButtons.createEl('button', { text: 'Yesterday', cls: 'work-log-date-btn' });
		yesterdayBtn.addEventListener('click', () => {
			this.setDate(moment().subtract(1, 'day'));
			this.updateActiveButton(quickButtons, yesterdayBtn);
		});

		const lastFridayBtn = quickButtons.createEl('button', { text: 'Last Friday', cls: 'work-log-date-btn' });
		lastFridayBtn.addEventListener('click', () => {
			const today = moment();
			const dayOfWeek = today.day();
			const daysBack = dayOfWeek === 0 ? 2 : dayOfWeek === 6 ? 1 : dayOfWeek + 2;
			this.setDate(moment().subtract(daysBack, 'days'));
			this.updateActiveButton(quickButtons, lastFridayBtn);
		});

		// Date input
		const dateInput = dateRow.createEl('input', {
			type: 'date',
			cls: 'work-log-date-input',
			value: this.selectedDate
		});
		dateInput.addEventListener('change', (e: Event) => {
			const target = e.target as HTMLInputElement;
			this.selectedDate = target.value;
			this.updateDateDisplay(container);
			this.updateActiveButton(quickButtons, null);
		});

		// Display selected date
		container.createDiv({
			cls: 'work-log-date-display',
			text: this.formatDateDisplay(this.selectedDate)
		});
	}

	private updateActiveButton(container: HTMLElement, activeBtn: HTMLElement | null): void {
		const buttons = container.querySelectorAll('.work-log-date-btn');
		buttons.forEach(btn => btn.removeClass('work-log-date-btn-active'));
		if (activeBtn) {
			activeBtn.addClass('work-log-date-btn-active');
		}
	}

	private setDate(date: moment.Moment): void {
		this.selectedDate = date.format('YYYY-MM-DD');
		const dateInput = this.contentEl.querySelector('.work-log-date-input') as HTMLInputElement;
		if (dateInput) {
			dateInput.value = this.selectedDate;
		}
		this.updateDateDisplay(this.contentEl);
	}

	private updateDateDisplay(container: HTMLElement): void {
		const display = container.querySelector('.work-log-date-display');
		if (display) {
			display.textContent = this.formatDateDisplay(this.selectedDate);
		}
	}

	private formatDateDisplay(dateStr: string): string {
		const date = moment(dateStr);
		const today = moment().startOf('day');
		const diff = today.diff(date.startOf('day'), 'days');

		if (diff === 0) return `${date.format('dddd, MMMM D, YYYY')} (Today)`;
		if (diff === 1) return `${date.format('dddd, MMMM D, YYYY')} (Yesterday)`;
		if (diff > 1 && diff <= 7) return `${date.format('dddd, MMMM D, YYYY')} (${diff} days ago)`;
		return date.format('dddd, MMMM D, YYYY');
	}

	private submit(): void {
		if (!this.description.trim()) {
			const descEl = this.contentEl.querySelector('.work-log-description');
			if (descEl) {
				descEl.addClass('work-log-error');
				setTimeout(() => descEl.removeClass('work-log-error'), 1000);
			}
			return;
		}

		// Auto-link note names in description
		let processedDescription = this.description.trim();
		if (this.settings.enableAutoLink) {
			processedDescription = this.autoLinker.processText(processedDescription);
		}

		const entry: LogEntry = {
			date: this.selectedDate,
			category: this.selectedCategory,
			description: processedDescription,
			relatedNote: this.relatedNote.trim() || undefined,
			timestamp: Date.now()
		};

		this.onSubmit(entry);
		this.close();
	}

	onClose(): void {
		if (this.noteSuggest) {
			this.noteSuggest.close();
		}
		const { contentEl } = this;
		contentEl.empty();
	}
}
