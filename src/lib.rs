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
    markdown_to_commonmark, markdown_to_commonmark_xml, markdown_to_html,
    markdown_to_html_with_plugins, parse_document, Arena,
};
use js_sys::Function;
use serde::Deserialize;
use std::sync::Arc;
use wasm_bindgen::prelude::*;

#[cfg(all(target_arch = "wasm32", target_feature = "atomics"))]
compile_error!("comrak-wasm does not support threaded Wasm; build without target_feature=atomics");

#[cfg(all(target_arch = "wasm32", not(target_feature = "atomics")))]
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
    math_latex: Option<bool>,
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
    block_directive: Option<bool>,
    header_attributes: Option<bool>,
    fenced_code_attributes: Option<bool>,
    inline_code_attributes: Option<bool>,
    link_attributes: Option<bool>,
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
    sourcepos_chars: Option<bool>,
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
    list_style: Option<ListStyle>,
    sourcepos: Option<bool>,
    escaped_char_spans: Option<bool>,
    ignore_empty_links: Option<bool>,
    gfm_quirks: Option<bool>,
    prefer_fenced: Option<bool>,
    figure_with_caption: Option<bool>,
    tasklist_classes: Option<bool>,
    alert_style: Option<AlertStyle>,
    ol_width: Option<usize>,
    experimental_minimize_commonmark: Option<bool>,
    compact_html: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum ListStyle {
    Dash,
    Plus,
    Star,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
enum AlertStyle {
    Specific,
    Semantic,
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
        set_bool!(math_latex);
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
        set_bool!(block_directive);
        set_bool!(header_attributes);
        set_bool!(fenced_code_attributes);
        set_bool!(inline_code_attributes);
        set_bool!(link_attributes);

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
        set_bool!(sourcepos_chars);

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
            options.render.list_style = match v {
                ListStyle::Dash => comrak::options::ListStyleType::Dash,
                ListStyle::Plus => comrak::options::ListStyleType::Plus,
                ListStyle::Star => comrak::options::ListStyleType::Star,
            };
        }
        if let Some(v) = render.alert_style {
            options.render.alert_style = match v {
                AlertStyle::Specific => comrak::options::AlertStyleType::Specific,
                AlertStyle::Semantic => comrak::options::AlertStyleType::Semantic,
            };
        }
        if let Some(v) = render.ol_width {
            options.render.ol_width = v;
        }
    }

    options
}

/// Parse a JS options object into `ComrakOptions`. A missing/`null`/`undefined`
/// value yields defaults. Malformed fields throw a JavaScript exception instead
/// of silently discarding otherwise valid options.
fn parse_options(val: JsValue) -> Result<ComrakOptions, JsValue> {
    if val.is_undefined() || val.is_null() {
        Ok(ComrakOptions::default())
    } else {
        serde_wasm_bindgen::from_value(val)
            .map_err(|error| js_sys::Error::new(&format!("invalid comrak options: {error}")).into())
    }
}

#[wasm_bindgen(js_name = comrakVersion)]
pub fn comrak_version() -> String {
    comrak::version().to_string()
}

#[wasm_bindgen(js_name = mdToHtml)]
pub fn md_to_html(md: &str, options: JsValue) -> Result<String, JsValue> {
    let opts = build_options(parse_options(options)?);
    Ok(markdown_to_html(md, &opts))
}

#[wasm_bindgen(js_name = mdToCommonmark)]
pub fn md_to_commonmark(md: &str, options: JsValue) -> Result<String, JsValue> {
    let opts = build_options(parse_options(options)?);
    Ok(markdown_to_commonmark(md, &opts))
}

// --- Syntax Highlighter Adapter ---

#[wasm_bindgen]
pub struct SyntaxHighlighter {
    highlight: Function,
    pre: Function,
    code: Function,
}

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

    #[wasm_bindgen(js_name = clone)]
    pub fn clone_js(&self) -> Self {
        Self {
            highlight: self.highlight.clone(),
            pre: self.pre.clone(),
            code: self.code.clone(),
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
        if let Some(value) = self
            .highlight
            .call2(&this, &js_code, &js_lang)
            .ok()
            .and_then(|value| value.as_string())
        {
            return output.write_str(&value);
        }
        comrak::html::escape(output, code)
    }

    fn write_pre_tag(
        &self,
        output: &mut dyn fmt::Write,
        attributes: HashMap<&'static str, Cow<'_, str>>,
    ) -> fmt::Result {
        let this = JsValue::null();
        let js_attrs = js_sys::Object::new();
        for (k, v) in &attributes {
            js_sys::Reflect::set(&js_attrs, &JsValue::from_str(k), &JsValue::from_str(v)).ok();
        }
        if let Some(value) = self
            .pre
            .call1(&this, &js_attrs)
            .ok()
            .and_then(|value| value.as_string())
        {
            return output.write_str(&value);
        }
        comrak::html::write_opening_tag(output, "pre", attributes)
    }

    fn write_code_tag(
        &self,
        output: &mut dyn fmt::Write,
        attributes: HashMap<&'static str, Cow<'_, str>>,
    ) -> fmt::Result {
        let this = JsValue::null();
        let js_attrs = js_sys::Object::new();
        for (k, v) in &attributes {
            js_sys::Reflect::set(&js_attrs, &JsValue::from_str(k), &JsValue::from_str(v)).ok();
        }
        if let Some(value) = self
            .code
            .call1(&this, &js_attrs)
            .ok()
            .and_then(|value| value.as_string())
        {
            return output.write_str(&value);
        }
        comrak::html::write_opening_tag(output, "code", attributes)
    }
}

