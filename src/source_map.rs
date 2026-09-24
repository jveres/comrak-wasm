//! Lexical provenance, captured before Comrak coalesces text. No rendered-DOM
//! diff or text search is used to decide where a glyph came from.
use comrak::{
    nodes::{LineColumn, NodeValue, Sourcepos},
    SourceLeaf,
};

#[derive(Clone)]
struct Token {
    start: usize,
    end: usize,
    text: String,
    linear: bool,
}

/// Converts Comrak 1-based line/column positions into byte offsets of one
/// source. Built once per source; every lookup is O(1).
///
/// Offsets are clamped to `source.len()`. A column past the end of its line
/// continues into the following lines, as Comrak's own column counting does.
pub(crate) struct Columns<'a> {
    source: &'a str,
    /// Byte offset of each line start.
    lines: Vec<usize>,
    char_columns: bool,
    /// Character columns in non-ASCII input only: byte offset of each
    /// character, then `source.len()`; and the character index of each line.
    chars: Vec<usize>,
    line_chars: Vec<usize>,
}

impl<'a> Columns<'a> {
    pub fn new(source: &'a str, char_columns: bool) -> Self {
        let mut lines = vec![0];
        lines.extend(source.match_indices('\n').map(|(i, _)| i + 1));
        let mut columns = Self {
            source,
            lines,
            char_columns: false,
            chars: Vec::new(),
            line_chars: Vec::new(),
        };
        columns.set_char_columns(char_columns);
        columns
    }

    fn set_char_columns(&mut self, char_columns: bool) {
        // In ASCII input a character column is a byte column.
        self.char_columns = char_columns && !self.source.is_ascii();
        if self.char_columns && self.chars.is_empty() {
            self.chars.reserve(self.source.len() + 1);
            self.line_chars.reserve(self.lines.len());
            self.line_chars.push(0);
            for (byte, ch) in self.source.char_indices() {
                self.chars.push(byte);
                if ch == '\n' {
                    self.line_chars.push(self.chars.len());
                }
            }
            self.chars.push(self.source.len());
        }
    }

    /// Byte offset where the line with this 0-based index starts.
    fn line(&self, index: usize) -> Option<usize> {
        self.lines.get(index).copied()
    }

    /// Byte offset of the character at `pos`, or `source.len()` past the end.
    pub fn offset(&self, pos: LineColumn) -> usize {
        let line = pos.line.saturating_sub(1);
        let column = pos.column.saturating_sub(1);
        if self.char_columns {
            self.line_chars
                .get(line)
                .and_then(|first| self.chars.get(first.saturating_add(column)))
                .copied()
                .unwrap_or(self.source.len())
        } else {
            self.line(line)
                .map_or(self.source.len(), |base| base.saturating_add(column))
                .min(self.source.len())
        }
    }

    /// Byte offset just past the character at inclusive end `pos`, clamped to
    /// `source.len()`.
    pub fn end(&self, pos: LineColumn) -> usize {
        let offset = self.offset(pos);
        let width = if self.char_columns {
            self.source[offset..]
                .chars()
                .next()
                .map_or(1, char::len_utf8)
        } else {
            1
        };
        offset.saturating_add(width).min(self.source.len())
    }
}

pub(crate) struct SourceMap<'a> {
    source: &'a str,
    columns: Columns<'a>,
    /// UTF-16 offset of each byte; `None` for ASCII, where it is the byte.
    units: Option<Vec<usize>>,
    tokens: Vec<Token>,
    limit: usize,
}

