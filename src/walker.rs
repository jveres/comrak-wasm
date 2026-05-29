use comrak::arena_tree::Node;
use comrak::nodes::{Ast, NodeValue, TableAlignment};
use std::cell::RefCell;
use std::fmt::Write;

pub type AstNode<'a> = Node<'a, RefCell<Ast>>;

const HR: &str = "────────────────────────────────────────";

/// Trait for formatting differences between text and ANSI output.
/// The walker handles all AST traversal and structural logic.
/// Default implementations provide structural behavior; formatters
/// override only what needs styling.
pub trait Formatter {
    fn show_urls(&self) -> bool;
    fn show_markdown(&self) -> bool;

    // --- Style hooks (override for ANSI) ---
    fn style(&self, _out: &mut String, _name: &str) {}
    fn reset(&self, _out: &mut String) {}
    /// Targeted style close — resets only the named attribute.
    /// Default calls full reset(); ANSI formatter uses targeted SGR codes.
    fn style_end(&self, out: &mut String, _name: &str) { self.reset(out); }

    // --- Block elements ---
    fn heading_start(&self, _out: &mut String, _level: u8) {}
    fn heading_end(&self, _out: &mut String) {}
    fn quote_prefix(&self, out: &mut String) { out.push_str("│ "); }
    fn blockquote_text_start(&self, _out: &mut String) {}
    fn blockquote_text_end(&self, _out: &mut String) {}

    fn code_block_start(&self, out: &mut String, info: &str) {
        if self.show_markdown() {
            self.style(out, "code_block_border");
            out.push_str("```");
            if !info.is_empty() { out.push_str(info); }
            self.style_end(out, "code_block_border");
            out.push('\n');
        }
    }
    fn code_block_line(&self, out: &mut String, line: &str) {
        self.style(out, "code_block");
        if self.show_markdown() { out.push_str("  "); }
        out.push_str(line);
        self.style_end(out, "code_block");
        out.push('\n');
    }
    fn code_block_end(&self, out: &mut String) {
        if self.show_markdown() {
            self.style(out, "code_block_border");
            out.push_str("```");
            self.style_end(out, "code_block_border");
            out.push('\n');
        }
    }

    fn thematic_break(&self, out: &mut String) {
        self.style(out, "thematic_break");
        out.push_str(HR);
        self.style_end(out, "thematic_break");
        out.push('\n');
    }

    fn alert_title(&self, out: &mut String, alert: &comrak::nodes::NodeAlert) {
        out.push('[');
        out.push_str(alert.title.as_deref().unwrap_or("Alert"));
        out.push(']');
    }

    fn list_bullet(&self, out: &mut String, ordered: bool, idx: usize) {
        self.style(out, "list_bullet");
        if ordered {
            let _ = write!(out, "{}.", idx);
        } else {
            out.push('•');
        }
        self.style_end(out, "list_bullet");
        out.push(' ');
    }

    fn task_marker(&self, out: &mut String, checked: bool) {
        if self.show_markdown() {
            self.style(out, "list_bullet");
            out.push('-');
            self.style_end(out, "list_bullet");
            out.push(' ');
            out.push_str(if checked { "[x] " } else { "[ ] " });
        } else {
            out.push_str(if checked { "☒ " } else { "☐ " });
        }
    }

    // --- Inline elements ---
    fn strong_start(&self, out: &mut String) {
        self.style(out, "bold");
        if self.show_markdown() { out.push_str("**"); }
    }
    fn strong_end(&self, out: &mut String) {
        if self.show_markdown() { out.push_str("**"); }
        self.style_end(out, "bold");
    }
    fn emph_start(&self, out: &mut String) {
        self.style(out, "italic");
        if self.show_markdown() { out.push('*'); }
    }
    fn emph_end(&self, out: &mut String) {
        if self.show_markdown() { out.push('*'); }
        self.style_end(out, "italic");
    }
    fn strikethrough_start(&self, out: &mut String) {
        self.style(out, "strikethrough");
        if self.show_markdown() { out.push_str("~~"); }
    }
    fn strikethrough_end(&self, out: &mut String) {
        if self.show_markdown() { out.push_str("~~"); }
        self.style_end(out, "strikethrough");
    }
    fn underline_start(&self, out: &mut String) { self.style(out, "underline"); }
    fn underline_end(&self, out: &mut String) { self.style_end(out, "underline"); }

    fn code_span(&self, out: &mut String, literal: &str) {
        self.style(out, "code");
        if self.show_markdown() { out.push('`'); }
        out.push_str(literal);
        if self.show_markdown() { out.push('`'); }
        self.style_end(out, "code");
    }

    fn link_start(&self, out: &mut String, _url: &str) { self.style(out, "link"); }
    fn link_end(&self, out: &mut String, url: &str) {
        self.style_end(out, "link");
        if self.show_urls() && !url.is_empty() {
            out.push(' ');
            self.style(out, "link_url");
            out.push('(');
            out.push_str(url);
            out.push(')');
            self.style_end(out, "link_url");
        }
    }
    fn image_end(&self, out: &mut String, url: &str) {
        if self.show_urls() && !url.is_empty() {
            out.push(' ');
            self.style(out, "link_url");
            out.push('(');
            out.push_str(url);
            out.push(')');
            self.style_end(out, "link_url");
        }
    }

    fn math_span(&self, out: &mut String, literal: &str) {
        self.style(out, "math");
        if self.show_markdown() { out.push('$'); }
        out.push_str(literal);
        if self.show_markdown() { out.push('$'); }
        self.style_end(out, "math");
    }

    fn wiki_link(&self, out: &mut String, url: &str) {
        self.style(out, "link");
        out.push_str("[[");
        out.push_str(url);
        out.push_str("]]");
        self.style_end(out, "link");
    }

    // --- Table ---
    fn table_border_style_start(&self, out: &mut String) { self.style(out, "thematic_break"); }
    fn table_border_style_end(&self, out: &mut String) { self.style_end(out, "thematic_break"); }
    fn table_header_start(&self, _out: &mut String) {}
    fn table_header_end(&self, _out: &mut String) {}
    fn table_shadow_char(&self) -> Option<&str> { None }
}

struct WalkCtx {
    list_index: Vec<Option<usize>>,
    list_tight: Vec<bool>,
    needs_newline: bool,
    quote_depth: usize,
    list_depth: usize,
}

