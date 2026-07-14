use crate::walker::{walk_and_format, AstNode, Formatter};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnsiTheme {
    pub heading: Option<String>,
    pub heading_h1: Option<String>,
    pub heading_h2: Option<String>,
    pub heading_h3: Option<String>,
    pub heading_h4: Option<String>,
    pub heading_h5: Option<String>,
    pub heading_h6: Option<String>,
    pub bold: Option<String>,
    pub italic: Option<String>,
    pub strikethrough: Option<String>,
    pub underline: Option<String>,
    pub code: Option<String>,
    pub code_block: Option<String>,
    pub code_block_border: Option<String>,
    pub link: Option<String>,
    pub link_url: Option<String>,
    pub blockquote: Option<String>,
    pub blockquote_border: Option<String>,
    pub thematic_break: Option<String>,
    pub list_bullet: Option<String>,
    pub math: Option<String>,
    pub reset: Option<String>,
    pub show_urls: Option<bool>,
    pub show_markdown: Option<bool>,
    pub table_shadow: Option<String>,
    pub hyperlinks: Option<bool>,
}

impl AnsiTheme {
    pub fn dark() -> Self {
        Self {
            heading: Some("\x1b[1;34m".into()),
            heading_h1: Some("\x1b[1;4;35m".into()),
            heading_h2: Some("\x1b[1;36m".into()),
            heading_h3: Some("\x1b[1;33m".into()),
            heading_h4: Some("\x1b[1;32m".into()),
            heading_h5: Some("\x1b[1;34m".into()),
            heading_h6: Some("\x1b[1;37m".into()),
            bold: Some("\x1b[1m".into()),
            italic: Some("\x1b[3m".into()),
            strikethrough: Some("\x1b[9m".into()),
            underline: Some("\x1b[4m".into()),
            code: Some("\x1b[48;5;236m\x1b[38;5;215m".into()),
            code_block: Some("\x1b[32m".into()),
            code_block_border: Some("\x1b[2m".into()),
            link: Some("\x1b[4;34m".into()),
            link_url: Some("\x1b[2;34m".into()),
            blockquote: Some("\x1b[3;2m".into()),
            blockquote_border: Some("\x1b[38;5;242m".into()),
            thematic_break: Some("\x1b[2m".into()),
            list_bullet: Some("\x1b[33m".into()),
            math: Some("\x1b[35m".into()),
            reset: Some("\x1b[0m".into()),
            show_urls: Some(true),
            show_markdown: Some(false),
            table_shadow: Some("░".into()),
            hyperlinks: Some(false),
        }
    }

    /// Light theme — differs from dark for elements that use 256-color
    /// palette (inline code background, blockquote border).
    pub fn light() -> Self {
        Self {
            code: Some("\x1b[48;5;254m\x1b[38;5;124m".into()),
            ..Self::dark()
        }
    }

    pub(crate) fn merge_with_defaults(self) -> AnsiTheme {
        let d = AnsiTheme::dark();
        macro_rules! merge {
            ($field:ident) => {
                Some(self.$field.unwrap_or_else(|| d.$field.unwrap()))
            };
        }
        AnsiTheme {
            heading: merge!(heading),
            heading_h1: merge!(heading_h1),
            heading_h2: merge!(heading_h2),
            heading_h3: merge!(heading_h3),
            heading_h4: merge!(heading_h4),
            heading_h5: merge!(heading_h5),
            heading_h6: merge!(heading_h6),
            bold: merge!(bold),
            italic: merge!(italic),
            strikethrough: merge!(strikethrough),
            underline: merge!(underline),
            code: merge!(code),
            code_block: merge!(code_block),
            code_block_border: merge!(code_block_border),
            link: merge!(link),
            link_url: merge!(link_url),
            blockquote: merge!(blockquote),
            blockquote_border: merge!(blockquote_border),
            thematic_break: merge!(thematic_break),
            list_bullet: merge!(list_bullet),
            math: merge!(math),
            reset: merge!(reset),
            show_urls: merge!(show_urls),
            show_markdown: merge!(show_markdown),
            table_shadow: self.table_shadow,
            hyperlinks: self.hyperlinks,
        }
    }

