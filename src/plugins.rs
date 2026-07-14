use std::borrow::Cow;
use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;

use comrak::adapters::CodefenceRendererAdapter as ComrakCodefenceRendererAdapter;
use comrak::adapters::{
    HeadingAdapter as ComrakHeadingAdapter, HeadingMeta,
    SyntaxHighlighterAdapter as ComrakSyntaxHighlighterAdapter,
};
use comrak::markdown_to_html_with_plugins;
use comrak::options::Plugins;
use js_sys::Function;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct SyntaxHighlighter {
    highlight: Function,
    pre: Function,
    code: Function,
}

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
        let js_lang = lang.map_or_else(JsValue::undefined, JsValue::from_str);
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
        for (key, value) in &attributes {
            js_sys::Reflect::set(
                &js_attrs,
                &JsValue::from_str(key),
                &JsValue::from_str(value),
            )
            .ok();
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
        for (key, value) in &attributes {
            js_sys::Reflect::set(
                &js_attrs,
                &JsValue::from_str(key),
                &JsValue::from_str(value),
            )
            .ok();
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

#[wasm_bindgen]
pub struct HeadingAdapter {
    enter: Function,
    exit: Function,
}

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
        let js_heading = heading_value(heading);
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
        let js_heading = heading_value(heading);
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

fn heading_value(heading: &HeadingMeta) -> js_sys::Object {
    let value = js_sys::Object::new();
    js_sys::Reflect::set(
        &value,
        &JsValue::from_str("level"),
        &JsValue::from(heading.level),
    )
    .ok();
    js_sys::Reflect::set(
        &value,
        &JsValue::from_str("content"),
        &JsValue::from_str(&heading.content),
    )
    .ok();
    value
}

fn build_plugins<'a>(
    syntax_highlighter: Option<&'a SyntaxHighlighter>,
    heading_adapter: Option<&'a HeadingAdapter>,
) -> Plugins<'a> {
    let mut plugins = Plugins::default();
    if let Some(highlighter) = syntax_highlighter {
        plugins.render.codefence_syntax_highlighter = Some(highlighter);
    }
    if let Some(adapter) = heading_adapter {
        plugins.render.heading_adapter = Some(adapter);
    }
    plugins
}

pub(crate) fn render_html_with_plugins(
    md: &str,
    options: &comrak::Options<'_>,
    syntax_highlighter: Option<&SyntaxHighlighter>,
    heading_adapter: Option<&HeadingAdapter>,
) -> String {
    let plugins = build_plugins(syntax_highlighter, heading_adapter);
    markdown_to_html_with_plugins(md, options, &plugins)
}

#[wasm_bindgen(js_name = __mdToHtmlWithPluginsOwned)]
pub fn md_to_html_with_plugins_js(
    md: &str,
    options: JsValue,
    syntax_highlighter: Option<SyntaxHighlighter>,
    heading_adapter: Option<HeadingAdapter>,
) -> Result<String, JsValue> {
    let options = crate::options::from_js(Some(options))?;
    Ok(render_html_with_plugins(
        md,
        &options,
        syntax_highlighter.as_ref(),
        heading_adapter.as_ref(),
    ))
}

#[wasm_bindgen]
pub struct CodefenceRenderer {
    write_fn: Function,
}

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
        if let Some(value) = self
            .write_fn
            .call3(&this, &js_lang, &js_meta, &js_code)
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

#[wasm_bindgen]
pub struct PreparedCodefenceRenderers {
    renderers: Vec<(String, CodefenceRenderer)>,
}

#[wasm_bindgen]
impl PreparedCodefenceRenderers {
    #[wasm_bindgen(constructor)]
    pub fn new(renderers: JsValue) -> Result<PreparedCodefenceRenderers, JsValue> {
        Ok(Self {
            renderers: parse_codefence_renderers(renderers)?,
        })
    }
}

