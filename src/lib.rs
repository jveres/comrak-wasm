mod ansi;
mod ast;
mod heal;
mod options;
mod plugins;
mod streaming;
mod text;
mod walker;

use comrak::{
    markdown_to_commonmark, markdown_to_commonmark_xml, markdown_to_html, parse_document, Arena,
};
use wasm_bindgen::prelude::*;

#[cfg(all(target_arch = "wasm32", target_feature = "atomics"))]
compile_error!("comrak-wasm does not support threaded Wasm; build without target_feature=atomics");

#[cfg(all(target_arch = "wasm32", not(target_feature = "atomics")))]
#[global_allocator]
static ALLOCATOR: lol_alloc::AssumeSingleThreaded<lol_alloc::FreeListAllocator> =
    unsafe { lol_alloc::AssumeSingleThreaded::new(lol_alloc::FreeListAllocator::new()) };

#[wasm_bindgen(js_name = comrakVersion)]
pub fn comrak_version() -> String {
    comrak::version().to_string()
}

/// Escapes text for literal inclusion in a CommonMark document at a
/// position where inline parsing occurs. The write-direction escaping
/// authority for editors serializing user-typed text into Markdown:
/// `**`, `__init__`, or a leading `# ` come back escaped so they render
/// as themselves. Comrak escapes more than strictly necessary; the
/// rendering is unaffected.
#[wasm_bindgen(js_name = escapeCommonmarkInline)]
pub fn escape_commonmark_inline(text: &str) -> String {
    comrak::escape_commonmark_inline(text)
}

/// Escapes a URL for inclusion as a CommonMark link destination. Emits
/// the bracketed `<...>` form, which admits spaces and parentheses by
/// construction.
#[wasm_bindgen(js_name = escapeCommonmarkLinkDestination)]
pub fn escape_commonmark_link_destination(url: &str) -> String {
    comrak::escape_commonmark_link_destination(url)
}

/// Canonicalizes an inline-intent Markdown paragraph: parse and print
/// back with only the escapes that matter (`escapeCommonmarkInline` is
/// deliberately over-conservative — `cut\.` prints back as `cut.`),
/// while line-edge whitespace survives as numeric character references
/// (the block parser treats 4+ leading spaces as indented code, strips
/// continuation-line indents and trims trailing spaces; `&#32;`/`&#9;`
/// decode to the exact bytes without counting as line structure). The
/// output never ends with the printer's own trailing newline.
#[wasm_bindgen(js_name = canonicalizeCommonmarkInline)]
pub fn canonicalize_commonmark_inline(md: &str, options: JsValue) -> Result<String, JsValue> {
    let options = options::from_js(Some(options))?;
    let printed = markdown_to_commonmark(&guard_edges(md), &options);
    let flat = printed.strip_suffix('\n').unwrap_or(&printed);
    Ok(guard_edges(flat))
}

/// Renders ONE paragraph's inline Markdown to HTML — the explicit
/// inline-only contract: the input must parse to exactly one paragraph
/// (or nothing, which renders ""); anything else — a heading, a list,
/// an indented code block — is an error, never silent block markup.
/// The output is the paragraph's inner HTML with HTML5 break spelling
/// (`<br>`, no cosmetic newline), ready to splice into a host element.
const NOT_ONE_PARAGRAPH: &str = "mdToInlineHtml: input is not a single paragraph";

#[wasm_bindgen(js_name = mdToInlineHtml)]
pub fn md_to_inline_html(md: &str, options: JsValue) -> Result<String, JsValue> {
    let mut options = options::from_js(Some(options))?;
    options.render.compact_html = true;
    let arena = Arena::new();
    let root = parse_document(&arena, md, &options);
    let mut blocks = root.children();
    let Some(first) = blocks.next() else {
        return Ok(String::new());
    };
    let paragraph = matches!(
        first.data.borrow().value,
        comrak::nodes::NodeValue::Paragraph
    );
    if blocks.next().is_some() || !paragraph {
        return Err(JsValue::from_str(NOT_ONE_PARAGRAPH));
    }
    // Render from the tree already in hand — the previous shape
    // re-parsed the identical input (2x the cost of every inline
    // render downstream).
    let mut html = String::new();
    comrak::format_html(root, &options, &mut html)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let inner = html
        .trim()
        .strip_prefix("<p>")
        .and_then(|rest| rest.strip_suffix("</p>"))
        .ok_or_else(|| JsValue::from_str(NOT_ONE_PARAGRAPH))?;
    Ok(inner.replace("<br />", "<br>"))
}

