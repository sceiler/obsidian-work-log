import { App, Modal, Setting, moment, TextAreaComponent, DropdownComponent } from 'obsidian';
import {
	getCategoryConfig,
	type Category,
	type LogEntry,
	type WorkLogSettings
} from './types';
import { AutoLinker } from './auto-linker';
import { NoteSuggest } from './note-suggest';

export class EntryModal extends Modal {
	private settings: WorkLogSettings;
	private onSubmit: (entry: LogEntry) => Promise<void>;
	private isSubmitting: boolean = false;
	private submitBtn: HTMLButtonElement | null = null;
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
		onSubmit: (entry: LogEntry) => Promise<void>
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

		// Category dropdown with description (UI-4: desc is part of Setting, not a sibling div)
		const initialConfig = getCategoryConfig(this.settings.categories, this.selectedCategory);
		const categorySetting = new Setting(contentEl)
			.setName('Category')
			.setDesc(initialConfig?.description ?? '');

		categorySetting.addDropdown((dropdown: DropdownComponent) => {
			for (const cat of this.settings.categories) {
				dropdown.addOption(cat.id, cat.label);
			}
			dropdown.setValue(this.selectedCategory);
			dropdown.onChange((value: string) => {
				this.selectedCategory = value as Category;
				const config = getCategoryConfig(this.settings.categories, this.selectedCategory);
				categorySetting.setDesc(config?.description ?? '');
				if (this.descriptionEl) {
					this.descriptionEl.setPlaceholder(config?.placeholder ?? '');
				}
			});
		});

		// Description textarea
		new Setting(contentEl)
			.setName('Description')
			.setDesc('What did you accomplish? Note names will be auto-linked.')
			.addTextArea((text: TextAreaComponent) => {
				this.descriptionEl = text;
				const catConfig = getCategoryConfig(this.settings.categories, this.selectedCategory);
				text.setPlaceholder(catConfig?.placeholder ?? '');
				text.inputEl.rows = 5;
				text.inputEl.addClass('work-log-description');
				text.onChange((value: string) => {
					this.description = value;
				});
				// Focus description for fastest common-case entry
				setTimeout(() => text.inputEl.focus(), 50);
			});

		// Auto-link indicator
		if (this.settings.enableAutoLink) {
			const autoLinkNote = contentEl.createDiv({ cls: 'work-log-autolink-note' });
			autoLinkNote.setText('Names of existing notes will be automatically linked');
		}

		// Related note with autocomplete (moved after description — optional field last)
		this.createRelatedNoteField(contentEl);

		// Submit button
		const buttonContainer = contentEl.createDiv({ cls: 'work-log-buttons' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		this.submitBtn = buttonContainer.createEl('button', {
			text: 'Add Entry',
			cls: 'mod-cta',
			attr: { 'aria-keyshortcuts': 'Meta+Enter' }
		});
		const shortcutHint = this.submitBtn.createSpan({ cls: 'work-log-shortcut-hint' });
		shortcutHint.setText(navigator.platform.includes('Mac') ? '⌘↵' : 'Ctrl+↵');
		this.submitBtn.addEventListener('click', () => this.submit());

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

		const noteStatusEl = container.createDiv({ cls: 'work-log-note-status' });

		setting.addText(text => {
			text.setPlaceholder('Start typing to search...');
			text.inputEl.addClass('work-log-related-note-input');

			// Create autocomplete suggest
			this.noteSuggest = new NoteSuggest(this.app, text.inputEl);

			text.onChange((value: string) => {
				this.relatedNote = value;
				// UX-8: Show existence indicator
				const trimmed = value.trim();
				if (!trimmed) {
					noteStatusEl.textContent = '';
					noteStatusEl.className = 'work-log-note-status';
				} else if (this.autoLinker.noteExists(trimmed)) {
					noteStatusEl.textContent = 'Note found';
					noteStatusEl.className = 'work-log-note-status is-found';
				} else {
					const action = this.settings.createRelatedNoteIfMissing ? 'will be created' : 'not found';
					noteStatusEl.textContent = `Note ${action}`;
					noteStatusEl.className = 'work-log-note-status is-missing';
				}
			});
		});

		// Info text
		const infoEl = container.createDiv({ cls: 'work-log-related-note-info' });
		infoEl.setText(`Entry will be added under ${this.settings.relatedNoteSectionHeading} → ${this.settings.relatedNoteDateHeadingLevel} [[date]] in the selected note`);
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

		// On Sat/Sun, the button targets "this past Friday" — label accordingly
		const dayOfWeekNow = moment().day();
		const fridayLabel = (dayOfWeekNow === 0 || dayOfWeekNow === 6) ? 'Friday' : 'Last Friday';
		const lastFridayBtn = quickButtons.createEl('button', { text: fridayLabel, cls: 'work-log-date-btn' });
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

	private async submit(): Promise<void> {
		if (this.isSubmitting) return;

		if (!this.description.trim()) {
			const descEl = this.contentEl.querySelector('.work-log-description');
			if (descEl) {
				descEl.addClass('work-log-error');
				descEl.setAttribute('aria-invalid', 'true');
				setTimeout(() => {
					descEl.removeClass('work-log-error');
					descEl.removeAttribute('aria-invalid');
				}, 1000);
			}
			// UX-2: Show visible error message
			let errorMsg = this.contentEl.querySelector('.work-log-error-msg');
			if (!errorMsg) {
				errorMsg = this.contentEl.querySelector('.work-log-description')
					?.closest('.setting-item')
					?.createDiv({ cls: 'work-log-error-msg' }) ?? null;
			}
			if (errorMsg) {
				errorMsg.textContent = 'Description is required';
				setTimeout(() => errorMsg?.remove(), 3000);
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

		// UX-1 / UI-3: Disable button and show loading state during async write
		this.isSubmitting = true;
		if (this.submitBtn) {
			this.submitBtn.disabled = true;
			this.submitBtn.textContent = 'Adding...';
		}

		try {
			await this.onSubmit(entry);
			this.close();
		} catch {
			// Re-enable on failure so user can retry
			this.isSubmitting = false;
			if (this.submitBtn) {
				this.submitBtn.disabled = false;
				this.submitBtn.textContent = 'Add Entry';
				const shortcutHint = this.submitBtn.createSpan({ cls: 'work-log-shortcut-hint' });
				shortcutHint.setText(navigator.platform.includes('Mac') ? '⌘↵' : 'Ctrl+↵');
			}
		}
	}

	onClose(): void {
		if (this.noteSuggest) {
			this.noteSuggest.close();
		}
		const { contentEl } = this;
		contentEl.empty();
	}
}