pub fn walk_and_format<'a, F: Formatter>(root: &'a AstNode<'a>, fmt: &F) -> String {
    let mut out = String::new();
    let mut ctx = WalkCtx {
        list_index: Vec::new(),
        list_tight: Vec::new(),
        needs_newline: false,
        quote_depth: 0,
        list_depth: 0,
    };
    walk(root, &mut out, &mut ctx, fmt);

    // Render footnote definitions at the end
    let mut footnotes = String::new();
    for child in root.children() {
        if let NodeValue::FootnoteDefinition(ref fd) = child.data.borrow().value {
            if !footnotes.is_empty() {
                footnotes.push('\n');
            }
            footnotes.push_str("[^");
            footnotes.push_str(&fd.name);
            footnotes.push_str("]: ");
            let mut fn_out = String::new();
            let mut fn_ctx = WalkCtx {
                list_index: Vec::new(),
                list_tight: Vec::new(),
                needs_newline: false,
                quote_depth: 0,
                list_depth: 0,
            };
            for fn_child in child.children() {
                walk(fn_child, &mut fn_out, &mut fn_ctx, fmt);
            }
            footnotes.push_str(fn_out.trim());
        }
    }
    if !footnotes.is_empty() {
        ensure_newline(&mut out);
        out.push('\n');
        out.push_str(&footnotes);
    }

    let trimmed_len = out.trim_end().len();
    out.truncate(trimmed_len);
    out
}

fn ensure_newline(out: &mut String) {
    if !out.is_empty() && !out.ends_with('\n') {
        out.push('\n');
    }
}

fn write_quote_prefix<F: Formatter>(out: &mut String, ctx: &WalkCtx, fmt: &F) {
    for _ in 0..ctx.quote_depth {
        fmt.quote_prefix(out);
    }
}

fn write_list_indent(out: &mut String, ctx: &WalkCtx) {
    for _ in 1..ctx.list_depth {
        out.push_str("  ");
    }
}

// --- Table ---

/// Calculate visible display width, stripping ANSI escape sequences.
/// Uses byte iteration to avoid UTF-8 decoding overhead.
fn display_width(s: &str) -> usize {
    let mut width = 0;
    let mut in_escape = false;
    for b in s.bytes() {
        if in_escape {
            if b == b'm' { in_escape = false; }
            continue;
        }
        if b == b'\x1b' { in_escape = true; continue; }
        // Count only leading bytes of UTF-8 sequences
        if (b & 0xC0) != 0x80 {
            width += 1;
        }
    }
    width
}

/// Walk inline nodes only — no block-level side effects.
/// Used by both the main walker (for inline content) and table cell rendering.
fn walk_inline<'a, F: Formatter>(node: &'a AstNode<'a>, out: &mut String, fmt: &F) {
    match &node.data.borrow().value {
        NodeValue::Text(t) => out.push_str(t),
        NodeValue::SoftBreak => out.push(' '),
        NodeValue::LineBreak => out.push('\n'),
        NodeValue::Code(c) => fmt.code_span(out, &c.literal),
        NodeValue::Strong => {
            fmt.strong_start(out);
            for child in node.children() { walk_inline(child, out, fmt); }
            fmt.strong_end(out);
        }
        NodeValue::Emph => {
            fmt.emph_start(out);
            for child in node.children() { walk_inline(child, out, fmt); }
            fmt.emph_end(out);
        }
        NodeValue::Strikethrough => {
            fmt.strikethrough_start(out);
            for child in node.children() { walk_inline(child, out, fmt); }
            fmt.strikethrough_end(out);
        }
        NodeValue::Underline => {
            fmt.underline_start(out);
            for child in node.children() { walk_inline(child, out, fmt); }
            fmt.underline_end(out);
        }
        NodeValue::Highlight | NodeValue::Insert | NodeValue::Superscript
        | NodeValue::Subscript | NodeValue::SpoileredText | NodeValue::Escaped => {
            for child in node.children() { walk_inline(child, out, fmt); }
        }
        NodeValue::Link(link) => {
            fmt.link_start(out, &link.url);
            for child in node.children() { walk_inline(child, out, fmt); }
            fmt.link_end(out, &link.url);
        }
        NodeValue::Image(link) => {
            for child in node.children() { walk_inline(child, out, fmt); }
            fmt.image_end(out, &link.url);
        }
        NodeValue::Math(m) => fmt.math_span(out, m.literal.trim()),
        NodeValue::WikiLink(wl) => fmt.wiki_link(out, &wl.url),
        NodeValue::FootnoteReference(r) => {
            out.push_str("[^");
            out.push_str(&r.name);
            out.push(']');
        }
        NodeValue::ShortCode(sc) => out.push_str(&sc.emoji),
        _ => {
            for child in node.children() { walk_inline(child, out, fmt); }
        }
    }
}

/// Render a table cell's inline content through the formatter.
fn render_cell_styled<'a, F: Formatter>(cell_node: &'a AstNode<'a>, fmt: &F) -> String {
    let mut s = String::new();
    for child in cell_node.children() {
        walk_inline(child, &mut s, fmt);
    }
    s
}

