mod ansi;
mod heal;
mod text;
mod walker;

use std::borrow::Cow;
use std::collections::HashMap;
use std::fmt;

use comrak::adapters::CodefenceRendererAdapter as ComrakCodefenceRendererAdapter;
use comrak::adapters::{
    HeadingAdapter as ComrakHeadingAdapter, HeadingMeta,
    SyntaxHighlighterAdapter as ComrakSyntaxHighlighterAdapter,
};
use comrak::options::Plugins;
use comrak::{
    markdown_to_commonmark, markdown_to_commonmark_xml, markdown_to_commonmark_xml_with_plugins,
    markdown_to_html, markdown_to_html_with_plugins, parse_document, Arena,
};
use std::sync::Arc;
use js_sys::Function;
use serde::Deserialize;
use wasm_bindgen::prelude::*;

#[cfg(target_arch = "wasm32")]
#[global_allocator]
static ALLOCATOR: lol_alloc::AssumeSingleThreaded<lol_alloc::FreeListAllocator> =
    unsafe { lol_alloc::AssumeSingleThreaded::new(lol_alloc::FreeListAllocator::new()) };

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ExtensionOptions {
    strikethrough: Option<bool>,
    tagfilter: Option<bool>,
    table: Option<bool>,
    autolink: Option<bool>,
    tasklist: Option<bool>,
    superscript: Option<bool>,
    header_ids: Option<String>,
    header_id_prefix: Option<String>,
    header_id_prefix_in_href: Option<bool>,
    footnotes: Option<bool>,
    inline_footnotes: Option<bool>,
    description_lists: Option<bool>,
    front_matter_delimiter: Option<String>,
    multiline_block_quotes: Option<bool>,
    alerts: Option<bool>,
    math_dollars: Option<bool>,
    math_code: Option<bool>,
    shortcodes: Option<bool>,
    wikilinks_title_after_pipe: Option<bool>,
    wikilinks_title_before_pipe: Option<bool>,
    underline: Option<bool>,
    subscript: Option<bool>,
    spoiler: Option<bool>,
    greentext: Option<bool>,
    cjk_friendly_emphasis: Option<bool>,
    subtext: Option<bool>,
    highlight: Option<bool>,
    insert: Option<bool>,
    phoenix_heex: Option<bool>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ParseOptions {
    smart: Option<bool>,
    default_info_string: Option<String>,
    relaxed_tasklist_matching: Option<bool>,
    tasklist_in_table: Option<bool>,
    relaxed_autolinks: Option<bool>,
    ignore_setext: Option<bool>,
    leave_footnote_definitions: Option<bool>,
    escaped_char_spans: Option<bool>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RenderOptions {
    hardbreaks: Option<bool>,
    github_pre_lang: Option<bool>,
    full_info_string: Option<bool>,
    width: Option<usize>,
    #[serde(rename = "unsafe")]
    unsafe_: Option<bool>,
    escape: Option<bool>,
    list_style: Option<String>,
    sourcepos: Option<bool>,
    escaped_char_spans: Option<bool>,
    ignore_empty_links: Option<bool>,
    gfm_quirks: Option<bool>,
    prefer_fenced: Option<bool>,
    figure_with_caption: Option<bool>,
    tasklist_classes: Option<bool>,
    ol_width: Option<usize>,
    experimental_minimize_commonmark: Option<bool>,
    compact_html: Option<bool>,
}

#[derive(Deserialize, Default)]
struct ComrakOptions {
    extension: Option<ExtensionOptions>,
    parse: Option<ParseOptions>,
    render: Option<RenderOptions>,
}

fn build_options(opts: ComrakOptions) -> comrak::Options<'static> {
    let mut options = comrak::Options::default();

    if let Some(ext) = opts.extension {
        macro_rules! set_bool {
            ($field:ident) => {
                if let Some(v) = ext.$field {
                    options.extension.$field = v;
                }
            };
        }
        set_bool!(strikethrough);
        set_bool!(tagfilter);
        set_bool!(table);
        set_bool!(autolink);
        set_bool!(tasklist);
        set_bool!(superscript);
        set_bool!(footnotes);
        set_bool!(inline_footnotes);
        set_bool!(description_lists);
        set_bool!(multiline_block_quotes);
        set_bool!(alerts);
        set_bool!(math_dollars);
        set_bool!(math_code);
        set_bool!(shortcodes);
        set_bool!(wikilinks_title_after_pipe);
        set_bool!(wikilinks_title_before_pipe);
        set_bool!(underline);
        set_bool!(subscript);
        set_bool!(spoiler);
        set_bool!(greentext);
        set_bool!(cjk_friendly_emphasis);
        set_bool!(subtext);
        set_bool!(highlight);
        set_bool!(insert);
        set_bool!(phoenix_heex);

        // header_id_prefix is the new name; header_ids is kept for backward compat
        if let Some(v) = ext.header_id_prefix.or(ext.header_ids) {
            options.extension.header_id_prefix = Some(v);
        }
        if let Some(v) = ext.header_id_prefix_in_href {
            options.extension.header_id_prefix_in_href = v;
        }
        if let Some(v) = ext.front_matter_delimiter {
            options.extension.front_matter_delimiter = Some(v);
        }
    }

    if let Some(parse) = opts.parse {
        macro_rules! set_bool {
            ($field:ident) => {
                if let Some(v) = parse.$field {
                    options.parse.$field = v;
                }
            };
        }
        set_bool!(smart);
        set_bool!(relaxed_tasklist_matching);
        set_bool!(tasklist_in_table);
        set_bool!(relaxed_autolinks);
        set_bool!(ignore_setext);
        set_bool!(leave_footnote_definitions);
        set_bool!(escaped_char_spans);

        if let Some(v) = parse.default_info_string {
            options.parse.default_info_string = Some(v);
        }
    }

    if let Some(render) = opts.render {
        macro_rules! set_bool {
            ($field:ident) => {
                if let Some(v) = render.$field {
                    options.render.$field = v;
                }
            };
        }
        set_bool!(hardbreaks);
        set_bool!(github_pre_lang);
        set_bool!(full_info_string);
        set_bool!(escape);
        set_bool!(sourcepos);
        set_bool!(escaped_char_spans);
        set_bool!(ignore_empty_links);
        set_bool!(gfm_quirks);
        set_bool!(prefer_fenced);
        set_bool!(figure_with_caption);
        set_bool!(tasklist_classes);
        set_bool!(experimental_minimize_commonmark);
        set_bool!(compact_html);

        if let Some(v) = render.unsafe_ {
            options.render.r#unsafe = v;
        }
        if let Some(v) = render.width {
            options.render.width = v;
        }
        if let Some(v) = render.list_style {
            options.render.list_style = match v.as_str() {
                "plus" => comrak::options::ListStyleType::Plus,
                "star" => comrak::options::ListStyleType::Star,
                _ => comrak::options::ListStyleType::Dash,
            };
        }
        if let Some(v) = render.ol_width {
            options.render.ol_width = v;
        }
    }

    options
}

fn parse_options(val: JsValue) -> ComrakOptions {
    if val.is_undefined() || val.is_null() {
        ComrakOptions::default()
    } else {
        serde_wasm_bindgen::from_value(val).unwrap_or_default()
    }
}

#[wasm_bindgen(js_name = comrakVersion)]
pub fn comrak_version() -> String {
    comrak::version().to_string()
}

#[wasm_bindgen(js_name = mdToHtml)]
pub fn md_to_html(md: &str, options: JsValue) -> String {
    let opts = build_options(parse_options(options));
    markdown_to_html(md, &opts)
}

#[wasm_bindgen(js_name = mdToCommonmark)]
pub fn md_to_commonmark(md: &str, options: JsValue) -> String {
    let opts = build_options(parse_options(options));
    markdown_to_commonmark(md, &opts)
}

// --- Syntax Highlighter Adapter ---

#[wasm_bindgen]
pub struct SyntaxHighlighter {
    highlight: Function,
    pre: Function,
    code: Function,
}

// SAFETY: WASM is single-threaded; Function is not Send/Sync but cannot be
// accessed from multiple threads in a WASM environment.
unsafe impl Send for SyntaxHighlighter {}
unsafe impl Sync for SyntaxHighlighter {}
impl std::panic::RefUnwindSafe for SyntaxHighlighter {}

#[wasm_bindgen]
impl SyntaxHighlighter {
    #[wasm_bindgen(constructor)]
    pub fn new(highlight: Function, pre: Function, code: Function) -> Self {
        Self {
            highlight,
            pre,
            code,
        }
    }
}

impl ComrakSyntaxHighlighterAdapter for SyntaxHighlighter {
    fn write_highlighted(
        &self,
        output: &mut dyn fmt::Write,
        lang: Option<&str>,
        code: &str,
    ) -> fmt::Result {
        let this = JsValue::null();
        let js_code = JsValue::from_str(code);
        let js_lang = match lang {
            Some(l) => JsValue::from_str(l),
            None => JsValue::undefined(),
        };
        let result = self.highlight.call2(&this, &js_code, &js_lang);
        if let Ok(val) = result {
            if let Some(s) = val.as_string() {
                return output.write_str(&s);
            }
        }
        Ok(())
    }

    fn write_pre_tag(
        &self,
        output: &mut dyn fmt::Write,
        attributes: HashMap<&'static str, Cow<'_, str>>,
    ) -> fmt::Result {
        let this = JsValue::null();
        let js_attrs = js_sys::Object::new();
        for (k, v) in &attributes {
            js_sys::Reflect::set(
                &js_attrs,
                &JsValue::from_str(k),
                &JsValue::from_str(v),
            )
            .ok();
        }
        let result = self.pre.call1(&this, &js_attrs);
        if let Ok(val) = result {
            if let Some(s) = val.as_string() {
                return output.write_str(&s);
            }
        }
        Ok(())
    }

    fn write_code_tag(
        &self,
        output: &mut dyn fmt::Write,
        attributes: HashMap<&'static str, Cow<'_, str>>,
    ) -> fmt::Result {
        let this = JsValue::null();
        let js_attrs = js_sys::Object::new();
        for (k, v) in &attributes {
            js_sys::Reflect::set(
                &js_attrs,
                &JsValue::from_str(k),
                &JsValue::from_str(v),
            )
            .ok();
        }
        let result = self.code.call1(&this, &js_attrs);
        if let Ok(val) = result {
            if let Some(s) = val.as_string() {
                return output.write_str(&s);
            }
        }
        Ok(())
    }
}

// --- Heading Adapter ---

#[wasm_bindgen]
pub struct HeadingAdapter {
    enter: Function,
    exit: Function,
}

unsafe impl Send for HeadingAdapter {}
unsafe impl Sync for HeadingAdapter {}
impl std::panic::RefUnwindSafe for HeadingAdapter {}

#[wasm_bindgen]
impl HeadingAdapter {
    #[wasm_bindgen(constructor)]
    pub fn new(enter: Function, exit: Function) -> Self {
        Self { enter, exit }
    }
}

impl ComrakHeadingAdapter for HeadingAdapter {
    fn enter(
        &self,
        output: &mut dyn fmt::Write,
        heading: &HeadingMeta,
        _sourcepos: Option<comrak::nodes::Sourcepos>,
    ) -> fmt::Result {
        let this = JsValue::null();
        let js_heading = js_sys::Object::new();
        js_sys::Reflect::set(
            &js_heading,
            &JsValue::from_str("level"),
            &JsValue::from(heading.level),
        )
        .ok();
        js_sys::Reflect::set(
            &js_heading,
            &JsValue::from_str("content"),
            &JsValue::from_str(&heading.content),
        )
        .ok();
        let result = self.enter.call1(&this, &js_heading);
        if let Ok(val) = result {
            if let Some(s) = val.as_string() {
                return output.write_str(&s);
            }
        }
        Ok(())
    }

    fn exit(&self, output: &mut dyn fmt::Write, heading: &HeadingMeta) -> fmt::Result {
        let this = JsValue::null();
        let js_heading = js_sys::Object::new();
        js_sys::Reflect::set(
            &js_heading,
            &JsValue::from_str("level"),
            &JsValue::from(heading.level),
        )
        .ok();
        js_sys::Reflect::set(
            &js_heading,
            &JsValue::from_str("content"),
            &JsValue::from_str(&heading.content),
        )
        .ok();
        let result = self.exit.call1(&this, &js_heading);
        if let Ok(val) = result {
            if let Some(s) = val.as_string() {
                return output.write_str(&s);
            }
        }
        Ok(())
    }
}

// --- HTML with plugins ---

#[wasm_bindgen(js_name = mdToHtmlWithPlugins)]
pub fn md_to_html_with_plugins_js(
    md: &str,
    options: JsValue,
    syntax_highlighter: Option<SyntaxHighlighter>,
    heading_adapter: Option<HeadingAdapter>,
) -> String {
    let opts = build_options(parse_options(options));
    let mut plugins = Plugins::default();

    if let Some(ref sh) = syntax_highlighter {
        plugins.render.codefence_syntax_highlighter = Some(sh);
    }
    if let Some(ref ha) = heading_adapter {
        plugins.render.heading_adapter = Some(ha);
    }

    markdown_to_html_with_plugins(md, &opts, &plugins)
}

// --- XML output ---

#[wasm_bindgen(js_name = mdToXml)]
pub fn md_to_xml(md: &str, options: JsValue) -> String {
    let opts = build_options(parse_options(options));
    markdown_to_commonmark_xml(md, &opts)
}

#[wasm_bindgen(js_name = mdToXmlWithPlugins)]
pub fn md_to_xml_with_plugins_js(
    md: &str,
    options: JsValue,
    syntax_highlighter: Option<SyntaxHighlighter>,
    heading_adapter: Option<HeadingAdapter>,
) -> String {
    let opts = build_options(parse_options(options));
    let mut plugins = Plugins::default();

    if let Some(ref sh) = syntax_highlighter {
        plugins.render.codefence_syntax_highlighter = Some(sh);
    }
    if let Some(ref ha) = heading_adapter {
        plugins.render.heading_adapter = Some(ha);
    }

    markdown_to_commonmark_xml_with_plugins(md, &opts, &plugins)
}

// --- Codefence Renderer Adapter ---

#[wasm_bindgen]
pub struct CodefenceRenderer {
    write_fn: Function,
}

unsafe impl Send for CodefenceRenderer {}
unsafe impl Sync for CodefenceRenderer {}
impl std::panic::RefUnwindSafe for CodefenceRenderer {}

#[wasm_bindgen]
impl CodefenceRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new(write_fn: Function) -> Self {
        Self { write_fn }
    }
}

