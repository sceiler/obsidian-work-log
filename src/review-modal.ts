import { App, Modal, Notice } from 'obsidian';
import { NoteSuggest } from './note-suggest';
import { ReviewInbox } from './review-inbox';
import type { SuggestionEdit, SuggestionFile } from './suggestion';
import type { WorkLogSettings } from './types';

interface ReviewCard {
	file: SuggestionFile;
	draft: SuggestionEdit;
	selected: boolean;
	saving: Promise<void>;
	pendingEdit?: SuggestionEdit;
	busy: boolean;
	error: string;
	status: HTMLElement;
	element: HTMLElement;
	fields: HTMLFieldSetElement;
}

export class ReviewModal extends Modal {
	private cards: ReviewCard[] = [];
	private suggests: NoteSuggest[] = [];
	private submitting = false;
	private closed = false;
	private submitButton?: HTMLButtonElement;
	private message?: HTMLElement;
	constructor(app: App, private inbox: ReviewInbox, private settings: WorkLogSettings, private done: () => void) { super(app); }

	onOpen(): void {
		this.closed = false;
		this.modalEl.addClass('work-log-review-modal');
		void this.load().catch(error => this.showError(error));
	}

	private showError(error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		if (this.message && !this.closed) this.message.setText(message);
		new Notice(message);
	}

	private async load(): Promise<void> {
		const scan = await this.inbox.scan();
		if (this.closed) return;
		for (const suggest of this.suggests) suggest.close();
		this.suggests = [];
		this.cards = [];
		this.contentEl.empty();
		this.contentEl.createEl('h2', { text: 'Review work log suggestions' });
		this.contentEl.createEl('p', { text: 'Edit your drafts, select the entries to include, then submit. Draft edits save automatically.' });
		this.message = this.contentEl.createDiv({ cls: 'work-log-review-message', attr: { role: 'status', 'aria-live': 'polite' } });
		for (const error of scan.errors) {
			const line = this.contentEl.createDiv({ cls: 'work-log-error-msg' });
			line.createSpan({ text: `${error.path}: ${error.message} ` });
			const open = line.createEl('button', { text: 'Open file' });
			open.onclick = () => { void this.app.workspace.openLinkText(error.path, '', false); };
		}
		const active = scan.entries.filter(item => item.suggestion.status === 'pending' || item.suggestion.status === 'applying');
		if (!active.length) this.contentEl.createEl('p', { text: 'No suggestions waiting for review. Run $work-log-review in Codex to prepare a batch.' });
		const list = this.contentEl.createDiv({ cls: 'work-log-review-list' });
		for (const file of active) this.renderCard(list, file);
		const footer = this.contentEl.createDiv({ cls: 'work-log-review-footer' });
		const close = footer.createEl('button', { text: 'Close' });
		close.onclick = () => this.close();
		this.submitButton = footer.createEl('button', { text: 'Submit selected entries', cls: 'mod-cta' });
		this.submitButton.onclick = () => { void this.submit(); };
		this.updateSubmit();
	}

