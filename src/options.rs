use std::sync::Arc;

use js_sys::{Function, Reflect};
use serde::Deserialize;
use wasm_bindgen::JsValue;

use crate::plugins::optional_function;

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
    /// Raw JS value passed through untouched; validated as a Function in
    /// `build`. `None` when the key is absent.
    #[serde(default, deserialize_with = "preserved_js_value")]
    broken_link_callback: Option<JsValue>,
}

fn preserved_js_value<'de, D: serde::Deserializer<'de>>(
    deserializer: D,
) -> Result<Option<JsValue>, D::Error> {
    serde_wasm_bindgen::preserve::deserialize(deserializer).map(Some)
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

/// Deserialize JavaScript options and map explicitly supplied fields onto
/// comrak defaults. Missing, `null`, and `undefined` values all select defaults.
pub(crate) fn from_js(value: Option<JsValue>) -> Result<comrak::Options<'static>, JsValue> {
    let options = match value {
        None => ComrakOptions::default(),
        Some(value) if value.is_undefined() || value.is_null() => ComrakOptions::default(),
        Some(value) => serde_wasm_bindgen::from_value(value).map_err(|error| {
            JsValue::from(js_sys::Error::new(&format!(
                "invalid comrak options: {error}"
            )))
        })?,
    };

    build(options)
}

/// Bridges a JS `(reference) => resolved` callback onto comrak's
/// `BrokenLinkCallback`. The callback receives `{ normalized, original }` and
/// resolves the reference by returning a URL string or `{ url, title? }`.
/// `null`, `undefined`, a thrown exception, or any other value leaves the
/// reference unresolved so it renders as literal text — the same
/// fail-safe posture as the URL rewriters.
struct JsBrokenLinkCallback {
    resolve_fn: Function,
}

impl comrak::options::BrokenLinkCallback for JsBrokenLinkCallback {
    fn resolve(
        &self,
        reference: comrak::options::BrokenLinkReference,
    ) -> Option<comrak::ResolvedReference> {
        let argument = js_sys::Object::new();
        Reflect::set(
            &argument,
            &JsValue::from_str("normalized"),
            &JsValue::from_str(reference.normalized),
        )
        .ok()?;
        Reflect::set(
            &argument,
            &JsValue::from_str("original"),
            &JsValue::from_str(reference.original),
        )
        .ok()?;

        let value = self.resolve_fn.call1(&JsValue::null(), &argument).ok()?;
        if let Some(url) = value.as_string() {
            return Some(comrak::ResolvedReference {
                url,
                title: String::new(),
            });
        }
        if !value.is_object() {
            return None;
        }

        let url = Reflect::get(&value, &JsValue::from_str("url"))
            .ok()?
            .as_string()?;
        let title = Reflect::get(&value, &JsValue::from_str("title"))
            .ok()
            .and_then(|title| title.as_string())
            .unwrap_or_default();
        Some(comrak::ResolvedReference { url, title })
    }
}

fn build(opts: ComrakOptions) -> Result<comrak::Options<'static>, JsValue> {
    let mut options = comrak::Options::default();

    if let Some(ext) = opts.extension {
        macro_rules! set_bool {
            ($field:ident) => {
                if let Some(value) = ext.$field {
                    options.extension.$field = value;
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

        // `header_id_prefix` is the current name; `header_ids` is retained for
        // backward compatibility and has lower precedence when both are set.
        if let Some(value) = ext.header_id_prefix.or(ext.header_ids) {
            options.extension.header_id_prefix = Some(value);
        }
        if let Some(value) = ext.header_id_prefix_in_href {
            options.extension.header_id_prefix_in_href = value;
        }
        if let Some(value) = ext.front_matter_delimiter {
            options.extension.front_matter_delimiter = Some(value);
        }
    }

    if let Some(parse) = opts.parse {
        macro_rules! set_bool {
            ($field:ident) => {
                if let Some(value) = parse.$field {
                    options.parse.$field = value;
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

        if let Some(value) = parse.default_info_string {
            options.parse.default_info_string = Some(value);
        }
        if let Some(value) = parse.broken_link_callback {
            if let Some(function) = optional_function(value, "parse.brokenLinkCallback")? {
                options.parse.broken_link_callback = Some(Arc::new(JsBrokenLinkCallback {
                    resolve_fn: function,
                }));
            }
        }
    }

    if let Some(render) = opts.render {
        macro_rules! set_bool {
            ($field:ident) => {
                if let Some(value) = render.$field {
                    options.render.$field = value;
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

        if let Some(value) = render.unsafe_ {
            options.render.r#unsafe = value;
        }
        if let Some(value) = render.width {
            options.render.width = value;
        }
        if let Some(value) = render.list_style {
            options.render.list_style = match value {
                ListStyle::Dash => comrak::options::ListStyleType::Dash,
                ListStyle::Plus => comrak::options::ListStyleType::Plus,
                ListStyle::Star => comrak::options::ListStyleType::Star,
            };
        }
        if let Some(value) = render.alert_style {
            options.render.alert_style = match value {
                AlertStyle::Specific => comrak::options::AlertStyleType::Specific,
                AlertStyle::Semantic => comrak::options::AlertStyleType::Semantic,
            };
        }
        if let Some(value) = render.ol_width {
            options.render.ol_width = value;
        }
    }

    Ok(options)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridges_comrak_054_fields() {
        let options = build(ComrakOptions {
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
        })
        .expect("options without a callback build infallibly");

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