impl ComrakCodefenceRendererAdapter for CodefenceRenderer {
    fn write(
        &self,
        output: &mut dyn fmt::Write,
        lang: &str,
        meta: &str,
        code: &str,
        _sourcepos: Option<comrak::nodes::Sourcepos>,
    ) -> fmt::Result {
        let this = JsValue::null();
        let js_lang = JsValue::from_str(lang);
        let js_meta = JsValue::from_str(meta);
        let js_code = JsValue::from_str(code);
        let args = js_sys::Array::of3(&js_lang, &js_meta, &js_code);
        let result = self.write_fn.apply(&this, &args);
        if let Ok(val) = result {
            if let Some(s) = val.as_string() {
                return output.write_str(&s);
            }
        }
        Ok(())
    }
}

#[wasm_bindgen(js_name = mdToHtmlWithCodefenceRenderers)]
pub fn md_to_html_with_codefence_renderers(
    md: &str,
    options: JsValue,
    renderers: JsValue,
    syntax_highlighter: Option<SyntaxHighlighter>,
    heading_adapter: Option<HeadingAdapter>,
) -> String {
    let opts = build_options(parse_options(options));
    let mut plugins = Plugins::default();

    if let Some(ref sh) = syntax_highlighter {
        plugins.render.codefence_syntax_highlighter = Some(sh);
    }
    if let Some(ref ha) = heading_adapter {
        plugins.render.heading_adapter = Some(ha);
    }

    // Parse codefence renderers from JS object { lang: Function }
    let mut cf_renderers: Vec<(String, CodefenceRenderer)> = Vec::new();
    if !renderers.is_null() && !renderers.is_undefined() {
        if let Ok(obj) = renderers.dyn_into::<js_sys::Object>() {
        let keys = js_sys::Object::keys(&obj);
        let obj: JsValue = obj.into();
        for i in 0..keys.length() {
            let key_val = keys.get(i);
            if let Some(key) = key_val.as_string() {
                if let Ok(func) = js_sys::Reflect::get(&obj, &JsValue::from_str(&key)) {
                    if let Ok(f) = func.dyn_into::<Function>() {
                        cf_renderers.push((key, CodefenceRenderer::new(f)));
                    }
                }
            }
        }
        }
    }

    for (lang, renderer) in &cf_renderers {
        plugins
            .render
            .codefence_renderers
            .insert(lang.clone(), renderer);
    }

    markdown_to_html_with_plugins(md, &opts, &plugins)
}

