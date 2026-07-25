import { SIDEBAR_COOKIE_NAME } from '$lib/components/ui/sidebar/constants.js';
import type { LayoutServerLoad } from './$types.js';

export const load: LayoutServerLoad = async ({ cookies }) => {
	// Restore the sidebar open/closed state from its cookie so SSR renders the
	// correct initial state (no flash) and the choice persists across reloads.
	const cookie = cookies.get(SIDEBAR_COOKIE_NAME);
	return {
		sidebarOpen: cookie === undefined ? true : cookie === 'true'
	};
};
