//! Heals incomplete markdown by closing unclosed delimiters.
//! Operates as a pre-parser text transform — fixes raw markdown before parsing.

use std::collections::HashMap;
use std::ops::Range;

pub fn heal_markdown(input: &str) -> String {
    let last_line = input.rsplit('\n').next().unwrap_or("").trim();
    let needs_setext_healing = input.contains('\n') && matches!(last_line, "-" | "--" | "=" | "==");
    let has_healing_syntax = input
        .bytes()
        .any(|byte| matches!(byte, b'<' | b'[' | b'*' | b'_' | b'~' | b'`' | b'$'));

    let mut buf = input.to_string();
    strip_single_trailing_space(&mut buf);
    if !has_healing_syntax && !needs_setext_healing {
        return buf;
    }
    // Block-level healers operate on the full text. Removing a marker can
    // expose a trailing space.
    heal_block_markup(&mut buf);
    strip_single_trailing_space(&mut buf);

    // Inline formatting cannot span paragraphs or fenced code, so closing
    // delimiters belong to the text after the last of either.
    let start = inline_start(&buf);
    let mut tail = buf.split_off(start);
    let suffix = tail.split_off(inline_end(&tail));
    heal_inline_markup(&mut tail);
    buf.push_str(&tail);
    buf.push_str(&suffix);
    buf
}

/// End of the text inline closers may follow: before trailing newlines and
/// a final bare list or heading marker line. Closers appended after a
/// newline start a new block, and one appended to `1.` or `#` turns the
/// marker into paragraph text. Setext-like `-` and `=` lines stay:
/// heal_setext escapes them.
fn inline_end(s: &str) -> usize {
    let paragraph = last_paragraph_start(s);
    if paragraph == s.len() {
        // Trailing blank lines: no paragraph is left open to heal.
        return s.len();
    }
    let end = s.trim_end_matches('\n').len();
    let line_start = s[..end].rfind('\n').map_or(0, |newline| newline + 1);
    if line_start <= paragraph {
        return end;
    }
    let bytes = &s.as_bytes()[..end];
    let line = Line::new(bytes, line_start, end, usize::MAX);
    if line.first == end || matches!(s[line_start..end].trim(), "-" | "--" | "=" | "==") {
        return end;
    }
    let text = &bytes[line.first..];
    let hashes = text.iter().take_while(|byte| **byte == b'#').count();
    let empty_heading =
        (1..=6).contains(&hashes) && text[hashes..].iter().all(u8::is_ascii_whitespace);
    let empty_item = list_marker(bytes, line.first, end)
        .is_some_and(|(marker_end, spaces)| marker_end + spaces == end);
    if empty_heading || empty_item {
        line_start.saturating_sub(1)
    } else {
        end
    }
}

/// Append-only healing for a visible writing cursor. Unfinished tags and
/// brackets stay visible, and code is handled by the streaming renderer.
pub(crate) fn heal_streaming(input: &str) -> String {
    let mut buf = input.to_string();
    strip_single_trailing_space(&mut buf);
    heal_links(&mut buf, true);
    let start = inline_start(&buf);
    let mut tail = buf.split_off(start);
    // Append-only closers after a trailing newline or on a bare marker line
    // would start a new block, so such text waits for the next chunk.
    if inline_end(&tail) == tail.len() {
        heal_inline_markup(&mut tail);
    }
    buf.push_str(&tail);
    buf
}

/// Start of the text that inline healers may change.
pub(crate) fn inline_start(s: &str) -> usize {
    last_paragraph_start(s).max(analyze(s).last_closed_fence_end.unwrap_or(0))
}

/// Strip a trailing single space but keep a two-space hard line break.
fn strip_single_trailing_space(buf: &mut String) {
    if buf.ends_with(' ') && !buf.ends_with("  ") {
        buf.pop();
    }
}

// --- Structure ---

fn is_escaped(bytes: &[u8], pos: usize) -> bool {
    bytes[..pos]
        .iter()
        .rev()
        .take_while(|byte| **byte == b'\\')
        .count()
        % 2
        == 1
}

#[derive(Clone, Copy)]
pub(crate) struct Fence {
    marker: u8,
    length: usize,
    /// Indentation of the opening marker after any blockquote prefix.
    column: usize,
    /// Content column of the list item holding the fence, or 0.
    container: usize,
    /// Blockquote markers before the fence; fewer end it.
    quote_depth: usize,
    /// Byte offset of the opening marker.
    start: usize,
}

/// Regions whose delimiters the healers must leave alone.
#[derive(Default)]
struct Structure {
    /// Fenced code blocks and code spans, sorted and disjoint. A code span
    /// the input leaves open runs to the end.
    code: Vec<Range<usize>>,
    /// `*` list bullets and thematic breaks, which are not emphasis delimiters.
    markers: Vec<Range<usize>>,
    open_fence: Option<Fence>,
    last_closed_fence_end: Option<usize>,
    /// Backtick run length and opener end of a code span the input leaves open.
    unclosed_span: Option<(usize, usize)>,
}

impl Structure {
    /// Code without an open trailing span, which stays literal until healed.
    fn closed_code(&self) -> &[Range<usize>] {
        let open = usize::from(self.unclosed_span.is_some());
        &self.code[..self.code.len() - open]
    }
}

