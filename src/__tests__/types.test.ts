import { describe, it, expect } from 'vitest';
import { getCategoryConfig, getCategoryLabel, DEFAULT_CATEGORIES } from '../types';

describe('getCategoryConfig', () => {
	it('finds a category by ID', () => {
		const config = getCategoryConfig(DEFAULT_CATEGORIES, 'demo');
		expect(config).toBeDefined();
		expect(config!.label).toBe('Demo');
		expect(config!.description).toBe('Customer demos, presentations, workshops');
	});

	it('returns undefined for missing ID', () => {
		const config = getCategoryConfig(DEFAULT_CATEGORIES, 'nonexistent');
		expect(config).toBeUndefined();
	});

	it('finds each default category', () => {
		for (const cat of DEFAULT_CATEGORIES) {
			expect(getCategoryConfig(DEFAULT_CATEGORIES, cat.id)).toBe(cat);
		}
	});
});

describe('getCategoryLabel', () => {
	it('returns the label for a known category', () => {
		expect(getCategoryLabel(DEFAULT_CATEGORIES, 'customer')).toBe('Customer');
		expect(getCategoryLabel(DEFAULT_CATEGORIES, 'win')).toBe('Win');
	});

	it('falls back to the raw ID for unknown categories', () => {
		expect(getCategoryLabel(DEFAULT_CATEGORIES, 'unknown')).toBe('unknown');
		expect(getCategoryLabel(DEFAULT_CATEGORIES, 'my-custom-cat')).toBe('my-custom-cat');
	});

	it('works with custom categories', () => {
		const custom = [{ id: 'ops', label: 'Operations', description: '', placeholder: '' }];
		expect(getCategoryLabel(custom, 'ops')).toBe('Operations');
		expect(getCategoryLabel(custom, 'demo')).toBe('demo'); // not in custom list
	});
});
