import { describe, it, expect, beforeEach } from 'vitest';
import { App, TFile, Vault, MetadataCache } from '../__mocks__/obsidian';
import { LogManager } from '../log-manager';
import { DEFAULT_SETTINGS, type WorkLogSettings, type LogEntry } from '../types';

// Cast our mock App to satisfy the Obsidian App type expected by LogManager
function createApp(): App {
	return new App();
}

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
	return {
		date: '2025-01-15',
		category: 'customer',
		description: 'Helped Acme Corp with deployment',
		timestamp: Date.UTC(2025, 0, 15, 14, 30),
		...overrides,
	};
}

function makeSettings(overrides: Partial<WorkLogSettings> = {}): WorkLogSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}

describe('LogManager', () => {
	let app: App;
	let settings: WorkLogSettings;
	let manager: LogManager;

	beforeEach(() => {
		app = createApp();
		settings = makeSettings();
		manager = new LogManager(app as any, settings);
	});

	// ── addEntry (insertEntryToLog) ──────────────────────────────────────

	describe('addEntry', () => {
		it('creates a new log file with header when file does not exist', async () => {
			const entry = makeEntry();
			await manager.addEntry(entry);

			const file = app.vault.getAbstractFileByPath('work-log.md')!;
			const content = await app.vault.read(file as TFile);

			expect(content).toContain('# work-log');
			expect(content).toContain('## [[2025-01-15]]');
			expect(content).toContain('**Customer**');
			expect(content).toContain('Helped Acme Corp with deployment');
		});

		it('appends to an existing date section', async () => {
			(app.vault as Vault)._setFile('work-log.md',
				`# work-log\n\n## [[2025-01-15]]\n\n- **Customer**: First entry\n`
			);

			await manager.addEntry(makeEntry({ description: 'Second entry' }));

			const content = await app.vault.read(new TFile('work-log.md'));
			expect(content).toContain('- **Customer**: First entry');
			expect(content).toContain('- **Customer**: Second entry');
			// Should only have one date heading
			const headingCount = (content.match(/## \[\[2025-01-15\]\]/g) ?? []).length;
			expect(headingCount).toBe(1);
		});

		it('separates entries with blank line when setting is on', async () => {
			(app.vault as Vault)._setFile('work-log.md',
				`# work-log\n\n## [[2025-01-15]]\n\n- **Customer**: First entry\n`
			);

			await manager.addEntry(makeEntry({ description: 'Second entry' }));

			const content = await app.vault.read(new TFile('work-log.md'));
			// Entries should be separated by blank line
			expect(content).toMatch(/First entry\n\n- \*\*Customer\*\*: Second entry/);
		});

		it('separates entries without blank line when setting is off', async () => {
			settings = makeSettings({ separateEntriesWithBlankLine: false });
			manager = new LogManager(app as any, settings);

			(app.vault as Vault)._setFile('work-log.md',
				`# work-log\n\n## [[2025-01-15]]\n\n- **Customer**: First entry\n`
			);

			await manager.addEntry(makeEntry({ description: 'Second entry' }));

			const content = await app.vault.read(new TFile('work-log.md'));
			expect(content).toMatch(/First entry\n- \*\*Customer\*\*: Second entry/);
		});

		it('creates new date sections in ascending chronological order', async () => {
			(app.vault as Vault)._setFile('work-log.md',
				`# work-log\n\n## [[2025-01-10]]\n\n- Entry A\n\n## [[2025-01-20]]\n\n- Entry C\n`
			);

			await manager.addEntry(makeEntry({ date: '2025-01-15', description: 'Entry B' }));

			const content = await app.vault.read(new TFile('work-log.md'));
			const idx10 = content.indexOf('2025-01-10');
			const idx15 = content.indexOf('2025-01-15');
			const idx20 = content.indexOf('2025-01-20');
			expect(idx10).toBeLessThan(idx15);
			expect(idx15).toBeLessThan(idx20);
		});

		it('appends new date section at end when it is the latest', async () => {
			(app.vault as Vault)._setFile('work-log.md',
				`# work-log\n\n## [[2025-01-10]]\n\n- Entry A\n`
			);

			await manager.addEntry(makeEntry({ date: '2025-01-20', description: 'Entry B' }));

			const content = await app.vault.read(new TFile('work-log.md'));
			const idx10 = content.indexOf('2025-01-10');
			const idx20 = content.indexOf('2025-01-20');
			expect(idx10).toBeLessThan(idx20);
		});

		it('uses plain-text date heading when workLogDateAsLink is false', async () => {
			settings = makeSettings({ workLogDateAsLink: false });
			manager = new LogManager(app as any, settings);

			await manager.addEntry(makeEntry());

			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('## 2025-01-15');
			expect(content).not.toContain('[[2025-01-15]]');
		});

		it('uses wiki-link date heading when workLogDateAsLink is true', async () => {
			await manager.addEntry(makeEntry());

			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('## [[2025-01-15]]');
		});

		it('respects different heading levels', async () => {
			settings = makeSettings({ workLogDateHeadingLevel: '###' });
			manager = new LogManager(app as any, settings);

			await manager.addEntry(makeEntry());

			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('### [[2025-01-15]]');
			expect(content).not.toMatch(/^## \[\[2025-01-15\]\]/m);
		});

		it('appends to existing date section between two date sections', async () => {
			(app.vault as Vault)._setFile('work-log.md',
				`# work-log\n\n## [[2025-01-10]]\n\n- Entry A\n\n## [[2025-01-20]]\n\n- Entry C\n`
			);

			await manager.addEntry(makeEntry({ date: '2025-01-10', description: 'Entry B' }));

			const content = await app.vault.read(new TFile('work-log.md'));
			expect(content).toContain('- Entry A');
			expect(content).toContain('- **Customer**: Entry B');
			// B should appear before the 2025-01-20 section
			const idxB = content.indexOf('Entry B');
			const idx20 = content.indexOf('2025-01-20');
			expect(idxB).toBeLessThan(idx20);
		});
	});

	// ── formatLogEntry ──────────────────────────────────────────────────

	describe('formatLogEntry (via addEntry)', () => {
		it('includes category when showCategoryInLog is true', async () => {
			await manager.addEntry(makeEntry());
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('- **Customer**: Helped Acme Corp');
		});

		it('excludes category when showCategoryInLog is false', async () => {
			settings = makeSettings({ showCategoryInLog: false });
			manager = new LogManager(app as any, settings);

			await manager.addEntry(makeEntry());
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('- Helped Acme Corp with deployment');
			expect(content).not.toContain('**Customer**');
		});

		it('includes related note link', async () => {
			await manager.addEntry(makeEntry({ relatedNote: 'Acme Corp' }));
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('[[Acme Corp]]');
		});

		it('formats with category + related note + timestamp', async () => {
			settings = makeSettings({ showTimestamps: true });
			manager = new LogManager(app as any, settings);

			await manager.addEntry(makeEntry({ relatedNote: 'Acme Corp' }));
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			// Pattern: - **Customer** ([[Acme Corp]], HH:mm): description
			expect(content).toMatch(/\*\*Customer\*\* \(\[\[Acme Corp\]\], \d{2}:\d{2}\):/);
		});

		it('formats with only related note (no category)', async () => {
			settings = makeSettings({ showCategoryInLog: false });
			manager = new LogManager(app as any, settings);

			await manager.addEntry(makeEntry({ relatedNote: 'Acme Corp' }));
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('- ([[Acme Corp]]): Helped Acme Corp');
		});

		it('formats with no metadata at all', async () => {
			settings = makeSettings({ showCategoryInLog: false });
			manager = new LogManager(app as any, settings);

			await manager.addEntry(makeEntry());
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('- Helped Acme Corp with deployment');
		});
	});

	// ── formatMultiLineDescription ──────────────────────────────────────

	describe('formatMultiLineDescription (via addEntry)', () => {
		it('keeps single-line description as-is', async () => {
			await manager.addEntry(makeEntry({ description: 'Simple entry' }));
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('Simple entry');
		});

		it('indents multi-line list items', async () => {
			const desc = 'Main task\n- Sub item 1\n- Sub item 2';
			await manager.addEntry(makeEntry({ description: desc }));
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('Main task\n  - Sub item 1\n  - Sub item 2');
		});

		it('filters blank lines from multi-line descriptions', async () => {
			const desc = 'Main task\n\n- Sub item 1\n\n- Sub item 2';
			await manager.addEntry(makeEntry({ description: desc }));
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			// Blank lines should be filtered out
			expect(content).not.toMatch(/Main task\n\n {2}- Sub item/);
			expect(content).toContain('Main task\n  - Sub item 1\n  - Sub item 2');
		});

		it('indents plain continuation lines', async () => {
			const desc = 'Main task\ncontinuation text';
			await manager.addEntry(makeEntry({ description: desc }));
			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			expect(content).toContain('Main task\n  continuation text');
		});
	});

	// ── addToRelatedNote (insertEntryToRelatedNote) ─────────────────────

	describe('addToRelatedNote', () => {
		it('creates a new related note when it does not exist', async () => {
			await manager.addToRelatedNote('John Doe', makeEntry());

			const file = app.vault.getAbstractFileByPath('References/John Doe.md');
			expect(file).toBeTruthy();
			const content = await app.vault.read(file as TFile);
			expect(content).toContain('## Notes');
			expect(content).toContain('### [[2025-01-15]]');
			expect(content).toContain('Helped Acme Corp with deployment');
		});

		it('throws when note is missing and createRelatedNoteIfMissing is false', async () => {
			settings = makeSettings({ createRelatedNoteIfMissing: false });
			manager = new LogManager(app as any, settings);

			await expect(manager.addToRelatedNote('John Doe', makeEntry()))
				.rejects.toThrow('Note "John Doe" not found');
		});

		it('inserts entry into existing section and date', async () => {
			const noteFile = new TFile('References/John Doe.md');
			(app.vault as Vault)._setFile('References/John Doe.md',
				`## Notes\n\n### [[2025-01-15]]\nFirst entry about John\n`
			);
			(app.metadataCache as MetadataCache)._setLinkResolution('John Doe', noteFile);

			await manager.addToRelatedNote('John Doe', makeEntry({ description: 'Second entry' }));

			const content = await app.vault.read(new TFile('References/John Doe.md'));
			expect(content).toContain('First entry about John');
			expect(content).toContain('Second entry');
		});

		it('creates new date subsection in ascending order', async () => {
			const noteFile = new TFile('References/John Doe.md');
			(app.vault as Vault)._setFile('References/John Doe.md',
				`## Notes\n\n### [[2025-01-10]]\nOld entry\n\n### [[2025-01-20]]\nFuture entry\n`
			);
			(app.metadataCache as MetadataCache)._setLinkResolution('John Doe', noteFile);

			await manager.addToRelatedNote('John Doe', makeEntry({ date: '2025-01-15', description: 'Middle entry' }));

			const content = await app.vault.read(new TFile('References/John Doe.md'));
			const idx10 = content.indexOf('2025-01-10');
			const idx15 = content.indexOf('2025-01-15');
			const idx20 = content.indexOf('2025-01-20');
			expect(idx10).toBeLessThan(idx15);
			expect(idx15).toBeLessThan(idx20);
		});

		it('appends date subsection at end when it is the latest', async () => {
			const noteFile = new TFile('References/John Doe.md');
			(app.vault as Vault)._setFile('References/John Doe.md',
				`## Notes\n\n### [[2025-01-10]]\nOld entry\n`
			);
			(app.metadataCache as MetadataCache)._setLinkResolution('John Doe', noteFile);

			await manager.addToRelatedNote('John Doe', makeEntry({ date: '2025-01-20' }));

			const content = await app.vault.read(new TFile('References/John Doe.md'));
			const idx10 = content.indexOf('2025-01-10');
			const idx20 = content.indexOf('2025-01-20');
			expect(idx10).toBeLessThan(idx20);
		});

		it('creates Notes section when it does not exist (no frontmatter)', async () => {
			const noteFile = new TFile('References/John Doe.md');
			(app.vault as Vault)._setFile('References/John Doe.md',
				`# John Doe\n\nSome content about John.\n`
			);
			(app.metadataCache as MetadataCache)._setLinkResolution('John Doe', noteFile);

			await manager.addToRelatedNote('John Doe', makeEntry());

			const content = await app.vault.read(new TFile('References/John Doe.md'));
			expect(content).toContain('## Notes');
			expect(content).toContain('### [[2025-01-15]]');
			// Notes section should appear before existing content
			const notesIdx = content.indexOf('## Notes');
			const existingIdx = content.indexOf('# John Doe');
			expect(notesIdx).toBeLessThan(existingIdx);
		});

		it('creates Notes section after frontmatter when present', async () => {
			const noteFile = new TFile('References/John Doe.md');
			(app.vault as Vault)._setFile('References/John Doe.md',
				`---\ntitle: John Doe\ntags: [person]\n---\n# John Doe\n\nSome content.\n`
			);
			(app.metadataCache as MetadataCache)._setLinkResolution('John Doe', noteFile);

			await manager.addToRelatedNote('John Doe', makeEntry());

			const content = await app.vault.read(new TFile('References/John Doe.md'));
			// Notes section should be after frontmatter
			const frontmatterEnd = content.indexOf('---\n# John Doe');
			const notesIdx = content.indexOf('## Notes');
			expect(notesIdx).toBeGreaterThan(frontmatterEnd);
		});

		it('respects related note date heading level setting', async () => {
			settings = makeSettings({ relatedNoteDateHeadingLevel: '####' });
			manager = new LogManager(app as any, settings);

			await manager.addToRelatedNote('John Doe', makeEntry());

			const file = app.vault.getAbstractFileByPath('References/John Doe.md');
			const content = await app.vault.read(file as TFile);
			expect(content).toContain('#### [[2025-01-15]]');
			expect(content).not.toMatch(/^### \[\[2025-01-15\]\]/m);
		});

		it('shows category in related note when showCategoryInRelatedNote is true', async () => {
			settings = makeSettings({ showCategoryInRelatedNote: true });
			manager = new LogManager(app as any, settings);

			await manager.addToRelatedNote('John Doe', makeEntry());

			const file = app.vault.getAbstractFileByPath('References/John Doe.md');
			const content = await app.vault.read(file as TFile);
			expect(content).toContain('**Customer**:');
		});

		it('does not show category in related note by default', async () => {
			await manager.addToRelatedNote('John Doe', makeEntry());

			const file = app.vault.getAbstractFileByPath('References/John Doe.md');
			const content = await app.vault.read(file as TFile);
			expect(content).not.toContain('**Customer**');
			expect(content).toContain('Helped Acme Corp with deployment');
		});
	});

	// ── findFrontmatterEnd (tested via addToRelatedNote) ────────────────

	describe('findFrontmatterEnd (via addToRelatedNote)', () => {
		it('handles no frontmatter', async () => {
			const noteFile = new TFile('References/Test.md');
			(app.vault as Vault)._setFile('References/Test.md', 'Just content');
			(app.metadataCache as MetadataCache)._setLinkResolution('Test', noteFile);

			await manager.addToRelatedNote('Test', makeEntry());
			const content = await app.vault.read(new TFile('References/Test.md'));
			// Notes section should be at the very beginning
			expect(content.startsWith('## Notes')).toBe(true);
		});

		it('handles frontmatter correctly', async () => {
			const noteFile = new TFile('References/Test.md');
			(app.vault as Vault)._setFile('References/Test.md',
				'---\ntitle: Test\n---\nContent here'
			);
			(app.metadataCache as MetadataCache)._setLinkResolution('Test', noteFile);

			await manager.addToRelatedNote('Test', makeEntry());
			const content = await app.vault.read(new TFile('References/Test.md'));
			// Frontmatter should still be at the start
			expect(content.startsWith('---')).toBe(true);
			// Notes section should come after frontmatter
			const notesIdx = content.indexOf('## Notes');
			expect(notesIdx).toBeGreaterThan(content.indexOf('---\n', 3));
		});

		it('handles malformed frontmatter (no closing ---)', async () => {
			const noteFile = new TFile('References/Test.md');
			(app.vault as Vault)._setFile('References/Test.md',
				'---\ntitle: Test\nContent without closing'
			);
			(app.metadataCache as MetadataCache)._setLinkResolution('Test', noteFile);

			await manager.addToRelatedNote('Test', makeEntry());
			const content = await app.vault.read(new TFile('References/Test.md'));
			// Should treat as no frontmatter — Notes section at start
			expect(content.startsWith('## Notes')).toBe(true);
		});
	});

	// ── updateSettings ──────────────────────────────────────────────────

	describe('updateSettings', () => {
		it('invalidates cached regex patterns on settings change', async () => {
			// First entry with ## headings
			await manager.addEntry(makeEntry({ date: '2025-01-10' }));

			// Change heading level and update
			settings = makeSettings({ workLogDateHeadingLevel: '###' });
			manager.updateSettings(settings);

			await manager.addEntry(makeEntry({ date: '2025-01-15' }));

			const content = await app.vault.read(
				app.vault.getAbstractFileByPath('work-log.md') as TFile
			);
			// New entry should use ### heading
			expect(content).toContain('### [[2025-01-15]]');
		});
	});
});