/// Scan lines once for fenced code, list bullets and thematic breaks, and
/// pair code spans inside each paragraph. Fences may sit inside blockquotes
/// and list items; only the innermost list item's content column is tracked.
fn analyze(s: &str) -> Structure {
    let bytes = s.as_bytes();
    let mut structure = Structure::default();
    // A paragraph that only a trailing suffix follows is the one healed.
    let healed_end = inline_end(s);
    let mut list_column = 0;
    let mut previous_blank = true;
    let mut paragraph = None;
    let mut line_start = 0;
    while line_start < bytes.len() {
        let line_end = bytes[line_start..]
            .iter()
            .position(|byte| *byte == b'\n')
            .map_or(bytes.len(), |offset| line_start + offset);
        let next = (line_end + 1).min(bytes.len());

        if let Some(fence) = structure.open_fence {
            let line = Line::new(bytes, line_start, line_end, fence.quote_depth);
            let blank = line.is_blank(bytes);
            if line.quote_depth == fence.quote_depth && (blank || line.indent >= fence.container) {
                if line.indent <= fence.column + 3
                    && fence_at(bytes, line.first, line_end, Some(fence))
                {
                    structure.code.push(fence.start..next);
                    structure.last_closed_fence_end = Some(next);
                    structure.open_fence = None;
                }
                line_start = next;
                continue;
            }
            // The fence's blockquote or list item ended, and the fence with it.
            structure.code.push(fence.start..line_start);
            structure.last_closed_fence_end = Some(line_start);
            structure.open_fence = None;
            if line.indent < list_column {
                list_column = 0;
            }
        }

        let line = Line::new(bytes, line_start, line_end, usize::MAX);
        let (first, indent) = (line.first, line.indent);
        if line.is_blank(bytes) {
            if let Some(start) = paragraph.take() {
                pair_code_spans(
                    bytes,
                    start..line_start,
                    line_start >= healed_end,
                    &mut structure,
                );
            }
            previous_blank = true;
            line_start = next;
            continue;
        }

        let text = &bytes[first..line_end];
        let mut fence_start = None;
        let mut fence_column = indent;
        let mut container = 0;
        let mut single_line_block = false;
        if indent <= 3 && paragraph.is_some() && is_setext_underline(text) {
            // The underline ends the paragraph above it as a heading.
            if let Some(start) = paragraph.take() {
                pair_code_spans(
                    bytes,
                    start..line_start,
                    line_start >= healed_end,
                    &mut structure,
                );
            }
            previous_blank = false;
            line_start = next;
            continue;
        } else if is_thematic_break(text) {
            structure.markers.push(first..line_end);
            single_line_block = true;
        } else if let Some((marker_end, spaces)) = list_marker(bytes, first, line_end) {
            if let Some(start) = paragraph.take() {
                pair_code_spans(
                    bytes,
                    start..line_start,
                    line_start >= healed_end,
                    &mut structure,
                );
            }
            if bytes[first] == b'*' {
                structure.markers.push(first..marker_end);
            }
            let marker_column = indent + (marker_end - first);
            let gap = columns(&bytes[marker_end..marker_end + spaces], marker_column);
            if (1..=4).contains(&gap) {
                list_column = marker_column + gap;
                fence_start = Some(marker_end + spaces);
                fence_column = list_column;
                container = list_column;
            } else {
                list_column = marker_column + 1;
            }
        } else {
            if previous_blank && indent < list_column {
                list_column = 0;
            }
            let nested = list_column > 0 && indent >= list_column && indent - list_column <= 3;
            if nested {
                fence_start = Some(first);
                container = list_column;
            } else if indent <= 3 {
                fence_start = Some(first);
                single_line_block = is_atx_heading(text);
            }
        }
        previous_blank = false;

        if let Some(start) = fence_start.filter(|start| fence_at(bytes, *start, line_end, None)) {
            if let Some(paragraph_start) = paragraph.take() {
                pair_code_spans(
                    bytes,
                    paragraph_start..line_start,
                    line_start >= healed_end,
                    &mut structure,
                );
            }
            structure.open_fence = Some(Fence {
                marker: bytes[start],
                length: run_length(bytes, start),
                column: fence_column,
                container,
                quote_depth: line.quote_depth,
                start,
            });
        } else if single_line_block {
            if let Some(start) = paragraph.take() {
                pair_code_spans(
                    bytes,
                    start..line_start,
                    line_start >= healed_end,
                    &mut structure,
                );
            }
            pair_code_spans(bytes, line_start..next, next >= healed_end, &mut structure);
        } else {
            paragraph.get_or_insert(line_start);
        }
        line_start = next;
    }

    if let Some(fence) = structure.open_fence {
        structure.code.push(fence.start..bytes.len());
    } else if let Some(start) = paragraph {
        pair_code_spans(bytes, start..bytes.len(), true, &mut structure);
    }
    debug_assert!(structure
        .code
        .windows(2)
        .all(|pair| pair[0].end <= pair[1].start));
    structure
}

/// A line split into its blockquote prefix and indented content.
struct Line {
    /// First byte after blockquote markers and indentation.
    first: usize,
    /// Indentation in columns, with tabs expanded.
    indent: usize,
    quote_depth: usize,
    end: usize,
}

impl Line {
    /// Strips at most `max_quote_depth` blockquote markers.
    fn new(bytes: &[u8], start: usize, end: usize, max_quote_depth: usize) -> Self {
        let mut content = start;
        let mut quote_depth = 0;
        while quote_depth < max_quote_depth {
            let spaces = bytes[content..end]
                .iter()
                .take(3)
                .take_while(|byte| **byte == b' ')
                .count();
            if content + spaces >= end || bytes[content + spaces] != b'>' {
                break;
            }
            content += spaces + 1;
            if content < end && bytes[content] == b' ' {
                content += 1;
            }
            quote_depth += 1;
        }
        let first = content
            + bytes[content..end]
                .iter()
                .take_while(|byte| matches!(**byte, b' ' | b'\t'))
                .count();
        Self {
            first,
            indent: columns(&bytes[content..first], 0),
            quote_depth,
            end,
        }
    }

    fn is_blank(&self, bytes: &[u8]) -> bool {
        bytes[self.first..self.end]
            .iter()
            .all(|byte| byte.is_ascii_whitespace())
    }
}

/// Width of leading spaces and tabs starting at `column`; tabs stop at
/// multiples of four, as in CommonMark.
fn columns(whitespace: &[u8], column: usize) -> usize {
    whitespace.iter().fold(column, |column, byte| {
        if *byte == b'\t' {
            column + 4 - column % 4
        } else {
            column + 1
        }
    }) - column
}

fn is_atx_heading(text: &[u8]) -> bool {
    let hashes = text.iter().take_while(|byte| **byte == b'#').count();
    (1..=6).contains(&hashes)
        && text
            .get(hashes)
            .is_none_or(|byte| matches!(byte, b' ' | b'\t' | b'\r'))
}

fn is_setext_underline(text: &[u8]) -> bool {
    let Some(&marker @ (b'=' | b'-')) = text.first() else {
        return false;
    };
    text.iter()
        .skip_while(|byte| **byte == marker)
        .all(|byte| matches!(byte, b' ' | b'\t' | b'\r'))
}

/// Returns the marker end and the number of spaces after a list marker.
fn list_marker(bytes: &[u8], start: usize, end: usize) -> Option<(usize, usize)> {
    let marker_end = match bytes[start] {
        b'-' | b'+' | b'*' => start + 1,
        b'0'..=b'9' => {
            let digits = bytes[start..end]
                .iter()
                .take_while(|byte| byte.is_ascii_digit())
                .count();
            if digits > 9 || !matches!(bytes.get(start + digits), Some(b'.' | b')')) {
                return None;
            }
            start + digits + 1
        }
        _ => return None,
    };
    if marker_end < end && !matches!(bytes[marker_end], b' ' | b'\t') {
        return None;
    }
    let spaces = bytes[marker_end..end]
        .iter()
        .take_while(|byte| matches!(**byte, b' ' | b'\t'))
        .count();
    Some((marker_end, spaces))
}

