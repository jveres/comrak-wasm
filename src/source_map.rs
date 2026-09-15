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

pub(crate) struct SourceMap {
    source: String,
    lines: Vec<usize>,
    units: Vec<usize>,
    tokens: Vec<Token>,
    limit: usize,
    char_columns: bool,
}

impl SourceMap {
    pub fn new(source: &str, leaves: Vec<SourceLeaf>, limit: usize, char_columns: bool) -> Self {
        let mut lines = vec![0];
        lines.extend(source.match_indices('\n').map(|(i, _)| i + 1));
        let mut units = vec![0; source.len() + 1];
        let mut count = 0;
        for (byte, ch) in source.char_indices() {
            units[byte..byte + ch.len_utf8()].fill(count);
            count += ch.len_utf16();
            units[byte + ch.len_utf8()] = count;
        }
        let mut map = Self {
            source: source.into(),
            lines,
            units,
            tokens: Vec::new(),
            limit,
            char_columns: false,
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
                        let Some(&base) = map.lines.get(line.saturating_sub(1)) else {
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
                            map.lines.get(line).copied().unwrap_or(map.source.len())
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
                        let Some(&base) = map.lines.get(line) else {
                            break;
                        };
                        let start = base + leaf.line_offsets.get(skip + i).copied().unwrap_or(0);
                        // The parser may add a final LF. It has no source owner.
                        let text = text.trim_end_matches('\n');
                        let line_end = map
                            .lines
                            .get(line + 1)
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
        map.char_columns = char_columns;
        map
    }

    pub fn atomic(&self, pos: Sourcepos) -> String {
        format!(
            "{},{}",
            self.units[self.offset(pos.start)].min(self.limit),
            self.units[self.end(pos.end)].min(self.limit)
        )
    }

    fn offset(&self, pos: LineColumn) -> usize {
        let base = self
            .lines
            .get(pos.line.saturating_sub(1))
            .copied()
            .unwrap_or(self.source.len());
        let column = pos.column.saturating_sub(1);
        let offset = if self.char_columns {
            self.source[base..]
                .char_indices()
                .nth(column)
                .map_or(self.source.len() - base, |(byte, _)| byte)
        } else {
            column
        };
        base.saturating_add(offset).min(self.source.len())
    }
    fn end(&self, pos: LineColumn) -> usize {
        let offset = self.offset(pos);
        let width = if self.char_columns {
            self.source
                .get(offset..)
                .and_then(|text| text.chars().next())
                .map_or(1, char::len_utf8)
        } else {
            1
        };
        offset.saturating_add(width).min(self.source.len())
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
                self.units[a],
                self.units[b],
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