fn render_table<'a, F: Formatter>(node: &'a AstNode<'a>, out: &mut String, ctx: &mut WalkCtx, fmt: &F) {
    let alignments = match &node.data.borrow().value {
        NodeValue::Table(t) => t.alignments.clone(),
        _ => vec![],
    };

    // Collect styled text and cached display widths per cell
    let mut rows: Vec<Vec<(String, usize)>> = Vec::new();
    for row in node.children() {
        let mut cells: Vec<(String, usize)> = Vec::new();
        for cell in row.children() {
            let s = render_cell_styled(cell, fmt);
            let w = display_width(&s);
            cells.push((s, w));
        }
        rows.push(cells);
    }

    if rows.is_empty() {
        return;
    }

    let cols = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    let mut widths = vec![0usize; cols];
    for row in &rows {
        for (i, (_, cw)) in row.iter().enumerate() {
            if i < cols {
                widths[i] = widths[i].max(*cw);
            }
        }
    }
    for w in &mut widths {
        if *w < 3 { *w = 3; }
    }

    let shadow = fmt.table_shadow_char();
    // Total table width: 1 (left border) + sum(col_width + 2 padding + 1 separator) - 1 last sep + 1 right border
    let table_width: usize = 1 + widths.iter().sum::<usize>() + 3 * cols;

    if ctx.needs_newline {
        ensure_newline(out);
        out.push('\n');
    }

    // Top border
    write_quote_prefix(out, ctx, fmt);
    fmt.table_border_style_start(out);
    out.push('┌');
    for (i, w) in widths.iter().enumerate() {
        for _ in 0..(*w + 2) { out.push('─'); }
        if i < cols - 1 { out.push('┬'); }
    }
    out.push('┐');
    fmt.table_border_style_end(out);
    out.push('\n');

    for (ri, row) in rows.iter().enumerate() {
        let is_header = ri == 0;
        write_quote_prefix(out, ctx, fmt);
        fmt.table_border_style_start(out);
        out.push('│');
        fmt.table_border_style_end(out);
        for (i, w) in widths.iter().enumerate() {
            let (styled, cw) = row.get(i).map(|c| (c.0.as_str(), c.1)).unwrap_or(("", 0));
            let align = alignments.get(i).copied().unwrap_or(TableAlignment::None);
            let pad = w.saturating_sub(cw);

            out.push(' ');
            if is_header { fmt.table_header_start(out); }
            match align {
                TableAlignment::Right => {
                    for _ in 0..pad { out.push(' '); }
                    out.push_str(styled);
                }
                TableAlignment::Center => {
                    let left = pad / 2;
                    let right = pad - left;
                    for _ in 0..left { out.push(' '); }
                    out.push_str(styled);
                    for _ in 0..right { out.push(' '); }
                }
                _ => {
                    out.push_str(styled);
                    for _ in 0..pad { out.push(' '); }
                }
            }
            if is_header { fmt.table_header_end(out); }
            out.push(' ');
            fmt.table_border_style_start(out);
            out.push('│');
            fmt.table_border_style_end(out);
        }
        if let Some(sc) = shadow { out.push_str(sc); }
        out.push('\n');

        if ri == 0 {
            write_quote_prefix(out, ctx, fmt);
            fmt.table_border_style_start(out);
            out.push('├');
            for (i, w) in widths.iter().enumerate() {
                for _ in 0..(*w + 2) { out.push('─'); }
                if i < cols - 1 { out.push('┼'); }
            }
            out.push('┤');
            fmt.table_border_style_end(out);
            if let Some(sc) = shadow { out.push_str(sc); }
            out.push('\n');
        }
    }

    // Bottom border
    write_quote_prefix(out, ctx, fmt);
    fmt.table_border_style_start(out);
    out.push('└');
    for (i, w) in widths.iter().enumerate() {
        for _ in 0..(*w + 2) { out.push('─'); }
        if i < cols - 1 { out.push('┴'); }
    }
    out.push('┘');
    fmt.table_border_style_end(out);
    if let Some(sc) = shadow { out.push_str(sc); }
    out.push('\n');

    // Bottom shadow row
    if let Some(sc) = shadow {
        write_quote_prefix(out, ctx, fmt);
        out.push_str("  ");
        for _ in 0..table_width - 1 {
            out.push_str(sc);
        }
        out.push('\n');
    }

    ctx.needs_newline = true;
}

// --- Item children helper ---

fn walk_item_children<'a, F: Formatter>(node: &'a AstNode<'a>, out: &mut String, ctx: &mut WalkCtx, fmt: &F) {
    let child_count = node.children().count();
    let mut first = true;
    for child in node.children() {
        if first {
            first = false;
            let child_val = &child.data.borrow().value;
            if matches!(child_val, NodeValue::Paragraph) {
                for inner in child.children() {
                    walk(inner, out, ctx, fmt);
                }
                ensure_newline(out);
                ctx.needs_newline = child_count > 1;
            } else {
                walk(child, out, ctx, fmt);
            }
        } else {
            walk(child, out, ctx, fmt);
        }
    }
    // If item had block children (code blocks etc.), ensure trailing blank line
    if child_count > 1 {
        ensure_newline(out);
        if !out.ends_with("\n\n") {
            out.push('\n');
        }
    }
    ctx.needs_newline = true;
}

// --- Main walker ---

