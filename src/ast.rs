//! The AST as plain JSON — the general projection (`mdToAst`).
//!
//! Comrak's tree is arena-allocated and lifetime-bound, so it cannot
//! cross the wasm boundary as objects; the honest export is one
//! serialization into JS-native values. The variant match is
//! EXHAUSTIVE on purpose (no `_` arm): a comrak upgrade that adds a
//! node type fails this build instead of silently dropping nodes.

use comrak::nodes::{AstNode, NodeValue, Sourcepos};
use serde::Serialize;
use wasm_bindgen::JsValue;

#[derive(Serialize, Default)]
struct Point {
    line: usize,
    column: usize,
}

#[derive(Serialize, Default)]
struct Span {
    start: Point,
    end: Point,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct JsonNode {
    #[serde(rename = "type")]
    node_type: &'static str,
    sourcepos: Span,
    #[serde(skip_serializing_if = "Option::is_none")]
    literal: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    level: Option<u8>,
    #[serde(skip_serializing_if = "Option::is_none")]
    setext: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    list_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    start: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    delimiter: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tight: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    fenced: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    info: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    header: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    alignments: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    checked: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    symbol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    display_math: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    dollar_math: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    emoji: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    alert_type: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    children: Vec<JsonNode>,
}

fn span(pos: Sourcepos) -> Span {
    Span {
        start: Point {
            line: pos.start.line,
            column: pos.start.column,
        },
        end: Point {
            line: pos.end.line,
            column: pos.end.column,
        },
    }
}

fn debug_word(value: impl std::fmt::Debug) -> String {
    format!("{value:?}").to_lowercase()
}

fn base(node_type: &'static str, pos: Sourcepos, children: Vec<JsonNode>) -> JsonNode {
    JsonNode {
        node_type,
        sourcepos: span(pos),
        children,
        ..Default::default()
    }
}

pub fn json_of<'a>(node: &'a AstNode<'a>) -> JsonNode {
    let children: Vec<JsonNode> = node.children().map(json_of).collect();
    let data = node.data.borrow();
    let pos = data.sourcepos;
    let mut out;
    match &data.value {
        NodeValue::Document => out = base("document", pos, children),
        NodeValue::FrontMatter(s) => {
            out = base("frontmatter", pos, children);
            out.literal = Some(s.clone());
        }
        NodeValue::BlockQuote => out = base("blockQuote", pos, children),
        NodeValue::List(l) => {
            out = base("list", pos, children);
            out.list_type = Some(debug_word(l.list_type));
            out.start = Some(l.start);
            out.delimiter = Some(debug_word(l.delimiter));
            out.tight = Some(l.tight);
        }
        NodeValue::Item(l) => {
            out = base("item", pos, children);
            out.list_type = Some(debug_word(l.list_type));
        }
        NodeValue::DescriptionList => out = base("descriptionList", pos, children),
        NodeValue::DescriptionItem(_) => out = base("descriptionItem", pos, children),
        NodeValue::DescriptionTerm => out = base("descriptionTerm", pos, children),
        NodeValue::DescriptionDetails => out = base("descriptionDetails", pos, children),
        NodeValue::CodeBlock(c) => {
            out = base("codeBlock", pos, children);
            out.fenced = Some(c.fenced);
            out.info = Some(c.info.clone());
            out.literal = Some(c.literal.clone());
        }
        NodeValue::HtmlBlock(h) => {
            out = base("htmlBlock", pos, children);
            out.literal = Some(h.literal.clone());
        }
        NodeValue::HeexBlock(h) => {
            out = base("heexBlock", pos, children);
            out.literal = Some(h.literal.clone());
        }
        NodeValue::Paragraph => out = base("paragraph", pos, children),
        NodeValue::Heading(h) => {
            out = base("heading", pos, children);
            out.level = Some(h.level);
            out.setext = Some(h.setext);
        }
        NodeValue::ThematicBreak => out = base("thematicBreak", pos, children),
        NodeValue::FootnoteDefinition(f) => {
            out = base("footnoteDefinition", pos, children);
            out.name = Some(f.name.clone());
        }
        NodeValue::Table(t) => {
            out = base("table", pos, children);
            out.alignments = Some(t.alignments.iter().map(|a| debug_word(*a)).collect());
        }
        NodeValue::TableRow(header) => {
            out = base("tableRow", pos, children);
            out.header = Some(*header);
        }
        NodeValue::TableCell => out = base("tableCell", pos, children),
        NodeValue::Text(t) => {
            out = base("text", pos, children);
            out.literal = Some(t.to_string());
        }
        NodeValue::TaskItem(t) => {
            out = base("taskItem", pos, children);
            out.checked = Some(t.symbol.is_some());
            out.symbol = t.symbol.map(String::from);
        }
        NodeValue::SoftBreak => out = base("softBreak", pos, children),
        NodeValue::LineBreak => out = base("lineBreak", pos, children),
        NodeValue::Code(c) => {
            out = base("code", pos, children);
            out.literal = Some(c.literal.clone());
        }
        NodeValue::HtmlInline(s) => {
            out = base("htmlInline", pos, children);
            out.literal = Some(s.clone());
        }
        NodeValue::HeexInline(s) => {
            out = base("heexInline", pos, children);
            out.literal = Some(s.clone());
        }
        NodeValue::Raw(s) => {
            out = base("raw", pos, children);
            out.literal = Some(s.clone());
        }
        NodeValue::Emph => out = base("emph", pos, children),
        NodeValue::Strong => out = base("strong", pos, children),
        NodeValue::Strikethrough => out = base("strikethrough", pos, children),
        NodeValue::Highlight => out = base("highlight", pos, children),
        NodeValue::Insert => out = base("insert", pos, children),
        NodeValue::Superscript => out = base("superscript", pos, children),
        NodeValue::Link(l) => {
            out = base("link", pos, children);
            out.url = Some(l.url.clone());
            out.title = Some(l.title.clone());
        }
        NodeValue::Image(l) => {
            out = base("image", pos, children);
            out.url = Some(l.url.clone());
            out.title = Some(l.title.clone());
        }
        NodeValue::FootnoteReference(f) => {
            out = base("footnoteReference", pos, children);
            out.name = Some(f.name.clone());
        }
        NodeValue::ShortCode(s) => {
            out = base("shortcode", pos, children);
            out.code = Some(s.code.clone());
            out.emoji = Some(s.emoji.clone());
        }
        NodeValue::Math(m) => {
            out = base("math", pos, children);
            out.literal = Some(m.literal.clone());
            out.display_math = Some(m.display_math);
            out.dollar_math = Some(m.dollar_math);
        }
        NodeValue::MultilineBlockQuote(_) => out = base("multilineBlockQuote", pos, children),
        NodeValue::Escaped => out = base("escaped", pos, children),
        NodeValue::WikiLink(w) => {
            out = base("wikiLink", pos, children);
            out.url = Some(w.url.clone());
        }
        NodeValue::Underline => out = base("underline", pos, children),
        NodeValue::Subscript => out = base("subscript", pos, children),
        NodeValue::SpoileredText => out = base("spoiler", pos, children),
        NodeValue::EscapedTag(s) => {
            out = base("escapedTag", pos, children);
            out.literal = Some((*s).to_string());
        }
        NodeValue::Alert(a) => {
            out = base("alert", pos, children);
            out.alert_type = Some(debug_word(a.alert_type));
            out.title = a.title.clone();
        }
        NodeValue::Subtext => out = base("subtext", pos, children),
        NodeValue::BlockDirective(b) => {
            out = base("blockDirective", pos, children);
            out.info = Some(b.info.clone());
        }
    }
    out
}

pub fn to_js(root: &JsonNode) -> Result<JsValue, JsValue> {
    serde_wasm_bindgen::to_value(root).map_err(|error| JsValue::from_str(&error.to_string()))
}
