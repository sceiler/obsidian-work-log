import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, TFile } from '../__mocks__/obsidian';
import { LogManager } from '../log-manager';
import { ReviewInbox } from '../review-inbox';
import { parseSuggestion, safeVaultPath, serializeSuggestion, validDate, validSource, type Suggestion, type SuggestionFile } from '../suggestion';
import { DEFAULT_SETTINGS, type WorkLogSettings } from '../types';

const personPath = 'References/Alex Example.md';
const companyPath = 'References/Example Co.md';
const draftPath = 'Work Log Inbox/wl-example-01.md';
const originalPerson = '---\norg:\n  - "[[Example Co]]"\nemail: alex@example.com\n---\n\n## Personal\n\nExisting private notes.\n';
function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
	return { work_log_suggestion: 1, id: 'wl-example-01', title: 'Customer update', date: '2026-09-18', category: 'customer',
		related_notes: [personPath, companyPath], sources: [{ label: 'Meeting', target: 'Notes/2026-09-18 Example.md' }],
		status: 'pending', description: 'Agreed on the next step.\n- Follow-up context', ...overrides };
}

describe('Markdown review inbox', () => {
	let app: App;
	let settings: WorkLogSettings;
	let manager: LogManager;
	let inbox: ReviewInbox;
	const read = async (path: string) => app.vault.read(new TFile(path));
	async function stage(overrides: Partial<Suggestion> = {}): Promise<SuggestionFile> {
		const item = suggestion(overrides);
		const raw = serializeSuggestion(item);
		app.vault._setFile(draftPath, raw);
		return { path: draftPath, raw, suggestion: item };
	}
	beforeEach(() => {
		app = new App();
		settings = { ...DEFAULT_SETTINGS };
		manager = new LogManager(app as any, settings);
		inbox = new ReviewInbox(app as any, settings, manager);
		app.vault._setFile(personPath, originalPerson);
		app.vault._setFile(companyPath, '# Existing company page\n');
		app.vault._setFile('work-log.md', '# work-log\n\n## [[2026-09-17]]\n\n- Existing entry\n');
	});

	it('scans only the configured inbox, preserving unknown metadata and multiline text', async () => {
		await stage({ evidence_note: 'Directly reported by the user' });
		app.vault._setFile('Other/suggestion.md', serializeSuggestion(suggestion()));
		app.vault._setFile('Work Log Inbox/runs/coverage.md', '---\nwork_log_review_run: 1\n---\nCoverage');
		const result = await inbox.scan();
		expect(result.entries).toHaveLength(1);
		expect(result.errors).toHaveLength(0);
		expect(result.entries[0].suggestion.evidence_note).toBe('Directly reported by the user');
		expect(result.entries[0].suggestion.description).toBe(suggestion().description);
	});

	it('saves edits and dismissal without touching the work log or references', async () => {
		let item = await stage();
		const log = await read('work-log.md');
		item = await inbox.save(item, { ...item.suggestion, description: 'My own wording', related_notes: [personPath] });
		item = await inbox.dismiss(item);
		expect(parseSuggestion(await read(draftPath))?.status).toBe('dismissed');
		expect(parseSuggestion(await read(draftPath))?.description).toBe('My own wording');
		expect(await read('work-log.md')).toBe(log);
		expect(await read(personPath)).toBe(originalPerson);
		await expect(inbox.apply(item)).rejects.toThrow('dismissed');
	});

	it('writes reviewed text once to the log and every explicit target, preserving page content', async () => {
		const applied = await inbox.apply(await stage());
		expect(applied.suggestion.status).toBe('applied');
		expect(await read('work-log.md')).toContain('[[References/Alex Example]], [[References/Example Co]]');
		expect(await read(personPath)).toContain('### [[2026-09-18]]');
		expect(await read(personPath)).toContain(originalPerson.split('\n\n')[0]);
		expect(await read(personPath)).toContain('## Personal\n\nExisting private notes.');
		expect(await read(companyPath)).toContain('# Existing company page');
		await inbox.apply(applied);
		for (const path of ['work-log.md', personPath, companyPath]) {
			expect((await read(path)).split('<!-- work-log:suggestion:wl-example-01 -->')).toHaveLength(2);
		}
	});

	it('resumes after a related-note write fails without duplicating successful writes', async () => {
		const original = manager.writeReviewedEntry.bind(manager);
		const write = vi.spyOn(manager, 'writeReviewedEntry').mockImplementation(async (path, ...args) => {
			if (path === companyPath) throw new Error('Disk failure');
			return original(path, ...args);
		});
		await expect(inbox.apply(await stage())).rejects.toThrow('Disk failure');
		const partial = (await inbox.scan()).entries[0];
		expect(partial.suggestion.status).toBe('applying');
		await expect(inbox.save(partial, { ...partial.suggestion, description: 'Changed after approval' })).rejects.toThrow('pending');
		await expect(inbox.dismiss(partial)).rejects.toThrow('started');
		write.mockRestore();
		// Even a work-log setting change must not redirect an interrupted submission.
		settings.logFilePath = 'different-log.md';
		await inbox.apply(partial);
		expect(app.vault.getAbstractFileByPath('different-log.md')).toBeNull();
		for (const path of ['work-log.md', personPath, companyPath]) {
			expect((await read(path)).split('Agreed on the next step.')).toHaveLength(2);
		}
	});

	it('handles interruption after all destination writes but before status is saved', async () => {
		const process = app.vault.process.bind(app.vault);
		const spy = vi.spyOn(app.vault, 'process').mockImplementation(async (file, fn) => {
			if (file.path === draftPath) {
				const next = fn(await read(file.path));
				if (parseSuggestion(next)?.status === 'applied') throw new Error('Interrupted status write');
			}
			return process(file, fn);
		});
		await expect(inbox.apply(await stage())).rejects.toThrow('Interrupted');
		spy.mockRestore();
		await inbox.apply((await inbox.scan()).entries[0]);
		expect((await read('work-log.md')).split('Agreed on the next step.')).toHaveLength(2);
	});

	it('rejects stale edits and approval when the Markdown has changed elsewhere', async () => {
		const stale = await stage();
		const latest = await stage({ description: 'External edit' });
		await expect(inbox.save(stale, { ...stale.suggestion, description: 'Stale text' })).rejects.toThrow('changed elsewhere');
		await expect(inbox.apply(stale)).rejects.toThrow('changed elsewhere');
		expect(await read(draftPath)).toBe(latest.raw);
	});

	it('blocks duplicate IDs, including an already applied or dismissed copy', async () => {
		const item = await stage();
		app.vault._setFile('Work Log Inbox/duplicate.md', serializeSuggestion(suggestion({ status: 'dismissed' })));
		expect((await inbox.scan()).errors).toHaveLength(2);
		await expect(inbox.apply(item)).rejects.toThrow('duplicate');
	});

	it.each([
		{ date: '2026-02-30' }, { category: 'unknown' }, { description: '' },
		{ description: '<!-- work-log:suggestion:other -->' },
		{ related_notes: ['../outside.md'] }, { related_notes: ['.obsidian/config.md'] },
		{ related_notes: ['work-log.md'] }, { related_notes: [draftPath] },
		{ related_notes: ['References/Does not exist.md'] }
	])('blocks invalid submissions before writing anything: %j', async override => {
		const log = await read('work-log.md');
		const item = await stage(override);
		await expect(inbox.apply(item)).rejects.toThrow();
		expect(await read('work-log.md')).toBe(log);
		expect(await read(personPath)).toBe(originalPerson);
		expect(parseSuggestion(await read(draftPath))?.status).toBe('pending');
	});

	it('can submit a work-log-only entry and creates the log when absent', async () => {
		settings.logFilePath = 'New log.md';
		await inbox.apply(await stage({ related_notes: [] }));
		expect(await read('New log.md')).toContain('Agreed on the next step.');
		expect(await read(personPath)).toBe(originalPerson);
	});

	it('reports malformed drafts while allowing other entries to be reviewed', async () => {
		await stage();
		app.vault._setFile('Work Log Inbox/bad.md', '---\nwork_log_suggestion: 2\n---\nUnsupported');
		const result = await inbox.scan();
		expect(result.entries).toHaveLength(1);
		expect(result.errors).toHaveLength(1);
	});
});

describe('suggestion input validation', () => {
	it('accepts real dates and safe links', () => {
		expect(validDate('2024-02-29')).toBe(true);
		expect(validDate('2026-02-29')).toBe(false);
		expect(safeVaultPath('References/Anton Wörle.md')).toBe(true);
		expect(validSource('https://example.com/call?id=1')).toBe(true);
		expect(validSource('javascript:alert(1)')).toBe(false);
		expect(validSource('file:///private/file.md')).toBe(false);
		expect(validSource('Notes/Example.md')).toBe(true);
	});
	it('rejects unquoted YAML dates and unsafe sources', () => {
		const raw = serializeSuggestion(suggestion());
		expect(() => parseSuggestion(raw.replace(/date: ['"]?2026-09-18['"]?/, 'date: 2026-09-18'))).toThrow('quoted string');
		expect(() => parseSuggestion(serializeSuggestion(suggestion({ sources: [{ label: 'Unsafe', target: 'javascript:alert(1)' }] })))).toThrow('sources');
	});
});
