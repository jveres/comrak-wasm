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
    constructor(enter: Function, exit: Function);
}

export class SyntaxHighlighter {
    free(): void;
    [Symbol.dispose](): void;
    constructor(highlight: Function, pre: Function, code: Function);
}

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

export function getFrontmatter(md: string, options: any): string | undefined;

export function healMarkdown(md: string): string;

export function mdToAnsi(md: string, options: any, theme: any): string;

export function mdToCommonmark(md: string, options: any): string;

export function mdToHtml(md: string, options: any): string;

export function mdToHtmlWithCodefenceRenderers(md: string, options: any, renderers: any, syntax_highlighter?: SyntaxHighlighter | null, heading_adapter?: HeadingAdapter | null): string;

export function mdToHtmlWithPlugins(md: string, options: any, syntax_highlighter?: SyntaxHighlighter | null, heading_adapter?: HeadingAdapter | null): string;

export function mdToHtmlWithRewriters(md: string, options: any, image_url_rewriter: any, link_url_rewriter: any): string;

export function mdToText(md: string, options: any, show_urls?: boolean | null, show_markdown?: boolean | null, table_shadow?: string | null): string;

export function mdToXml(md: string, options: any): string;

export function mdToXmlWithPlugins(md: string, options: any, syntax_highlighter?: SyntaxHighlighter | null, heading_adapter?: HeadingAdapter | null): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_codefencerenderer_free: (a: number, b: number) => void;
    readonly __wbg_headingadapter_free: (a: number, b: number) => void;
    readonly __wbg_syntaxhighlighter_free: (a: number, b: number) => void;
    readonly ansiThemeAuto: (a: number, b: number) => number;
    readonly ansiThemeDark: () => number;
    readonly ansiThemeLight: () => number;
    readonly codefencerenderer_new: (a: number) => number;
    readonly comrakVersion: (a: number) => void;
    readonly detectColorScheme: (a: number, b: number, c: number) => void;
    readonly getFrontmatter: (a: number, b: number, c: number, d: number) => void;
    readonly headingadapter_new: (a: number, b: number) => number;
    readonly healMarkdown: (a: number, b: number, c: number) => void;
    readonly mdToAnsi: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly mdToCommonmark: (a: number, b: number, c: number, d: number) => void;
    readonly mdToHtml: (a: number, b: number, c: number, d: number) => void;
    readonly mdToHtmlWithCodefenceRenderers: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly mdToHtmlWithPlugins: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly mdToHtmlWithRewriters: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly mdToText: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly mdToXml: (a: number, b: number, c: number, d: number) => void;
    readonly mdToXmlWithPlugins: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly syntaxhighlighter_new: (a: number, b: number, c: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
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
