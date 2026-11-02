import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../__mocks__/obsidian';
import { AutoLinker } from '../auto-linker';

describe('AutoLinker', () => {
	let app: App;
	let linker: AutoLinker;

	beforeEach(() => {
		app = new App();
		linker = new AutoLinker(app as any);
	});

	/**
	 * Helper: add notes to the index and rebuild patterns.
	 * Uses private API via `as any` — standard TypeScript testing pattern.
	 */
	function addNotes(...names: string[]): void {
		for (const name of names) {
			(linker as any).noteNames.add(name);
			(linker as any).noteNamesLower.set(name.toLowerCase(), name);
		}
		(linker as any).rebuildSortedList();
	}

	// ── Basic linking ───────────────────────────────────────────────────

	describe('processText', () => {
		it('links a known note name', () => {
			addNotes('Acme Corp');
			expect(linker.processText('Met with Acme Corp today'))
				.toBe('Met with [[Acme Corp]] today');
		});

		it('returns text unchanged when no notes are indexed', () => {
			const text = 'Just some text';
			expect(linker.processText(text)).toBe(text);
		});

		it('returns empty string unchanged', () => {
			addNotes('Acme Corp');
			expect(linker.processText('')).toBe('');
		});

		it('links multiple different note names in one string', () => {
			addNotes('Acme Corp', 'John Doe');
			const result = linker.processText('Met John Doe at Acme Corp');
			expect(result).toContain('[[John Doe]]');
			expect(result).toContain('[[Acme Corp]]');
		});

		it('links multiple occurrences of the same name', () => {
			addNotes('Acme Corp');
			const result = linker.processText('Acme Corp loves Acme Corp');
			// Both should be linked
			const matches = result.match(/\[\[Acme Corp\]\]/g);
			expect(matches).toHaveLength(2);
		});
	});

	// ── Case handling ───────────────────────────────────────────────────

	describe('case-insensitive matching', () => {
		it('matches case-insensitively and uses alias syntax', () => {
			addNotes('Acme Corp');
			const result = linker.processText('Talked to acme corp');
			expect(result).toBe('Talked to [[Acme Corp|acme corp]]');
		});

		it('preserves original case when it matches exactly', () => {
			addNotes('Acme Corp');
			const result = linker.processText('Talked to Acme Corp');
			expect(result).toBe('Talked to [[Acme Corp]]');
		});
	});

	// ── Existing links preserved ────────────────────────────────────────

	describe('existing links', () => {
		it('does not double-link existing [[wiki links]]', () => {
			addNotes('Acme Corp');
			const text = 'Already linked [[Acme Corp]] here';
			expect(linker.processText(text)).toBe(text);
		});

		it('does not double-link [[alias|display]] links', () => {
			addNotes('Acme Corp');
			const text = 'See [[Acme Corp|the company]]';
			expect(linker.processText(text)).toBe(text);
		});

		it('links unlinked occurrences while preserving linked ones', () => {
			addNotes('Acme Corp');
			const result = linker.processText('[[Acme Corp]] and Acme Corp');
			expect(result).toBe('[[Acme Corp]] and [[Acme Corp]]');
		});
	});

	// ── URL protection ──────────────────────────────────────────────────

	describe('URL protection', () => {
		it('does not corrupt URLs containing note names', () => {
			addNotes('docs');
			const text = 'See https://example.com/docs/guide for info';
			const result = linker.processText(text);
			expect(result).toContain('https://example.com/docs/guide');
		});

		it('preserves multiple URLs', () => {
			addNotes('test');
			const text = 'Visit https://a.com/test and https://b.com/test';
			const result = linker.processText(text);
			expect(result).toContain('https://a.com/test');
			expect(result).toContain('https://b.com/test');
		});
	});

	// ── Short names skipped ─────────────────────────────────────────────

	describe('short name filtering', () => {
		it('skips names shorter than 3 characters', () => {
			addNotes('AI', 'ML');
			const text = 'Discussed AI and ML trends';
			expect(linker.processText(text)).toBe(text);
		});

		it('links names with exactly 3 characters', () => {
			addNotes('Bob');
			expect(linker.processText('Met Bob')).toBe('Met [[Bob]]');
		});
	});

	// ── Longest match wins ──────────────────────────────────────────────

	describe('longest match wins', () => {
		it('prefers longer match over shorter', () => {
			addNotes('John', 'John Doe', 'John Doe Smith');
			const result = linker.processText('Met John Doe Smith today');
			expect(result).toBe('Met [[John Doe Smith]] today');
		});

		it('links shorter name when longer name is not present in text', () => {
			addNotes('John', 'John Doe', 'John Doe Smith');
			const result = linker.processText('Met John today');
			expect(result).toBe('Met [[John]] today');
		});
	});

	// ── Word boundary behavior ──────────────────────────────────────────

	describe('word boundaries', () => {
		it('does not link partial word matches', () => {
			addNotes('Test');
			const text = 'This is a TestCase and Testing scenario';
			// "Test" appears as part of "TestCase" and "Testing" — should not link
			expect(linker.processText(text)).toBe(text);
		});

		it('links when surrounded by non-word characters', () => {
			addNotes('Test');
			expect(linker.processText('Run Test now')).toBe('Run [[Test]] now');
			expect(linker.processText('(Test)')).toBe('([[Test]])');
		});
	});

	// ── noteExists ──────────────────────────────────────────────────────

	describe('noteExists', () => {
		it('returns true for indexed notes (case-insensitive)', () => {
			addNotes('Acme Corp');
			expect(linker.noteExists('Acme Corp')).toBe(true);
			expect(linker.noteExists('acme corp')).toBe(true);
			expect(linker.noteExists('ACME CORP')).toBe(true);
		});

		it('returns false for non-indexed notes', () => {
			addNotes('Acme Corp');
			expect(linker.noteExists('Unknown Note')).toBe(false);
		});
	});

	// ── getNoteCount ────────────────────────────────────────────────────

	describe('getNoteCount', () => {
		it('returns the number of indexed notes', () => {
			expect(linker.getNoteCount()).toBe(0);
			addNotes('Acme Corp', 'John Doe');
			expect(linker.getNoteCount()).toBe(2);
		});
	});
});