// --- URL Rewriter ---

struct JsUrlRewriter {
    rewrite_fn: Function,
}

unsafe impl Send for JsUrlRewriter {}
unsafe impl Sync for JsUrlRewriter {}
impl std::panic::RefUnwindSafe for JsUrlRewriter {}

impl comrak::options::URLRewriter for JsUrlRewriter {
    fn to_html(&self, url: &str) -> String {
        let this = JsValue::null();
        let js_url = JsValue::from_str(url);
        let result = self.rewrite_fn.call1(&this, &js_url);
        if let Ok(val) = result {
            if let Some(s) = val.as_string() {
                return s;
            }
        }
        url.to_string()
    }
}

#[wasm_bindgen(js_name = mdToHtmlWithRewriters)]
pub fn md_to_html_with_rewriters(
    md: &str,
    options: JsValue,
    image_url_rewriter: JsValue,
    link_url_rewriter: JsValue,
) -> String {
    let mut opts = build_options(parse_options(options));

    if !image_url_rewriter.is_null() && !image_url_rewriter.is_undefined() {
        if let Ok(f) = image_url_rewriter.dyn_into::<Function>() {
            opts.extension.image_url_rewriter = Some(Arc::new(JsUrlRewriter { rewrite_fn: f }));
        }
    }
    if !link_url_rewriter.is_null() && !link_url_rewriter.is_undefined() {
        if let Ok(f) = link_url_rewriter.dyn_into::<Function>() {
            opts.extension.link_url_rewriter = Some(Arc::new(JsUrlRewriter { rewrite_fn: f }));
        }
    }

    markdown_to_html(md, &opts)
}

