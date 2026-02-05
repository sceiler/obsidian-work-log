// Categories tailored for Sales Engineer role
export type Category = 'demo' | 'customer' | 'technical' | 'collaboration' | 'win';

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

export const DEFAULT_SETTINGS: WorkLogSettings = {
	// File settings
	logFilePath: 'work-log.md',
	dateFormat: 'YYYY-MM-DD',

	// Entry settings
	defaultCategory: 'customer',
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

// Labels shown in UI and log entries
export const CATEGORY_LABELS: Record<Category, string> = {
	demo: 'Demo',
	customer: 'Customer',
	technical: 'Technical',
	collaboration: 'Collaboration',
	win: 'Win',
};

// Descriptions for each category (shown in dropdown)
export const CATEGORY_DESCRIPTIONS: Record<Category, string> = {
	demo: 'Customer demos, presentations, workshops',
	customer: 'Calls, support, follow-ups, relationships',
	technical: 'POCs, integrations, troubleshooting, docs',
	collaboration: 'Helping teammates, internal meetings, cross-team work',
	win: 'Deals closed, achievements, milestones, metrics',
};

// Placeholder examples for each category
export const CATEGORY_PLACEHOLDERS: Record<Category, string> = {
	demo: 'Delivered Next.js migration demo to Acme Corp',
	customer: 'Helped John Doe troubleshoot deployment issue',
	technical: 'Built POC for edge middleware integration',
	collaboration: 'Reviewed Sarah\'s demo script, shared feedback',
	win: 'Closed deal with Acme Corp - $50k ARR',
};