impl<'a> SourceMap<'a> {
    pub fn new(source: &'a str, leaves: Vec<SourceLeaf>, limit: usize, char_columns: bool) -> Self {
        let units = (!source.is_ascii()).then(|| {
            let mut units = vec![0; source.len() + 1];
            let mut count = 0;
            for (byte, ch) in source.char_indices() {
                units[byte..byte + ch.len_utf8()].fill(count);
                count += ch.len_utf16();
                units[byte + ch.len_utf8()] = count;
            }
            units
        });
        // Lexical leaves carry byte columns, whatever the caller's option.
        let mut map = Self {
            source,
            columns: Columns::new(source, false),
            units,
            tokens: Vec::new(),
            limit,
        };
        for leaf in leaves {
            let start = map.offset(leaf.sourcepos.start);
            let end = map.end(leaf.sourcepos.end);
            match leaf.value {
                NodeValue::Text(text) => map.push(start, end, &text),
                NodeValue::ShortCode(code) => map.push(start, end, &code.emoji),
                NodeValue::Code(ref code) => {
                    let mut chars = Vec::new();
                    for line in leaf.sourcepos.start.line..=leaf.sourcepos.end.line {
                        let Some(base) = map.columns.line(line.saturating_sub(1)) else {
                            break;
                        };
                        let from = if line == leaf.sourcepos.start.line {
                            start + code.num_backticks
                        } else {
                            base + leaf
                                .line_offsets
                                .get(line.saturating_sub(leaf.line_start))
                                .copied()
                                .unwrap_or(0)
                        };
                        let to = if line == leaf.sourcepos.end.line {
                            end.saturating_sub(code.num_backticks)
                        } else {
                            map.columns.line(line).unwrap_or(map.source.len())
                        };
                        if let Some(raw) = map.source.get(from..to) {
                            chars.extend(raw.char_indices().map(|(i, c)| {
                                (
                                    from + i,
                                    from + i + c.len_utf8(),
                                    if c == '\n' { ' ' } else { c },
                                )
                            }));
                        }
                    }
                    if chars.first().is_some_and(|c| c.2 == ' ')
                        && chars.last().is_some_and(|c| c.2 == ' ')
                        && chars.iter().any(|c| c.2 != ' ')
                    {
                        chars.remove(0);
                        chars.pop();
                    }
                    if chars.iter().map(|c| c.2).collect::<String>() == code.literal {
                        for (start, end, ch) in chars {
                            map.push(start, end, &ch.to_string());
                        }
                    }
                }
                NodeValue::CodeBlock(ref code) => {
                    let skip = usize::from(code.fenced);
                    for (i, text) in code.literal.split_inclusive('\n').enumerate() {
                        let line = leaf.sourcepos.start.line - 1 + skip + i;
                        let Some(base) = map.columns.line(line) else {
                            break;
                        };
                        let start = base + leaf.line_offsets.get(skip + i).copied().unwrap_or(0);
                        // The parser may add a final LF. It has no source owner.
                        let text = text.trim_end_matches('\n');
                        let line_end = map
                            .columns
                            .line(line + 1)
                            .map_or(map.source.len(), |end| end - 1);
                        let raw = map.source.get(start..line_end).unwrap_or("");
                        let extra = text.len().saturating_sub(raw.len());
                        // Comrak expands a partly consumed indentation tab into
                        // literal spaces. Those spaces belong to that tab.
                        let padding = if extra > 0
                            && text.get(extra..) == Some(raw)
                            && text[..extra].bytes().all(|b| b == b' ')
                            && start > 0
                            && map.source.as_bytes()[start - 1] == b'\t'
                        {
                            map.push(start - 1, start, &text[..extra]);
                            extra
                        } else {
                            0
                        };
                        let text = text.get(padding..).unwrap_or(text);
                        if map.source.get(start..start + text.len()) == Some(text) {
                            map.push(start, start + text.len(), text);
                            if map.source.get(start + text.len()..start + text.len() + 1)
                                == Some("\n")
                            {
                                map.push(start + text.len(), start + text.len() + 1, "\n");
                            }
                        }
                    }
                }
                _ => {}
            }
        }
        map.tokens.sort_by_key(|token| token.start);
        // Lexical leaves retain byte columns. The final AST may use the
        // caller's character-column option; preserve that rendering contract.
        map.columns.set_char_columns(char_columns);
        map
    }

