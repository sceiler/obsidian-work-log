import { parseYaml, stringifyYaml } from 'obsidian';
import type { LogEntry } from './types';

export interface SuggestionSource { label: string; target: string; }
export type SuggestionStatus = 'pending' | 'applying' | 'applied' | 'dismissed';
export interface Submission {
	log_path: string;
	related_notes: string[];
	entry: LogEntry;
}
export interface Suggestion {
	work_log_suggestion: 1;
	id: string;
	title: string;
	date: string;
	category: string;
	related_notes: string[];
	sources: SuggestionSource[];
	status: SuggestionStatus;
	description: string;
	submission?: Submission;
	[key: string]: unknown;
}
export interface SuggestionFile { path: string; raw: string; suggestion: Suggestion; }
export type SuggestionEdit = Pick<Suggestion, 'title' | 'date' | 'category' | 'related_notes' | 'description'>;

export function safeVaultPath(path: string): boolean {
	return !!path && path.trim() === path && !/[\\:#|[\]\n\r\0]/.test(path)
		&& path.split('/').every(part => !!part && part !== '..' && !part.startsWith('.'));
}

export function validDate(date: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
	const parsed = new Date(`${date}T00:00:00Z`);
	return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function validSource(target: string): boolean {
	if (/^https?:\/\//.test(target)) {
		try { return !!new URL(target).hostname; } catch { return false; }
	}
	return safeVaultPath(target) && target.endsWith('.md');
}

function object(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}
function strings(value: unknown): value is string[] {
	return Array.isArray(value) && value.every(item => typeof item === 'string');
}

/** Parsing permits incomplete editable fields; submission performs strict validation. */
export function parseSuggestion(raw: string): Suggestion | null {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
	if (!match) return null;
	const meta: unknown = parseYaml(match[1]);
	if (!object(meta) || meta.work_log_suggestion === undefined) return null;
	if (meta.work_log_suggestion !== 1) throw new Error('Unsupported suggestion version');
	if (typeof meta.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}$/.test(meta.id)) throw new Error('Invalid suggestion ID');
	for (const field of ['title', 'date', 'category']) {
		if (typeof meta[field] !== 'string') throw new Error(`${field} must be a quoted string`);
	}
	if (!strings(meta.related_notes)) throw new Error('related_notes must be a list of paths');
	if (!Array.isArray(meta.sources) || !meta.sources.every(source => object(source)
		&& typeof source.label === 'string' && typeof source.target === 'string' && validSource(source.target))) {
		throw new Error('sources must contain labels and HTTP(S) URLs or vault Markdown paths');
	}
	if (!['pending', 'applying', 'applied', 'dismissed'].includes(String(meta.status))) throw new Error('Invalid review status');
	if (meta.status === 'applying' || meta.status === 'applied') {
		const submission = meta.submission;
		if (!object(submission) || typeof submission.log_path !== 'string' || !safeVaultPath(submission.log_path)
			|| !submission.log_path.endsWith('.md') || !strings(submission.related_notes)
			|| !submission.related_notes.every(path => safeVaultPath(path) && path.endsWith('.md'))
			|| !object(submission.entry) || typeof submission.entry.description !== 'string'
			|| typeof submission.entry.date !== 'string' || !validDate(submission.entry.date)
			|| typeof submission.entry.category !== 'string' || typeof submission.entry.timestamp !== 'number'
			|| !strings(submission.entry.relatedNotes)) throw new Error('Invalid saved submission');
	}
	return { ...meta, description: raw.slice(match[0].length).trim() } as Suggestion;
}

export function serializeSuggestion(suggestion: Suggestion): string {
	const { description, ...metadata } = suggestion;
	return `---\n${stringifyYaml(metadata).trimEnd()}\n---\n\n${description.trim()}\n`;
}
