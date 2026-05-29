use crate::walker::{AstNode, Formatter, walk_and_format};

pub struct TextFormatter {
    pub show_urls: bool,
    pub show_markdown: bool,
    pub table_shadow: Option<String>,
}

pub fn format_text<'a>(
    root: &'a AstNode<'a>,
    show_urls: bool,
    show_markdown: bool,
    table_shadow: Option<String>,
) -> String {
    let fmt = TextFormatter { show_urls, show_markdown, table_shadow };
    walk_and_format(root, &fmt)
}

impl Formatter for TextFormatter {
    fn show_urls(&self) -> bool { self.show_urls }
    fn show_markdown(&self) -> bool { self.show_markdown }

    fn strong_start(&self, _out: &mut String) {}
    fn strong_end(&self, _out: &mut String) {}
    fn emph_start(&self, _out: &mut String) {}
    fn emph_end(&self, _out: &mut String) {}
    fn strikethrough_start(&self, _out: &mut String) {}
    fn strikethrough_end(&self, _out: &mut String) {}
    fn underline_start(&self, _out: &mut String) {}
    fn underline_end(&self, _out: &mut String) {}

    fn table_shadow_char(&self) -> Option<&str> {
        self.table_shadow.as_deref()
    }
}
