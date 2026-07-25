import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function clamp(n: number, lo: number, hi: number): number {
	return Math.min(hi, Math.max(lo, n));
}

/**
 * Run at most once per animation frame, with the latest arguments. Slider
 * drags fire on every pointermove; each model write rebuilds the whole canvas,
 * so an unthrottled drag costs ~100 rebuilds a second.
 */
export function rafThrottle<A extends unknown[]>(fn: (...args: A) => void): (...args: A) => void {
	let frame = 0;
	let latest: A;
	return (...args: A) => {
		latest = args;
		if (frame) return;
		frame = requestAnimationFrame(() => {
			frame = 0;
			fn(...latest);
		});
	};
}

/** Open the native file picker; resolves null if the user cancels. */
export function pickFile(accept: string): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.oncancel = () => resolve(null);
		input.click();
	});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