fn is_thematic_break(line: &[u8]) -> bool {
    let Some(&marker @ (b'*' | b'-' | b'_')) = line.first() else {
        return false;
    };
    let mut count = 0;
    for byte in line {
        match *byte {
            byte if byte == marker => count += 1,
            b' ' | b'\t' | b'\r' => {}
            _ => return false,
        }
    }
    count >= 3
}

fn run_length(bytes: &[u8], start: usize) -> usize {
    bytes[start..]
        .iter()
        .take_while(|byte| **byte == bytes[start])
        .count()
}

/// Whether a fence marker starts at `i`: an opener when `open` is `None`,
/// otherwise a closer for `open`.
fn fence_at(bytes: &[u8], i: usize, line_end: usize, open: Option<Fence>) -> bool {
    let Some(&marker @ (b'`' | b'~')) = bytes.get(i) else {
        return false;
    };
    let length = run_length(bytes, i);
    if length < 3 {
        return false;
    }
    let rest = &bytes[i + length..line_end];
    match open {
        None => marker == b'~' || !rest.contains(&b'`'),
        Some(open) => {
            marker == open.marker
                && length >= open.length
                && rest
                    .iter()
                    .all(|byte| matches!(*byte, b' ' | b'\t' | b'\r'))
        }
    }
}

/// Pair backtick runs of equal length within one paragraph. An unmatched
/// opener stays literal, except in the final paragraph, where the healer is
/// about to close it and everything after it is code.
fn pair_code_spans(bytes: &[u8], paragraph: Range<usize>, last: bool, structure: &mut Structure) {
    let mut runs = Vec::new();
    let mut i = paragraph.start;
    while i < paragraph.end {
        if bytes[i] != b'`' {
            i += 1;
            continue;
        }
        let start = i;
        i += run_length(bytes, i).min(paragraph.end - i);
        let start = start + usize::from(is_escaped(bytes, start));
        if start < i {
            runs.push(start..i);
        }
    }
    if runs.is_empty() {
        return;
    }

    let mut next_same = vec![None; runs.len()];
    let mut seen = HashMap::new();
    for (index, run) in runs.iter().enumerate().rev() {
        next_same[index] = seen.insert(run.len(), index);
    }
    let mut index = 0;
    while index < runs.len() {
        if let Some(closer) = next_same[index] {
            structure.code.push(runs[index].start..runs[closer].end);
            index = closer + 1;
        } else if last {
            structure.unclosed_span = Some((runs[index].len(), runs[index].end));
            structure.code.push(runs[index].start..paragraph.end);
            return;
        } else {
            index += 1;
        }
    }
}

/// Code plus markup whose `*`, `_` and `~` are not emphasis: list bullets,
/// thematic breaks, link destinations and bare URLs. Math stays visible:
/// `$$` is often a literal price or token. Returns `None` when the text
/// ends inside open code, an open destination or a marker, where an
/// appended closer would be literal too.
fn literal_ranges(s: &str, structure: &Structure) -> Option<Vec<Range<usize>>> {
    let bytes = s.as_bytes();
    // heal_inline_code leaves an opener without content literal.
    let open_span_has_content = structure
        .unclosed_span
        .map(|(_, opener_end)| has_code_content(&bytes[opener_end..]));
    if open_span_has_content == Some(true)
        || structure
            .markers
            .last()
            .is_some_and(|marker| marker.end == s.len())
    {
        return None;
    }
    let code = structure.closed_code();
    let mut ranges: Vec<_> = code.iter().chain(&structure.markers).cloned().collect();
    let mut code = Skip::new(code);
    let mut i = 0;
    while i < bytes.len() {
        if let Some(end) = code.end_of(i) {
            i = end;
            continue;
        }
        let range = if bytes[i..].starts_with(b"](") && !is_escaped(s.as_bytes(), i) {
            // heal_links closes a destination that runs to the end.
            let start = i + 2;
            let offset = bytes[start..]
                .iter()
                .position(|byte| *byte == b')' || byte.is_ascii_whitespace())?;
            Some(start..start + offset)
        } else if starts_url(bytes, i) {
            let end = bytes[i..]
                .iter()
                .position(|byte| byte.is_ascii_whitespace() || *byte == b'<')
                .map_or(bytes.len(), |offset| i + offset);
            // GFM autolinks exclude trailing punctuation, including emphasis markers.
            let trailing = bytes[i..end]
                .iter()
                .rev()
                .take_while(|byte| b"?!.,:;*_~'\")".contains(byte))
                .count();
            Some(i..end - trailing)
        } else {
            None
        };
        match range {
            Some(range) => {
                i = range.end.max(i + 1);
                ranges.push(range);
            }
            None => i += 1,
        }
    }
    Some(merge(ranges))
}

/// Whether text after a code-span opener is worth closing the span for.
/// Delimiters are not content, and neither is `$`: a later math closer must
/// not turn a literal backtick into a code span.
fn has_code_content(rest: &[u8]) -> bool {
    rest.iter()
        .any(|byte| !byte.is_ascii_whitespace() && !b"*_~`$".contains(byte))
}

fn starts_url(bytes: &[u8], i: usize) -> bool {
    let boundary = i == 0
        || matches!(
            bytes[i - 1],
            b' ' | b'\t' | b'\n' | b'\r' | b'(' | b'<' | b'*' | b'_' | b'~'
        );
    boundary
        && [&b"https://"[..], b"http://", b"www."]
            .iter()
            .any(|prefix| bytes[i..].starts_with(prefix))
}

fn merge(mut ranges: Vec<Range<usize>>) -> Vec<Range<usize>> {
    ranges.sort_unstable_by_key(|range| range.start);
    let mut merged: Vec<Range<usize>> = Vec::with_capacity(ranges.len());
    for range in ranges {
        match merged.last_mut() {
            Some(last) if range.start <= last.end => last.end = last.end.max(range.end),
            _ => merged.push(range),
        }
    }
    merged
}

/// Forward-only lookup into sorted, disjoint ranges.
struct Skip<'a> {
    ranges: &'a [Range<usize>],
    next: usize,
}

