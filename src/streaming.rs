//! Cursor placement on the parsed tree, without candidate re-parses.
use comrak::{
    nodes::{AstNode, NodeValue},
    parse_document, Arena, Options,
};

const CURSOR: &str = "\u{2060}";

pub(crate) fn prefix_at_utf16(source: &str, offset: f64) -> Result<&str, &'static str> {
    const INVALID: &str = "writingOffset must be a UTF-16 boundary within the source";
    if !offset.is_finite() || offset < 0.0 || offset.fract() != 0.0 {
        return Err(INVALID);
    }
    if source.is_ascii() {
        return source.get(..offset as usize).ok_or(INVALID);
    }
    let mut units = 0;
    for (byte, character) in source.char_indices() {
        if units as f64 == offset {
            return Ok(&source[..byte]);
        }
        units += character.len_utf16();
        if units as f64 > offset {
            return Err(INVALID);
        }
    }
    if units as f64 == offset {
        Ok(source)
    } else {
        Err(INVALID)
    }
}

pub(crate) fn render(md: &str, options: &Options<'_>) -> String {
    render_with_blocks(md, options, false).html
}

pub(crate) fn render_with_blocks(
    md: &str,
    options: &Options<'_>,
    boundaries: bool,
) -> crate::blocks::Output {
    // Comrak normalizes these too. Normalize before healing so source positions
    // and the writing offset use the same line endings and BOM convention.
    let normalized;
    let md = md.strip_prefix('\u{feff}').unwrap_or(md);
    let md = if md.contains('\r') {
        normalized = md.replace("\r\n", "\n").replace('\r', "\n");
        normalized.as_str()
    } else {
        md
    };
    let open_fence = crate::heal::unclosed_fence(md).is_some();
    let inline_start = md
        .rfind("\n\n")
        .map_or(0, |i| i + 2)
        .max(crate::heal::last_closed_fence_end(md).unwrap_or(0));
    let inline = (!open_fence)
        .then(|| crate::heal::unclosed_inline_code(&md[inline_start..]))
        .flatten();
    let source = if open_fence {
        md.to_string()
    } else if let Some((run, end)) = inline {
        format!(
            "{md}{}{closer}",
            if end + inline_start == md.len() || md.ends_with('`') {
                " "
            } else {
                ""
            },
            closer = "`".repeat(run)
        )
    } else {
        crate::heal::heal_streaming(md)
    };
    let arena = Arena::new();
    let root = parse_document(&arena, &source, options);
    let mut lines = vec![0];
    lines.extend(source.match_indices('\n').map(|(i, _)| i + 1));
    let offset = |pos: comrak::nodes::LineColumn| {
        let start = lines
            .get(pos.line.saturating_sub(1))
            .copied()
            .unwrap_or(source.len());
        let column = pos.column.saturating_sub(1);
        start
            + if options.parse.sourcepos_chars {
                source[start..]
                    .char_indices()
                    .nth(column)
                    .map_or(source.len() - start + 1, |(byte, _)| byte)
            } else {
                column
            }
    };
    let end_offset = |pos: comrak::nodes::LineColumn| {
        let byte = offset(pos);
        byte + if options.parse.sourcepos_chars {
            source
                .get(byte..)
                .and_then(|s| s.chars().next())
                .map_or(1, char::len_utf8)
        } else {
            1
        }
    };
    let base = if !open_fence && inline.is_none() && md.ends_with(' ') && !md.ends_with("  ") {
        &md[..md.len() - 1]
    } else {
        md
    };
    // Closers that did not become syntax are synthetic text, never user input.
    if source.starts_with(base) && source.len() > base.len() {
        for node in root.descendants() {
            let mut data = node.data.borrow_mut();
            let excess = end_offset(data.sourcepos.end).saturating_sub(base.len());
            match &mut data.value {
                NodeValue::Text(text) if excess > 0 => {
                    let keep = text.len().saturating_sub(excess);
                    let mut keep = keep;
                    while !text.is_char_boundary(keep) {
                        keep -= 1;
                    }
                    text.to_mut().truncate(keep);
                }
                NodeValue::HtmlBlock(block) => {
                    remove_literal_closers(&mut block.literal, &source, base)
                }
                NodeValue::CodeBlock(code) => {
                    remove_literal_closers(&mut code.literal, &source, base)
                }
                _ => {}
            }
        }
    }
    let terminal = base.as_bytes().last().copied();
    let writing = terminal
        .filter(|b| b.is_ascii_punctuation())
        .map_or(base.len(), |b| {
            base.len() - base.bytes().rev().take_while(|c| *c == b).count()
        });
    let has_footnotes = root
        .children()
        .any(|n| matches!(n.data.borrow().value, NodeValue::FootnoteDefinition(_)));
    // An unfinished raw HTML block must not swallow the cursor as comment or
    // raw-text content. Use the block kind already identified by Comrak.
    for node in root.descendants() {
        if let NodeValue::HtmlBlock(block) = &mut node.data.borrow_mut().value {
            close_raw_html(block, options);
        }
    }
    if has_footnotes {
        let mut output = crate::blocks::render(root, options, boundaries);
        let end = output.html.trim_end_matches('\n').len();
        output.insert(end, CURSOR);
        return output;
    }
    let marker = arena.alloc(AstNode::from(NodeValue::Raw(CURSOR.into())));
    let mut node = root;
    // Hidden definitions and completed blank lines have no inline writing node.
    let last_end = root
        .last_child()
        .map(|n| end_offset(n.data.borrow().sourcepos.end))
        .unwrap_or(0);
    let own_line =
        last_end < md.trim_end_matches(['\n', '\r', ' ', '\t']).len() || md.ends_with("\n\n");
    if !own_line || open_fence || inline.is_some() {
        while let Some(last) = node
            .children()
            .filter(|n| {
                !matches!(n.data.borrow().value, NodeValue::TableCell)
                    || offset(n.data.borrow().sourcepos.start) < md.len()
            })
            .last()
        {
            node = last;
            let data = node.data.borrow();
            match &data.value {
                NodeValue::CodeBlock(_)
                | NodeValue::HtmlBlock(_)
                | NodeValue::ThematicBreak
                | NodeValue::Link(_)
                | NodeValue::Image(_)
                | NodeValue::FootnoteDefinition(_)
                | NodeValue::EscapedTag(_) => break,
                NodeValue::Table(_) | NodeValue::Heading(_) if md.ends_with('\n') => break,
                NodeValue::Emph | NodeValue::Strong | NodeValue::Strikethrough
                    if end_offset(data.sourcepos.end) <= writing =>
                {
                    break
                }
                _ => {}
            }
        }
    }
    let mut data = node.data.borrow_mut();
    let cursor_in_code =
        matches!(&data.value, NodeValue::CodeBlock(code) if !code.closed || !code.fenced);
    match &mut data.value {
        NodeValue::CodeBlock(code) if !code.closed || !code.fenced => {
            // Comrak appends a synthetic final LF to code literals.
            if !md.ends_with('\n') && code.literal.ends_with('\n') {
                code.literal.pop();
            }
            code.literal.push_str(CURSOR);
            code.literal.push('\n');
        }
        NodeValue::Code(code) if inline.is_some() || base.ends_with('`') => {
            if inline.is_some_and(|(_, end)| end + inline_start == md.len()) {
                code.literal.clear();
            }
            code.literal.push_str(CURSOR);
        }
        NodeValue::Heading(_) if md.ends_with('\n') => node.insert_after(marker),
        NodeValue::Item(_)
            if node.first_child().is_none() && !base.ends_with(char::is_whitespace) =>
        {
            let start = offset(data.sourcepos.start);
            if let Some(literal) = base.get(start..) {
                place_after_unfinished_item(node, marker, &arena, literal);
            } else {
                node.append(marker);
            }
        }
        NodeValue::Document
        | NodeValue::Paragraph
        | NodeValue::Heading(_)
        | NodeValue::TableCell
        | NodeValue::Item(_)
        | NodeValue::TaskItem(_) => node.append(marker),
        _ => node.insert_after(marker),
    }
    drop(data);
    let mut output = crate::blocks::render(root, options, boundaries);
    if !cursor_in_code {
        output.strip_cursor_linebreaks();
    }
    output
}