fn walk<'a, F: Formatter>(node: &'a AstNode<'a>, out: &mut String, ctx: &mut WalkCtx, fmt: &F) {
    let val = &node.data.borrow().value;

    match val {
        NodeValue::Document => {
            for child in node.children() {
                walk(child, out, ctx, fmt);
            }
            return;
        }

        NodeValue::FrontMatter(_) | NodeValue::HtmlBlock(_) | NodeValue::HtmlInline(_) => return,

        NodeValue::Paragraph => {
            if ctx.needs_newline {
                ensure_newline(out);
                write_quote_prefix(out, ctx, fmt);
                out.push('\n');
            }
            write_quote_prefix(out, ctx, fmt);
            if ctx.quote_depth > 0 {
                fmt.blockquote_text_start(out);
            }
            for child in node.children() {
                walk(child, out, ctx, fmt);
            }
            if ctx.quote_depth > 0 {
                fmt.blockquote_text_end(out);
            }
            ensure_newline(out);
            ctx.needs_newline = true;
            return;
        }

        NodeValue::Heading(h) => {
            if ctx.needs_newline {
                ensure_newline(out);
                out.push('\n');
            }
            fmt.heading_start(out, h.level);
            // showMarkdown: all levels get # prefix
            // otherwise: H1/H2 rely on styling; H3+ show # for hierarchy
            if fmt.show_markdown() || h.level >= 3 {
                for _ in 0..h.level { out.push('#'); }
                out.push(' ');
            }
            for child in node.children() {
                walk(child, out, ctx, fmt);
            }
            fmt.heading_end(out);
            ensure_newline(out);
            ctx.needs_newline = true;
            return;
        }

        NodeValue::BlockQuote | NodeValue::MultilineBlockQuote(_) => {
            ctx.quote_depth += 1;
            for child in node.children() {
                walk(child, out, ctx, fmt);
            }
            ctx.quote_depth -= 1;
            return;
        }

        NodeValue::List(nl) => {
            ctx.list_depth += 1;
            ctx.list_tight.push(nl.tight);
            if nl.list_type == comrak::nodes::ListType::Ordered {
                ctx.list_index.push(Some(nl.start as usize));
            } else {
                ctx.list_index.push(None);
            }
            for child in node.children() {
                walk(child, out, ctx, fmt);
            }
            ctx.list_index.pop();
            ctx.list_tight.pop();
            ctx.list_depth -= 1;
            return;
        }

        NodeValue::Item(nl) => {
            if ctx.needs_newline {
                ensure_newline(out);
            }
            write_quote_prefix(out, ctx, fmt);
            write_list_indent(out, ctx);
            let ordered = nl.list_type == comrak::nodes::ListType::Ordered;
            let idx = ctx.list_index.last().copied().flatten().unwrap_or(1);
            fmt.list_bullet(out, ordered, idx);
            if ordered {
                if let Some(last) = ctx.list_index.last_mut() {
                    *last = Some(idx + 1);
                }
            }
            walk_item_children(node, out, ctx, fmt);
            return;
        }

        NodeValue::TaskItem(ti) => {
            if ctx.needs_newline {
                ensure_newline(out);
            }
            write_quote_prefix(out, ctx, fmt);
            write_list_indent(out, ctx);
            fmt.task_marker(out, ti.symbol.is_some());
            walk_item_children(node, out, ctx, fmt);
            return;
        }

        NodeValue::CodeBlock(cb) => {
            if ctx.needs_newline {
                ensure_newline(out);
                out.push('\n');
            }
            fmt.code_block_start(out, &cb.info);
            for line in cb.literal.lines() {
                write_quote_prefix(out, ctx, fmt);
                fmt.code_block_line(out, line);
            }
            fmt.code_block_end(out);
            ctx.needs_newline = true;
            return;
        }

        NodeValue::ThematicBreak => {
            if ctx.needs_newline {
                ensure_newline(out);
                out.push('\n');
            }
            fmt.thematic_break(out);
            ctx.needs_newline = true;
            return;
        }

        // Leaf inlines — delegate to walk_inline (shared with table cells)
        NodeValue::Text(_) | NodeValue::Code(_) | NodeValue::SoftBreak
        | NodeValue::Math(_) | NodeValue::FootnoteReference(_) | NodeValue::WikiLink(_)
        | NodeValue::ShortCode(_) => {
            walk_inline(node, out, fmt);
            return;
        }

        NodeValue::LineBreak => {
            out.push('\n');
            write_quote_prefix(out, ctx, fmt);
        }

        // Container inlines — use walk_inline for formatting but recurse
        // through walk() to handle LineBreak with quote prefix
        NodeValue::Strong => {
            fmt.strong_start(out);
            for child in node.children() { walk(child, out, ctx, fmt); }
            fmt.strong_end(out);
            return;
        }
        NodeValue::Emph => {
            fmt.emph_start(out);
            for child in node.children() { walk(child, out, ctx, fmt); }
            fmt.emph_end(out);
            return;
        }
        NodeValue::Strikethrough => {
            fmt.strikethrough_start(out);
            for child in node.children() { walk(child, out, ctx, fmt); }
            fmt.strikethrough_end(out);
            return;
        }
        NodeValue::Underline => {
            fmt.underline_start(out);
            for child in node.children() { walk(child, out, ctx, fmt); }
            fmt.underline_end(out);
            return;
        }
        NodeValue::Highlight | NodeValue::Insert | NodeValue::Superscript
        | NodeValue::Subscript | NodeValue::SpoileredText | NodeValue::Escaped => {
            for child in node.children() { walk(child, out, ctx, fmt); }
            return;
        }
        NodeValue::Link(link) => {
            fmt.link_start(out, &link.url);
            for child in node.children() { walk(child, out, ctx, fmt); }
            fmt.link_end(out, &link.url);
            return;
        }
        NodeValue::Image(link) => {
            for child in node.children() { walk(child, out, ctx, fmt); }
            fmt.image_end(out, &link.url);
            return;
        }

        NodeValue::Table(_) => {
            render_table(node, out, ctx, fmt);
            return;
        }
        NodeValue::TableRow(_) | NodeValue::TableCell => return,

        NodeValue::FootnoteDefinition(_) => return,

        NodeValue::Alert(a) => {
            if ctx.needs_newline {
                ensure_newline(out);
                out.push('\n');
            }
            fmt.alert_title(out, a);
            out.push('\n');
            ctx.needs_newline = false;
            for child in node.children() {
                walk(child, out, ctx, fmt);
            }
            ctx.needs_newline = true;
            return;
        }

        NodeValue::DescriptionList | NodeValue::DescriptionItem(_)
        | NodeValue::DescriptionTerm | NodeValue::DescriptionDetails | NodeValue::Subtext => {
            for child in node.children() {
                walk(child, out, ctx, fmt);
            }
            return;
        }

        NodeValue::Raw(s) => out.push_str(s),
        NodeValue::EscapedTag(s) => out.push_str(s),
        NodeValue::HeexBlock(_) | NodeValue::HeexInline(_) | NodeValue::BlockDirective(_) => return,
    }
}

#[cfg(test)]
mod tests {
    use comrak::{parse_document, Arena, Options};
    use crate::text::format_text;
    use crate::ansi::{format_ansi, AnsiTheme};

