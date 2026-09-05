//! HTML boundaries recorded during one document-wide render. Never render each
//! AST child separately: heading IDs and footnote numbering share a context.
use std::{cell::Cell, fmt};

use comrak::{
    html::{format_document_with_formatter, format_node_default, ChildRendering, Context},
    nodes::{AstNode, NodeValue},
    options::Plugins,
    Options,
};
use serde::Serialize;

pub(crate) struct Output {
    pub html: String,
    ends: Option<Vec<usize>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Snapshot {
    html: String,
    block_ends: Option<Vec<usize>>,
}

impl Output {
    pub fn insert(&mut self, index: usize, text: &str) {
        self.html.insert_str(index, text);
        if let Some(ends) = &mut self.ends {
            for end in ends {
                if *end >= index {
                    *end += text.len();
                }
            }
        }
    }

    pub fn strip_cursor_linebreaks(&mut self) {
        let positions: Vec<_> = self
            .html
            .match_indices("\n\u{2060}")
            .map(|(i, _)| i)
            .collect();
        if positions.is_empty() {
            return;
        }
        self.html = self.html.replace("\n\u{2060}", "\u{2060}");
        if let Some(ends) = &mut self.ends {
            for end in ends {
                *end -= positions.partition_point(|position| *position < *end);
            }
        }
    }

    pub fn snapshot(self) -> Snapshot {
        // JS slices strings by UTF-16 units, not UTF-8 bytes. Convert boundaries
        // in a single pass without reparsing or allocating each block string.
        let block_ends = self.ends.map(|ends| {
            let mut result = Vec::with_capacity(ends.len());
            let mut previous = 0;
            let mut units = 0;
            for end in ends {
                units += self.html[previous..end].encode_utf16().count();
                if result.last() != Some(&units) && units > 0 {
                    result.push(units);
                }
                previous = end;
            }
            result
        });
        Snapshot {
            html: self.html,
            block_ends,
        }
    }
}

struct Writer<'a> {
    html: String,
    length: &'a Cell<usize>,
}

impl fmt::Write for Writer<'_> {
    fn write_str(&mut self, text: &str) -> fmt::Result {
        self.html.push_str(text);
        self.length.set(self.html.len());
        Ok(())
    }
}

struct Boundaries<'a> {
    length: &'a Cell<usize>,
    ends: Vec<usize>,
    footnotes: bool,
}

fn record<'a>(
    context: &mut Context<Boundaries<'_>>,
    node: &'a AstNode<'a>,
    entering: bool,
) -> Result<ChildRendering, fmt::Error> {
    let rendering = format_node_default(context, node, entering)?;
    let top_level = node
        .parent()
        .is_some_and(|parent| matches!(parent.data.borrow().value, NodeValue::Document));
    if top_level {
        if matches!(node.data.borrow().value, NodeValue::FootnoteDefinition(_)) {
            // Comrak opens a shared section at the first definition and closes
            // it after the traversal; it is one fragment, not one per note.
            context.user.footnotes = true;
        }
        if !entering && !context.user.footnotes {
            let end = context.user.length.get();
            if end > 0 && context.user.ends.last() != Some(&end) {
                context.user.ends.push(end);
            }
        }
    }
    Ok(rendering)
}

pub(crate) fn render<'a>(root: &'a AstNode<'a>, options: &Options<'_>, boundaries: bool) -> Output {
    // Literal HTML can span AST siblings or trigger browser tree repair. Only
    // whole-tree parsing preserves that context. Escaped raw HTML is safe but
    // conservatively takes the same fallback; callers never guess boundaries.
    let independent = boundaries
        && !root.descendants().any(|node| {
            matches!(
                node.data.borrow().value,
                NodeValue::HtmlBlock(_)
                    | NodeValue::HtmlInline(_)
                    | NodeValue::HeexBlock(_)
                    | NodeValue::HeexInline(_)
            )
        });
    if !independent {
        let mut html = String::new();
        comrak::format_html(root, options, &mut html).expect("writing HTML to a String");
        return Output { html, ends: None };
    }
    let length = Cell::new(0);
    let mut writer = Writer {
        html: String::new(),
        length: &length,
    };
    let mut state = format_document_with_formatter(
        root,
        options,
        &mut writer,
        &Plugins::default(),
        record,
        Boundaries {
            length: &length,
            ends: Vec::new(),
            footnotes: false,
        },
    )
    .expect("writing HTML to a String");
    if !writer.html.is_empty() && state.ends.last() != Some(&writer.html.len()) {
        state.ends.push(writer.html.len());
    }
    Output {
        html: writer.html,
        ends: Some(state.ends),
    }
}
