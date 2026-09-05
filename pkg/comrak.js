/* @ts-self-types="./comrak.d.ts" */

export class CodefenceRenderer {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        CodefenceRendererFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_codefencerenderer_free(ptr, 0);
    }
    /**
     * @param {Function} write_fn
     */
    constructor(write_fn) {
        const ret = wasm.codefencerenderer_new(write_fn);
        this.__wbg_ptr = ret;
        CodefenceRendererFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) CodefenceRenderer.prototype[Symbol.dispose] = CodefenceRenderer.prototype.free;

export class HeadingAdapter {
    static __wrap(ptr) {
        const obj = Object.create(HeadingAdapter.prototype);
        obj.__wbg_ptr = ptr;
        HeadingAdapterFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        HeadingAdapterFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_headingadapter_free(ptr, 0);
    }
    /**
     * @returns {HeadingAdapter}
     */
    clone() {
        const ret = wasm.headingadapter_clone(this.__wbg_ptr);
        return HeadingAdapter.__wrap(ret);
    }
    /**
     * @param {Function} enter
     * @param {Function} exit
     */
    constructor(enter, exit) {
        const ret = wasm.headingadapter_new(enter, exit);
        this.__wbg_ptr = ret;
        HeadingAdapterFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) HeadingAdapter.prototype[Symbol.dispose] = HeadingAdapter.prototype.free;

/**
 * ANSI theme prepared once for repeated renders without repeated JavaScript
 * deserialization, string allocation, or default merging.
 */
export class PreparedAnsiTheme {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PreparedAnsiThemeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_preparedansitheme_free(ptr, 0);
    }
    /**
     * @param {any | null} [theme]
     */
    constructor(theme) {
        const ret = wasm.preparedansitheme_new(isLikeNone(theme) ? 0 : addToExternrefTable0(theme));
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        PreparedAnsiThemeFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) PreparedAnsiTheme.prototype[Symbol.dispose] = PreparedAnsiTheme.prototype.free;

export class PreparedCodefenceRenderers {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PreparedCodefenceRenderersFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_preparedcodefencerenderers_free(ptr, 0);
    }
    /**
     * @param {any} renderers
     */
    constructor(renderers) {
        const ret = wasm.preparedcodefencerenderers_new(renderers);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        PreparedCodefenceRenderersFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) PreparedCodefenceRenderers.prototype[Symbol.dispose] = PreparedCodefenceRenderers.prototype.free;

/**
 * Options prepared once for repeated renders without repeated JS
 * deserialization and comrak option mapping.
 */
export class PreparedOptions {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PreparedOptionsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_preparedoptions_free(ptr, 0);
    }
    /**
     * @param {string} md
     * @param {PreparedCodefenceRenderers} renderers
     * @param {SyntaxHighlighter | null} [syntax_highlighter]
     * @param {HeadingAdapter | null} [heading_adapter]
     * @returns {string}
     */
    __mdToHtmlWithCodefenceRenderersOwned(md, renderers, syntax_highlighter, heading_adapter) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            _assertClass(renderers, PreparedCodefenceRenderers);
            let ptr1 = 0;
            if (!isLikeNone(syntax_highlighter)) {
                _assertClass(syntax_highlighter, SyntaxHighlighter);
                ptr1 = syntax_highlighter.__destroy_into_raw();
            }
            let ptr2 = 0;
            if (!isLikeNone(heading_adapter)) {
                _assertClass(heading_adapter, HeadingAdapter);
                ptr2 = heading_adapter.__destroy_into_raw();
            }
            const ret = wasm.preparedoptions___mdToHtmlWithCodefenceRenderersOwned(this.__wbg_ptr, ptr0, len0, renderers.__wbg_ptr, ptr1, ptr2);
            deferred4_0 = ret[0];
            deferred4_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @param {string} md
     * @param {SyntaxHighlighter | null} [syntax_highlighter]
     * @param {HeadingAdapter | null} [heading_adapter]
     * @returns {string}
     */
    __mdToHtmlWithPluginsOwned(md, syntax_highlighter, heading_adapter) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            let ptr1 = 0;
            if (!isLikeNone(syntax_highlighter)) {
                _assertClass(syntax_highlighter, SyntaxHighlighter);
                ptr1 = syntax_highlighter.__destroy_into_raw();
            }
            let ptr2 = 0;
            if (!isLikeNone(heading_adapter)) {
                _assertClass(heading_adapter, HeadingAdapter);
                ptr2 = heading_adapter.__destroy_into_raw();
            }
            const ret = wasm.preparedoptions___mdToHtmlWithPluginsOwned(this.__wbg_ptr, ptr0, len0, ptr1, ptr2);
            deferred4_0 = ret[0];
            deferred4_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @param {string} md
     * @returns {string | undefined}
     */
    getFrontmatter(md) {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.preparedoptions_getFrontmatter(this.__wbg_ptr, ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * @param {string} md
     * @param {any} theme
     * @returns {string}
     */
    mdToAnsi(md, theme) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.preparedoptions_mdToAnsi(this.__wbg_ptr, ptr0, len0, theme);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * @param {string} md
     * @param {PreparedAnsiTheme} theme
     * @returns {string}
     */
    mdToAnsiWithTheme(md, theme) {
        let deferred3_0;
        let deferred3_1;
        try {
            const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            _assertClass(theme, PreparedAnsiTheme);
            const ret = wasm.preparedoptions_mdToAnsiWithTheme(this.__wbg_ptr, ptr0, len0, theme.__wbg_ptr);
            var ptr2 = ret[0];
            var len2 = ret[1];
            if (ret[3]) {
                ptr2 = 0; len2 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred3_0 = ptr2;
            deferred3_1 = len2;
            return getStringFromWasm0(ptr2, len2);
        } finally {
            wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
        }
    }
    /**
     * @param {string} md
     * @returns {string}
     */
    mdToCommonmark(md) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.preparedoptions_mdToCommonmark(this.__wbg_ptr, ptr0, len0);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @param {string} md
     * @returns {string}
     */
    mdToHtml(md) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.preparedoptions_mdToHtml(this.__wbg_ptr, ptr0, len0);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @param {string} md
     * @param {boolean | null} [show_urls]
     * @param {boolean | null} [show_markdown]
     * @param {string | null} [table_shadow]
     * @returns {string}
     */
    mdToText(md, show_urls, show_markdown, table_shadow) {
        let deferred4_0;
        let deferred4_1;
        try {
            const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            var ptr1 = isLikeNone(table_shadow) ? 0 : passStringToWasm0(table_shadow, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            const ret = wasm.preparedoptions_mdToText(this.__wbg_ptr, ptr0, len0, isLikeNone(show_urls) ? 0xFFFFFF : show_urls ? 1 : 0, isLikeNone(show_markdown) ? 0xFFFFFF : show_markdown ? 1 : 0, ptr1, len1);
            var ptr3 = ret[0];
            var len3 = ret[1];
            if (ret[3]) {
                ptr3 = 0; len3 = 0;
                throw takeFromExternrefTable0(ret[2]);
            }
            deferred4_0 = ptr3;
            deferred4_1 = len3;
            return getStringFromWasm0(ptr3, len3);
        } finally {
            wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
        }
    }
    /**
     * @param {string} md
     * @returns {string}
     */
    mdToXml(md) {
        let deferred2_0;
        let deferred2_1;
        try {
            const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len0 = WASM_VECTOR_LEN;
            const ret = wasm.preparedoptions_mdToXml(this.__wbg_ptr, ptr0, len0);
            deferred2_0 = ret[0];
            deferred2_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
        }
    }
    /**
     * @param {any | null} [options]
     */
    constructor(options) {
        const ret = wasm.preparedoptions_new(isLikeNone(options) ? 0 : addToExternrefTable0(options));
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0];
        PreparedOptionsFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) PreparedOptions.prototype[Symbol.dispose] = PreparedOptions.prototype.free;

export class SyntaxHighlighter {
    static __wrap(ptr) {
        const obj = Object.create(SyntaxHighlighter.prototype);
        obj.__wbg_ptr = ptr;
        SyntaxHighlighterFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SyntaxHighlighterFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_syntaxhighlighter_free(ptr, 0);
    }
    /**
     * @returns {SyntaxHighlighter}
     */
    clone() {
        const ret = wasm.syntaxhighlighter_clone(this.__wbg_ptr);
        return SyntaxHighlighter.__wrap(ret);
    }
    /**
     * @param {Function} highlight
     * @param {Function} pre
     * @param {Function} code
     */
    constructor(highlight, pre, code) {
        const ret = wasm.syntaxhighlighter_new(highlight, pre, code);
        this.__wbg_ptr = ret;
        SyntaxHighlighterFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) SyntaxHighlighter.prototype[Symbol.dispose] = SyntaxHighlighter.prototype.free;

/**
 * @param {string} md
 * @param {any} options
 * @param {any} renderers
 * @param {SyntaxHighlighter | null} [syntax_highlighter]
 * @param {HeadingAdapter | null} [heading_adapter]
 * @returns {string}
 */
export function __mdToHtmlWithCodefenceRenderersOwned(md, options, renderers, syntax_highlighter, heading_adapter) {
    let deferred5_0;
    let deferred5_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        let ptr1 = 0;
        if (!isLikeNone(syntax_highlighter)) {
            _assertClass(syntax_highlighter, SyntaxHighlighter);
            ptr1 = syntax_highlighter.__destroy_into_raw();
        }
        let ptr2 = 0;
        if (!isLikeNone(heading_adapter)) {
            _assertClass(heading_adapter, HeadingAdapter);
            ptr2 = heading_adapter.__destroy_into_raw();
        }
        const ret = wasm.__mdToHtmlWithCodefenceRenderersOwned(ptr0, len0, options, renderers, ptr1, ptr2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
            ptr4 = 0; len4 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
}

/**
 * @param {string} md
 * @param {any} options
 * @param {SyntaxHighlighter | null} [syntax_highlighter]
 * @param {HeadingAdapter | null} [heading_adapter]
 * @returns {string}
 */
export function __mdToHtmlWithPluginsOwned(md, options, syntax_highlighter, heading_adapter) {
    let deferred5_0;
    let deferred5_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        let ptr1 = 0;
        if (!isLikeNone(syntax_highlighter)) {
            _assertClass(syntax_highlighter, SyntaxHighlighter);
            ptr1 = syntax_highlighter.__destroy_into_raw();
        }
        let ptr2 = 0;
        if (!isLikeNone(heading_adapter)) {
            _assertClass(heading_adapter, HeadingAdapter);
            ptr2 = heading_adapter.__destroy_into_raw();
        }
        const ret = wasm.__mdToHtmlWithPluginsOwned(ptr0, len0, options, ptr1, ptr2);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
            ptr4 = 0; len4 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
}

/**
 * The COMBINED entry: URL rewriters (a host's security guards ride
 * them on every render) together with the render plugins (syntax
 * highlighter, heading adapter, per-language codefence renderers).
 * The disjoint entries forced hosts to choose between guarding URLs
 * and highlighting code.
 * @param {string} md
 * @param {any} options
 * @param {any} image_url_rewriter
 * @param {any} link_url_rewriter
 * @param {SyntaxHighlighter | null | undefined} syntax_highlighter
 * @param {HeadingAdapter | null | undefined} heading_adapter
 * @param {any} renderers
 * @returns {string}
 */
export function __mdToHtmlWithRewritersAndPluginsOwned(md, options, image_url_rewriter, link_url_rewriter, syntax_highlighter, heading_adapter, renderers) {
    let deferred5_0;
    let deferred5_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        let ptr1 = 0;
        if (!isLikeNone(syntax_highlighter)) {
            _assertClass(syntax_highlighter, SyntaxHighlighter);
            ptr1 = syntax_highlighter.__destroy_into_raw();
        }
        let ptr2 = 0;
        if (!isLikeNone(heading_adapter)) {
            _assertClass(heading_adapter, HeadingAdapter);
            ptr2 = heading_adapter.__destroy_into_raw();
        }
        const ret = wasm.__mdToHtmlWithRewritersAndPluginsOwned(ptr0, len0, options, image_url_rewriter, link_url_rewriter, ptr1, ptr2, renderers);
        var ptr4 = ret[0];
        var len4 = ret[1];
        if (ret[3]) {
            ptr4 = 0; len4 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred5_0 = ptr4;
        deferred5_1 = len4;
        return getStringFromWasm0(ptr4, len4);
    } finally {
        wasm.__wbindgen_free(deferred5_0, deferred5_1, 1);
    }
}

/**
 * Auto-select dark or light theme based on COLORFGBG value.
 * @param {string | null} [colorfgbg]
 * @returns {any}
 */
export function ansiThemeAuto(colorfgbg) {
    var ptr0 = isLikeNone(colorfgbg) ? 0 : passStringToWasm0(colorfgbg, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.ansiThemeAuto(ptr0, len0);
    return ret;
}

/**
 * @returns {any}
 */
export function ansiThemeDark() {
    const ret = wasm.ansiThemeDark();
    return ret;
}

/**
 * @returns {any}
 */
export function ansiThemeLight() {
    const ret = wasm.ansiThemeLight();
    return ret;
}

/**
 * Canonicalizes an inline-intent Markdown paragraph: parse and print
 * back with only the escapes that matter (`escapeCommonmarkInline` is
 * deliberately over-conservative — `cut\.` prints back as `cut.`),
 * while line-edge whitespace survives as numeric character references
 * (the block parser treats 4+ leading spaces as indented code, strips
 * continuation-line indents and trims trailing spaces; `&#32;`/`&#9;`
 * decode to the exact bytes without counting as line structure). The
 * output never ends with the printer's own trailing newline.
 * @param {string} md
 * @param {any} options
 * @returns {string}
 */
export function canonicalizeCommonmarkInline(md, options) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.canonicalizeCommonmarkInline(ptr0, len0, options);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @returns {string}
 */
export function comrakVersion() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.comrakVersion();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}

/**
 * Detect color scheme from the COLORFGBG environment variable.
 * Returns "light" or "dark". Background values 7 or 15 indicate a light terminal.
 * @param {string | null} [colorfgbg]
 * @returns {string}
 */
export function detectColorScheme(colorfgbg) {
    let deferred2_0;
    let deferred2_1;
    try {
        var ptr0 = isLikeNone(colorfgbg) ? 0 : passStringToWasm0(colorfgbg, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.detectColorScheme(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Escapes text for literal inclusion in a CommonMark document at a
 * position where inline parsing occurs. The write-direction escaping
 * authority for editors serializing user-typed text into Markdown:
 * `**`, `__init__`, or a leading `# ` come back escaped so they render
 * as themselves. Comrak escapes more than strictly necessary; the
 * rendering is unaffected.
 * @param {string} text
 * @returns {string}
 */
export function escapeCommonmarkInline(text) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.escapeCommonmarkInline(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * Escapes a URL for inclusion as a CommonMark link destination. Emits
 * the bracketed `<...>` form, which admits spaces and parentheses by
 * construction.
 * @param {string} url
 * @returns {string}
 */
export function escapeCommonmarkLinkDestination(url) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.escapeCommonmarkLinkDestination(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {string} md
 * @param {any} options
 * @returns {string | undefined}
 */
export function getFrontmatter(md, options) {
    const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.getFrontmatter(ptr0, len0, options);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    let v2;
    if (ret[0] !== 0) {
        v2 = getStringFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    }
    return v2;
}

/**
 * @param {string} md
 * @returns {string}
 */
export function healMarkdown(md) {
    let deferred2_0;
    let deferred2_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.healMarkdown(ptr0, len0);
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

/**
 * @param {string} md
 * @param {any} options
 * @param {any} theme
 * @returns {string}
 */
export function mdToAnsi(md, options, theme) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mdToAnsi(ptr0, len0, options, theme);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} md
 * @param {any} options
 * @param {PreparedAnsiTheme} theme
 * @returns {string}
 */
export function mdToAnsiWithTheme(md, options, theme) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        _assertClass(theme, PreparedAnsiTheme);
        const ret = wasm.mdToAnsiWithTheme(ptr0, len0, options, theme.__wbg_ptr);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * The whole AST as plain JSON (`{ type, sourcepos, …fields, children }`
 * per node). Comrak's tree is arena-allocated and lifetime-bound — it
 * cannot cross the wasm boundary as live objects, so this is the
 * honest export: one serialization into JS-native values, every node
 * type mapped exhaustively (a comrak upgrade that adds one fails the
 * build rather than dropping nodes).
 * @param {string} md
 * @param {any} options
 * @returns {any}
 */
export function mdToAst(md, options) {
    const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.mdToAst(ptr0, len0, options);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {string} md
 * @param {any} options
 * @returns {string}
 */
export function mdToCommonmark(md, options) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mdToCommonmark(ptr0, len0, options);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} md
 * @param {any} options
 * @returns {string}
 */
export function mdToHtml(md, options) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mdToHtml(ptr0, len0, options);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Render a complete block snapshot. Boundaries are null for raw HTML whose
 * browser parsing context may span AST blocks.
 * @param {string} md
 * @param {any} options
 * @returns {any}
 */
export function mdToHtmlBlocks(md, options) {
    const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.mdToHtmlBlocks(ptr0, len0, options);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {string} md
 * @param {any} options
 * @param {any} image_url_rewriter
 * @param {any} link_url_rewriter
 * @returns {string}
 */
export function mdToHtmlWithRewriters(md, options, image_url_rewriter, link_url_rewriter) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mdToHtmlWithRewriters(ptr0, len0, options, image_url_rewriter, link_url_rewriter);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * @param {string} md
 * @param {any} options
 * @returns {string}
 */
export function mdToInlineHtml(md, options) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mdToInlineHtml(ptr0, len0, options);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Render an incomplete streaming document with one U+2060 cursor marker.
 * @param {string} md
 * @param {number} writing_offset
 * @param {any} options
 * @returns {string}
 */
export function mdToStreamingHtml(md, writing_offset, options) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mdToStreamingHtml(ptr0, len0, writing_offset, options);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}

/**
 * Render an incomplete document once with cursor and complete block boundaries.
 * @param {string} md
 * @param {number} writing_offset
 * @param {any} options
 * @returns {any}
 */
export function mdToStreamingHtmlBlocks(md, writing_offset, options) {
    const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.mdToStreamingHtmlBlocks(ptr0, len0, writing_offset, options);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return takeFromExternrefTable0(ret[0]);
}

/**
 * @param {string} md
 * @param {any} options
 * @param {boolean | null} [show_urls]
 * @param {boolean | null} [show_markdown]
 * @param {string | null} [table_shadow]
 * @returns {string}
 */
export function mdToText(md, options, show_urls, show_markdown, table_shadow) {
    let deferred4_0;
    let deferred4_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(table_shadow) ? 0 : passStringToWasm0(table_shadow, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        const ret = wasm.mdToText(ptr0, len0, options, isLikeNone(show_urls) ? 0xFFFFFF : show_urls ? 1 : 0, isLikeNone(show_markdown) ? 0xFFFFFF : show_markdown ? 1 : 0, ptr1, len1);
        var ptr3 = ret[0];
        var len3 = ret[1];
        if (ret[3]) {
            ptr3 = 0; len3 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_free(deferred4_0, deferred4_1, 1);
    }
}

/**
 * @param {string} md
 * @param {any} options
 * @returns {string}
 */
export function mdToXml(md, options) {
    let deferred3_0;
    let deferred3_1;
    try {
        const ptr0 = passStringToWasm0(md, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.mdToXml(ptr0, len0, options);
        var ptr2 = ret[0];
        var len2 = ret[1];
        if (ret[3]) {
            ptr2 = 0; len2 = 0;
            throw takeFromExternrefTable0(ret[2]);
        }
        deferred3_0 = ptr2;
        deferred3_1 = len2;
        return getStringFromWasm0(ptr2, len2);
    } finally {
        wasm.__wbindgen_free(deferred3_0, deferred3_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_408e67f47ca7b58b: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_Number_3890faa6d3ff057d: function(arg0) {
            const ret = Number(arg0);
            return ret;
        },
        __wbg_String_8564e559799eccda: function(arg0, arg1) {
            const ret = String(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_bigint_get_as_i64_c4ecf48528083721: function(arg0, arg1) {
            const v = arg1;
            const ret = typeof(v) === 'bigint' ? v : undefined;
            getDataViewMemory0().setBigInt64(arg0 + 8 * 1, isLikeNone(ret) ? BigInt(0) : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_boolean_get_c9c83ebd41b34df3: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_a57024b9c6e4a48b: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_in_ac983077f137f2e6: function(arg0, arg1) {
            const ret = arg0 in arg1;
            return ret;
        },
        __wbg___wbindgen_is_bigint_8ffbbef442139384: function(arg0) {
            const ret = typeof(arg0) === 'bigint';
            return ret;
        },
        __wbg___wbindgen_is_function_5e4570eb24ffa122: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_7d13f41e1a2d5140: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_object_a2790eb24c211ea0: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_e6f02f0ea5f20a32: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_6cff064c44e0d823: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_jsval_eq_0a18949a61670320: function(arg0, arg1) {
            const ret = arg0 === arg1;
            return ret;
        },
        __wbg___wbindgen_jsval_loose_eq_acf2776254a8d832: function(arg0, arg1) {
            const ret = arg0 == arg1;
            return ret;
        },
        __wbg___wbindgen_number_get_136b9679cab35cfb: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_d154f1e671052120: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_bb96b2010945f0bc: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_0f2a9af232c18fd2: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.call(arg1, arg2, arg3);
            return ret;
        }, arguments); },
        __wbg_call_35dba3c747ad7521: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_call_39f824e18d9d2414: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            const ret = arg0.call(arg1, arg2, arg3, arg4);
            return ret;
        }, arguments); },
        __wbg_entries_7774d489e1da5f4f: function(arg0) {
            const ret = Object.entries(arg0);
            return ret;
        },
        __wbg_get_971a0c45d172643f: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_c0c8f8d7da0c03dd: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_get_with_ref_key_6412cf3094599694: function(arg0, arg1) {
            const ret = arg0[arg1];
            return ret;
        },
        __wbg_instanceof_ArrayBuffer_993d02d2d254cad1: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Object_80ad464782e2bd73: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Object;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Uint8Array_f935dbb0aa7cdeed: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Uint8Array;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isSafeInteger_f3d6cd19ccfe4512: function(arg0) {
            const ret = Number.isSafeInteger(arg0);
            return ret;
        },
        __wbg_keys_ec7f8c0c2370d91d: function(arg0) {
            const ret = Object.keys(arg0);
            return ret;
        },
        __wbg_length_36bd29c6848c2144: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_ecfa2c63d3d0d82c: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_new_116be93542d39019: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_15ae2532051588db: function(arg0, arg1) {
            const ret = new TypeError(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_19e1be967b5131c8: function(arg0, arg1) {
            const ret = new RangeError(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_358857d90afd5a2d: function(arg0, arg1) {
            const ret = new Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_77cc4f4f472aeb81: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_ebe3e0f6837f0879: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_prototypesetcall_de8e0d9553586985: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_8155bb79a948541b: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_a80955eb93b145c6: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./comrak_bg.js": import0,
    };
}

const CodefenceRendererFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_codefencerenderer_free(ptr, 1));
const HeadingAdapterFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_headingadapter_free(ptr, 1));
const PreparedAnsiThemeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_preparedansitheme_free(ptr, 1));
const PreparedCodefenceRenderersFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_preparedcodefencerenderers_free(ptr, 1));
const PreparedOptionsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_preparedoptions_free(ptr, 1));
const SyntaxHighlighterFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_syntaxhighlighter_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('comrak.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
