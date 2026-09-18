import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseSuggestion, serializeSuggestion } from '../suggestion';

const helper = resolve('skills/work-log-review/scripts/stage.py');
describe('Codex staging helper → plugin handoff', () => {
	let root: string;
	let vault: string;
	let input: string;
	let batch: any;
	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'work-log-skill-'));
		vault = join(root, 'vault'); input = join(root, 'batch.json');
		mkdirSync(join(vault, '.obsidian/plugins/work-log'), { recursive: true });
		mkdirSync(join(vault, 'References'));
		writeFileSync(join(vault, 'References/Alex Example.md'), '# Existing person');
		writeFileSync(join(vault, '.obsidian/plugins/work-log/data.json'), JSON.stringify({
			reviewInboxFolder: 'Review drafts', logFilePath: 'work-log.md', categories: [{ id: 'feedback' }]
		}));
		batch = {
			period: { start: '2026-09-18', end: '2026-09-18' },
			coverage: Object.fromEntries(['gmail', 'slack', 'index', 'notes'].map(name => [name, { status: 'checked', detail: 'Synthetic test fixture.' }])),
			entries: [{ event_key: 'fixture:call-123:feedback', title: 'A useful update', date: '2026-09-18', category: 'feedback',
				related_notes: ['References/Alex Example.md'], sources: [{ label: 'Context', target: 'https://example.com/call' }],
				description: 'Shared feedback with [[Alex Example]].\n- Preserved ö and a second line.' }]
		};
	});
	afterEach(() => rmSync(root, { recursive: true, force: true }));
	function run(...flags: string[]) {
		writeFileSync(input, JSON.stringify(batch));
		return JSON.parse(execFileSync('python3', [helper, '--vault', vault, '--input', input, ...flags], { encoding: 'utf8' }));
	}

	it('dry-runs without writes, then publishes Markdown the plugin can parse', () => {
		const preview = run('--dry-run');
		expect(preview.created).toHaveLength(1);
		expect(existsSync(join(vault, 'Review drafts'))).toBe(false);
		const result = run();
		const parsed = parseSuggestion(readFileSync(join(vault, result.created[0]), 'utf8'))!;
		expect(parsed.description).toBe(batch.entries[0].description);
		expect(parsed.status).toBe('pending');
		expect(parsed.date).toBe('2026-09-18');
		expect(parsed.related_notes).toEqual(['References/Alex Example.md']);
		expect(readFileSync(join(vault, result.report), 'utf8')).toContain('Source coverage');
		expect(existsSync(join(vault, 'work-log.md'))).toBe(false);
	});

	it('never overwrites an existing draft or dismissed entry even if wording changes', () => {
		const first = run();
		const path = join(vault, first.created[0]);
		const item = parseSuggestion(readFileSync(path, 'utf8'))!;
		const edited = serializeSuggestion({ ...item, status: 'dismissed', description: 'My edited words' });
		writeFileSync(path, edited);
		batch.entries[0].description = 'Different generated wording';
		const second = run();
		expect(second.created).toEqual([]);
		expect(second.skipped).toEqual(first.created);
		expect(readFileSync(path, 'utf8')).toBe(edited);
	});

	it('validates the whole batch before writing any suggestions', () => {
		batch.entries.push({ ...batch.entries[0], event_key: 'second-event', related_notes: ['References/Missing.md'] });
		writeFileSync(input, JSON.stringify(batch));
		const result = spawnSync('python3', [helper, '--vault', vault, '--input', input], { encoding: 'utf8' });
		expect(result.status).toBe(1);
		expect(existsSync(join(vault, 'Review drafts'))).toBe(false);
	});

	it('blocks a symlinked inbox escaping the vault', () => {
		const outside = join(root, 'outside'); mkdirSync(outside);
		symlinkSync(outside, join(vault, 'Review drafts'));
		writeFileSync(input, JSON.stringify(batch));
		const result = spawnSync('python3', [helper, '--vault', vault, '--input', input], { encoding: 'utf8' });
		expect(result.status).toBe(1);
		expect(readdirSync(outside)).toEqual([]);
	});

	it('records unavailable sources and supports a run with no suggestions', () => {
		batch.entries = [];
		batch.coverage.gmail = { status: 'unavailable', detail: 'No connected Gmail reader.' };
		const result = run();
		expect(result.created).toEqual([]);
		expect(readFileSync(join(vault, result.report), 'utf8')).toContain('No connected Gmail reader.');
	});
});