impl<'a> Skip<'a> {
    fn new(ranges: &'a [Range<usize>]) -> Self {
        Self { ranges, next: 0 }
    }

    /// The end of the range containing `i`, which must not decrease between calls.
    fn end_of(&mut self, i: usize) -> Option<usize> {
        while let Some(range) = self.ranges.get(self.next) {
            if range.end <= i {
                self.next += 1;
            } else {
                return (range.start <= i).then_some(range.end);
            }
        }
        None
    }
}

pub(crate) fn unclosed_fence(s: &str) -> Option<Fence> {
    analyze(s).open_fence
}

pub(crate) fn unclosed_inline_code(s: &str) -> Option<(usize, usize)> {
    analyze(s).unclosed_span
}

/// Start of the text after the last blank line, which may hold whitespace
/// and blockquote markers.
pub(crate) fn last_paragraph_start(s: &str) -> usize {
    let blank = |line: &str| {
        let bytes = line.as_bytes();
        Line::new(bytes, 0, bytes.len(), usize::MAX).is_blank(bytes)
    };
    let last_line = s.rfind('\n').map_or(0, |newline| newline + 1);
    if last_line < s.len() && blank(&s[last_line..]) {
        return s.len();
    }
    let mut line_end = None;
    for (newline, _) in s.rmatch_indices('\n') {
        if let Some(end) = line_end {
            if blank(&s[newline + 1..end]) {
                return end + 1;
            }
        }
        line_end = Some(newline);
    }
    line_end
        .filter(|end| blank(&s[..*end]))
        .map_or(0, |end| end + 1)
}

fn delimiter_stats(s: &str, delim: &str, skip: &[Range<usize>]) -> (usize, Option<usize>) {
    let dbytes = delim.as_bytes();
    let mut skip = Skip::new(skip);
    let mut count = 0;
    let mut last_end = None;
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() {
        if let Some(end) = skip.end_of(i) {
            i = end;
            continue;
        }
        if bytes[i..].starts_with(dbytes) && !is_escaped(s.as_bytes(), i) {
            count += 1;
            i += dbytes.len();
            last_end = Some(i);
            continue;
        }
        i += 1;
    }
    (count, last_end)
}

fn has_meaningful_content(s: &str) -> bool {
    s.chars()
        .any(|c| !c.is_whitespace() && c != '*' && c != '_' && c != '~' && c != '`')
}

fn has_meaningful_content_after(s: &str, delimiter_end: Option<usize>) -> bool {
    delimiter_end.is_some_and(|end| has_meaningful_content(&s[end..]))
}

fn append_closing_delimiter(buf: &mut String, delimiter: &str) {
    let trailing_backslashes = buf.bytes().rev().take_while(|byte| *byte == b'\\').count();
    if trailing_backslashes % 2 == 1 {
        // The first marker would be escaped, so add one before the real closer.
        buf.push(delimiter.as_bytes()[0] as char);
    }
    buf.push_str(delimiter);
}

fn heal_inline_markup(buf: &mut String) {
    // Mixed incomplete delimiters can cross on the first pass. Re-run the
    // bounded set of append-only healers until their output reaches a fixed
    // point so calling `heal_markdown` again cannot add more closers. Code
    // spans go first and math second: emphasis closers must land after
    // them rather than inside an open span or display block.
    for _ in 0..8 {
        let original_len = buf.len();
        heal_inline_code(buf);
        heal_math(buf);
        heal_bold_italic(buf);
        heal_bold(buf);
        heal_italic_double_underscore(buf);
        heal_italic_asterisk(buf);
        heal_italic_underscore(buf);
        heal_strikethrough(buf);
        if buf.len() == original_len {
            break;
        }
    }
}

fn heal_block_markup(buf: &mut String) {
    // Removing one incomplete construct can expose another one. Reach the same
    // bounded fixed point here as for mixed inline delimiters.
    for _ in 0..8 {
        let original_len = buf.len();
        // Escaping a setext underline joins it to the paragraph, which
        // decides where code spans pair, so it runs first.
        heal_setext(buf);
        heal_links(buf, false);
        heal_html_tag(buf);
        heal_code_block(buf);
        if buf.len() == original_len {
            break;
        }
    }
}

// --- Healers ---

fn heal_html_tag(buf: &mut String) {
    // Candidates are unescaped `<name` or `</` starts outside code that do not
    // follow a word character: `a<b` is a comparison, not a tag. Walking them
    // backwards, the last must start a plausible unfinished tag that runs to
    // the end, and each earlier one joins the removal only when its text up to
    // the next candidate is one too. Truncating once reaches the fixed point
    // of repeated rescans in linear time.
    let structure = analyze(buf);
    let mut code = Skip::new(&structure.code);
    let bytes = buf.as_bytes();
    let mut candidates = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        if let Some(end) = code.end_of(i) {
            i = end;
            continue;
        }
        let starts_tag = bytes[i] == b'<'
            && bytes
                .get(i + 1)
                .is_some_and(|byte| byte.is_ascii_alphabetic() || *byte == b'/')
            && !(i > 0 && bytes[i - 1].is_ascii_alphanumeric())
            && !is_escaped(buf.as_bytes(), i);
        if starts_tag {
            candidates.push(i);
        }
        i += 1;
    }

    let mut cut = None;
    let mut end = bytes.len();
    for &start in candidates.iter().rev() {
        if !is_partial_tag(&bytes[start..end]) {
            break;
        }
        cut = Some(start);
        end = start;
    }
    if let Some(pos) = cut {
        buf.truncate(pos);
        let trimmed = buf.trim_end().len();
        buf.truncate(trimmed);
    }
}

/// Whether `text`, starting at `<`, is an HTML tag cut off before its `>`.
fn is_partial_tag(text: &[u8]) -> bool {
    let mut i = 1 + usize::from(text.get(1) == Some(&b'/'));
    let name = text[i..]
        .iter()
        .take_while(|byte| byte.is_ascii_alphanumeric() || **byte == b'-')
        .count();
    if name == 0 {
        return i == text.len();
    }
    i += name;
    if i < text.len() && !matches!(text[i], b' ' | b'\t' | b'\n' | b'\r' | b'/') {
        return false;
    }
    let mut quote = None;
    let mut previous = 0;
    for &byte in &text[i..] {
        match quote {
            Some(open) if byte == open => quote = None,
            Some(_) => {}
            None => match byte {
                b'"' | b'\'' => quote = Some(byte),
                b'<' | b'>' | b'`' => return false,
                // A blank line ends raw HTML.
                b'\n' if previous == b'\n' => return false,
                _ => {}
            },
        }
        if byte != b'\r' && byte != b' ' {
            previous = byte;
        }
    }
    true
}