    fn g(&self, key: &str) -> &str {
        match key {
            "heading" => self.heading.as_deref().unwrap_or(""),
            "heading_h1" => self.heading_h1.as_deref().unwrap_or(""),
            "heading_h2" => self.heading_h2.as_deref().unwrap_or(""),
            "heading_h3" => self.heading_h3.as_deref().unwrap_or(""),
            "heading_h4" => self.heading_h4.as_deref().unwrap_or(""),
            "heading_h5" => self.heading_h5.as_deref().unwrap_or(""),
            "heading_h6" => self.heading_h6.as_deref().unwrap_or(""),
            "bold" => self.bold.as_deref().unwrap_or(""),
            "italic" => self.italic.as_deref().unwrap_or(""),
            "strikethrough" => self.strikethrough.as_deref().unwrap_or(""),
            "underline" => self.underline.as_deref().unwrap_or(""),
            "code" => self.code.as_deref().unwrap_or(""),
            "code_block" => self.code_block.as_deref().unwrap_or(""),
            "code_block_border" => self.code_block_border.as_deref().unwrap_or(""),
            "link" => self.link.as_deref().unwrap_or(""),
            "link_url" => self.link_url.as_deref().unwrap_or(""),
            "blockquote" => self.blockquote.as_deref().unwrap_or(""),
            "blockquote_border" => self.blockquote_border.as_deref().unwrap_or(""),
            "thematic_break" => self.thematic_break.as_deref().unwrap_or(""),
            "list_bullet" => self.list_bullet.as_deref().unwrap_or(""),
            "math" => self.math.as_deref().unwrap_or(""),
            "reset" => self.reset.as_deref().unwrap_or(""),
            _ => "",
        }
    }
}

impl Default for AnsiTheme {
    fn default() -> Self {
        Self::dark()
    }
}

struct AnsiFormatter<'a> {
    theme: &'a AnsiTheme,
}

#[cfg(test)]
pub fn format_ansi<'a>(root: &'a AstNode<'a>, theme: Option<AnsiTheme>) -> String {
    let theme = match theme {
        Some(t) => t.merge_with_defaults(),
        None => AnsiTheme::default(),
    };
    format_ansi_prepared(root, &theme)
}

pub(crate) fn format_ansi_prepared<'a>(root: &'a AstNode<'a>, theme: &AnsiTheme) -> String {
    let fmt = AnsiFormatter { theme };
    walk_and_format(root, &fmt)
}

fn write_terminal_safe(out: &mut String, literal: &str) {
    // Unicode control characters outside ASCII are all in U+0080..=U+009F,
    // whose UTF-8 encoding starts with 0xC2. Most Markdown literals therefore
    // take this single byte-scan plus push_str fast path.
    if !literal.as_bytes().iter().any(|byte| {
        (*byte < b' ' && !matches!(*byte, b'\n' | b'\t')) || *byte == 0x7f || *byte == 0xc2
    }) {
        out.push_str(literal);
        return;
    }

    let mut copied_through = 0;
    for (index, character) in literal.char_indices() {
        if character.is_control() && !matches!(character, '\n' | '\t') {
            out.push_str(&literal[copied_through..index]);
            copied_through = index + character.len_utf8();
        }
    }
    out.push_str(&literal[copied_through..]);
}

