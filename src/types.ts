export type Category = string;

export interface CategoryConfig {
	id: string;
	label: string;
	description: string;
	placeholder: string;
}

export interface LogEntry {
	date: string;           // YYYY-MM-DD format
	category: Category;
	description: string;
	relatedNote?: string;   // Note name to also log this entry to (e.g., "John Doe")
	timestamp: number;      // Unix timestamp for ordering within same day
}

export interface TaskEntry {
	date: string;              // YYYY-MM-DD (creation date / which journal it belongs to)
	description: string;
	urgent: boolean;
	important: boolean;
	dueDate?: string;          // YYYY-MM-DD
	relatedNote?: string;      // Note name (task line written to this note)
	timestamp: number;
}

export interface WorkLogSettings {
	// File settings
	logFilePath: string;

	// Entry settings
	defaultCategory: Category;
	categories: CategoryConfig[];
	showTimestamps: boolean;
	showCategoryInLog: boolean;
	showCategoryInRelatedNote: boolean;

	// Auto-linking
	enableAutoLink: boolean;

	// Related notes
	createRelatedNoteIfMissing: boolean;
	newRelatedNoteFolder: string;
	relatedNoteSectionHeading: string;
	relatedNoteDateHeadingLevel: '###' | '####';

	// Work log formatting
	workLogDateHeadingLevel: '##' | '###';
	workLogDateAsLink: boolean;

	// Entry separators
	separateEntriesWithBlankLine: boolean;

	// Task settings
	taskJournalFolder: string;
	taskJournalSuffix: string;
	tasksMocPath: string;
	taskUrgencyThresholdDays: number;
	taskSectionHeading: string;
	taskJournalSectionHeading: string;
}

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
	{
		id: 'demo',
		label: 'Demo',
		description: 'Customer demos, presentations, workshops',
		placeholder: 'Delivered Next.js migration demo to Acme Corp',
	},
	{
		id: 'customer',
		label: 'Customer',
		description: 'Calls, support, follow-ups, relationships',
		placeholder: 'Helped John Doe troubleshoot deployment issue',
	},
	{
		id: 'technical',
		label: 'Technical',
		description: 'POCs, integrations, troubleshooting, docs',
		placeholder: 'Built POC for edge middleware integration',
	},
	{
		id: 'collaboration',
		label: 'Collaboration',
		description: 'Helping teammates, internal meetings, cross-team work',
		placeholder: 'Reviewed Sarah\'s demo script, shared feedback',
	},
	{
		id: 'win',
		label: 'Win',
		description: 'Deals closed, achievements, milestones, metrics',
		placeholder: 'Closed deal with Acme Corp - $50k ARR',
	},
];

export const DEFAULT_SETTINGS: WorkLogSettings = {
	// File settings
	logFilePath: 'work-log.md',

	// Entry settings
	defaultCategory: 'customer',
	categories: DEFAULT_CATEGORIES,
	showTimestamps: false,
	showCategoryInLog: true,
	showCategoryInRelatedNote: false,

	// Auto-linking
	enableAutoLink: true,

	// Related notes
	createRelatedNoteIfMissing: true,
	newRelatedNoteFolder: 'References',
	relatedNoteSectionHeading: '## Notes',
	relatedNoteDateHeadingLevel: '###',

	// Work log formatting
	workLogDateHeadingLevel: '##',
	workLogDateAsLink: true,

	// Entry separators
	separateEntriesWithBlankLine: true,

	// Task settings
	taskJournalFolder: '',
	taskJournalSuffix: ' Journal',
	tasksMocPath: 'Tasks.md',
	taskUrgencyThresholdDays: 3,
	taskSectionHeading: '## Tasks',
	taskJournalSectionHeading: '## Tasks',
};

export function getCategoryConfig(categories: CategoryConfig[], id: string): CategoryConfig | undefined {
	return categories.find(c => c.id === id);
}

export function getCategoryLabel(categories: CategoryConfig[], id: string): string {
	return getCategoryConfig(categories, id)?.label ?? id;
}

/**
 * Map Eisenhower quadrant to Obsidian Tasks priority (dataview format).
 * Urgency ranks higher than importance.
 */
export function eisenhowerToPriority(urgent: boolean, important: boolean): string {
	if (urgent && important) return 'highest'; // Q1: Do First
	if (urgent && !important) return 'high';   // Q2: Delegate
	if (!urgent && important) return 'low';    // Q3: Schedule
	return '';                                  // Q4: Low Priority — none
}

/**
 * Format a TaskEntry as a markdown task line compatible with Obsidian Tasks plugin.
 * Uses dataview inline field format: [created:: date], [due:: date], [priority:: level]
 */
export function formatTaskLine(task: TaskEntry): string {
	const parts: string[] = [`- [ ] ${task.description}`];

	const priority = eisenhowerToPriority(task.urgent, task.important);
	if (priority) {
		parts.push(`[priority:: ${priority}]`);
	}

	if (task.dueDate) {
		parts.push(`[due:: ${task.dueDate}]`);
	}

	parts.push(`[created:: ${task.date}]`);

	return parts.join(' ');
}