fn heal_setext(buf: &mut String) {
    // Escape an incomplete 1-2 character setext underline without changing its text.
    let Some(newline) = buf.rfind('\n') else {
        return;
    };
    let line_start = newline + 1;
    let needs_fix = matches!(buf[line_start..].trim(), "-" | "--" | "=" | "==");
    if needs_fix && unclosed_fence(buf).is_none() {
        let offset = buf[line_start..]
            .find(|character: char| !character.is_whitespace())
            .unwrap_or(0);
        buf.insert(line_start + offset, '\\');
    }
}

fn heal_links(buf: &mut String, preserve_markers: bool) {
    // Find unmatched [ or ![ and the last link destination outside code.
    // Track escape parity inline; calling is_escaped per byte would be
    // O(n^2) on backslash-heavy input.
    let structure = analyze(buf);
    let mut code = Skip::new(&structure.code);
    let bytes = buf.as_bytes();
    let mut unmatched_opens = Vec::new();
    let mut destination = None;
    let mut backslashes = 0usize; // consecutive '\' immediately before byte i

    let mut i = 0;
    while i < bytes.len() {
        if let Some(end) = code.end_of(i) {
            i = end;
            backslashes = 0;
            continue;
        }
        if backslashes.is_multiple_of(2) {
            match bytes[i] {
                b'[' => {
                    let is_image =
                        i > 0 && bytes[i - 1] == b'!' && !is_escaped(buf.as_bytes(), i - 1);
                    unmatched_opens.push(if is_image { i - 1 } else { i });
                }
                b']' => {
                    unmatched_opens.pop();
                    if bytes.get(i + 1) == Some(&b'(') {
                        destination = Some(i + 2);
                    }
                }
                _ => {}
            }
        }
        backslashes = if bytes[i] == b'\\' {
            backslashes + 1
        } else {
            0
        };
        i += 1;
    }

    // An unfinished destination `[text](url` in the inline-healed text.
    if let Some(start) = destination {
        if !buf[start..].contains(')')
            && structure.open_fence.is_none()
            && inline_start(buf) <= start
        {
            append_closing_delimiter(buf, ")");
        }
    }

    // Compact all unmatched markers in place. Repeated String::drain calls
    // shift the remaining suffix once per marker and become quadratic, while a
    // second output String needlessly raises the Wasm high-water mark.
    if !preserve_markers && !unmatched_opens.is_empty() {
        let mut markers = unmatched_opens.into_iter().peekable();
        let mut original_index = 0;
        let mut remove_through = 0;
        buf.retain(|character| {
            let index = original_index;
            original_index += character.len_utf8();
            if index < remove_through {
                return false;
            }
            if markers.peek().copied() == Some(index) {
                markers.next();
                remove_through = index + if character == '!' { 2 } else { 1 };
                return false;
            }
            true
        });
        debug_assert!(markers.next().is_none());
    }
}

fn heal_paired_delimiter(buf: &mut String, delimiter: &str) {
    let Some(literal) = literal_ranges(buf, &analyze(buf)) else {
        return;
    };
    let (count, last_end) = delimiter_stats(buf, delimiter, &literal);
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        let marker = delimiter.as_bytes()[0] as char;
        // Complete a half-typed closer such as `**bold*`.
        if delimiter.len() == 2 && buf.ends_with(marker) && !buf.ends_with(delimiter) {
            buf.push(marker);
        } else {
            append_closing_delimiter(buf, delimiter);
        }
    }
}

fn heal_bold_italic(buf: &mut String) {
    heal_paired_delimiter(buf, "***");
}

fn heal_bold(buf: &mut String) {
    heal_paired_delimiter(buf, "**");
}

fn heal_italic_double_underscore(buf: &mut String) {
    heal_paired_delimiter(buf, "__");
}

fn heal_strikethrough(buf: &mut String) {
    heal_paired_delimiter(buf, "~~");
}

/// Count single emphasis markers that are not word-internal. Odd runs leave
/// one single marker once their doubled markers pair up.
fn single_marker_stats(buf: &str, marker: u8) -> (usize, Option<usize>) {
    let Some(literal) = literal_ranges(buf, &analyze(buf)) else {
        return (0, None);
    };
    let mut skip = Skip::new(&literal);
    let mut count = 0;
    let mut last_end = None;
    let mut i = 0;
    let bytes = buf.as_bytes();
    let is_word = |byte: u8| byte.is_ascii_alphanumeric() || byte == b'_';
    while i < bytes.len() {
        if let Some(end) = skip.end_of(i) {
            i = end;
            continue;
        }
        if bytes[i] != marker || is_escaped(buf.as_bytes(), i) {
            i += 1;
            continue;
        }
        let start = i;
        i += run_length(bytes, i);
        let run = i - start;
        let counts = if run == 1 {
            let before_word = start > 0 && is_word(bytes[start - 1]);
            let after_word = i < bytes.len() && is_word(bytes[i]);
            !(before_word && after_word)
        } else {
            run % 2 == 1
        };
        if counts {
            count += 1;
            last_end = Some(i);
        }
    }
    (count, last_end)
}

fn heal_italic_asterisk(buf: &mut String) {
    let (count, last_end) = single_marker_stats(buf, b'*');
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        append_closing_delimiter(buf, "*");
    }
}

fn heal_italic_underscore(buf: &mut String) {
    let (count, last_end) = single_marker_stats(buf, b'_');
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        // heal_markdown splits trailing newlines off first; streaming source
        // positions must refer to the original input, so both only append.
        append_closing_delimiter(buf, "_");
    }
}

fn heal_inline_code(buf: &mut String) {
    let structure = analyze(buf);
    if structure.open_fence.is_some() {
        return;
    }
    if let Some((run, opener_end)) = structure.unclosed_span {
        if has_code_content(&buf.as_bytes()[opener_end..]) {
            let trimmed_end = buf.trim_end_matches('\n').len();
            let trailing_newlines = buf.split_off(trimmed_end);
            let unhealed_len = buf.len();
            if buf.ends_with('`') {
                // Keep a mismatched trailing run separate from the closer.
                buf.push(' ');
            }
            append_closing_delimiter(buf, &"`".repeat(run));
            if run >= 3 && unclosed_fence(buf).is_some() {
                // The closer would open a fence on an otherwise empty line.
                buf.truncate(unhealed_len);
            }
            buf.push_str(&trailing_newlines);
        }
    }
}