impl Formatter for AnsiFormatter<'_> {
    fn show_urls(&self) -> bool {
        self.theme.show_urls.unwrap_or(true)
    }
    fn show_markdown(&self) -> bool {
        self.theme.show_markdown.unwrap_or(false)
    }

    fn write_literal(&self, out: &mut String, literal: &str) {
        write_terminal_safe(out, literal);
    }

    fn style(&self, out: &mut String, name: &str) {
        out.push_str(self.theme.g(name));
    }
    fn reset(&self, out: &mut String) {
        out.push_str(self.theme.g("reset"));
    }

    /// Targeted SGR disable codes — turns off only the specific attribute
    /// so enclosing styles (e.g. heading color around bold) survive.
    /// Respects theme: if reset is empty (all ANSI disabled), acts as no-op.
    fn style_end(&self, out: &mut String, name: &str) {
        if self.theme.g("reset").is_empty() {
            return;
        }
        match name {
            "bold" => out.push_str("\x1b[22m"),               // bold/dim off
            "italic" => out.push_str("\x1b[23m"),             // italic off
            "strikethrough" => out.push_str("\x1b[29m"),      // strikethrough off
            "underline" => out.push_str("\x1b[24m"),          // underline off
            "code" => out.push_str("\x1b[39m\x1b[49m"),       // default fg + bg
            "link" => out.push_str("\x1b[24m\x1b[39m"),       // underline off + default fg
            "link_url" => out.push_str("\x1b[22m\x1b[39m"),   // dim off + default fg
            "blockquote" => out.push_str("\x1b[23m\x1b[22m"), // italic off + dim off
            "blockquote_border" => out.push_str("\x1b[39m"),  // default fg
            "code_block" => out.push_str("\x1b[39m"),         // default fg
            "thematic_break" | "code_block_border" => out.push_str("\x1b[22m"), // dim off
            "list_bullet" => out.push_str("\x1b[39m"),        // default fg
            "math" => out.push_str("\x1b[39m"),               // default fg
            _ => self.reset(out),
        }
    }

    // Per-level heading colors
    fn heading_start(&self, out: &mut String, level: u8) {
        let key = match level {
            1 => "heading_h1",
            2 => "heading_h2",
            3 => "heading_h3",
            4 => "heading_h4",
            5 => "heading_h5",
            6 => "heading_h6",
            _ => "heading",
        };
        out.push_str(self.theme.g(key));
    }
    fn heading_end(&self, out: &mut String) {
        self.reset(out);
    }

    // Styled blockquote prefix and italic text
    fn quote_prefix(&self, out: &mut String) {
        self.style(out, "blockquote_border");
        out.push('│');
        self.style_end(out, "blockquote_border");
        out.push(' ');
    }
    fn blockquote_text_start(&self, out: &mut String) {
        out.push_str(self.theme.g("blockquote"));
    }
    fn blockquote_text_end(&self, out: &mut String) {
        self.reset(out);
    }

    // OSC 8 hyperlinks — clickable links in supported terminals
    fn link_start(&self, out: &mut String, url: &str) {
        if self.theme.hyperlinks.unwrap_or(false)
            && !url.is_empty()
            && !self.theme.g("reset").is_empty()
        {
            out.push_str("\x1b]8;;");
            self.write_literal(out, url);
            out.push_str("\x1b\\");
        }
        self.style(out, "link");
    }
    fn link_end(&self, out: &mut String, url: &str) {
        self.style_end(out, "link");
        if self.theme.hyperlinks.unwrap_or(false) && !url.is_empty() {
            out.push_str("\x1b]8;;\x1b\\");
        }
        if self.show_urls() && !url.is_empty() {
            out.push(' ');
            self.style(out, "link_url");
            out.push('(');
            self.write_literal(out, url);
            out.push(')');
            self.style_end(out, "link_url");
        }
    }

    // Bold table headers
    fn table_header_start(&self, out: &mut String) {
        if !self.theme.g("reset").is_empty() {
            out.push_str("\x1b[1m");
        }
    }
    fn table_header_end(&self, out: &mut String) {
        if !self.theme.g("reset").is_empty() {
            out.push_str("\x1b[22m");
        }
    }

    // Colored alert badges
    fn alert_title(&self, out: &mut String, alert: &comrak::nodes::NodeAlert) {
        let bg = match alert.alert_type {
            comrak::nodes::AlertType::Note => "\x1b[1;97;44m",
            comrak::nodes::AlertType::Tip => "\x1b[1;97;42m",
            comrak::nodes::AlertType::Important => "\x1b[1;97;45m",
            comrak::nodes::AlertType::Warning => "\x1b[1;97;43m",
            comrak::nodes::AlertType::Caution => "\x1b[1;97;41m",
        };
        let title = alert
            .title
            .as_deref()
            .unwrap_or(alert.alert_type.default_title());
        out.push_str(bg);
        out.push(' ');
        self.write_literal(out, title);
        out.push(' ');
        self.reset(out);
    }

    fn table_shadow_char(&self) -> Option<&str> {
        self.theme.table_shadow.as_deref()
    }
}

#[cfg(test)]
mod tests {
    use super::{format_ansi, AnsiTheme};
    use comrak::{parse_document, Arena, Options};

    fn render(markdown: &str, options: &Options<'_>, theme: Option<AnsiTheme>) -> String {
        let arena = Arena::new();
        let root = parse_document(&arena, markdown, options);
        format_ansi(root, theme)
    }

    #[test]
    fn strips_terminal_controls_from_plain_markdown_text() {
        let output = render(
            "safe\x1b]52;c;SGVsbG8=\x07tail\u{009b}31m",
            &Options::default(),
            None,
        );

        assert_eq!(output, "safe]52;c;SGVsbG8=tail31m");
    }

    #[test]
    fn strips_terminal_controls_from_styled_and_structural_literals() {
        let mut options = Options::default();
        options.extension.table = true;
        let payload = "safe\x1b]52;c;SGVsbG8=\x07tail";
        let documents = [
            format!("`{payload}`"),
            format!("```text\n{payload}\n```"),
            format!("| value |\n|---|\n| {payload} |"),
        ];

        for markdown in documents {
            let output = render(&markdown, &options, None);
            assert!(output.contains("safe"));
            assert!(!output.contains("\x1b]52"));
            assert!(!output.contains('\x07'));
        }
    }

    #[test]
    fn strips_terminal_controls_from_osc_hyperlink_urls() {
        let mut theme = AnsiTheme::dark();
        theme.hyperlinks = Some(true);
        theme.show_urls = Some(false);
        let arena = Arena::new();
        let root = parse_document(
            &arena,
            "[label](https://example.test/)",
            &Options::default(),
        );
        let link = root
            .first_child()
            .and_then(|paragraph| paragraph.first_child())
            .expect("parsed document contains a link");
        let mut data = link.data.borrow_mut();
        let comrak::nodes::NodeValue::Link(link) = &mut data.value else {
            panic!("parsed inline is not a link");
        };
        link.url.push_str("\x1b]52;c;SGVsbG8=\x07tail");
        drop(data);

        let output = format_ansi(root, Some(theme));

        assert!(output.contains("\x1b]8;;https://example.test/"));
        assert!(!output.contains("\x1b]52"));
        assert!(!output.contains('\x07'));
    }
}
