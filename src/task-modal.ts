import { App, Modal, Setting, moment, TextAreaComponent } from 'obsidian';
import { type TaskEntry, type WorkLogSettings } from './types';
import { AutoLinker } from './auto-linker';
import { NoteSuggest } from './note-suggest';

const QUADRANT_LABELS: Record<string, string> = {
	'true-true': 'Do First (Urgent + Important)',
	'true-false': 'Delegate (Urgent)',
	'false-true': 'Schedule (Important)',
	'false-false': 'Low Priority',
};

export class TaskModal extends Modal {
	private settings: WorkLogSettings;
	private onSubmit: (task: TaskEntry) => Promise<void>;
	private autoLinker: AutoLinker;
	private isSubmitting: boolean = false;
	private submitBtn: HTMLButtonElement | null = null;

	private description: string = '';
	private urgent: boolean = false;
	private important: boolean = false;
	private dueDate: string = '';
	private relatedNote: string = '';
	private descriptionEl: TextAreaComponent | null = null;
	private noteSuggest: NoteSuggest | null = null;

	// UI elements that need updating
	private urgentBtn: HTMLButtonElement | null = null;
	private importantBtn: HTMLButtonElement | null = null;
	private quadrantLabel: HTMLElement | null = null;
	private urgencyHint: HTMLElement | null = null;
	private urgencyAutoSet: boolean = false;
	private dueDateInput: HTMLInputElement | null = null;

