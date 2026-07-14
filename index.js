import initialize, {
	__mdToHtmlWithCodefenceRenderersOwned,
	__mdToHtmlWithPluginsOwned,
	PreparedOptions as GeneratedPreparedOptions,
	initSync as initializeSync,
	mdToXml as renderXml,
} from "./pkg/comrak.js";

export {
	ansiThemeAuto,
	ansiThemeDark,
	ansiThemeLight,
	CodefenceRenderer,
	comrakVersion,
	detectColorScheme,
	getFrontmatter,
	HeadingAdapter,
	healMarkdown,
	mdToAnsi,
	mdToAnsiWithTheme,
	mdToCommonmark,
	mdToHtml,
	mdToHtmlWithRewriters,
	mdToText,
	mdToXml,
	PreparedAnsiTheme,
	PreparedCodefenceRenderers,
	SyntaxHighlighter,
} from "./pkg/comrak.js";

/** @typedef {import("./pkg/comrak.js").InitInput} InitInput */
/** @typedef {import("./pkg/comrak.js").InitOutput} InitOutput */
/** @typedef {import("./pkg/comrak.js").SyncInitInput} SyncInitInput */
/** @typedef {import("./types.d.ts").ComrakOptions} ComrakOptionsInput */
/** @typedef {import("./types.d.ts").SyntaxHighlighter} SyntaxHighlighterHandle */
/** @typedef {import("./types.d.ts").HeadingAdapter} HeadingAdapterHandle */
/** @typedef {import("./types.d.ts").CodefenceRenderers} CodefenceRendererMap */
/** @typedef {import("./types.d.ts").PreparedCodefenceRenderers} PreparedCodefenceRendererHandle */

/** @type {Promise<InitOutput> | undefined} */
let initializationPromise;
/** @type {InitOutput | undefined} */
let initializedOutput;

/**
 * Initialize the Wasm module once. Concurrent callers share the same in-flight
 * initialization; the first call determines the module input.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>} [moduleOrPath]
 * @returns {Promise<InitOutput>}
 */
export default function init(moduleOrPath) {
	if (initializedOutput) return Promise.resolve(initializedOutput);
	if (!initializationPromise) {
		initializationPromise = initialize(moduleOrPath).then(
			(output) => {
				initializedOutput = output;
				return output;
			},
			(error) => {
				initializationPromise = undefined;
				throw error;
			},
		);
	}
	return initializationPromise;
}

/**
 * Initialize synchronously unless asynchronous initialization is in flight.
 *
 * @param {{ module: SyncInitInput } | SyncInitInput} module
 * @returns {InitOutput}
 */
export function initSync(module) {
	if (initializationPromise && !initializedOutput) {
		throw new Error(
			"cannot call initSync while asynchronous initialization is in progress",
		);
	}
	const output = initializeSync(module);
	initializedOutput = output;
	initializationPromise ??= Promise.resolve(output);
	return output;
}

/**
 * @template T
 * @param {{ clone(): T } | null | undefined} adapter
 * @returns {T | undefined}
 */
function cloneAdapter(adapter) {
	return adapter == null ? undefined : adapter.clone();
}

export class PreparedOptions extends GeneratedPreparedOptions {
	/**
	 * @param {string} markdown
	 * @param {SyntaxHighlighterHandle | null | undefined} syntaxHighlighter
	 * @param {HeadingAdapterHandle | null | undefined} headingAdapter
	 * @returns {string}
	 */
	mdToHtmlWithPlugins(markdown, syntaxHighlighter, headingAdapter) {
		return this.__mdToHtmlWithPluginsOwned(
			markdown,
			cloneAdapter(syntaxHighlighter),
			cloneAdapter(headingAdapter),
		);
	}

	/**
	 * @param {string} markdown
	 * @param {PreparedCodefenceRendererHandle} renderers
	 * @param {SyntaxHighlighterHandle | null | undefined} syntaxHighlighter
	 * @param {HeadingAdapterHandle | null | undefined} headingAdapter
	 * @returns {string}
	 */
	mdToHtmlWithCodefenceRenderers(
		markdown,
		renderers,
		syntaxHighlighter,
		headingAdapter,
	) {
		return this.__mdToHtmlWithCodefenceRenderersOwned(
			markdown,
			renderers,
			cloneAdapter(syntaxHighlighter),
			cloneAdapter(headingAdapter),
		);
	}
}

/**
 * @param {string} markdown
 * @param {ComrakOptionsInput | null | undefined} options
 * @param {SyntaxHighlighterHandle | null | undefined} syntaxHighlighter
 * @param {HeadingAdapterHandle | null | undefined} headingAdapter
 * @returns {string}
 */
export function mdToHtmlWithPlugins(
	markdown,
	options,
	syntaxHighlighter,
	headingAdapter,
) {
	return __mdToHtmlWithPluginsOwned(
		markdown,
		options,
		cloneAdapter(syntaxHighlighter),
		cloneAdapter(headingAdapter),
	);
}

/**
 * @deprecated Comrak's XML formatter ignores render plugins. Use mdToXml.
 * @param {string} markdown
 * @param {ComrakOptionsInput | null | undefined} options
 * @param {SyntaxHighlighterHandle | null | undefined} _syntaxHighlighter
 * @param {HeadingAdapterHandle | null | undefined} _headingAdapter
 * @returns {string}
 */
export function mdToXmlWithPlugins(
	markdown,
	options,
	_syntaxHighlighter,
	_headingAdapter,
) {
	return renderXml(markdown, options);
}

/**
 * @param {string} markdown
 * @param {ComrakOptionsInput | null | undefined} options
 * @param {CodefenceRendererMap | null | undefined} renderers
 * @param {SyntaxHighlighterHandle | null | undefined} syntaxHighlighter
 * @param {HeadingAdapterHandle | null | undefined} headingAdapter
 * @returns {string}
 */
export function mdToHtmlWithCodefenceRenderers(
	markdown,
	options,
	renderers,
	syntaxHighlighter,
	headingAdapter,
) {
	return __mdToHtmlWithCodefenceRenderersOwned(
		markdown,
		options,
		renderers,
		cloneAdapter(syntaxHighlighter),
		cloneAdapter(headingAdapter),
	);
}