// --- Text output ---

#[wasm_bindgen(js_name = mdToText)]
pub fn md_to_text(
    md: &str,
    options: JsValue,
    show_urls: Option<bool>,
    show_markdown: Option<bool>,
    table_shadow: Option<String>,
) -> String {
    let opts = build_options(parse_options(options));
    let arena = Arena::new();
    let root = parse_document(&arena, md, &opts);
    let shadow = match table_shadow {
        Some(ref s) if s.is_empty() => None,
        Some(s) => Some(s),
        None => Some("░".into()),
    };
    text::format_text(root, show_urls.unwrap_or(false), show_markdown.unwrap_or(false), shadow)
}

// --- ANSI output ---

#[wasm_bindgen(js_name = mdToAnsi)]
pub fn md_to_ansi(md: &str, options: JsValue, theme: JsValue) -> String {
    let opts = build_options(parse_options(options));
    let arena = Arena::new();
    let root = parse_document(&arena, md, &opts);

    let theme = if theme.is_undefined() || theme.is_null() {
        None
    } else {
        serde_wasm_bindgen::from_value::<ansi::AnsiTheme>(theme).ok()
    };

    ansi::format_ansi(root, theme)
}

#[wasm_bindgen(js_name = ansiThemeDark)]
pub fn ansi_theme_dark() -> JsValue {
    serde_wasm_bindgen::to_value(&ansi::AnsiTheme::dark()).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen(js_name = ansiThemeLight)]
