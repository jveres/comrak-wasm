/* tslint:disable */
/* eslint-disable */

export class CodefenceRenderer {
    free(): void;
    [Symbol.dispose](): void;
    constructor(write_fn: Function);
}

export class HeadingAdapter {
    free(): void;
    [Symbol.dispose](): void;
    clone(): HeadingAdapter;
    constructor(enter: Function, exit: Function);
}

/**
 * ANSI theme prepared once for repeated renders without repeated JavaScript
 * deserialization, string allocation, or default merging.
 */
export class PreparedAnsiTheme {
    free(): void;
    [Symbol.dispose](): void;
    constructor(theme?: any | null);
}

export class PreparedCodefenceRenderers {
    free(): void;
    [Symbol.dispose](): void;
    constructor(renderers: any);
}

/**
 * Options prepared once for repeated renders without repeated JS
 * deserialization and comrak option mapping.
 */
export class PreparedOptions {
    free(): void;
    [Symbol.dispose](): void;
    __mdToHtmlWithCodefenceRenderersOwned(md: string, renderers: PreparedCodefenceRenderers, syntax_highlighter?: SyntaxHighlighter | null, heading_adapter?: HeadingAdapter | null): string;
    __mdToHtmlWithPluginsOwned(md: string, syntax_highlighter?: SyntaxHighlighter | null, heading_adapter?: HeadingAdapter | null): string;
    getFrontmatter(md: string): string | undefined;
    mdToAnsi(md: string, theme: any): string;
    mdToAnsiWithTheme(md: string, theme: PreparedAnsiTheme): string;
    mdToCommonmark(md: string): string;
    mdToHtml(md: string): string;
    mdToText(md: string, show_urls?: boolean | null, show_markdown?: boolean | null, table_shadow?: string | null): string;
    mdToXml(md: string): string;
    constructor(options?: any | null);
}

export class SyntaxHighlighter {
    free(): void;
    [Symbol.dispose](): void;
    clone(): SyntaxHighlighter;
    constructor(highlight: Function, pre: Function, code: Function);
}

export function __mdToHtmlWithCodefenceRenderersOwned(md: string, options: any, renderers: any, syntax_highlighter?: SyntaxHighlighter | null, heading_adapter?: HeadingAdapter | null): string;

export function __mdToHtmlWithPluginsOwned(md: string, options: any, syntax_highlighter?: SyntaxHighlighter | null, heading_adapter?: HeadingAdapter | null): string;

/**
 * The COMBINED entry: URL rewriters (a host's security guards ride
 * them on every render) together with the render plugins (syntax
 * highlighter, heading adapter, per-language codefence renderers).
 * The disjoint entries forced hosts to choose between guarding URLs
 * and highlighting code.
 */
export function __mdToHtmlWithRewritersAndPluginsOwned(md: string, options: any, image_url_rewriter: any, link_url_rewriter: any, syntax_highlighter: SyntaxHighlighter | null | undefined, heading_adapter: HeadingAdapter | null | undefined, renderers: any): string;

/**
 * Auto-select dark or light theme based on COLORFGBG value.
 */
export function ansiThemeAuto(colorfgbg?: string | null): any;

export function ansiThemeDark(): any;

export function ansiThemeLight(): any;

export function comrakVersion(): string;

/**
 * Detect color scheme from the COLORFGBG environment variable.
 * Returns "light" or "dark". Background values 7 or 15 indicate a light terminal.
 */
export function detectColorScheme(colorfgbg?: string | null): string;

/**
 * Escapes text for literal inclusion in a CommonMark document at a
 * position where inline parsing occurs. The write-direction escaping
 * authority for editors serializing user-typed text into Markdown:
 * `**`, `__init__`, or a leading `# ` come back escaped so they render
 * as themselves. Comrak escapes more than strictly necessary; the
 * rendering is unaffected.
 */
export function escapeCommonmarkInline(text: string): string;

export function getFrontmatter(md: string, options: any): string | undefined;

export function healMarkdown(md: string): string;