/// The whole AST as plain JSON (`{ type, sourcepos, …fields, children }`
/// per node). Comrak's tree is arena-allocated and lifetime-bound — it
/// cannot cross the wasm boundary as live objects, so this is the
/// honest export: one serialization into JS-native values, every node
/// type mapped exhaustively (a comrak upgrade that adds one fails the
/// build rather than dropping nodes).
#[wasm_bindgen(js_name = mdToAst)]
pub fn md_to_ast(md: &str, options: JsValue) -> Result<JsValue, JsValue> {
    let options = options::from_js(Some(options))?;
    let arena = Arena::new();
    let root = parse_document(&arena, md, &options);
    ast::to_js(&ast::json_of(root))
}

fn guard_edges(text: &str) -> String {
    let encode = |s: &str| -> String {
        s.chars()
            .map(|c| if c == '\t' { "&#9;" } else { "&#32;" })
            .collect()
    };
    text.split('\n')
        .map(|line| {
            let start = line.len() - line.trim_start_matches([' ', '\t']).len();
            let end = line.trim_end_matches([' ', '\t']).len();
            if start >= end {
                encode(line)
            } else {
                format!(
                    "{}{}{}",
                    encode(&line[..start]),
                    &line[start..end],
                    encode(&line[end..])
                )
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

pub(crate) fn render_html(md: &str, options: &comrak::Options<'_>) -> String {
    markdown_to_html(md, options)
}

fn render_commonmark(md: &str, options: &comrak::Options<'_>) -> String {
    markdown_to_commonmark(md, options)
}

fn render_xml(md: &str, options: &comrak::Options<'_>) -> String {
    markdown_to_commonmark_xml(md, options)
}

#[wasm_bindgen(js_name = mdToHtml)]
pub fn md_to_html(md: &str, options: JsValue) -> Result<String, JsValue> {
    let options = options::from_js(Some(options))?;
    Ok(render_html(md, &options))
}

/// Render an incomplete streaming document with one U+2060 cursor marker.
#[wasm_bindgen(js_name = mdToStreamingHtml)]
pub fn md_to_streaming_html(
    md: &str,
    writing_offset: f64,
    options: JsValue,
) -> Result<String, JsValue> {
    let options = options::from_js(Some(options))?;
    let prefix = streaming::prefix_at_utf16(md, writing_offset).map_err(JsValue::from_str)?;
    Ok(streaming::render(prefix, &options))
}

#[wasm_bindgen(js_name = mdToCommonmark)]
pub fn md_to_commonmark(md: &str, options: JsValue) -> Result<String, JsValue> {
    let options = options::from_js(Some(options))?;
    Ok(render_commonmark(md, &options))
}

#[wasm_bindgen(js_name = mdToXml)]
pub fn md_to_xml(md: &str, options: JsValue) -> Result<String, JsValue> {
    let options = options::from_js(Some(options))?;
    Ok(render_xml(md, &options))
}

fn render_text(
    md: &str,
    options: &comrak::Options<'_>,
    show_urls: Option<bool>,
    show_markdown: Option<bool>,
    table_shadow: Option<String>,
) -> Result<String, JsValue> {
    let arena = Arena::new();
    let root = parse_document(&arena, md, options);
    ensure_walker_depth(root)?;
    let shadow = match table_shadow {
        Some(shadow) => validate_table_shadow(shadow)?,
        None => Some("░".into()),
    };
    Ok(text::format_text(
        root,
        show_urls.unwrap_or(false),
        show_markdown.unwrap_or(false),
        shadow,
    ))
}

fn validate_table_shadow(shadow: String) -> Result<Option<String>, JsValue> {
    if shadow.is_empty() {
        return Ok(None);
    }

    let mut characters = shadow.chars();
    let character = characters.next().expect("non-empty string has a character");
    if characters.next().is_some() || character.is_control() {
        return Err(js_sys::TypeError::new(
            "tableShadow must be empty or one non-control Unicode scalar value",
        )
        .into());
    }
    Ok(Some(shadow))
}

#[wasm_bindgen(js_name = mdToText)]
pub fn md_to_text(
    md: &str,
    options: JsValue,
    show_urls: Option<bool>,
    show_markdown: Option<bool>,
    table_shadow: Option<String>,
) -> Result<String, JsValue> {
    let options = options::from_js(Some(options))?;
    render_text(md, &options, show_urls, show_markdown, table_shadow)
}

fn prepare_ansi_theme(theme: JsValue) -> Result<ansi::AnsiTheme, JsValue> {
    let mut theme = if theme.is_undefined() || theme.is_null() {
        ansi::AnsiTheme::default()
    } else {
        serde_wasm_bindgen::from_value::<ansi::AnsiTheme>(theme)
            .map_err(|error| js_sys::Error::new(&format!("invalid ANSI theme: {error}")))?
            .merge_with_defaults()
    };
    theme.table_shadow = match theme.table_shadow.take() {
        Some(shadow) => validate_table_shadow(shadow)?,
        None => None,
    };
    Ok(theme)
}

fn render_ansi_prepared(
    md: &str,
    options: &comrak::Options<'_>,
    theme: &ansi::AnsiTheme,
) -> Result<String, JsValue> {
    let arena = Arena::new();
    let root = parse_document(&arena, md, options);
    ensure_walker_depth(root)?;
    Ok(ansi::format_ansi_prepared(root, theme))
}

fn render_ansi(md: &str, options: &comrak::Options<'_>, theme: JsValue) -> Result<String, JsValue> {
    let theme = prepare_ansi_theme(theme)?;
    render_ansi_prepared(md, options, &theme)
}

#[wasm_bindgen(js_name = mdToAnsi)]
pub fn md_to_ansi(md: &str, options: JsValue, theme: JsValue) -> Result<String, JsValue> {
    let options = options::from_js(Some(options))?;
    render_ansi(md, &options, theme)
}

/// ANSI theme prepared once for repeated renders without repeated JavaScript
/// deserialization, string allocation, or default merging.
#[wasm_bindgen]
pub struct PreparedAnsiTheme {
    theme: ansi::AnsiTheme,
}

#[wasm_bindgen]
impl PreparedAnsiTheme {
    #[wasm_bindgen(constructor)]
    pub fn new(theme: Option<JsValue>) -> Result<PreparedAnsiTheme, JsValue> {
        Ok(Self {
            theme: prepare_ansi_theme(theme.unwrap_or(JsValue::UNDEFINED))?,
        })
    }
}

#[wasm_bindgen(js_name = mdToAnsiWithTheme)]
pub fn md_to_ansi_with_theme(
    md: &str,
    options: JsValue,
    theme: &PreparedAnsiTheme,
) -> Result<String, JsValue> {
    let options = options::from_js(Some(options))?;
    render_ansi_prepared(md, &options, &theme.theme)
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
        Some(value) => {
            if let Some("7" | "15") = value.rsplit(';').next().map(str::trim) {
                return "light".into();
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

fn strip_prefix_line_ending(value: &str) -> Option<&str> {
    value
        .strip_prefix("\r\n")
        .or_else(|| value.strip_prefix('\n'))
}

fn strip_suffix_line_ending(value: &str) -> Option<&str> {
    value
        .strip_suffix("\r\n")
        .or_else(|| value.strip_suffix('\n'))
}

fn frontmatter_content<'a>(raw: &'a str, delimiter: &str) -> Option<&'a str> {
    let mut after_open = strip_prefix_line_ending(raw.strip_prefix(delimiter)?)?;

    // Comrak includes the closing line ending and, when present, the blank line
    // following the frontmatter node. Remove those complete line endings first.
    while let Some(stripped) = strip_suffix_line_ending(after_open) {
        after_open = stripped;
    }

    let before_close = after_open.strip_suffix(delimiter)?;
    if before_close.is_empty() {
        Some("")
    } else {
        // The closing delimiter occupies its own line. Remove exactly the LF or
        // CRLF that terminates the content while preserving content whitespace.
        strip_suffix_line_ending(before_close)
    }
}

/// Port of comrak's private `strings::split_off_front_matter`, returning the
/// raw front-matter block (delimiters, closing line ending, and the optional
/// blank line that follows) without parsing the whole document. The closing
/// line search order and the newline-or-EOF requirement after the closing
/// delimiter deliberately mirror comrak so both agree on every input.
fn split_off_frontmatter<'a>(source: &'a str, delimiter: &str) -> Option<&'a str> {
    let source = source.strip_prefix('\u{feff}').unwrap_or(source);
    let body = strip_prefix_line_ending(source.strip_prefix(delimiter)?)?;
    let body_start = source.len() - body.len();

    let close_index = body
        .find(&format!("\n{delimiter}\r\n"))
        .or_else(|| body.find(&format!("\n{delimiter}\n")))
        .or_else(|| body.find(&format!("\n{delimiter}")))?;
    let mut end = body_start + close_index + 1 + delimiter.len();

    if end == source.len() {
        return Some(source);
    }
    let after_close = strip_prefix_line_ending(&source[end..])?;
    end = source.len() - after_close.len();
    if let Some(after_blank) = strip_prefix_line_ending(&source[end..]) {
        end = source.len() - after_blank.len();
    }
    Some(&source[..end])
}

fn extract_frontmatter(md: &str, options: &comrak::Options<'_>) -> Option<String> {
    let delimiter = options.extension.front_matter_delimiter.as_deref()?;
    let raw = split_off_frontmatter(md, delimiter)?;
    let content = frontmatter_content(raw, delimiter)?;
    (!content.is_empty()).then(|| content.to_string())
}

#[wasm_bindgen(js_name = getFrontmatter)]
pub fn get_frontmatter(md: &str, options: JsValue) -> Result<Option<String>, JsValue> {
    let options = options::from_js(Some(options))?;
    Ok(extract_frontmatter(md, &options))
}

/// Options prepared once for repeated renders without repeated JS
/// deserialization and comrak option mapping.
#[wasm_bindgen]
pub struct PreparedOptions {
    options: comrak::Options<'static>,
}

#[wasm_bindgen]
impl PreparedOptions {
    #[wasm_bindgen(constructor)]
    pub fn new(options: Option<JsValue>) -> Result<PreparedOptions, JsValue> {
        Ok(Self {
            options: options::from_js(options)?,
        })
    }

    #[wasm_bindgen(js_name = mdToHtml)]
    pub fn md_to_html(&self, md: &str) -> String {
        render_html(md, &self.options)
    }

    #[wasm_bindgen(js_name = __mdToHtmlWithPluginsOwned)]
    pub fn md_to_html_with_plugins(
        &self,
        md: &str,
        syntax_highlighter: Option<plugins::SyntaxHighlighter>,
        heading_adapter: Option<plugins::HeadingAdapter>,
    ) -> String {
        plugins::render_html_with_plugins(
            md,
            &self.options,
            syntax_highlighter.as_ref(),
            heading_adapter.as_ref(),
        )
    }

    #[wasm_bindgen(js_name = __mdToHtmlWithCodefenceRenderersOwned)]
    pub fn md_to_html_with_codefence_renderers(
        &self,
        md: &str,
        renderers: &plugins::PreparedCodefenceRenderers,
        syntax_highlighter: Option<plugins::SyntaxHighlighter>,
        heading_adapter: Option<plugins::HeadingAdapter>,
    ) -> String {
        plugins::render_html_with_codefence_renderers(
            md,
            &self.options,
            renderers,
            syntax_highlighter.as_ref(),
            heading_adapter.as_ref(),
        )
    }

    #[wasm_bindgen(js_name = mdToCommonmark)]
    pub fn md_to_commonmark(&self, md: &str) -> String {
        render_commonmark(md, &self.options)
    }

    #[wasm_bindgen(js_name = mdToXml)]
    pub fn md_to_xml(&self, md: &str) -> String {
        render_xml(md, &self.options)
    }

    #[wasm_bindgen(js_name = mdToText)]
    pub fn md_to_text(
        &self,
        md: &str,
        show_urls: Option<bool>,
        show_markdown: Option<bool>,
        table_shadow: Option<String>,
    ) -> Result<String, JsValue> {
        render_text(md, &self.options, show_urls, show_markdown, table_shadow)
    }

    #[wasm_bindgen(js_name = mdToAnsi)]
    pub fn md_to_ansi(&self, md: &str, theme: JsValue) -> Result<String, JsValue> {
        render_ansi(md, &self.options, theme)
    }

    #[wasm_bindgen(js_name = mdToAnsiWithTheme)]
    pub fn md_to_ansi_with_theme(
        &self,
        md: &str,
        theme: &PreparedAnsiTheme,
    ) -> Result<String, JsValue> {
        render_ansi_prepared(md, &self.options, &theme.theme)
    }

    #[wasm_bindgen(js_name = getFrontmatter)]
    pub fn get_frontmatter(&self, md: &str) -> Option<String> {
        extract_frontmatter(md, &self.options)
    }
}

#[wasm_bindgen(js_name = healMarkdown)]
pub fn heal_markdown_js(md: &str) -> String {
    heal::heal_markdown(md)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frontmatter_options() -> comrak::Options<'static> {
        let mut options = comrak::Options::default();
        options.extension.front_matter_delimiter = Some("---".into());
        options
    }

    #[test]
    fn extracts_lf_frontmatter() {
        assert_eq!(
            extract_frontmatter("---\ntitle: Hello\n---\n\n# Body", &frontmatter_options()),
            Some("title: Hello".into())
        );
    }

    #[test]
    fn extracts_crlf_frontmatter() {
        assert_eq!(
            extract_frontmatter(
                "---\r\ntitle: Hello\r\n---\r\n\r\n# Body",
                &frontmatter_options()
            ),
            Some("title: Hello".into())
        );
    }

    #[test]
    fn empty_frontmatter_is_absent() {
        assert_eq!(
            extract_frontmatter("---\n---\n\n# Body", &frontmatter_options()),
            None
        );
        assert_eq!(
            extract_frontmatter("---\r\n---\r\n\r\n# Body", &frontmatter_options()),
            None
        );
    }

    #[test]
    fn frontmatter_scan_matches_document_parse() {
        let options = frontmatter_options();
        let cases = [
            "---\ntitle: Hello\n---\n\n# Body",
            "---\r\ntitle: Hello\r\n---\r\n\r\n# Body",
            "---\ntitle: Hello\n---\n# No blank line",
            "---\ntitle: Hello\n---",
            "---\ntitle: Hello\n---\n",
            "---\ntitle: Hello   \n---",
            "---\ntitle: Hello\r\n---\n",
            "\u{feff}---\ntitle: Hello\n---\n\n# Body",
            "---\ntitle: Hello\n---x\n\n# Unterminated close",
            "---\ntitle: Hello\n--- \n\n# Trailing space on close",
            "---\ntitle: Hello",
            "--- \ntitle: Space after open\n---\n",
            "---\nfirst\n---\nsecond\n---\r\nthird",
            "---\n\n---\n\n# Blank content",
            "# No frontmatter",
            "",
            "---",
        ];
        for source in cases {
            let arena = Arena::new();
            let root = parse_document(&arena, source, &options);
            let parsed = root.children().find_map(|child| {
                let data = child.data.borrow();
                let comrak::nodes::NodeValue::FrontMatter(raw) = &data.value else {
                    return None;
                };
                Some(raw.clone())
            });
            let scanned = split_off_frontmatter(source, "---").map(str::to_string);
            assert_eq!(scanned, parsed, "raw block mismatch for {source:?}");
        }
    }

    #[test]
    fn frontmatter_absent_when_extension_disabled() {
        assert_eq!(
            extract_frontmatter("---\ntitle: Hello\n---\n", &comrak::Options::default()),
            None
        );
    }
}
