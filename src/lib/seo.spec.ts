import { describe, expect, test } from 'bun:test';
import { DESCRIPTION, IMAGE_ALT, SCHEMA, SEO, SITE_URL, TITLE } from './seo';

describe('search copy stays within what search engines show', () => {
	test('the title is not truncated in a result', () => {
		// Google cuts around 60 characters; past that the tail is invisible
		expect(TITLE.length).toBeLessThanOrEqual(60);
		expect(TITLE.length).toBeGreaterThan(20);
	});

	test('the description is not truncated in a result', () => {
		expect(DESCRIPTION.length).toBeLessThanOrEqual(160);
		expect(DESCRIPTION.length).toBeGreaterThan(70);
	});

	test('both name the printers, which is what people search for', () => {
		expect(TITLE).toContain('NIIMBOT B1');
		expect(TITLE).toContain('Y50P');
	});
});

describe('the canonical URL', () => {
	test('is absolute, https, and ends in a slash so image URLs concatenate', () => {
		expect(SITE_URL.startsWith('https://')).toBe(true);
		expect(SITE_URL.endsWith('/')).toBe(true);
		// the head builds `${SEO.url}og.jpg`; a missing slash would break it
		expect(`${SEO.url}og.jpg`).toBe('https://printrow.lastra.us/og.jpg');
	});
});

describe('structured data', () => {
	test('serialises without a closing-tag sequence that would break the script', () => {
		// it is injected via {@html} inside a <script> tag, so a literal
		// "</script>" anywhere in the copy would end the block early
		expect(JSON.stringify(SCHEMA).toLowerCase()).not.toContain('</script');
	});

	test('is honest that printing needs Chromium', () => {
		expect(SCHEMA.browserRequirements).toMatch(/chromium/i);
	});

	test('says the same thing as the meta description', () => {
		expect(SCHEMA.description).toBe(DESCRIPTION);
	});
});

describe('the link preview image', () => {
	test('has alt text, for the readers that use it', () => {
		expect(IMAGE_ALT.length).toBeGreaterThan(20);
	});
});