// --- Heading Adapter ---

#[wasm_bindgen]
pub struct HeadingAdapter {
    enter: Function,
    exit: Function,
}

impl std::panic::RefUnwindSafe for HeadingAdapter {}

#[wasm_bindgen]
impl HeadingAdapter {
    #[wasm_bindgen(constructor)]
    pub fn new(enter: Function, exit: Function) -> Self {
        Self { enter, exit }
    }

    #[wasm_bindgen(js_name = clone)]
    pub fn clone_js(&self) -> Self {
        Self {
            enter: self.enter.clone(),
            exit: self.exit.clone(),
        }
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
        if let Some(value) = self
            .enter
            .call1(&this, &js_heading)
            .ok()
            .and_then(|value| value.as_string())
        {
            return output.write_str(&value);
        }
        write!(output, "<h{}>", heading.level)
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
        if let Some(value) = self
            .exit
            .call1(&this, &js_heading)
            .ok()
            .and_then(|value| value.as_string())
        {
            return output.write_str(&value);
        }
        write!(output, "</h{}>", heading.level)
    }
}

// --- HTML with plugins ---

/// Build `Plugins` wired with the optional syntax-highlighter and heading
/// adapters. The result borrows from both adapters, so they must outlive it.
fn build_plugins<'a>(
    syntax_highlighter: Option<&'a SyntaxHighlighter>,
    heading_adapter: Option<&'a HeadingAdapter>,
) -> Plugins<'a> {
    let mut plugins = Plugins::default();
    if let Some(sh) = syntax_highlighter {
        plugins.render.codefence_syntax_highlighter = Some(sh);
    }
    if let Some(ha) = heading_adapter {
        plugins.render.heading_adapter = Some(ha);
    }
    plugins
}

#[wasm_bindgen(js_name = __mdToHtmlWithPluginsOwned)]
pub fn md_to_html_with_plugins_js(
    md: &str,
    options: JsValue,
    syntax_highlighter: Option<SyntaxHighlighter>,
    heading_adapter: Option<HeadingAdapter>,
) -> Result<String, JsValue> {
    let opts = build_options(parse_options(options)?);
    let plugins = build_plugins(syntax_highlighter.as_ref(), heading_adapter.as_ref());
    Ok(markdown_to_html_with_plugins(md, &opts, &plugins))
}

// --- XML output ---

#[wasm_bindgen(js_name = mdToXml)]
pub fn md_to_xml(md: &str, options: JsValue) -> Result<String, JsValue> {
    let opts = build_options(parse_options(options)?);
    Ok(markdown_to_commonmark_xml(md, &opts))
}

// --- Codefence Renderer Adapter ---

#[wasm_bindgen]
pub struct CodefenceRenderer {
    write_fn: Function,
}

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
        if let Some(value) = self
            .write_fn
            .apply(&this, &args)
            .ok()
            .and_then(|value| value.as_string())
        {
            return output.write_str(&value);
        }

        comrak::html::write_opening_tag(output, "pre", std::iter::empty::<(&str, &str)>())?;
        let class = (!lang.is_empty()).then(|| format!("language-{lang}"));
        comrak::html::write_opening_tag(
            output,
            "code",
            class.as_deref().map(|value| ("class", value)),
        )?;
        comrak::html::escape(output, code)?;
        output.write_str("</code></pre>\n")
    }
}

#[wasm_bindgen(js_name = __mdToHtmlWithCodefenceRenderersOwned)]
pub fn md_to_html_with_codefence_renderers(
    md: &str,
    options: JsValue,
    renderers: JsValue,
    syntax_highlighter: Option<SyntaxHighlighter>,
    heading_adapter: Option<HeadingAdapter>,
) -> Result<String, JsValue> {
    let opts = build_options(parse_options(options)?);

    // Parse codefence renderers from JS object { lang: Function } first, so the
    // Vec outlives the Plugins that borrows from it.
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

    let mut plugins = build_plugins(syntax_highlighter.as_ref(), heading_adapter.as_ref());
    for (lang, renderer) in &cf_renderers {
        plugins
            .render
            .codefence_renderers
            .insert(lang.clone(), renderer);
    }

    Ok(markdown_to_html_with_plugins(md, &opts, &plugins))
}

