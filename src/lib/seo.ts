/**
 * Search and link-preview copy, in one place so the title, the Open Graph
 * card, the Twitter card and the structured data cannot drift apart — which is
 * the usual failure, since nothing in a build catches a stale OG description.
 *
 * Lengths matter: Google truncates titles around 60 characters and
 * descriptions around 160, so `seo.spec.ts` guards both rather than leaving it
 * to whoever next edits the copy.
 */

export const SITE_URL = 'https://printrow.lastra.us/';

/** Kept under 60 characters. Leads with the brand, then the two models, which
 *  is what high-intent searches actually name. */
export const TITLE = 'printrow — label designer for NIIMBOT B1 and KNAON Y50P';

/** Kept under 160 characters. States what it does, then the three things that
 *  are genuinely different about it, all of them checkable facts. */
export const DESCRIPTION =
	'Design thermal labels in your browser and batch-print them from CSV over Web Bluetooth. No app, no drivers, no account — nothing leaves the browser.';

export const IMAGE_ALT =
	'The printrow editor: a yellow label carrying a package icon, a product name and a Code 128 barcode, with values resolved live from an imported CSV';

/**
 * schema.org SoftwareApplication. `browserRequirements` is honest about the
 * Chromium-only constraint rather than claiming the web at large — a listing
 * that overpromises just collects bounces from Safari.
 */
export const SCHEMA = {
	'@context': 'https://schema.org',
	'@type': 'SoftwareApplication',
	name: 'printrow',
	url: SITE_URL,
	description: DESCRIPTION,
	applicationCategory: 'DesignApplication',
	operatingSystem: 'Any',
	browserRequirements: 'Requires a Chromium browser with Web Bluetooth enabled',
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
	license: 'https://opensource.org/licenses/MIT',
	isAccessibleForFree: true,
	featureList: [
		'Canvas label editor with text, barcodes, QR, images, icons and boxes',
		'Bind {{variables}} straight to CSV columns, with no mapping step',
		'Batch print a whole CSV, a single row, or a range',
		'Prints to NIIMBOT B1 and KNAON Y50P over Web Bluetooth',
		'Runs entirely in the browser — no server, no install, no account'
	]
};

export const SEO = {
	url: SITE_URL,
	title: TITLE,
	description: DESCRIPTION,
	imageAlt: IMAGE_ALT,
	schema: SCHEMA
};