    pub fn atomic(&self, pos: Sourcepos) -> String {
        format!(
            "{},{}",
            self.unit(self.offset(pos.start)).min(self.limit),
            self.unit(self.end(pos.end)).min(self.limit)
        )
    }

    fn offset(&self, pos: LineColumn) -> usize {
        self.columns.offset(pos)
    }
    fn end(&self, pos: LineColumn) -> usize {
        self.columns.end(pos)
    }
    fn unit(&self, byte: usize) -> usize {
        self.units.as_ref().map_or(byte, |units| units[byte])
    }
    fn push(&mut self, start: usize, end: usize, text: &str) {
        if text.is_empty() || start >= end || end > self.source.len() {
            return;
        }
        let raw = self.source.get(start..end);
        if raw == Some(text) {
            if let Some(previous) = self
                .tokens
                .last_mut()
                .filter(|token| token.linear && token.end == start)
            {
                previous.end = end;
                previous.text.push_str(text);
                return;
            }
        }
        self.tokens.push(Token {
            start,
            end,
            text: text.into(),
            linear: raw == Some(text),
        });
    }

    /// A compact list of UTF-16 source start/end, rendered length, and whether
    /// that run maps one-to-one. Transformed lexical units remain atomic.
    pub fn attribute(&self, pos: Sourcepos, literal: &str) -> Option<String> {
        let start = self.offset(pos.start);
        let end = self.end(pos.end);
        let mut decoded = String::new();
        let mut runs = Vec::<(usize, usize, usize, bool)>::new();
        let first = self.tokens.partition_point(|token| token.end <= start);
        for token in &self.tokens[first..] {
            if token.start >= end {
                break;
            }
            let a = token.start.max(start);
            let b = token.end.min(end);
            let text = if token.linear {
                token.text.get(a - token.start..b - token.start)?
            } else if a == token.start && b == token.end {
                &token.text
            } else {
                return None;
            };
            decoded.push_str(text);
            let run = (
                self.unit(a),
                self.unit(b),
                text.encode_utf16().count(),
                token.linear,
            );
            if let Some(previous) = runs.last_mut().filter(|p| p.3 && run.3 && p.1 == run.0) {
                previous.1 = run.1;
                previous.2 += run.2;
            } else {
                runs.push(run);
            }
        }
        // Code DOM omits the final LF, while a parser literal includes it.
        if decoded.trim_end_matches('\n') != literal.replace('\u{2060}', "").trim_end_matches('\n')
            || runs.is_empty()
        {
            return None;
        }
        Some(
            runs.iter()
                .map(|(a, b, n, linear)| format!("{a},{b},{n},{}", usize::from(*linear)))
                .collect::<Vec<_>>()
                .join(";"),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The previous per-lookup scan, clamped to the source.
    fn reference(source: &str, line: usize, column: usize, chars: bool) -> usize {
        let mut lines = vec![0];
        lines.extend(source.match_indices('\n').map(|(i, _)| i + 1));
        let base = lines
            .get(line.saturating_sub(1))
            .copied()
            .unwrap_or(source.len());
        let column = column.saturating_sub(1);
        let offset = if chars {
            source[base..]
                .char_indices()
                .nth(column)
                .map_or(source.len() - base, |(byte, _)| byte)
        } else {
            column
        };
        base.saturating_add(offset).min(source.len())
    }

    #[test]
    fn columns_match_scanning_lookup() {
        for source in ["", "ab\ncd", "é☃\n\nx😀y\n", "a\u{0301}\n\tb\n"] {
            for chars in [false, true] {
                let columns = Columns::new(source, chars);
                for line in 0..6 {
                    for column in 0..10 {
                        let pos = LineColumn { line, column };
                        let offset = reference(source, line, column, chars);
                        assert_eq!(columns.offset(pos), offset, "{source:?} {line}:{column}");
                        let width = if chars {
                            source[offset..].chars().next().map_or(1, char::len_utf8)
                        } else {
                            1
                        };
                        assert_eq!(columns.end(pos), (offset + width).min(source.len()));
                    }
                }
            }
        }
    }
}
