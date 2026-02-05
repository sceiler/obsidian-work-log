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

export interface WorkLogSettings {
	// File settings
	logFilePath: string;
	dateFormat: string;

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
	dateFormat: 'YYYY-MM-DD',

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
};

export function getCategoryConfig(categories: CategoryConfig[], id: string): CategoryConfig | undefined {
	return categories.find(c => c.id === id);
}

export function getCategoryLabel(categories: CategoryConfig[], id: string): string {
	return getCategoryConfig(categories, id)?.label ?? id;
}