// --- URL Rewriter ---

struct JsUrlRewriter {
    rewrite_fn: Function,
}

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
) -> Result<String, JsValue> {
    let mut opts = build_options(parse_options(options)?);

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

    Ok(markdown_to_html(md, &opts))
}

// --- Text output ---

#[wasm_bindgen(js_name = mdToText)]
pub fn md_to_text(
    md: &str,
    options: JsValue,
    show_urls: Option<bool>,
    show_markdown: Option<bool>,
    table_shadow: Option<String>,
) -> Result<String, JsValue> {
    let opts = build_options(parse_options(options)?);
    let arena = Arena::new();
    let root = parse_document(&arena, md, &opts);
    ensure_walker_depth(root)?;
    let shadow = match table_shadow {
        Some(ref s) if s.is_empty() => None,
        Some(s) => Some(s),
        None => Some("░".into()),
    };
    Ok(text::format_text(
        root,
        show_urls.unwrap_or(false),
        show_markdown.unwrap_or(false),
        shadow,
    ))
}

// --- ANSI output ---

#[wasm_bindgen(js_name = mdToAnsi)]
pub fn md_to_ansi(md: &str, options: JsValue, theme: JsValue) -> Result<String, JsValue> {
    let opts = build_options(parse_options(options)?);
    let arena = Arena::new();
    let root = parse_document(&arena, md, &opts);
    ensure_walker_depth(root)?;

    let theme = if theme.is_undefined() || theme.is_null() {
        None
    } else {
        Some(
            serde_wasm_bindgen::from_value::<ansi::AnsiTheme>(theme).map_err(|error| {
                JsValue::from(js_sys::Error::new(&format!("invalid ANSI theme: {error}")))
            })?,
        )
    };

    Ok(ansi::format_ansi(root, theme))
}

fn ensure_walker_depth<'a>(root: &'a walker::AstNode<'a>) -> Result<(), JsValue> {
    if walker::nesting_within_limit(root) {
        Ok(())
    } else {
        Err(js_sys::RangeError::new(&format!(
            "markdown nesting exceeds the text/ANSI limit of {}",
            walker::MAX_NESTING_DEPTH
        ))
        .into())
    }
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
pub fn get_frontmatter(md: &str, options: JsValue) -> Result<Option<String>, JsValue> {
    let opts = build_options(parse_options(options)?);
    let arena = Arena::new();
    let root = parse_document(&arena, md, &opts);
    // comrak only emits a FrontMatter node when a delimiter is configured, so
    // strip exactly that delimiter from both ends (open and close must match).
    let delim = opts
        .extension
        .front_matter_delimiter
        .as_deref()
        .unwrap_or("---");
    for child in root.children() {
        if let comrak::nodes::NodeValue::FrontMatter(ref s) = child.data.borrow().value {
            let trimmed = s.trim();
            let content = trimmed
                .strip_prefix(delim)
                .unwrap_or(trimmed)
                .trim_start_matches('\n');
            let content = content
                .strip_suffix(delim)
                .unwrap_or(content)
                .trim_end_matches('\n');
            if content.is_empty() {
                return Ok(None);
            }
            return Ok(Some(content.to_string()));
        }
    }
    Ok(None)
}

// --- Heal ---

#[wasm_bindgen(js_name = healMarkdown)]
pub fn heal_markdown_js(md: &str) -> String {
    heal::heal_markdown(md)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_options_bridges_comrak_054_fields() {
        let options = build_options(ComrakOptions {
            extension: Some(ExtensionOptions {
                math_latex: Some(true),
                block_directive: Some(true),
                header_attributes: Some(true),
                fenced_code_attributes: Some(true),
                inline_code_attributes: Some(true),
                link_attributes: Some(true),
                ..ExtensionOptions::default()
            }),
            parse: Some(ParseOptions {
                sourcepos_chars: Some(true),
                ..ParseOptions::default()
            }),
            render: Some(RenderOptions {
                alert_style: Some(AlertStyle::Semantic),
                ..RenderOptions::default()
            }),
        });

        assert!(options.extension.math_latex);
        assert!(options.extension.block_directive);
        assert!(options.extension.header_attributes);
        assert!(options.extension.fenced_code_attributes);
        assert!(options.extension.inline_code_attributes);
        assert!(options.extension.link_attributes);
        assert!(options.parse.sourcepos_chars);
        assert!(matches!(
            options.render.alert_style,
            comrak::options::AlertStyleType::Semantic
        ));
    }
}