	private renderCard(container: HTMLElement, file: SuggestionFile): void {
		const suggestion = file.suggestion;
		const cardEl = container.createEl('article', { cls: 'work-log-review-card' });
		const header = cardEl.createDiv({ cls: 'work-log-review-heading' });
		const selectLabel = header.createEl('label');
		const checkbox = selectLabel.createEl('input', { type: 'checkbox' });
		selectLabel.createSpan({ text: suggestion.title || 'Untitled entry' });
		const status = cardEl.createDiv({ cls: 'work-log-review-save-status', attr: { role: 'status' } });
		const fields = cardEl.createEl('fieldset', { cls: 'work-log-review-fields' });
		const card: ReviewCard = {
			file, draft: { title: suggestion.title, date: suggestion.date, category: suggestion.category,
				related_notes: [...suggestion.related_notes], description: suggestion.description },
			selected: false, saving: Promise.resolve(), busy: false, error: '', status, element: cardEl, fields
		};
		this.cards.push(card);
		checkbox.onchange = () => { card.selected = checkbox.checked; this.updateSubmit(); };
		fields.createEl('legend', { text: 'Entry details', cls: 'work-log-sr-only' });
		fields.disabled = suggestion.status === 'applying';
		if (fields.disabled) status.setText('Submission started. Select this entry to retry the remaining writes. Its approved text is locked.');
		const row = fields.createDiv({ cls: 'work-log-review-row' });
		const dateLabel = row.createEl('label', { text: 'Date' });
		const date = dateLabel.createEl('input', { type: 'date', value: card.draft.date });
		date.oninput = () => { card.draft.date = date.value; this.save(card); };
		const catLabel = row.createEl('label', { text: 'Category' });
		const category = catLabel.createEl('select');
		if (!this.settings.categories.some(cat => cat.id === card.draft.category)) {
			category.createEl('option', { value: card.draft.category, text: `Choose category (${card.draft.category || 'missing'})` });
		}
		for (const cat of this.settings.categories) category.createEl('option', { value: cat.id, text: cat.label });
		category.value = card.draft.category;
		category.onchange = () => { card.draft.category = category.value; this.save(card); };
		const bodyLabel = fields.createEl('label', { text: 'Entry text' });
		const body = bodyLabel.createEl('textarea', { cls: 'work-log-review-text', attr: { rows: '5' } });
		body.value = card.draft.description;
		body.oninput = () => { card.draft.description = body.value; this.save(card); };
		const destinations = fields.createDiv({ cls: 'work-log-review-destinations' });
		const renderDestinations = () => {
			destinations.empty();
			destinations.createEl('p', { text: `Writes to: ${suggestion.submission?.log_path ?? this.settings.logFilePath}` });
			for (const path of card.draft.related_notes) {
				const chip = destinations.createDiv({ cls: 'work-log-review-destination' });
				chip.createSpan({ text: path });
				const remove = chip.createEl('button', { text: 'Remove', attr: { 'aria-label': `Remove ${path}` } });
				remove.onclick = () => { card.draft.related_notes = card.draft.related_notes.filter(item => item !== path); this.save(card); renderDestinations(); };
			}
		};
		renderDestinations();
		const addRow = fields.createDiv({ cls: 'work-log-review-row' });
		const noteLabel = addRow.createEl('label', { text: 'Also add to' });
		const target = noteLabel.createEl('input', { type: 'text', attr: { placeholder: 'Find a person, company, or project note' } });
		this.suggests.push(new NoteSuggest(this.app, target, true));
		const add = addRow.createEl('button', { text: 'Add note' });
		add.onclick = () => {
			const input = target.value.trim().replace(/^\[\[|\]\]$/g, '');
			const resolved = this.app.metadataCache.getFirstLinkpathDest(input, file.path);
			if (!resolved || resolved.extension !== 'md' || this.inbox.contains(resolved.path) || resolved.path === this.settings.logFilePath) {
				status.setText('Choose an existing person, company, or project note.'); return;
			}
			if (!card.draft.related_notes.includes(resolved.path)) {
				card.draft.related_notes.push(resolved.path); this.save(card); renderDestinations();
			}
			target.value = '';
		};
		const sources = cardEl.createEl('details', { cls: 'work-log-review-sources' });
		sources.createEl('summary', { text: `Sources (${suggestion.sources.length})` });
		const sourceList = sources.createEl('ul');
		for (const source of suggestion.sources) {
			const li = sourceList.createEl('li');
			const link = li.createEl('a', { text: source.label, href: /^https?:\/\//.test(source.target) ? source.target : '#',
				attr: { target: '_blank', rel: 'noopener noreferrer' } });
			if (!/^https?:\/\//.test(source.target)) link.onclick = event => {
				event.preventDefault(); void this.app.workspace.openLinkText(source.target, file.path, false);
			};
		}
		const dismiss = cardEl.createEl('button', { text: 'Dismiss' });
		dismiss.disabled = fields.disabled;
		dismiss.onclick = async () => {
			if (card.busy) return;
			this.setBusy(card, true);
			await card.saving;
			try {
				if (card.error) throw new Error(card.error);
				card.file = await this.inbox.dismiss(card.file);
				cardEl.remove(); this.cards = this.cards.filter(item => item !== card); this.updateSubmit(); this.done();
			} catch (error) { this.showError(error); }
			finally { this.setBusy(card, false); this.updateSubmit(); }
		};
	}

