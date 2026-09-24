//! HTML boundaries recorded during one document-wide render. Never render each
//! AST child separately: heading IDs and footnote numbering share a context.
use std::fmt::Write;
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
    /// Ascending indices into `ends` of fragments holding inline raw HTML.
    raw: Vec<usize>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Snapshot {
    html: String,
    block_ends: Option<Vec<usize>>,
    raw_html_blocks: Option<Vec<usize>>,
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

    /// Apply many insertions in one pass. Positions refer to the current HTML;
    /// equal positions keep their order. Same boundary rule as [`Self::insert`].
    fn insert_all(&mut self, mut inserts: Vec<(usize, String)>) {
        if inserts.is_empty() {
            return;
        }
        inserts.sort_by_key(|(index, _)| *index);
        let extra: usize = inserts.iter().map(|(_, text)| text.len()).sum();
        let mut html = String::with_capacity(self.html.len() + extra);
        let mut last = 0;
        for (index, text) in &inserts {
            html.push_str(&self.html[last..*index]);
            html.push_str(text);
            last = *index;
        }
        html.push_str(&self.html[last..]);
        self.html = html;
        if let Some(ends) = &mut self.ends {
            // Ends ascend, so one merge shifts each by the text inserted at or
            // before it.
            let mut pending = inserts.iter().peekable();
            let mut shift = 0;
            for end in ends {
                while let Some((_, text)) = pending.next_if(|(index, _)| *index <= *end) {
                    shift += text.len();
                }
                *end += shift;
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
        // Empty fragments are dropped, so raw-HTML indices are renumbered.
        let mut raw = self.raw.iter().peekable();
        let (block_ends, raw_html_blocks) = match self.ends {
            Some(ends) => {
                let mut result = Vec::with_capacity(ends.len());
                let mut raw_blocks = Vec::new();
                let mut previous = 0;
                let mut units = 0;
                for (index, end) in ends.into_iter().enumerate() {
                    units += self.html[previous..end].encode_utf16().count();
                    if result.last() != Some(&units) && units > 0 {
                        result.push(units);
                    }
                    if raw.next_if(|raw| **raw == index).is_some() && !result.is_empty() {
                        raw_blocks.push(result.len() - 1);
                    }
                    previous = end;
                }
                raw_blocks.dedup();
                (Some(result), Some(raw_blocks))
            }
            None => (None, None),
        };
        Snapshot {
            html: self.html,
            block_ends,
            raw_html_blocks,
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
    raw: Vec<usize>,
    mapping: Option<&'a crate::source_map::SourceMap<'a>>,
    annotations: Vec<(usize, usize, String, bool)>,
}

fn record<'a>(
    context: &mut Context<Boundaries<'_>>,
    node: &'a AstNode<'a>,
    entering: bool,
) -> Result<ChildRendering, fmt::Error> {
    let before = context.user.length.get();
    let data = node.data.borrow();
    let attribute = if entering && context.user.mapping.is_some() {
        let literal = match &data.value {
            NodeValue::Text(text) => Some(text.as_ref()),
            NodeValue::ShortCode(code) => Some(code.emoji.as_str()),
            NodeValue::Code(code) => Some(code.literal.as_str()),
            NodeValue::CodeBlock(code) => Some(code.literal.as_str()),
            _ => None,
        };
        literal.and_then(|text| {
            context
                .user
                .mapping
                .and_then(|map| map.attribute(data.sourcepos, text))
        })
    } else {
        None
    };
    let text = matches!(data.value, NodeValue::Text(_) | NodeValue::ShortCode(_));
    if entering
        && matches!(
            data.value,
            NodeValue::HtmlInline(_) | NodeValue::HeexInline(_)
        )
    {
        // The fragment being written is the one after the recorded ends.
        let fragment = context.user.ends.len();
        if context.user.raw.last() != Some(&fragment) {
            context.user.raw.push(fragment);
        }
    }
    let atomic = if entering && matches!(data.value, NodeValue::Math(_)) {
        context.user.mapping.map(|map| map.atomic(data.sourcepos))
    } else {
        None
    };
    drop(data);
    if text {
        if let Some(attribute) = &attribute {
            context.write_str(&format!("<span data-md-source=\"{attribute}\">"))?;
        }
    }
    let rendering = format_node_default(context, node, entering)?;
    if let Some(attribute) = attribute {
        if text {
            context.write_str("</span>")?;
        } else {
            context
                .user
                .annotations
                .push((before, context.user.length.get(), attribute, false));
        }
    }
    if let Some(atomic) = atomic {
        context
            .user
            .annotations
            .push((before, context.user.length.get(), atomic, true));
    }
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

pub(crate) fn render<'a>(
    root: &'a AstNode<'a>,
    options: &Options<'_>,
    boundaries: bool,
    mapping: Option<&crate::source_map::SourceMap<'_>>,
) -> Output {
    // An HTML block can open an element that later siblings close, so only
    // whole-tree parsing preserves its context. Inline raw HTML is listed
    // per fragment instead: parsed on their own, those fragments keep an
    // unclosed inline tag inside their block. Escaped raw HTML is safe but
    // is treated the same way.
    let independent = boundaries
        && !root.descendants().any(|node| {
            matches!(
                node.data.borrow().value,
                NodeValue::HtmlBlock(_) | NodeValue::HeexBlock(_)
            )
        });
    if !independent && mapping.is_none() {
        let mut html = String::new();
        comrak::format_html(root, options, &mut html).expect("writing HTML to a String");
        return Output {
            html,
            ends: None,
            raw: Vec::new(),
        };
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
            raw: Vec::new(),
            mapping,
            annotations: Vec::new(),
        },
    )
    .expect("writing HTML to a String");
    if !writer.html.is_empty() && state.ends.last() != Some(&writer.html.len()) {
        state.ends.push(writer.html.len());
    }
    let mut output = Output {
        html: writer.html,
        ends: independent.then_some(state.ends),
        raw: state.raw,
    };
    let inserts = state
        .annotations
        .into_iter()
        .filter_map(|(start, end, attribute, atomic)| {
            let (tag, name) = if atomic {
                ("<span", "atomic")
            } else {
                ("<code", "source")
            };
            // Insert right after the tag name, before its existing attributes.
            let index = output.html[start..end].find(tag)?;
            Some((
                start + index + tag.len(),
                format!(" data-md-{name}=\"{attribute}\""),
            ))
        })
        .collect();
    output.insert_all(inserts);
    output
}
