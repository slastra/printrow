import { plugin } from 'bun';
import { compileModule } from 'svelte/compiler';

/**
 * Let `bun test` import `.svelte.ts` modules. Bun would otherwise load them as
 * plain TypeScript, and `$state` and friends would be undefined at runtime.
 * Strip the types first, then hand the result to Svelte's module compiler, the
 * same two steps vite-plugin-svelte takes.
 */
plugin({
	name: 'svelte-runes',
	setup(build) {
		const strip = new Bun.Transpiler({ loader: 'ts' });
		build.onLoad({ filter: /\.svelte\.ts$/ }, async ({ path }) => {
			const source = strip.transformSync(await Bun.file(path).text());
			const { js } = compileModule(source, { filename: path, generate: 'client', dev: false });
			return { contents: js.code, loader: 'js' };
		});
	}
});
