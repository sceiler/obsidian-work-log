// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, TFile } from '../__mocks__/obsidian';
import { LogManager } from '../log-manager';
import { ReviewInbox } from '../review-inbox';
import { ReviewModal } from '../review-modal';
import { parseSuggestion, serializeSuggestion } from '../suggestion';
import { DEFAULT_SETTINGS } from '../types';

// Obsidian's DOM convenience methods on a real DOM implementation.
Object.assign(HTMLElement.prototype, {
	createEl(this: HTMLElement, tag: string, options: any = {}) {
		const el = document.createElement(tag);
		if (options.text) el.textContent = options.text;
		if (options.cls) el.className = options.cls;
		for (const key of ['type', 'value', 'href']) if (options[key] !== undefined) (el as any)[key] = options[key];
		for (const [key, value] of Object.entries(options.attr ?? {})) el.setAttribute(key, String(value));
		this.appendChild(el);
		return el;
	},
	createDiv(this: HTMLElement, options: any) { return this.createEl('div', options); },
	createSpan(this: HTMLElement, options: any) { return this.createEl('span', options); },
	setText(this: HTMLElement, text: string) { this.textContent = text; },
	empty(this: HTMLElement) { this.replaceChildren(); },
	addClass(this: HTMLElement, ...classes: string[]) { this.classList.add(...classes); },
});

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>(done => { resolve = done; });
	return { promise, resolve };
}

