//! ANSI input to escaped HTML (distinct from Markdown-to-terminal output).
//! Visible slices retain their original offsets; control bytes never own glyphs.
use serde::Serialize;
use std::fmt::Write;

#[derive(Default, Clone, PartialEq)]
struct Style {
    flags: [bool; 6],
    fg: Option<String>,
    bg: Option<String>,
}

fn color(n: u32) -> Option<String> {
    match n {
        0..=15 => Some(n.to_string()),
        16..=231 => {
            let n = n - 16;
            let step = |v| if v == 0 { 0 } else { 55 + v * 40 };
            Some(format!(
                "rgb({},{},{})",
                step(n / 36),
                step(n / 6 % 6),
                step(n % 6)
            ))
        }
        232..=255 => {
            let n = 8 + (n - 232) * 10;
            Some(format!("rgb({n},{n},{n})"))
        }
        _ => None,
    }
}

impl Style {
    fn sgr(&mut self, params: &str) {
        let codes: Vec<_> = params
            .split([';', ':'])
            .map(|p| {
                if p.is_empty() {
                    Some(0)
                } else {
                    p.parse::<u32>().ok()
                }
            })
            .collect();
        let mut i = 0;
        while i < codes.len() {
            match codes[i] {
                Some(0) => *self = Self::default(),
                Some(n @ 1..=4) => self.flags[(n - 1) as usize] = true,
                Some(7) => self.flags[5] = true,
                Some(9) => self.flags[4] = true,
                Some(22) => {
                    self.flags[0] = false;
                    self.flags[1] = false;
                }
                Some(23) => self.flags[2] = false,
                Some(24) => self.flags[3] = false,
                Some(27) => self.flags[5] = false,
                Some(29) => self.flags[4] = false,
                Some(n @ 30..=37) => self.fg = color(n - 30),
                Some(39) => self.fg = None,
                Some(n @ 40..=47) => self.bg = color(n - 40),
                Some(49) => self.bg = None,
                Some(n @ 90..=97) => self.fg = color(n - 90 + 8),
                Some(n @ 100..=107) => self.bg = color(n - 100 + 8),
                Some(n @ (38 | 48)) => {
                    let target = if n == 38 { &mut self.fg } else { &mut self.bg };
                    match codes.get(i + 1) {
                        Some(Some(5)) => {
                            *target = codes.get(i + 2).copied().flatten().and_then(color);
                            i += 2;
                        }
                        Some(Some(2)) => {
                            *target = match (codes.get(i + 2), codes.get(i + 3), codes.get(i + 4)) {
                                (
                                    Some(Some(r @ 0..=255)),
                                    Some(Some(g @ 0..=255)),
                                    Some(Some(b @ 0..=255)),
                                ) => Some(format!("rgb({r},{g},{b})")),
                                _ => None,
                            };
                            i += 4;
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
            i += 1;
        }
    }

    fn emit(&self, text: &str, html: &mut String) {
        for (i, line) in text.split('\n').enumerate() {
            if i > 0 {
                html.push('\n');
            }
            if line.is_empty() {
                continue;
            }
            let styled = *self != Self::default();
            if styled {
                html.push_str("<span class=\"ansi");
                if self.fg.is_some() && !self.flags[5] && line.chars().all(|c| c == '█') {
                    html.push_str(" ansi-solid");
                }
                for (enabled, name) in self.flags.iter().zip(["b", "d", "i", "u", "s", "inv"]) {
                    if *enabled {
                        write!(html, " ansi-{name}").unwrap();
                    }
                }
                let mut inline = Vec::new();
                for (name, value) in [("fg", &self.fg), ("bg", &self.bg)] {
                    if let Some(value) = value {
                        if value.starts_with("rgb(") {
                            inline.push(format!(
                                "{}:{value}",
                                if name == "fg" {
                                    "color"
                                } else {
                                    "background-color"
                                }
                            ));
                        } else {
                            write!(html, " ansi-{name}-{value}").unwrap();
                        }
                    }
                }
                html.push('"');
                if !inline.is_empty() {
                    write!(html, " style=\"{}\"", inline.join(";")).unwrap();
                }
                html.push('>');
            }
            for c in line.chars() {
                html.push_str(match c {
                    '&' => "&amp;",
                    '<' => "&lt;",
                    '>' => "&gt;",
                    '"' => "&quot;",
                    '\'' => "&#39;",
                    _ => {
                        html.push(c);
                        continue;
                    }
                });
            }
            if styled {
                html.push_str("</span>");
            }
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Output {
    pub html: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_map: Option<String>,
}

/// Compose retained UTF-16 slices with the parser's lexical map. Invalid maps
/// fail closed: HTML still renders, but no inaccurate provenance is returned.
fn remap(mapping: &str, slices: &[(usize, usize)]) -> Option<String> {
    let runs = mapping
        .split(';')
        .map(|run| {
            let fields = run
                .split(',')
                .map(str::parse::<usize>)
                .collect::<Result<Vec<_>, _>>()
                .ok()?;
            let [start, end, length, linear] = fields.as_slice() else {
                return None;
            };
            if end <= start
                || *length == 0
                || *linear > 1
                || (*linear == 1 && end - start != *length)
            {
                return None;
            }
            Some((*start, *end, *length, *linear))
        })
        .collect::<Option<Vec<_>>>()?;
    let mut out = Vec::new();
    let mut index = 0;
    let mut offset: usize = 0;
    for &(from, to) in slices {
        let mut cursor = from;
        while cursor < to {
            let &(start, end, length, linear) = runs.get(index)?;
            let next = offset.checked_add(length)?;
            if next <= cursor {
                offset = next;
                index += 1;
                continue;
            }
            let take = to.min(next) - cursor;
            let a = if linear == 1 {
                start.checked_add(cursor - offset)?
            } else {
                start
            };
            let b = if linear == 1 {
                a.checked_add(take)?
            } else {
                end
            };
            out.push(format!("{a},{b},{take},{linear}"));
            cursor += take;
        }
    }
    Some(out.join(";"))
}

/// Returns the consumed byte count and optional SGR parameters. Incomplete
/// trailing sequences are consumed until a subsequent render completes them.
fn sequence(text: &str, textual: bool) -> Option<(usize, Option<&str>)> {
    let prefix = if text.starts_with("\x1b[") {
        Some(2)
    } else if textual {
        ["\\e[", "\\033[", "\\x1b[", "\\u001b[", "^[["]
            .iter()
            .find(|p| text.starts_with(**p))
            .map(|p| p.len())
    } else {
        None
    };
    if let Some(prefix) = prefix {
        let bytes = text.as_bytes();
        let mut i = prefix;
        while i < bytes.len() && (bytes[i].is_ascii_digit() || b";:?".contains(&bytes[i])) {
            i += 1;
        }
        let params_end = i;
        while i < bytes.len() && (b' '..=b'/').contains(&bytes[i]) {
            i += 1;
        }
        if i == bytes.len() {
            return Some((i, None));
        }
        if (b'@'..=b'~').contains(&bytes[i]) {
            return Some((
                i + 1,
                (bytes[i] == b'm').then_some(&text[prefix..params_end]),
            ));
        }
        return None;
    }
    if !text.starts_with('\x1b') {
        return None;
    }
    let bytes = text.as_bytes();
    if bytes.len() == 1 {
        return Some((1, None));
    }
    if bytes[1] == b']' {
        let mut i = 2;
        while i < bytes.len() {
            if bytes[i] == 7 {
                return Some((i + 1, None));
            }
            if bytes[i] == 27 {
                if bytes.get(i + 1) == Some(&b'\\') {
                    return Some((i + 2, None));
                }
                break;
            }
            i += 1;
        }
        if i == bytes.len() {
            return Some((i, None));
        }
    }
    if (b'@'..=b'Z').contains(&bytes[1]) || (b'\\'..=b'_').contains(&bytes[1]) {
        return Some((2, None));
    }
    None
}

pub fn render(code: &str, textual: bool, mapping: Option<&str>) -> Output {
    let mut html = String::new();
    let mut style = Style::default();
    let mut slices = Vec::new();
    let mut units = 0;
    let mut start = 0;
    let mut i = 0;
    while i < code.len() {
        let tail = &code[i..];
        let control = if tail.starts_with('\x07') {
            Some((1, None))
        } else {
            sequence(tail, textual)
        };
        if let Some((length, params)) = control {
            let text = &code[start..i];
            style.emit(text, &mut html);
            if mapping.is_some() {
                let end = units + text.encode_utf16().count();
                if end > units {
                    slices.push((units, end));
                }
                units = end + code[i..i + length].encode_utf16().count();
            }
            if let Some(params) = params {
                style.sgr(params);
            }
            i += length;
            start = i;
        } else {
            i += tail.chars().next().unwrap().len_utf8();
        }
    }
    style.emit(&code[start..], &mut html);
    if mapping.is_some() && start < code.len() {
        slices.push((units, units + code[start..].encode_utf16().count()));
    }
    Output {
        html,
        source_map: mapping.map(|map| remap(map, &slices).unwrap_or_default()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn maps_visible_text_after_controls() {
        let code = "\x1b[31mred\x1b[0m last";
        let out = render(
            code,
            true,
            Some(&format!("20,{}, {},1", 20 + code.len(), code.len()).replace(' ', "")),
        );
        assert_eq!(out.html, "<span class=\"ansi ansi-fg-1\">red</span> last");
        assert_eq!(out.source_map.as_deref(), Some("25,28,3,1;32,37,5,1"));
    }
    #[test]
    fn escapes_untrusted_text() {
        assert_eq!(
            render("\x1b[31m<script>\"'&", false, None).html,
            "<span class=\"ansi ansi-fg-1\">&lt;script&gt;&quot;&#39;&amp;</span>"
        );
    }
}