	constructor(
		app: App,
		settings: WorkLogSettings,
		autoLinker: AutoLinker,
		onSubmit: (task: TaskEntry) => Promise<void>
	) {
		super(app);
		this.settings = settings;
		this.autoLinker = autoLinker;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		contentEl.empty();
		contentEl.addClass('work-log-modal');
		modalEl.addClass('work-log-modal-container');

		contentEl.createEl('h2', { text: 'Create Task' });

		// Description textarea
		new Setting(contentEl)
			.setName('Description')
			.setDesc('What needs to be done? Note names will be auto-linked.')
			.addTextArea((text: TextAreaComponent) => {
				this.descriptionEl = text;
				text.setPlaceholder('What needs to be done?');
				text.inputEl.rows = 3;
				text.inputEl.addClass('work-log-description');
				text.onChange((value: string) => {
					this.description = value;
				});
				setTimeout(() => text.inputEl.focus(), 50);
			});

		// Auto-link indicator
		if (this.settings.enableAutoLink) {
			const autoLinkNote = contentEl.createDiv({ cls: 'work-log-autolink-note' });
			autoLinkNote.setText('Names of existing notes will be automatically linked');
		}

		// Priority section
		this.createPrioritySection(contentEl);

		// Related note with autocomplete
		this.createRelatedNoteField(contentEl);

		// Due date
		this.createDueDateField(contentEl);

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'work-log-buttons' });

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		this.submitBtn = buttonContainer.createEl('button', {
			text: 'Create Task',
			cls: 'mod-cta',
			attr: { 'aria-keyshortcuts': 'Meta+Enter' }
		});
		const shortcutHint = this.submitBtn.createSpan({ cls: 'work-log-shortcut-hint' });
		shortcutHint.setText(navigator.platform.includes('Mac') ? '⌘↵' : 'Ctrl+↵');
		this.submitBtn.addEventListener('click', () => this.submit());

		// Keyboard shortcuts
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

	private createPrioritySection(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'work-log-priority-section' });
		section.createEl('div', { cls: 'work-log-priority-label', text: 'Priority' });

		const toggleRow = section.createDiv({ cls: 'work-log-priority-toggles' });

		this.importantBtn = toggleRow.createEl('button', {
			text: 'Important',
			cls: 'work-log-priority-btn'
		});
		this.importantBtn.addEventListener('click', () => {
			this.important = !this.important;
			this.updatePriorityUI();
		});

		this.urgentBtn = toggleRow.createEl('button', {
			text: 'Urgent',
			cls: 'work-log-priority-btn'
		});
		this.urgentBtn.addEventListener('click', () => {
			this.urgent = !this.urgent;
			// If user manually toggles urgent, clear auto-set
			this.urgencyAutoSet = false;
			this.updatePriorityUI();
		});

		this.quadrantLabel = section.createDiv({ cls: 'work-log-quadrant-label' });
		this.urgencyHint = section.createDiv({ cls: 'work-log-urgency-hint' });
		this.updatePriorityUI();
	}

	private updatePriorityUI(): void {
		if (this.importantBtn) {
			this.importantBtn.toggleClass('is-active', this.important);
		}
		if (this.urgentBtn) {
			this.urgentBtn.toggleClass('is-active', this.urgent);
		}
		if (this.quadrantLabel) {
			const key = `${this.urgent}-${this.important}`;
			this.quadrantLabel.setText(QUADRANT_LABELS[key] ?? '');
		}
		if (this.urgencyHint) {
			if (this.urgencyAutoSet) {
				this.urgencyHint.setText(`(auto: due within ${this.settings.taskUrgencyThresholdDays} days)`);
				this.urgencyHint.style.visibility = 'visible';
			} else {
				this.urgencyHint.setText('\u00A0');
				this.urgencyHint.style.visibility = 'hidden';
			}
		}
	}

	private buildQuickDateButtons(): { label: string; days: number }[] {
		const buttons: { label: string; days: number }[] = [
			{ label: 'Today', days: 0 },
			{ label: 'Tomorrow', days: 1 },
			{ label: 'Day after', days: 2 },
		];

		// Add remaining weekdays (Mon–Fri) of this work week, 3+ days out
		const dayOfWeek = moment().day(); // 0=Sun, 1=Mon … 5=Fri, 6=Sat
		if (dayOfWeek >= 1 && dayOfWeek <= 5) {
			const daysToFriday = 5 - dayOfWeek;
			for (let d = 3; d <= daysToFriday; d++) {
				buttons.push({ label: moment().add(d, 'days').format('ddd'), days: d });
			}
		} else {
			// Weekend: show next week's weekdays that are 3–6 days out
			for (let d = 3; d <= 6; d++) {
				const dow = moment().add(d, 'days').day();
				if (dow >= 1 && dow <= 5) {
					buttons.push({ label: moment().add(d, 'days').format('ddd'), days: d });
				}
			}
		}

		buttons.push({ label: '1 week', days: 7 });
		return buttons;
	}

	private createDueDateField(container: HTMLElement): void {
		const section = container.createDiv({ cls: 'work-log-due-date-section' });
		section.createEl('div', { cls: 'work-log-date-label', text: 'Due date' });

		const quickRow = section.createDiv({ cls: 'work-log-quick-dates' });

		const buttons: { label: string; days: number; el?: HTMLButtonElement }[] = this.buildQuickDateButtons();

		for (const btn of buttons) {
			btn.el = quickRow.createEl('button', {
				text: btn.label,
				cls: 'work-log-date-btn'
			});
			btn.el.addEventListener('click', () => {
				const date = moment().add(btn.days, 'days').format('YYYY-MM-DD');
				if (this.dueDate === date) {
					// Toggle off if already selected
					this.setDueDate('', buttons, null);
				} else {
					this.setDueDate(date, buttons, btn.el!);
				}
			});
		}

		const dateInput = section.createEl('input', {
			type: 'date',
			cls: 'work-log-due-date-input'
		});
		dateInput.addEventListener('change', () => {
			this.setDueDate(dateInput.value, buttons, null);
		});

		this.dueDateInput = dateInput;
	}

	private setDueDate(
		value: string,
		buttons: { label: string; el?: HTMLButtonElement }[],
		activeBtn: HTMLButtonElement | null
	): void {
		this.dueDate = value;
		if (this.dueDateInput) {
			this.dueDateInput.value = value;
		}
		for (const btn of buttons) {
			btn.el?.removeClass('work-log-date-btn-active');
		}
		if (activeBtn) {
			activeBtn.addClass('work-log-date-btn-active');
		}
		this.checkUrgencyThreshold();
	}

	private checkUrgencyThreshold(): void {
		if (!this.dueDate) {
			if (this.urgencyAutoSet) {
				this.urgent = false;
				this.urgencyAutoSet = false;
				this.updatePriorityUI();
			}
			return;
		}

		const due = moment(this.dueDate);
		const today = moment().startOf('day');
		const daysUntilDue = due.diff(today, 'days');

		if (daysUntilDue <= this.settings.taskUrgencyThresholdDays) {
			if (!this.urgent) {
				this.urgent = true;
				this.urgencyAutoSet = true;
				this.updatePriorityUI();
			}
		} else {
			if (this.urgencyAutoSet) {
				this.urgent = false;
				this.urgencyAutoSet = false;
				this.updatePriorityUI();
			}
		}
	}

	private createRelatedNoteField(container: HTMLElement): void {
		const setting = new Setting(container)
			.setName('Related note')
			.setDesc('Optional: Write task to a person/org/project note');

		const noteStatusEl = container.createDiv({ cls: 'work-log-note-status' });
		noteStatusEl.setText('\u00A0');

		setting.addText(text => {
			text.setPlaceholder('Start typing to search...');
			text.inputEl.addClass('work-log-related-note-input');

			this.noteSuggest = new NoteSuggest(this.app, text.inputEl);

			text.onChange((value: string) => {
				this.relatedNote = value;
				const trimmed = value.trim();
				if (!trimmed) {
					noteStatusEl.setText('\u00A0');
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

		const task: TaskEntry = {
			date: moment().format('YYYY-MM-DD'),
			description: processedDescription,
			urgent: this.urgent,
			important: this.important,
			dueDate: this.dueDate || undefined,
			relatedNote: this.relatedNote.trim() || undefined,
			timestamp: Date.now()
		};

		this.isSubmitting = true;
		if (this.submitBtn) {
			this.submitBtn.disabled = true;
			this.submitBtn.textContent = 'Creating...';
		}

		try {
			await this.onSubmit(task);
			this.close();
		} catch {
			this.isSubmitting = false;
			if (this.submitBtn) {
				this.submitBtn.disabled = false;
				this.submitBtn.textContent = 'Create Task';
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