fn parse_codefence_renderers(
    renderers: JsValue,
) -> Result<Vec<(String, CodefenceRenderer)>, JsValue> {
    let mut codefence_renderers = Vec::new();
    if renderers.is_null() || renderers.is_undefined() {
        return Ok(codefence_renderers);
    }

    let object = renderers.dyn_into::<js_sys::Object>().map_err(|_| {
        js_sys::TypeError::new("codefence renderers must be an object, null, or undefined")
    })?;
    let keys = js_sys::Object::keys(&object);
    let object: JsValue = object.into();
    codefence_renderers.reserve(keys.length() as usize);
    for index in 0..keys.length() {
        let key_value = keys.get(index);
        let key = key_value
            .as_string()
            .expect("Object.keys always returns strings");
        let value = js_sys::Reflect::get(&object, &key_value).map_err(|_| {
            js_sys::TypeError::new(&format!("codefence renderer for {key:?} could not be read"))
        })?;
        let function = value.dyn_into::<Function>().map_err(|_| {
            js_sys::TypeError::new(&format!(
                "codefence renderer for {key:?} must be a Function"
            ))
        })?;
        codefence_renderers.push((key, CodefenceRenderer::new(function)));
    }
    Ok(codefence_renderers)
}

pub(crate) fn render_html_with_codefence_renderers(
    md: &str,
    options: &comrak::Options<'_>,
    prepared_renderers: &PreparedCodefenceRenderers,
    syntax_highlighter: Option<&SyntaxHighlighter>,
    heading_adapter: Option<&HeadingAdapter>,
) -> String {
    let mut plugins = build_plugins(syntax_highlighter, heading_adapter);
    for (language, renderer) in &prepared_renderers.renderers {
        plugins
            .render
            .codefence_renderers
            .insert(language.clone(), renderer);
    }
    markdown_to_html_with_plugins(md, options, &plugins)
}

#[wasm_bindgen(js_name = __mdToHtmlWithCodefenceRenderersOwned)]
pub fn md_to_html_with_codefence_renderers(
    md: &str,
    options: JsValue,
    renderers: JsValue,
    syntax_highlighter: Option<SyntaxHighlighter>,
    heading_adapter: Option<HeadingAdapter>,
) -> Result<String, JsValue> {
    let options = crate::options::from_js(Some(options))?;
    let prepared_renderers = PreparedCodefenceRenderers {
        renderers: parse_codefence_renderers(renderers)?,
    };
    Ok(render_html_with_codefence_renderers(
        md,
        &options,
        &prepared_renderers,
        syntax_highlighter.as_ref(),
        heading_adapter.as_ref(),
    ))
}

struct JsUrlRewriter {
    rewrite_fn: Function,
}

impl comrak::options::URLRewriter for JsUrlRewriter {
    fn to_html(&self, url: &str) -> String {
        let this = JsValue::null();
        let js_url = JsValue::from_str(url);
        if let Ok(value) = self.rewrite_fn.call1(&this, &js_url) {
            if let Some(rewritten) = value.as_string() {
                return rewritten;
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
    let mut options = crate::options::from_js(Some(options))?;

    if let Some(function) = optional_function(image_url_rewriter, "image URL rewriter")? {
        options.extension.image_url_rewriter = Some(Arc::new(JsUrlRewriter {
            rewrite_fn: function,
        }));
    }
    if let Some(function) = optional_function(link_url_rewriter, "link URL rewriter")? {
        options.extension.link_url_rewriter = Some(Arc::new(JsUrlRewriter {
            rewrite_fn: function,
        }));
    }

    Ok(crate::render_html(md, &options))
}

fn optional_function(value: JsValue, name: &str) -> Result<Option<Function>, JsValue> {
    if value.is_null() || value.is_undefined() {
        return Ok(None);
    }

    value.dyn_into::<Function>().map(Some).map_err(|_| {
        js_sys::TypeError::new(&format!("{name} must be a Function, null, or undefined")).into()
    })
}