fn heal_math(buf: &mut String) {
    let (count, last_end) = delimiter_stats(buf, "$$", analyze(buf).closed_code());
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        // If ends with single $, just append one more
        if buf.ends_with('$') && !buf.ends_with("$$") {
            buf.push('$');
        } else {
            // Block math: add newline if content has newlines
            if !buf.ends_with('\n') {
                buf.push('\n');
            }
            buf.push_str("$$");
        }
    }
}

fn heal_code_block(buf: &mut String) {
    if let Some(fence) = unclosed_fence(buf) {
        // Repeat blockquote markers and indent to the opener's column so
        // the closer stays inside the fence's container.
        if !buf.ends_with('\n') {
            buf.push('\n');
        }
        for _ in 0..fence.quote_depth {
            buf.push_str("> ");
        }
        for _ in 0..fence.column {
            buf.push(' ');
        }
        for _ in 0..fence.length {
            buf.push(fence.marker as char);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Bold ---
    #[test]
    fn heal_unclosed_bold() {
        assert_eq!(heal_markdown("**bold"), "**bold**");
    }
    #[test]
    fn heal_half_closed_bold() {
        assert_eq!(heal_markdown("**bold*"), "**bold**");
    }
    #[test]
    fn heal_closed_bold_unchanged() {
        assert_eq!(heal_markdown("**bold**"), "**bold**");
    }
    #[test]
    fn heal_bold_with_content() {
        assert_eq!(heal_markdown("text **bold"), "text **bold**");
    }
    #[test]
    fn heal_nested_bold() {
        // Two ** pairs = even count, no healing needed
        assert_eq!(heal_markdown("**outer **inner"), "**outer **inner");
    }

    // --- Italic ---
    #[test]
    fn heal_unclosed_italic_star() {
        assert_eq!(heal_markdown("*italic"), "*italic*");
    }
    #[test]
    fn heal_unclosed_italic_underscore() {
        assert_eq!(heal_markdown("_italic"), "_italic_");
    }
    #[test]
    fn heal_closed_italic_unchanged() {
        assert_eq!(heal_markdown("*italic*"), "*italic*");
    }

    // --- Bold italic ---
    #[test]
    fn heal_unclosed_bold_italic() {
        assert_eq!(heal_markdown("***bold italic"), "***bold italic***");
    }

    // --- Strikethrough ---
    #[test]
    fn heal_unclosed_strikethrough() {
        assert_eq!(heal_markdown("~~strike"), "~~strike~~");
    }
    #[test]
    fn heal_half_closed_strikethrough() {
        assert_eq!(heal_markdown("~~strike~"), "~~strike~~");
    }
    #[test]
    fn heal_closed_strikethrough_unchanged() {
        assert_eq!(heal_markdown("~~strike~~"), "~~strike~~");
    }

    // --- Inline code ---
    #[test]
    fn heal_unclosed_inline_code() {
        assert_eq!(heal_markdown("use `const"), "use `const`");
    }
    #[test]
    fn heal_closed_inline_code_unchanged() {
        assert_eq!(heal_markdown("use `const`"), "use `const`");
    }

    // --- Code block ---
    #[test]
    fn heal_unclosed_code_block() {
        let result = heal_markdown("```js\ncode");
        assert!(result.ends_with("\n```"));
        assert!(result.contains("code"));
    }
    #[test]
    fn heal_closed_code_block_unchanged() {
        assert_eq!(heal_markdown("```js\ncode\n```"), "```js\ncode\n```");
    }
    #[test]
    fn heal_unclosed_code_block_no_lang() {
        let result = heal_markdown("```\ncode");
        assert!(result.ends_with("\n```"));
    }

    // --- Links ---
    #[test]
    fn heal_unclosed_link_url() {
        assert_eq!(
            heal_markdown("[click](http://example.com"),
            "[click](http://example.com)"
        );
    }
    #[test]
    fn heal_incomplete_link_text() {
        assert_eq!(heal_markdown("text [incomplete"), "text incomplete");
    }
    #[test]
    fn heal_unmatched_link_markers_with_unicode_and_images() {
        assert_eq!(heal_markdown("α[one β![img γ[three"), "αone βimg γthree");
    }
    #[test]
    fn heal_unmatched_link_preserves_an_escaped_image_marker() {
        assert_eq!(heal_markdown(r"\![not an image"), r"\!not an image");
    }
    #[test]
    fn heal_complete_link_unchanged() {
        assert_eq!(
            heal_markdown("[click](http://example.com)"),
            "[click](http://example.com)"
        );
    }

    // --- Double underscore ---
    #[test]
    fn heal_unclosed_double_underscore() {
        assert_eq!(heal_markdown("__underline"), "__underline__");
    }
    #[test]
    fn heal_half_closed_double_underscore() {
        assert_eq!(heal_markdown("__underline_"), "__underline__");
    }

    // --- KaTeX ---
    #[test]
    fn heal_unclosed_block_katex() {
        let result = heal_markdown("$$\nx^2");
        assert_eq!(result.matches("$$").count(), 2);
    }
    #[test]
    fn heal_closed_katex_unchanged() {
        assert_eq!(heal_markdown("$$\nx^2\n$$"), "$$\nx^2\n$$");
    }

    // --- HTML tag ---
    #[test]
    fn heal_incomplete_html_tag() {
        assert_eq!(heal_markdown("text <div"), "text");
    }
    #[test]
    fn heal_many_exposed_html_tags_reaches_a_fixed_point() {
        let input = format!("start {}", "<a ".repeat(20));
        let healed = heal_markdown(&input);

        assert_eq!(healed, "start");
        assert_eq!(heal_markdown(&healed), healed);
    }
    #[test]
    fn heal_complete_html_tag_unchanged() {
        assert_eq!(heal_markdown("text <div>"), "text <div>");
    }

    // --- Setext ---
    #[test]
    fn heal_setext_single_dash() {
        let result = heal_markdown("title\n-");
        assert_ne!(result, "title\n-");
    }
    #[test]
    fn heal_setext_triple_dash_unchanged() {
        assert_eq!(heal_markdown("---"), "---");
    }

    // --- Edge cases ---
    #[test]
    fn heal_empty_input() {
        assert_eq!(heal_markdown(""), "");
    }
    #[test]
    fn heal_plain_text_unchanged() {
        assert_eq!(heal_markdown("hello world"), "hello world");
    }
    #[test]
    fn heal_escaped_delimiter() {
        assert_eq!(heal_markdown("\\*not italic"), "\\*not italic");
    }
    #[test]
    fn heal_strip_trailing_single_space() {
        assert_eq!(heal_markdown("text "), "text");
    }
    #[test]
    fn heal_preserve_double_trailing_space() {
        assert_eq!(heal_markdown("text  "), "text  ");
    }
    #[test]
    fn heal_inside_code_block_unchanged() {
        assert_eq!(
            heal_markdown("```\n**unclosed\n```"),
            "```\n**unclosed\n```"
        );
    }
    #[test]
    fn heal_multiple_unclosed() {
        let result = heal_markdown("**bold *italic");
        assert!(result.contains("**"));
        assert!(result.contains("*"));
    }
    #[test]
    fn heal_word_internal_asterisk_unchanged() {
        assert_eq!(heal_markdown("file*name"), "file*name");
    }
    #[test]
    fn heal_word_internal_underscore_unchanged() {
        assert_eq!(heal_markdown("var_name"), "var_name");
    }

    // --- Multi-byte Unicode ---
    #[test]
    fn heal_zwsp_in_text() {
        // ZWSP (U+200B) is 3 bytes — must not panic
        assert_eq!(
            heal_markdown("Text\u{200B}with\u{200B}ZWSP"),
            "Text\u{200B}with\u{200B}ZWSP"
        );
    }
    #[test]
    fn heal_zwsp_with_bold() {
        assert_eq!(heal_markdown("**bold\u{200B}text"), "**bold\u{200B}text**");
    }
    #[test]
    fn heal_zwsp_with_link() {
        assert_eq!(
            heal_markdown("[link\u{200B}text](url"),
            "[link\u{200B}text](url)"
        );
    }
    #[test]
    fn heal_emoji_in_text() {
        // Emoji are multi-byte (4 bytes)
        assert_eq!(heal_markdown("Hello 🌍 world"), "Hello 🌍 world");
    }
    #[test]
    fn heal_emoji_with_unclosed_bold() {
        assert_eq!(heal_markdown("**bold 🌍"), "**bold 🌍**");
    }
    #[test]
    fn heal_cjk_characters() {
        // CJK characters are 3 bytes
        assert_eq!(heal_markdown("你好世界"), "你好世界");
    }
    #[test]
    fn heal_cjk_with_unclosed_code() {
        assert_eq!(heal_markdown("`代码"), "`代码`");
    }
    #[test]
    fn heal_mixed_multibyte_unchanged() {
        assert_eq!(heal_markdown("café résumé naïve"), "café résumé naïve");
    }

    // --- Cross-paragraph boundary ---
    #[test]
    fn heal_bold_does_not_span_paragraphs() {
        // Opening *** in first paragraph should NOT close at end of second
        let result = heal_markdown("***bold\n\nmore text");
        // The *** should not appear at the very end (after "more text")
        assert!(!result.ends_with("***"));
        // First paragraph stays unclosed (literal ***)
        assert!(result.starts_with("***bold"));
    }
    #[test]
    fn heal_bold_closes_in_same_paragraph() {
        assert_eq!(heal_markdown("**bold"), "**bold**");
    }
    #[test]
    fn heal_italic_does_not_span_paragraphs() {
        let result = heal_markdown("*italic\n\nmore text");
        assert!(!result.ends_with("*more text*"));
    }
    #[test]
    fn heal_strikethrough_does_not_span_paragraphs() {
        let result = heal_markdown("~~strike\n\nmore text");
        assert!(!result.ends_with("~~"));
    }
    #[test]
    fn heal_inline_code_does_not_span_paragraphs() {
        let result = heal_markdown("`code\n\nmore text");
        assert!(!result.ends_with("`"));
    }
    #[test]
    fn heal_last_paragraph_still_healed() {
        // Unclosed bold in second paragraph should be healed there
        assert_eq!(heal_markdown("normal\n\n**bold"), "normal\n\n**bold**");
    }
    #[test]
    fn heal_code_block_still_spans_paragraphs() {
        // Block-level constructs should still work across paragraphs
        let result = heal_markdown("```\ncode\n\nmore code");
        assert!(result.ends_with("\n```"));
    }

    #[test]
    fn heal_is_idempotent_for_minimal_delimiters() {
        for input in [
            "a*",
            "a_",
            "[[",
            "title\n-",
            "bold**",
            "code`",
            "_plain__",
            "_\\",
            "plain```plain\n",
            "_plain\n```",
            "<[plain",
            "plain```plain`",
        ] {
            let healed = heal_markdown(input);
            assert_eq!(heal_markdown(&healed), healed, "input: {input:?}");
        }
    }

    #[test]
    fn heal_closes_fences_with_the_opening_marker_and_length() {
        assert_eq!(heal_markdown("````\ncode"), "````\ncode\n````");
        assert_eq!(heal_markdown("~~~~\ncode"), "~~~~\ncode\n~~~~");
        assert_eq!(heal_markdown("````\ncode\n```"), "````\ncode\n```\n````");
    }

    #[test]
    fn fence_detection_accepts_at_most_three_leading_spaces() {
        for indent in 0..=3 {
            let prefix = " ".repeat(indent);
            assert_eq!(
                heal_markdown(&format!("{prefix}```js\nx")),
                format!("{prefix}```js\nx\n{prefix}```")
            );
        }

        assert_eq!(heal_markdown("    ```js\nx"), "    ```js\nx```");
    }

    #[test]
    fn midline_backticks_are_healed_as_inline_code() {
        assert_eq!(heal_markdown("text ```code"), "text ```code```");
    }

    #[test]
    fn complete_triple_backtick_inline_code_is_not_a_fence() {
        assert_eq!(heal_markdown("```test```"), "```test```");
    }

    // --- Code spans, containers and literal markup ---
    #[test]
    fn delimiters_inside_code_spans_are_literal() {
        for input in [
            "use `**kwargs` to pass",
            "use `*args` here",
            "the `$$` token",
            "code `~~` done",
            "`arr[0` more",
            "text `](` done",
        ] {
            assert_eq!(heal_markdown(input), input, "input: {input:?}");
        }
    }
    #[test]
    fn open_code_span_closes_before_emphasis() {
        assert_eq!(heal_markdown("**bold `code"), "**bold `code`**");
        assert_eq!(heal_markdown("use `*args"), "use `*args`");
    }
    #[test]
    fn list_bullets_and_thematic_breaks_are_not_emphasis() {
        for input in [
            "* item one",
            "  * nested",
            "> * quoted",
            "***\nfoo",
            "* * *\nfoo",
            "___\nfoo",
        ] {
            assert_eq!(heal_markdown(input), input, "input: {input:?}");
        }
        assert_eq!(heal_markdown("* item **bo"), "* item **bo**");
        assert_eq!(heal_markdown("- *item"), "- *item*");
    }
    #[test]
    fn urls_and_link_destinations_keep_underscores() {
        assert_eq!(
            heal_markdown("see https://x.com/_private"),
            "see https://x.com/_private"
        );
        assert_eq!(heal_markdown("[a](http://x/_y"), "[a](http://x/_y)");
        assert_eq!(heal_markdown("*see https://x.com"), "*see https://x.com*");
    }
    #[test]
    fn comparisons_and_code_are_not_html_tags() {
        for input in [
            "if a<b then c",
            "`Vec<String` is",
            "Use `x<y` to compare, then more",
            "<https://exa",
        ] {
            assert_eq!(heal_markdown(input), input, "input: {input:?}");
        }
        assert_eq!(heal_markdown("text <span class=\"a"), "text");
        assert_eq!(heal_markdown("a </di"), "a");
        assert_eq!(heal_markdown("<b>bold</b> <i"), "<b>bold</b>");
    }
    #[test]
    fn fences_inside_containers_close_inside_them() {
        assert_eq!(heal_markdown("- ```js\n  code"), "- ```js\n  code\n  ```");
        assert_eq!(heal_markdown("> ```js\n> code"), "> ```js\n> code\n> ```");
        assert_eq!(
            heal_markdown("1. Step\n   ```py\n   x = *args"),
            "1. Step\n   ```py\n   x = *args\n   ```"
        );
        assert_eq!(
            heal_markdown("> - ```js\n>   a"),
            "> - ```js\n>   a\n>   ```"
        );
    }
    #[test]
    fn setext_healing_skips_open_fences() {
        assert_eq!(heal_markdown("```\ncode\n-"), "```\ncode\n-\n```");
    }
    #[test]
    fn whitespace_only_lines_split_paragraphs() {
        assert_eq!(heal_markdown("*a\n  \nb"), "*a\n  \nb");
        assert_eq!(heal_markdown("*a\r\n\r\nb"), "*a\r\n\r\nb");
        assert_eq!(heal_markdown("> *a\n>\n> b"), "> *a\n>\n> b");
    }
    #[test]
    fn math_closes_before_emphasis() {
        assert_eq!(heal_markdown("a $$ b **c"), "a $$ b **c\n$$**");
        assert_eq!(heal_markdown("**a $$x$$ b"), "**a $$x$$ b**");
        assert_eq!(heal_markdown("$$`plain"), "$$`plain`\n$$");
    }
    #[test]
    fn code_spans_do_not_pair_across_blocks() {
        assert_eq!(heal_markdown("## `a\n**b"), "## `a\n**b**");
        assert_eq!(heal_markdown("# `a\n*b `c"), "# `a\n*b `c`*");
        assert_eq!(heal_markdown("- `a\n- *b `c"), "- `a\n- *b `c`*");
        assert_eq!(heal_markdown("a `b\n---\n**c"), "a `b\n---\n**c**");
    }
    #[test]
    fn tabs_indent_to_four_column_stops() {
        // A tab-indented line stays inside the list item's fence.
        let fenced = "- item\n\n  ```\n\tcode\n  `";
        assert!(unclosed_fence(fenced).is_some());
        assert_eq!(heal_markdown(fenced), format!("{fenced}\n  ```"));
        // A tab after the marker puts the content, and the closer, at column 4.
        assert_eq!(
            heal_markdown("-\t```js\n\tcode"),
            "-\t```js\n\tcode\n    ```"
        );
    }
    #[test]
    fn fences_end_with_their_container() {
        assert_eq!(
            heal_markdown("- ```\n  x\n\ny **z"),
            "- ```\n  x\n\ny **z**"
        );
        assert_eq!(heal_markdown("> ```\n> x\n\ny *z"), "> ```\n> x\n\ny *z*");
        // The unquoted fence opens a new top-level block.
        assert_eq!(
            heal_markdown("> ```\n> a\n```\n\n**b"),
            "> ```\n> a\n```\n\n**b\n```"
        );
        assert_eq!(heal_markdown("```\n> ```\n**b"), "```\n> ```\n**b\n```");
    }
    #[test]
    fn inline_code_closer_never_opens_a_fence() {
        let input = "a ```x\n* ";
        let healed = heal_markdown(input);
        assert!(unclosed_fence(&healed).is_none(), "{healed:?}");
        assert_eq!(heal_markdown(&healed), healed);
    }
    #[test]
    fn empty_last_list_items_and_headings_get_no_closers() {
        for input in ["**a\n1.", "*a\n+", "**a\n#"] {
            let healed = heal_markdown(input);
            assert_eq!(heal_markdown(&healed), healed, "input: {input:?}");
            assert!(
                healed.ends_with(input.rsplit('\n').next().unwrap()),
                "{healed:?}"
            );
        }
    }
    #[test]
    fn lone_backtick_does_not_block_emphasis() {
        assert_eq!(heal_markdown("**b `"), "**b `**");
        assert_eq!(heal_markdown("*i `"), "*i `*");
        assert_eq!(heal_markdown("**b `**"), "**b `**");
    }
    #[test]
    fn closers_go_before_trailing_newlines() {
        assert_eq!(heal_markdown("# Title *x\n"), "# Title *x*\n");
        assert_eq!(heal_markdown("a **b\n"), "a **b**\n");
    }
    #[test]
    fn removed_markers_do_not_leave_a_single_trailing_space() {
        assert_eq!(heal_markdown("- ["), "-");
        assert_eq!(heal_markdown("a ["), "a");
    }
    #[test]
    fn heal_is_idempotent_for_container_and_code_mixes() {
        for input in [
            "**$$",
            "$$`plain",
            "- __$$__<a ",
            "&好\\<a \\](",
            "\\[]([$$*)~~\n\n`**plain   ] ]~~~\n>",
            "*\n]```https://x.co/_a* $$*~~\n*   ",
            "&__\n][*```>plain]   \n> ",
            "___\\](*plain~~~",
        ] {
            let healed = heal_markdown(input);
            assert_eq!(heal_markdown(&healed), healed, "input: {input:?}");
        }
    }
}