export function mdToAnsi(md: string, options: any, theme: any): string;

export function mdToAnsiWithTheme(md: string, options: any, theme: PreparedAnsiTheme): string;

export function mdToCommonmark(md: string, options: any): string;

export function mdToHtml(md: string, options: any): string;

export function mdToHtmlWithRewriters(md: string, options: any, image_url_rewriter: any, link_url_rewriter: any): string;

export function mdToText(md: string, options: any, show_urls?: boolean | null, show_markdown?: boolean | null, table_shadow?: string | null): string;

export function mdToXml(md: string, options: any): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __mdToHtmlWithCodefenceRenderersOwned: (a: number, b: number, c: any, d: any, e: number, f: number) => [number, number, number, number];
    readonly __mdToHtmlWithPluginsOwned: (a: number, b: number, c: any, d: number, e: number) => [number, number, number, number];
    readonly __mdToHtmlWithRewritersAndPluginsOwned: (a: number, b: number, c: any, d: any, e: any, f: number, g: number, h: any) => [number, number, number, number];
    readonly __wbg_codefencerenderer_free: (a: number, b: number) => void;
    readonly __wbg_headingadapter_free: (a: number, b: number) => void;
    readonly __wbg_preparedansitheme_free: (a: number, b: number) => void;
    readonly __wbg_preparedcodefencerenderers_free: (a: number, b: number) => void;
    readonly __wbg_preparedoptions_free: (a: number, b: number) => void;
    readonly __wbg_syntaxhighlighter_free: (a: number, b: number) => void;
    readonly ansiThemeAuto: (a: number, b: number) => any;
    readonly ansiThemeDark: () => any;
    readonly ansiThemeLight: () => any;
    readonly codefencerenderer_new: (a: any) => number;
    readonly comrakVersion: () => [number, number];
    readonly detectColorScheme: (a: number, b: number) => [number, number];
    readonly escapeCommonmarkInline: (a: number, b: number) => [number, number];
    readonly getFrontmatter: (a: number, b: number, c: any) => [number, number, number, number];
    readonly headingadapter_clone: (a: number) => number;
    readonly headingadapter_new: (a: any, b: any) => number;
    readonly healMarkdown: (a: number, b: number) => [number, number];
    readonly mdToAnsi: (a: number, b: number, c: any, d: any) => [number, number, number, number];
    readonly mdToAnsiWithTheme: (a: number, b: number, c: any, d: number) => [number, number, number, number];
    readonly mdToCommonmark: (a: number, b: number, c: any) => [number, number, number, number];
    readonly mdToHtml: (a: number, b: number, c: any) => [number, number, number, number];
    readonly mdToHtmlWithRewriters: (a: number, b: number, c: any, d: any, e: any) => [number, number, number, number];
    readonly mdToText: (a: number, b: number, c: any, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly mdToXml: (a: number, b: number, c: any) => [number, number, number, number];
    readonly preparedansitheme_new: (a: number) => [number, number, number];
    readonly preparedcodefencerenderers_new: (a: any) => [number, number, number];
    readonly preparedoptions___mdToHtmlWithCodefenceRenderersOwned: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
    readonly preparedoptions___mdToHtmlWithPluginsOwned: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly preparedoptions_getFrontmatter: (a: number, b: number, c: number) => [number, number];
    readonly preparedoptions_mdToAnsi: (a: number, b: number, c: number, d: any) => [number, number, number, number];
    readonly preparedoptions_mdToAnsiWithTheme: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly preparedoptions_mdToCommonmark: (a: number, b: number, c: number) => [number, number];
    readonly preparedoptions_mdToHtml: (a: number, b: number, c: number) => [number, number];
    readonly preparedoptions_mdToText: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly preparedoptions_mdToXml: (a: number, b: number, c: number) => [number, number];
    readonly preparedoptions_new: (a: number) => [number, number, number];
    readonly syntaxhighlighter_clone: (a: number) => number;
    readonly syntaxhighlighter_new: (a: any, b: any, c: any) => number;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