	private save(card: ReviewCard): void {
		// Keep only the newest edit while a disk write is in flight. Typing must not
		// leave one queued vault write per keystroke for submission to wait through.
		const alreadySaving = card.pendingEdit !== undefined;
		card.pendingEdit = { ...card.draft, related_notes: [...card.draft.related_notes] };
		card.status.setText('Saving draft…');
		if (alreadySaving) return;
		card.saving = card.saving.then(async () => {
			if (card.error) throw new Error(card.error);
			while (card.pendingEdit) {
				const edit = card.pendingEdit;
				card.file = await this.inbox.save(card.file, edit);
				if (card.pendingEdit === edit) card.pendingEdit = undefined;
			}
			card.status.setText('Draft saved');
		}).catch(error => {
			card.pendingEdit = undefined;
			card.error = error instanceof Error ? error.message : String(error);
			card.status.setText(`Draft not saved: ${card.error}`);
			if (this.closed) new Notice(`Work Log draft not saved: ${card.error}`);
		});
	}

	private updateSubmit(): void {
		if (!this.submitButton) return;
		const count = this.cards.filter(card => card.selected && !card.busy).length;
		this.submitButton.textContent = this.submitting ? 'Submitting entries…' : `Submit selected entries (${count})`;
		this.submitButton.disabled = !count || this.submitting;
	}

	private setBusy(card: ReviewCard, busy: boolean): void {
		card.busy = busy;
		card.fields.disabled = busy || card.file.suggestion.status !== 'pending';
		card.element.querySelector<HTMLInputElement>('input[type="checkbox"]')!.disabled = busy;
		const dismiss = card.element.querySelector<HTMLButtonElement>(':scope > button')!;
		dismiss.disabled = card.fields.disabled;
	}

	private async submit(): Promise<void> {
		if (this.submitting) return;
		const selected = this.cards.filter(card => card.selected && !card.busy);
		if (!selected.length) return;
		this.submitting = true;
		for (const card of selected) {
			this.setBusy(card, true);
			card.status.setText('Waiting to submit…');
		}
		this.updateSubmit();
		let applied = 0;
		const errors: string[] = [];
		try {
			for (const [index, card] of selected.entries()) {
				try {
					await card.saving;
					if (card.error) throw new Error(card.error);
					card.status.setText('Submitting…');
					if (!this.closed) this.message?.setText(`Submitting ${index + 1} of ${selected.length}… You can keep reviewing other drafts or close this window.`);
					card.file = await this.inbox.apply(card.file);
					applied++;
					card.element.remove();
					this.cards = this.cards.filter(item => item !== card);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					errors.push(`${card.draft.title}: ${message}`);
					// Recover a frozen, partly written submission for retry without
					// reloading unrelated cards and losing their edits or focus.
					try {
						const latest = (await this.inbox.scan()).entries.find(item => item.path === card.file.path);
						if (latest?.suggestion.status === 'applying') card.file = latest;
					} catch { /* Keep the stale version: approval will refuse to overwrite it. */ }
					card.status.setText(`Not submitted: ${message}${card.file.suggestion.status === 'applying' ? ' Approved text is locked; submit again to retry.' : ''}`);
				} finally { this.setBusy(card, false); }
			}
		} finally {
			this.submitting = false;
			this.updateSubmit();
			this.done();
		}
		const message = [`${applied} ${applied === 1 ? 'entry' : 'entries'} submitted.`, ...errors].join('\n');
		if (!this.closed) this.message?.setText(message);
		new Notice(message);
	}

	onClose(): void {
		this.closed = true;
		for (const suggest of this.suggests) suggest.close();
		this.contentEl.empty();
	}
}