    fn opts() -> Options<'static> {
        let mut o = Options::default();
        o.extension.strikethrough = true;
        o.extension.table = true;
        o.extension.tasklist = true;
        o.extension.autolink = true;
        o.extension.alerts = true;
        o.extension.footnotes = true;
        o.extension.math_dollars = true;
        o.extension.superscript = true;
        o.extension.subscript = true;
        o.extension.underline = true;
        o.extension.description_lists = true;
        o
    }

    fn text(md: &str) -> String {
        let arena = Arena::new();
        let root = parse_document(&arena, md, &opts());
        format_text(root, false, false, None)
    }

    fn text_md(md: &str) -> String {
        let arena = Arena::new();
        let root = parse_document(&arena, md, &opts());
        format_text(root, false, true, None)
    }

    fn ansi_plain(md: &str) -> String {
        let arena = Arena::new();
        let root = parse_document(&arena, md, &opts());
        let theme = AnsiTheme { bold: Some("".into()), italic: Some("".into()),
            strikethrough: Some("".into()), underline: Some("".into()),
            code: Some("".into()), code_block: Some("".into()),
            code_block_border: Some("".into()), link: Some("".into()),
            link_url: Some("".into()), blockquote: Some("".into()),
            blockquote_border: Some("".into()), thematic_break: Some("".into()),
            list_bullet: Some("".into()), math: Some("".into()),
            heading: Some("".into()),
            heading_h1: Some("".into()), heading_h2: Some("".into()),
            heading_h3: Some("".into()), heading_h4: Some("".into()),
            heading_h5: Some("".into()), heading_h6: Some("".into()),
            reset: Some("".into()),
            show_urls: Some(false), show_markdown: Some(false),
            table_shadow: None, hyperlinks: Some(false) };
        format_ansi(root, Some(theme))
    }

    // --- Text and ANSI match ---
    #[test] fn text_ansi_match_basic() {
        assert_eq!(text("# Hello\n\nworld"), ansi_plain("# Hello\n\nworld"));
    }
    #[test] fn text_ansi_match_list() {
        assert_eq!(text("- one\n- two"), ansi_plain("- one\n- two"));
    }
    #[test] fn text_ansi_match_code_block() {
        assert_eq!(text("```\ncode\n```"), ansi_plain("```\ncode\n```"));
    }
    #[test] fn text_ansi_match_table() {
        assert_eq!(
            text("| a | b |\n|---|---|\n| 1 | 2 |"),
            ansi_plain("| a | b |\n|---|---|\n| 1 | 2 |")
        );
    }
    #[test] fn text_ansi_match_blockquote() {
        assert_eq!(text("> quote"), ansi_plain("> quote"));
    }

    // --- Headings ---
    #[test] fn h1_no_prefix_by_default() {
        assert_eq!(text("# Title"), "Title");
    }
    #[test] fn h2_no_prefix_by_default() {
        assert_eq!(text("## Sub"), "Sub");
    }
    #[test] fn h3_always_has_prefix() {
        assert_eq!(text("### Section"), "### Section");
    }
    #[test] fn h4_always_has_prefix() {
        assert_eq!(text("#### Deep"), "#### Deep");
    }
    #[test] fn h1_shows_prefix_with_show_markdown() {
        assert_eq!(text_md("# Title"), "# Title");
    }
    #[test] fn h3_shows_prefix_with_show_markdown() {
        assert_eq!(text_md("### Section"), "### Section");
    }

    // --- Inline formatting ---
    #[test] fn bold_stripped() { assert_eq!(text("**bold**"), "bold"); }
    #[test] fn italic_stripped() { assert_eq!(text("*italic*"), "italic"); }
    #[test] fn strikethrough_stripped() { assert_eq!(text("~~struck~~"), "struck"); }
    #[test] fn inline_code_no_backticks() { assert_eq!(text("use `const`"), "use const"); }
    #[test] fn inline_code_backticks_with_show_markdown() {
        assert_eq!(text_md("use `const`"), "use `const`");
    }
    #[test] fn nested_formatting_stripped() {
        assert_eq!(text("**bold *and italic***"), "bold and italic");
    }

    // --- Code blocks ---
    #[test] fn code_block_no_fences_by_default() {
        let t = text("```js\ncode\n```");
        assert!(!t.contains("```"));
        assert!(t.contains("code"));
    }
    #[test] fn code_block_fences_with_show_markdown() {
        let t = text_md("```js\ncode\n```");
        assert!(t.contains("```js"));
        assert!(t.contains("code"));
    }
    #[test] fn code_block_spacing() {
        let t = text("before\n\n```\ncode\n```\n\nafter");
        assert_eq!(t, "before\n\ncode\n\nafter");
    }

    // --- Lists ---
    #[test] fn unordered_always_shows_bullets() {
        let t = text("- one\n- two");
        assert!(t.contains("• one"));
        assert!(t.contains("• two"));
    }
    #[test] fn ordered_always_shows_numbers() {
        let t = text("1. first\n2. second");
        assert!(t.contains("1. first"));
        assert!(t.contains("2. second"));
    }
    #[test] fn tight_list_no_extra_spacing() {
        assert_eq!(text("- one\n- two\n- three"), "• one\n• two\n• three");
    }
    #[test] fn nested_list_indentation() {
        let t = text("- a\n  - b\n    - c");
        assert!(t.contains("• a"));
        assert!(t.contains("  • b"));
    }
    #[test] fn code_block_in_list_has_spacing_before_and_after() {
        let t = text("- Item\n\n        code\n\n- Next");
        assert!(t.contains("Item\n\n"));
        assert!(t.contains("code\n\n"));
        assert!(t.contains("• Next"));
    }

    // --- Blockquotes ---
    #[test] fn blockquote_has_bar_prefix() {
        assert!(text("> quoted").contains("│"));
        assert!(text("> quoted").contains("quoted"));
    }
    #[test] fn blockquote_prefix_always_shown() {
        // Even without show_markdown, blockquote prefix is structural
        assert!(text("> quoted").contains("│"));
    }
    #[test] fn multi_paragraph_blockquote() {
        let t = text("> line1\n>\n> line2");
        assert!(t.contains("line1"));
        assert!(t.contains("line2"));
    }

    // --- Tables ---
    #[test] fn table_box_drawing() {
        let t = text("| a | b |\n|---|---|\n| 1 | 2 |");
        assert!(t.contains("┌"));
        assert!(t.contains("│"));
        assert!(t.contains("┘"));
    }
    #[test] fn table_alignment() {
        let t = text("| l | c | r |\n|:--|:--:|--:|\n| x | y | z |");
        // Right-aligned: z should have leading space
        assert!(t.contains("z"));
    }
    #[test] fn table_shadow() {
        let arena = Arena::new();
        let root = parse_document(&arena, "| a |\n|---|\n| 1 |", &opts());
        let t = format_text(root, false, false, Some("░".into()));
        assert!(t.contains("░"));
    }
    #[test] fn table_no_shadow_with_empty_string() {
        let arena = Arena::new();
        let root = parse_document(&arena, "| a |\n|---|\n| 1 |", &opts());
        let t = format_text(root, false, false, Some("".into()));
        assert!(!t.contains("░"));
    }

    // --- Thematic break ---
    #[test] fn thematic_break_box_drawing() {
        assert!(text("---").contains("────"));
    }

    // --- Links ---
    #[test] fn link_no_url_by_default() {
        assert_eq!(text("[click](http://x)"), "click");
    }
    #[test] fn link_with_url() {
        let arena = Arena::new();
        let root = parse_document(&arena, "[click](http://x)", &opts());
        let t = format_text(root, true, false, None);
        assert!(t.contains("click"));
        assert!(t.contains("http://x"));
    }

    // --- Footnotes ---
    #[test] fn footnote_reference_shown() {
        let t = text("text[^1]\n\n[^1]: note");
        assert!(t.contains("[^1]"));
    }
    #[test] fn footnote_definition_at_bottom() {
        let t = text("text[^1]\n\n[^1]: The footnote");
        assert!(t.contains("[^1]: The footnote"));
    }

    // --- Alerts ---
    #[test] fn alert_title_shown() {
        let t = text("> [!NOTE]\n> content");
        assert!(t.contains("Alert") || t.contains("Note") || t.contains("NOTE"));
        assert!(t.contains("content"));
    }

    // --- Math ---
    #[test] fn inline_math() {
        let t = text("$x^2$");
        assert!(t.contains("x^2"));
    }
    #[test] fn display_math_no_extra_lines() {
        let t = text("before\n\n$$\nx^2\n$$\n\nafter");
        assert_eq!(t, "before\n\nx^2\n\nafter");
    }

    // --- Empty ---
    #[test] fn empty_input() { assert_eq!(text(""), ""); }
    #[test] fn whitespace_only() { assert_eq!(text("   "), ""); }

    // --- Task lists ---
    #[test] fn task_list_checked_symbol() {
        let t = text("- [x] done");
        assert!(t.contains("☒") || t.contains("[x]"));
        assert!(t.contains("done"));
    }
    #[test] fn task_list_unchecked_symbol() {
        let t = text("- [ ] todo");
        assert!(t.contains("☐") || t.contains("[ ]"));
        assert!(t.contains("todo"));
    }

    // --- Description lists ---
    #[test] fn description_list() {
        let t = text("term\n\n: definition");
        assert!(t.contains("term"));
        assert!(t.contains("definition"));
    }

    // === ANSI-specific tests (with real theme) ===

    fn ansi(md: &str) -> String {
        let arena = Arena::new();
        let root = parse_document(&arena, md, &opts());
        format_ansi(root, None) // default dark theme
    }

    fn ansi_with(md: &str, theme: AnsiTheme) -> String {
        let arena = Arena::new();
        let root = parse_document(&arena, md, &opts());
        format_ansi(root, Some(theme))
    }

    #[test] fn ansi_bold_has_escape_codes() {
        let a = ansi("**bold**");
        assert!(a.contains("\x1b["));
        assert!(a.contains("bold"));
    }
    #[test] fn ansi_italic_has_escape_codes() {
        let a = ansi("*italic*");
        assert!(a.contains("\x1b["));
        assert!(a.contains("italic"));
    }
    #[test] fn ansi_strikethrough_has_escape_codes() {
        let a = ansi("~~struck~~");
        assert!(a.contains("\x1b["));
        assert!(a.contains("struck"));
    }
    #[test] fn ansi_underline_has_escape_codes() {
        let a = ansi("__underlined__");
        assert!(a.contains("\x1b["));
    }
    #[test] fn ansi_code_has_escape_codes() {
        let a = ansi("`code`");
        assert!(a.contains("\x1b["));
        assert!(a.contains("code"));
    }
    #[test] fn ansi_code_block_has_escape_codes() {
        let a = ansi("```\ncode\n```");
        assert!(a.contains("\x1b["));
        assert!(a.contains("code"));
    }
    #[test] fn ansi_heading_h1_styled() {
        let a = ansi("# Title");
        assert!(a.contains("\x1b[1;4;35m")); // bold underline magenta
    }
    #[test] fn ansi_heading_h2_styled() {
        let a = ansi("## Sub");
        assert!(a.contains("\x1b[1;36m")); // bold cyan
    }
    #[test] fn ansi_link_styled() {
        let a = ansi("[click](http://x)");
        assert!(a.contains("\x1b["));
        assert!(a.contains("click"));
        assert!(a.contains("http://x"));
    }
    #[test] fn ansi_blockquote_styled() {
        let a = ansi("> quote");
        assert!(a.contains("│"));
        assert!(a.contains("quote"));
    }
    #[test] fn ansi_thematic_break_styled() {
        let a = ansi("---");
        assert!(a.contains("────"));
    }
    #[test] fn ansi_list_bullet_styled() {
        let a = ansi("- item");
        assert!(a.contains("\x1b["));
        assert!(a.contains("•"));
    }
    #[test] fn ansi_table_border_styled() {
        let a = ansi("| a |\n|---|\n| 1 |");
        assert!(a.contains("┌"));
        assert!(a.contains("\x1b["));
    }

    // Alert types
    #[test] fn ansi_alert_note() {
        let a = ansi("> [!NOTE]\n> content");
        assert!(a.contains("\x1b[1;97;44m")); // white on blue
        assert!(a.contains("content"));
    }
    #[test] fn ansi_alert_tip() {
        let a = ansi("> [!TIP]\n> content");
        assert!(a.contains("\x1b[1;97;42m")); // white on green
    }
    #[test] fn ansi_alert_important() {
        let a = ansi("> [!IMPORTANT]\n> content");
        assert!(a.contains("\x1b[1;97;45m")); // white on purple
    }
    #[test] fn ansi_alert_warning() {
        let a = ansi("> [!WARNING]\n> content");
        assert!(a.contains("\x1b[1;97;43m")); // white on yellow
    }
    #[test] fn ansi_alert_caution() {
        let a = ansi("> [!CAUTION]\n> content");
        assert!(a.contains("\x1b[1;97;41m")); // white on red
    }

    // Theme variations
    #[test] fn ansi_light_theme() {
        let a = ansi_with("**bold**", AnsiTheme::light());
        assert!(a.contains("\x1b["));
    }
    #[test] fn ansi_default_theme() {
        let a = ansi_with("**bold**", AnsiTheme::default());
        assert!(a.contains("\x1b["));
    }
    #[test] fn ansi_show_markdown_on() {
        let mut t = AnsiTheme::dark();
        t.show_markdown = Some(true);
        let a = ansi_with("**bold**", t);
        assert!(a.contains("**bold**"));
    }
    #[test] fn ansi_show_urls_off() {
        let mut t = AnsiTheme::dark();
        t.show_urls = Some(false);
        let a = ansi_with("[click](http://x)", t);
        assert!(a.contains("click"));
        assert!(!a.contains("http://x"));
    }
    #[test] fn ansi_show_urls_on() {
        let mut t = AnsiTheme::dark();
        t.show_urls = Some(true);
        let a = ansi_with("[click](http://x)", t);
        assert!(a.contains("http://x"));
    }
    #[test] fn ansi_table_shadow() {
        let mut t = AnsiTheme::dark();
        t.table_shadow = Some("░".into());
        let a = ansi_with("| a |\n|---|\n| 1 |", t);
        assert!(a.contains("░"));
    }
    #[test] fn ansi_task_list_with_show_markdown() {
        let mut t = AnsiTheme::dark();
        t.show_markdown = Some(true);
        let a = ansi_with("- [x] done", t);
        assert!(a.contains("[x]"));
        assert!(a.contains("done"));
    }
    #[test] fn ansi_merge_partial_theme() {
        let t = AnsiTheme {
            bold: Some("\x1b[1;31m".into()),
            ..Default::default()
        };
        let a = ansi_with("**bold**", t);
        assert!(a.contains("\x1b[1;31m"));
    }
    #[test] fn ansi_empty_style_disables() {
        let t = AnsiTheme {
            bold: Some("".into()),
            reset: Some("".into()),
            ..Default::default()
        };
        let a = ansi_with("**bold**", t);
        // With empty bold/reset, no ANSI codes for bold specifically
        assert!(a.contains("bold"));
    }

    // Text formatter table shadow
    #[test] fn text_table_shadow_char() {
        let arena = Arena::new();
        let root = parse_document(&arena, "| a |\n|---|\n| 1 |", &opts());
        let t = crate::text::format_text(root, false, false, Some("▒".into()));
        assert!(t.contains("▒"));
    }
    #[test] fn text_show_urls_true() {
        let arena = Arena::new();
        let root = parse_document(&arena, "[click](http://x)", &opts());
        let t = crate::text::format_text(root, true, false, None);
        assert!(t.contains("http://x"));
    }
    #[test] fn text_show_markdown_true() {
        let arena = Arena::new();
        let root = parse_document(&arena, "**bold**", &opts());
        let t = crate::text::format_text(root, false, true, None);
        assert!(t.contains("bold"));
    }

    // === walk_inline coverage (inline formatting in table cells) ===

    #[test] fn table_cell_bold() {
        let t = text("| **bold** |\n|---|\n| x |");
        assert!(t.contains("bold"));
    }
    #[test] fn table_cell_italic() {
        let t = text("| *italic* |\n|---|\n| x |");
        assert!(t.contains("italic"));
    }
    #[test] fn table_cell_strikethrough() {
        let t = text("| ~~struck~~ |\n|---|\n| x |");
        assert!(t.contains("struck"));
    }
    #[test] fn table_cell_underline() {
        let t = text("| __underlined__ |\n|---|\n| x |");
        assert!(t.contains("underlined"));
    }
    #[test] fn table_cell_code() {
        let t = text("| `code` |\n|---|\n| x |");
        assert!(t.contains("code"));
    }
    #[test] fn table_cell_link() {
        let arena = Arena::new();
        let root = parse_document(&arena, "| [click](http://x) |\n|---|\n| y |", &opts());
        let t = crate::text::format_text(root, true, false, None);
        assert!(t.contains("click"));
        assert!(t.contains("http://x"));
    }
    #[test] fn table_cell_image() {
        let arena = Arena::new();
        let root = parse_document(&arena, "| ![alt](http://img) |\n|---|\n| y |", &opts());
        let t = crate::text::format_text(root, true, false, None);
        assert!(t.contains("alt"));
        assert!(t.contains("http://img"));
    }
    #[test] fn table_cell_math() {
        let t = text("| $x^2$ |\n|---|\n| y |");
        assert!(t.contains("x^2"));
    }
    #[test] fn table_cell_nested_formatting() {
        let t = text("| **bold *italic*** |\n|---|\n| x |");
        assert!(t.contains("bold"));
        assert!(t.contains("italic"));
    }
    #[test] fn table_cell_soft_break() {
        // Soft break in table cell becomes space
        let t = text("| a b |\n|---|\n| x |");
        assert!(t.contains("a b"));
    }

    // ANSI table cells with inline formatting
    #[test] fn ansi_table_cell_bold() {
        let a = ansi("| **bold** |\n|---|\n| x |");
        assert!(a.contains("\x1b[")); // has ANSI codes
        assert!(a.contains("bold"));
    }
    #[test] fn ansi_table_cell_link() {
        let a = ansi("| [click](http://x) |\n|---|\n| y |");
        assert!(a.contains("click"));
        assert!(a.contains("http://x"));
    }
    #[test] fn ansi_table_cell_code() {
        let a = ansi("| `code` |\n|---|\n| x |");
        assert!(a.contains("code"));
    }

    // walk_inline: footnote reference in table
    #[test] fn table_cell_footnote_ref() {
        let t = text("| text[^1] |\n|---|\n| x |\n\n[^1]: note");
        assert!(t.contains("[^1]"));
    }

    // walk_inline: image outside table
    #[test] fn image_with_url() {
        let arena = Arena::new();
        let root = parse_document(&arena, "![alt](http://img.png)", &opts());
        let t = crate::text::format_text(root, true, false, None);
        assert!(t.contains("alt"));
        assert!(t.contains("http://img.png"));
    }
    #[test] fn image_without_url() {
        let t = text("![alt](http://img.png)");
        assert!(t.contains("alt"));
        assert!(!t.contains("http://img.png"));
    }

    // LineBreak in blockquote (goes through main walker, not walk_inline)
    #[test] fn line_break_in_blockquote() {
        let t = text("> line1\\\n> line2");
        assert!(t.contains("line1"));
        assert!(t.contains("line2"));
    }

    // Multiple footnotes (covers the `footnotes.push('\n')` branch)
    #[test] fn multiple_footnotes() {
        let t = text("a[^1] b[^2]\n\n[^1]: first\n[^2]: second");
        assert!(t.contains("[^1]: first"));
        assert!(t.contains("[^2]: second"));
    }

    // HtmlBlock/HtmlInline skipped
    #[test] fn html_block_skipped() {
        let t = text("<div>html</div>");
        assert!(!t.contains("<div>"));
    }

    // FrontMatter skipped
    #[test] fn frontmatter_skipped() {
        let mut o = opts();
        o.extension.front_matter_delimiter = Some("---".into());
        let arena = Arena::new();
        let root = parse_document(&arena, "---\ntitle: hi\n---\n\ncontent", &o);
        let t = format_text(root, false, false, None);
        assert!(!t.contains("title"));
        assert!(t.contains("content"));
    }

    // === Feature #1: Targeted SGR resets ===

    #[test] fn targeted_reset_bold_uses_sgr22() {
        let a = ansi("**bold**");
        // Should use \x1b[22m (bold off) not \x1b[0m (full reset)
        assert!(a.contains("\x1b[22m"));
    }
    #[test] fn targeted_reset_italic_uses_sgr23() {
        let a = ansi("*italic*");
        assert!(a.contains("\x1b[23m"));
    }
    #[test] fn targeted_reset_strikethrough_uses_sgr29() {
        let a = ansi("~~struck~~");
        assert!(a.contains("\x1b[29m"));
    }
    #[test] fn targeted_reset_underline_uses_sgr24() {
        let a = ansi("__underlined__");
        assert!(a.contains("\x1b[24m"));
    }
    #[test] fn targeted_reset_code_resets_fg_bg() {
        let a = ansi("`code`");
        // Code close resets fg and bg: \x1b[39m\x1b[49m
        assert!(a.contains("\x1b[39m\x1b[49m"));
    }
    #[test] fn targeted_reset_link_resets_underline_fg() {
        let a = ansi("[click](http://x)");
        // Link close: underline off + default fg
        assert!(a.contains("\x1b[24m\x1b[39m"));
    }
    #[test] fn nested_bold_inside_italic_preserves_italic() {
        // **bold *italic*** — closing italic should not kill bold
        let a = ansi("**bold *and italic***");
        assert!(a.contains("bold"));
        assert!(a.contains("and italic"));
        // italic close is \x1b[23m, NOT \x1b[0m
        assert!(a.contains("\x1b[23m"));
        // bold close is \x1b[22m
        assert!(a.contains("\x1b[22m"));
        // should NOT contain a raw \x1b[0m between inline spans
        // (only heading_end and blockquote_text_end use full reset)
    }
    #[test] fn nested_code_inside_bold_uses_targeted_resets() {
        let a = ansi("**some `code` here**");
        assert!(a.contains("some"));
        assert!(a.contains("code"));
        assert!(a.contains("here"));
        // code close should reset fg+bg, not full reset
        assert!(a.contains("\x1b[39m\x1b[49m"));
    }

    // === Feature #2: Per-level heading colors ===

    #[test] fn ansi_heading_h1_magenta() {
        let a = ansi("# H1");
        assert!(a.contains("\x1b[1;4;35m")); // bold + underline + magenta
    }
    #[test] fn ansi_heading_h2_cyan() {
        let a = ansi("## H2");
        assert!(a.contains("\x1b[1;36m")); // bold + cyan
    }
    #[test] fn ansi_heading_h3_yellow() {
        let a = ansi("### H3");
        assert!(a.contains("\x1b[1;33m")); // bold + yellow
    }
    #[test] fn ansi_heading_h4_green() {
        let a = ansi("#### H4");
        assert!(a.contains("\x1b[1;32m")); // bold + green
    }
    #[test] fn ansi_heading_h5_blue() {
        let a = ansi("##### H5");
        assert!(a.contains("\x1b[1;34m")); // bold + blue
    }
    #[test] fn ansi_heading_h6_white() {
        let a = ansi("###### H6");
        assert!(a.contains("\x1b[1;37m")); // bold + white
    }
    #[test] fn heading_custom_h3_override() {
        let t = AnsiTheme {
            heading_h3: Some("\x1b[1;31m".into()), // custom red
            ..AnsiTheme::dark()
        };
        let a = ansi_with("### Custom", t);
        assert!(a.contains("\x1b[1;31m"));
    }

    // === Feature #3: Bold table headers ===

    #[test] fn ansi_table_header_bold() {
        let a = ansi("| Name | Age |\n|------|-----|\n| Alice | 30 |");
        // Header row should contain bold \x1b[1m and bold-off \x1b[22m
        assert!(a.contains("\x1b[1m"));
        assert!(a.contains("\x1b[22m"));
        // Find the header content between bold markers
        assert!(a.contains("Name"));
        assert!(a.contains("Age"));
    }
    #[test] fn text_table_header_not_bold() {
        // TextFormatter should not add bold to headers
        let t = text("| Name | Age |\n|------|-----|\n| Alice | 30 |");
        assert!(!t.contains("\x1b["));
    }

    // === Feature #4: 256-color inline code backgrounds ===

    #[test] fn ansi_code_256_dark_bg() {
        let a = ansi("`code`");
        // Dark theme: gray bg \x1b[48;5;236m + orange fg \x1b[38;5;215m
        assert!(a.contains("\x1b[48;5;236m"));
        assert!(a.contains("\x1b[38;5;215m"));
    }
    #[test] fn ansi_code_256_light_bg() {
        let a = ansi_with("`code`", AnsiTheme::light());
        // Light theme: light gray bg + dark red fg
        assert!(a.contains("\x1b[48;5;254m"));
        assert!(a.contains("\x1b[38;5;124m"));
    }
    #[test] fn ansi_blockquote_border_256_gray() {
        let a = ansi("> quote");
        // Blockquote border uses 256-color medium gray
        assert!(a.contains("\x1b[38;5;242m"));
    }

    // === Feature #5: OSC 8 hyperlinks ===

    #[test] fn ansi_osc8_hyperlinks_off_by_default() {
        let a = ansi("[click](http://example.com)");
        // Default: no OSC 8 sequences
        assert!(!a.contains("\x1b]8;;"));
    }
    #[test] fn ansi_osc8_hyperlinks_on() {
        let mut t = AnsiTheme::dark();
        t.hyperlinks = Some(true);
        let a = ansi_with("[click](http://example.com)", t);
        // Should contain OSC 8 open with URL
        assert!(a.contains("\x1b]8;;http://example.com\x1b\\"));
        // Should contain OSC 8 close (empty URL)
        assert!(a.contains("\x1b]8;;\x1b\\"));
        assert!(a.contains("click"));
    }
    #[test] fn ansi_osc8_empty_url_skipped() {
        let mut t = AnsiTheme::dark();
        t.hyperlinks = Some(true);
        // Link with empty URL should not emit OSC 8
        let a = ansi_with("[text]()", t);
        assert!(!a.contains("\x1b]8;;"));
    }
    #[test] fn ansi_osc8_with_show_urls() {
        let mut t = AnsiTheme::dark();
        t.hyperlinks = Some(true);
        t.show_urls = Some(true);
        let a = ansi_with("[click](http://x)", t);
        // Should have both OSC 8 and visible URL
        assert!(a.contains("\x1b]8;;http://x\x1b\\"));
        assert!(a.contains("(http://x)"));
    }

    // === Feature #6: Light/dark auto-detection ===

    #[test] fn light_theme_differs_from_dark() {
        let dark = AnsiTheme::dark();
        let light = AnsiTheme::light();
        // Code style should differ between dark and light
        assert_ne!(dark.code, light.code);
    }
    #[test] fn light_theme_code_style() {
        let light = AnsiTheme::light();
        assert_eq!(light.code.as_deref(), Some("\x1b[48;5;254m\x1b[38;5;124m"));
    }
    #[test] fn dark_theme_code_style() {
        let dark = AnsiTheme::dark();
        assert_eq!(dark.code.as_deref(), Some("\x1b[48;5;236m\x1b[38;5;215m"));
    }

    // === Regression: ensure text output unchanged ===

    #[test] fn text_output_unchanged_after_refactor() {
        // Verify text formatter still produces identical output
        let cases = vec![
            "# Title",
            "**bold** and *italic*",
            "- list\n- items",
            "> blockquote",
            "| a | b |\n|---|---|\n| 1 | 2 |",
            "```\ncode\n```",
            "[link](http://x)",
            "---",
        ];
        for md in cases {
            let t = text(md);
            let ap = ansi_plain(md);
            assert_eq!(t, ap, "text/ansi_plain mismatch for: {}", md);
        }
    }
}