fn place_after_unfinished_item<'a>(
    item: &'a AstNode<'a>,
    marker: &'a AstNode<'a>,
    arena: &'a Arena<'a>,
    literal: &str,
) {
    // Until whitespace arrives, a bare list marker stays visible as text.
    // In an existing list it is a continuation of the preceding item.
    let list = item.parent().expect("list item has a list parent");
    let paragraph = if let Some(previous) = item.previous_sibling() {
        if let Some(paragraph) = previous
            .last_child()
            .filter(|n| matches!(n.data.borrow().value, NodeValue::Paragraph))
        {
            paragraph.append(arena.alloc(AstNode::from(NodeValue::LineBreak)));
            paragraph
        } else {
            let paragraph: &AstNode<'_> = arena.alloc(AstNode::from(NodeValue::Paragraph));
            previous.append(paragraph);
            paragraph
        }
    } else {
        let paragraph: &AstNode<'_> = arena.alloc(AstNode::from(NodeValue::Paragraph));
        list.insert_before(paragraph);
        list.detach();
        paragraph
    };
    item.detach();
    paragraph.append(arena.alloc(AstNode::from(NodeValue::Text(literal.to_string().into()))));
    paragraph.append(marker);
}

fn remove_literal_closers(literal: &mut String, source: &str, base: &str) {
    let content = if source.ends_with('\n') {
        literal.as_str()
    } else {
        literal.strip_suffix('\n').unwrap_or(literal)
    };
    if let Some(original) = content.strip_suffix(&source[base.len()..]) {
        let length = original.len();
        literal.truncate(length);
        if !literal.ends_with('\n') {
            literal.push('\n');
        }
    }
}

fn close_raw_html(block: &mut comrak::nodes::NodeHtmlBlock, options: &Options<'_>) {
    if !options.render.r#unsafe || options.render.escape {
        return;
    }
    let closer = match block.block_type {
        1 => {
            let start = block.literal.trim_start().to_ascii_lowercase();
            ["pre", "script", "style", "textarea"]
                .into_iter()
                .find(|tag| start.strip_prefix('<').is_some_and(|s| s.starts_with(tag)))
                .filter(|tag| !options.extension.tagfilter || *tag == "pre")
                .map(|tag| format!("</{tag}>"))
        }
        2 => Some("-->".to_string()),
        3 => Some("?>".to_string()),
        4 => Some(">".to_string()),
        5 => Some("]]>".to_string()),
        _ => None,
    };
    if let Some(closer) = closer {
        if !block.literal.to_ascii_lowercase().contains(&closer) {
            if block.block_type == 1 && !block.literal.contains('>') {
                block.literal.push('>');
            }
            block.literal.push_str(&closer);
        }
    } else if let Some(open) = block.literal.rfind('<') {
        // A filtered raw-text tag, or ordinary HTML block, may end in `</`.
        // Leave that fragment visible instead of consuming the cursor's tag.
        if !block.literal[open..].contains('>') {
            block.literal.replace_range(open..open + 1, "&lt;");
        }
    }
}