describe('review window during slow vault writes', () => {
	let app: App;
	let inbox: ReviewInbox;
	let manager: LogManager;
	let modal: ReviewModal;
	let done = vi.fn(() => {});
	const path = (number: number) => `Work Log Inbox/wl-test-0${number}.md`;
	const cards = () => Array.from(document.querySelectorAll<HTMLElement>('article'));
	const button = (name: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(el => el.textContent?.startsWith(name))!;
	const select = (card: HTMLElement) => card.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
	const edit = (card: HTMLElement, text: string) => {
		const input = card.querySelector('textarea')!;
		input.value = text;
		input.dispatchEvent(new Event('input'));
	};
	const read = (number: number) => app.vault.read(new TFile(path(number)));

	beforeEach(async () => {
		app = new App();
		const settings = { ...DEFAULT_SETTINGS };
		manager = new LogManager(app as any, settings);
		inbox = new ReviewInbox(app as any, settings, manager);
		done = vi.fn();
		for (const number of [1, 2]) {
			app.vault._setFile(path(number), serializeSuggestion({ work_log_suggestion: 1, id: `wl-test-0${number}`,
				title: `Entry ${number}`, date: '2026-09-18', category: 'customer', related_notes: [], sources: [],
				status: 'pending', description: `Original ${number}` }));
		}
		modal = new ReviewModal(app as any, inbox, settings, done);
		modal.open();
		await vi.waitFor(() => expect(cards()).toHaveLength(2));
	});
	afterEach(() => { modal.close(); document.body.replaceChildren(); vi.restoreAllMocks(); });

	it('keeps other drafts and Close usable, preserving edits, focus and selection after submit', async () => {
		const gate = deferred();
		const write = manager.writeReviewedEntry.bind(manager);
		vi.spyOn(manager, 'writeReviewedEntry').mockImplementation(async (...args) => { await gate.promise; return write(...args); });
		const [first, second] = cards();
		select(first);
		button('Submit selected').click();
		await vi.waitFor(() => expect(manager.writeReviewedEntry).toHaveBeenCalled());
		expect(first.querySelector('fieldset')!.disabled).toBe(true);
		expect(second.querySelector('fieldset')!.disabled).toBe(false);
		expect(button('Close').disabled).toBe(false);
		expect(button('Submitting').disabled).toBe(true);
		select(second);
		second.querySelector('textarea')!.focus();
		edit(second, 'Edited while the other entry submits');
		gate.resolve();
		await vi.waitFor(() => expect(cards()).toHaveLength(1));
		expect(cards()[0]).toBe(second);
		expect(document.activeElement).toBe(second.querySelector('textarea'));
		expect(second.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
		await vi.waitFor(async () => expect(parseSuggestion(await read(2))?.description).toBe('Edited while the other entry submits'));
		expect(parseSuggestion(await read(1))?.status).toBe('applied');
	});

	it('does not wait for an unrelated draft save before or after submitting', async () => {
		const gate = deferred();
		const save = inbox.save.bind(inbox);
		vi.spyOn(inbox, 'save').mockImplementation(async (...args) => { await gate.promise; return save(...args); });
		const [first, second] = cards();
		edit(second, 'Slow unrelated edit');
		select(first);
		button('Submit selected').click();
		await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
		expect(cards()).toHaveLength(1);
		gate.resolve();
		await vi.waitFor(async () => expect(parseSuggestion(await read(2))?.description).toBe('Slow unrelated edit'));
	});

	it('combines typing during a slow save and submits the latest text', async () => {
		const gate = deferred();
		const save = inbox.save.bind(inbox);
		const saves = vi.spyOn(inbox, 'save').mockImplementation(async (...args) => { await gate.promise; return save(...args); });
		const first = cards()[0];
		edit(first, 'First edit');
		await vi.waitFor(() => expect(saves).toHaveBeenCalledOnce());
		for (let index = 0; index < 50; index++) edit(first, `Latest edit ${index}`);
		select(first);
		button('Submit selected').click();
		gate.resolve();
		await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
		expect(saves).toHaveBeenCalledTimes(2);
		expect(parseSuggestion(await read(1))?.submission?.entry.description).toBe('Latest edit 49');
	});

	it('can close during submission while approved writes finish in the background', async () => {
		const gate = deferred();
		const write = manager.writeReviewedEntry.bind(manager);
		vi.spyOn(manager, 'writeReviewedEntry').mockImplementation(async (...args) => { await gate.promise; return write(...args); });
		select(cards()[0]);
		button('Submit selected').click();
		await vi.waitFor(() => expect(manager.writeReviewedEntry).toHaveBeenCalled());
		button('Close').click();
		expect(document.querySelector('article')).toBeNull();
		gate.resolve();
		await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
		expect(parseSuggestion(await read(1))?.status).toBe('applied');
		expect(document.querySelector('article')).toBeNull();
	});

	it('keeps failed submissions locked and retryable without rebuilding other drafts', async () => {
		const write = vi.spyOn(manager, 'writeReviewedEntry').mockRejectedValueOnce(new Error('Disk failure'));
		const [first, second] = cards();
		select(first);
		button('Submit selected').click();
		await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
		expect(first.querySelector('fieldset')!.disabled).toBe(true);
		expect(first.textContent).toContain('submit again to retry');
		expect(second.querySelector('fieldset')!.disabled).toBe(false);
		expect(button('Submit selected').disabled).toBe(false);
		write.mockRestore();
		button('Submit selected').click();
		await vi.waitFor(() => expect(cards()).toHaveLength(1));
		expect(cards()[0]).toBe(second);
		expect(parseSuggestion(await read(1))?.status).toBe('applied');
	});

	it('keeps invalid pending entries editable and reports the validation error', async () => {
		const first = cards()[0];
		edit(first, '');
		select(first);
		button('Submit selected').click();
		await vi.waitFor(() => expect(done).toHaveBeenCalledOnce());
		expect(first.querySelector('fieldset')!.disabled).toBe(false);
		expect(first.textContent).toContain('Entry text is required');
		expect(parseSuggestion(await read(1))?.status).toBe('pending');
	});

	it('allows an unrelated draft to be dismissed while a submission is pending', async () => {
		const gate = deferred();
		const write = manager.writeReviewedEntry.bind(manager);
		vi.spyOn(manager, 'writeReviewedEntry').mockImplementation(async (...args) => { await gate.promise; return write(...args); });
		const [first, second] = cards();
		select(first);
		button('Submit selected').click();
		await vi.waitFor(() => expect(manager.writeReviewedEntry).toHaveBeenCalled());
		second.querySelector<HTMLButtonElement>(':scope > button')!.click();
		await vi.waitFor(async () => expect(parseSuggestion(await read(2))?.status).toBe('dismissed'));
		gate.resolve();
		await vi.waitFor(() => expect(cards()).toHaveLength(0));
	});
});