pub fn ansi_theme_light() -> JsValue {
    serde_wasm_bindgen::to_value(&ansi::AnsiTheme::light()).unwrap_or(JsValue::NULL)
}

/// Detect color scheme from the COLORFGBG environment variable.
/// Returns "light" or "dark". Background values 7 or 15 indicate a light terminal.
#[wasm_bindgen(js_name = detectColorScheme)]
pub fn detect_color_scheme(colorfgbg: Option<String>) -> String {
    match colorfgbg {
        Some(ref s) => {
            if let Some(bg) = s.rsplit(';').next() {
                match bg.trim() {
                    "7" | "15" => return "light".into(),
                    _ => {}
                }
            }
            "dark".into()
        }
        None => "dark".into(),
    }
}

/// Auto-select dark or light theme based on COLORFGBG value.
#[wasm_bindgen(js_name = ansiThemeAuto)]
pub fn ansi_theme_auto(colorfgbg: Option<String>) -> JsValue {
    if detect_color_scheme(colorfgbg) == "light" {
        ansi_theme_light()
    } else {
        ansi_theme_dark()
    }
}

// --- Frontmatter ---

#[wasm_bindgen(js_name = getFrontmatter)]
pub fn get_frontmatter(md: &str, options: JsValue) -> Option<String> {
    let opts = build_options(parse_options(options));
    let arena = Arena::new();
    let root = parse_document(&arena, md, &opts);
    for child in root.children() {
        if let comrak::nodes::NodeValue::FrontMatter(ref s) = child.data.borrow().value {
            let trimmed = s.trim();
            // Strip opening and closing delimiter lines
            let content = trimmed
                .strip_prefix("---").or_else(|| trimmed.strip_prefix("+++"))
                .unwrap_or(trimmed)
                .trim_start_matches('\n');
            let content = content
                .strip_suffix("---").or_else(|| content.strip_suffix("+++"))
                .unwrap_or(content)
                .trim_end_matches('\n');
            if content.is_empty() {
                return None;
            }
            return Some(content.to_string());
        }
    }
    None
}

// --- Heal ---

#[wasm_bindgen(js_name = healMarkdown)]
pub fn heal_markdown_js(md: &str) -> String {
    heal::heal_markdown(md)
}
