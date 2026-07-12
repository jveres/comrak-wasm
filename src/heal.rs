//! Heals incomplete markdown by closing unclosed delimiters.
//! Operates as a pre-parser text transform — fixes raw markdown before parsing.

pub fn heal_markdown(input: &str) -> String {
    let trailing_single_space = input.ends_with(' ') && !input.ends_with("  ");
    let last_line = input.rsplit('\n').next().unwrap_or("").trim();
    let needs_setext_healing = input.contains('\n') && matches!(last_line, "-" | "--" | "=" | "==");
    let has_healing_syntax = input
        .bytes()
        .any(|byte| matches!(byte, b'<' | b'[' | b'*' | b'_' | b'~' | b'`' | b'$'));

    if !has_healing_syntax && !needs_setext_healing {
        let mut output = input.to_string();
        if trailing_single_space {
            output.pop();
        }
        return output;
    }

    let mut buf = input.to_string();

    // Strip trailing single space (preserve double-space line breaks)
    if buf.ends_with(' ') && !buf.ends_with("  ") {
        buf.pop();
    }

    // Block-level healers operate on the full text.
    heal_block_markup(&mut buf);

    // Inline formatting healers must only operate on the last paragraph.
    // Inline formatting (bold, italic, etc.) cannot span paragraph boundaries (\n\n),
    // so closing delimiters must be appended within the same paragraph.
    let paragraph_start = buf.rfind("\n\n").map_or(0, |position| position + 2);
    let inline_start = paragraph_start.max(last_closed_fence_end(&buf).unwrap_or(0));
    if inline_start > 0 {
        let split = inline_start;
        let mut last_para = buf[split..].to_string();
        heal_inline_markup(&mut last_para);
        buf.truncate(split);
        buf.push_str(&last_para);
    } else {
        // Single paragraph — heal the whole thing
        heal_inline_markup(&mut buf);
    }

    buf
}

// --- Helpers ---

fn is_escaped(s: &str, pos: usize) -> bool {
    let bytes = s.as_bytes();
    let mut backslashes = 0;
    let mut i = pos;
    while i > 0 {
        i -= 1;
        if bytes[i] == b'\\' {
            backslashes += 1;
        } else {
            break;
        }
    }
    backslashes % 2 == 1
}

#[derive(Clone, Copy)]
struct Fence {
    marker: u8,
    length: usize,
}

fn fence_line_at(s: &str, i: usize, open: Option<Fence>) -> Option<(Fence, usize)> {
    let bytes = s.as_bytes();
    let marker = *bytes.get(i)?;
    if marker != b'`' && marker != b'~' {
        return None;
    }

    let line_start = bytes[..i]
        .iter()
        .rposition(|byte| *byte == b'\n')
        .map_or(0, |position| position + 1);
    let indent = i - line_start;
    if indent > 3 || bytes[line_start..i].iter().any(|byte| *byte != b' ') {
        return None;
    }

    let mut length = 0;
    while bytes.get(i + length) == Some(&marker) {
        length += 1;
    }
    if length < 3 {
        return None;
    }

    if let Some(open) = open {
        if marker != open.marker || length < open.length {
            return None;
        }
        let line_end = bytes[i + length..]
            .iter()
            .position(|byte| *byte == b'\n')
            .map_or(bytes.len(), |offset| i + length + offset);
        if bytes[i + length..line_end]
            .iter()
            .any(|byte| !matches!(*byte, b' ' | b'\t' | b'\r'))
        {
            return None;
        }
    }

    Some((Fence { marker, length }, length))
}

fn update_fence(s: &str, i: usize, open: &mut Option<Fence>) -> Option<usize> {
    let (fence, run) = fence_line_at(s, i, *open)?;
    if open.is_some() {
        *open = None;
    } else {
        *open = Some(fence);
    }
    Some(run)
}

fn in_fenced_code_block(s: &str, up_to: usize) -> bool {
    // Snap to char boundary (callers may pass byte offsets inside multi-byte chars)
    let mut pos = up_to.min(s.len());
    while pos > 0 && !s.is_char_boundary(pos) {
        pos -= 1;
    }
    let text = &s[..pos];
    let mut open = None;
    let mut i = 0;
    let bytes = text.as_bytes();
    while i < bytes.len() {
        if let Some(run) = update_fence(text, i, &mut open) {
            i += run;
            continue;
        }
        i += 1;
    }
    open.is_some()
}

fn unclosed_fence(s: &str) -> Option<Fence> {
    let mut open = None;
    let mut i = 0;
    while i < s.len() {
        if let Some(run) = update_fence(s, i, &mut open) {
            i += run;
        } else {
            i += 1;
        }
    }
    open
}

fn last_closed_fence_end(s: &str) -> Option<usize> {
    let mut open = None;
    let mut last_end = None;
    let mut i = 0;
    while i < s.len() {
        let was_open = open.is_some();
        if let Some(run) = update_fence(s, i, &mut open) {
            if was_open && open.is_none() {
                last_end = Some(
                    s[i + run..]
                        .find('\n')
                        .map_or(s.len(), |offset| i + run + offset + 1),
                );
            }
            i += run;
        } else {
            i += 1;
        }
    }
    last_end
}

fn unclosed_inline_code(s: &str) -> Option<(usize, usize)> {
    let mut inline_open: Option<(usize, usize)> = None; // (run length, opener end)
    let mut open = None;
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() {
        if let Some(run) = update_fence(s, i, &mut open) {
            i += run;
            continue;
        }
        if open.is_none() && bytes[i] == b'`' && !is_escaped(s, i) {
            let mut run = 1;
            while bytes.get(i + run) == Some(&b'`') {
                run += 1;
            }
            if inline_open.is_some_and(|(opening_run, _)| opening_run == run) {
                inline_open = None;
            } else if inline_open.is_none() {
                inline_open = Some((run, i + run));
            }
            i += run;
            continue;
        }
        i += 1;
    }
    inline_open
}

fn delimiter_stats_outside_fences(s: &str, delim: &str) -> (usize, Option<usize>) {
    let dlen = delim.len();
    let dbytes = delim.as_bytes();
    let mut count = 0;
    let mut last_end = None;
    let mut open = None;
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() {
        if let Some(run) = update_fence(s, i, &mut open) {
            i += run;
            continue;
        }
        if open.is_some() {
            i += 1;
            continue;
        }
        // Match delimiter
        if i + dlen <= bytes.len() && &bytes[i..i + dlen] == dbytes && !is_escaped(s, i) {
            count += 1;
            i += dlen;
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
    // point so calling `heal_markdown` again cannot add more closers.
    for _ in 0..8 {
        let original_len = buf.len();
        heal_bold_italic(buf);
        heal_bold(buf);
        heal_italic_double_underscore(buf);
        heal_italic_asterisk(buf);
        heal_italic_underscore(buf);
        heal_inline_code(buf);
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
        heal_links(buf);
        heal_html_tag(buf);
        heal_setext(buf);
        heal_block_katex(buf);
        heal_code_block(buf);
        if buf.len() == original_len {
            break;
        }
    }
}

// --- Healers ---

fn heal_html_tag(buf: &mut String) {
    // Find unclosed HTML tag at end: <tag... with no >
    let bytes = buf.as_bytes();
    let mut last_lt = None;
    for i in (0..bytes.len()).rev() {
        if bytes[i] == b'>' {
            return; // Last angle bracket is a close — no unclosed tag
        }
        if bytes[i] == b'<' {
            last_lt = Some(i);
            break;
        }
    }
    if let Some(pos) = last_lt {
        if in_fenced_code_block(buf, pos) {
            return;
        }
        // Check next char is letter or /
        if pos + 1 < bytes.len() {
            let next = bytes[pos + 1];
            if next.is_ascii_alphabetic() || next == b'/' {
                buf.truncate(pos);
                // Trim trailing whitespace
                let trimmed = buf.trim_end().len();
                buf.truncate(trimmed);
            }
        }
    }
}

fn heal_setext(buf: &mut String) {
    // Escape an incomplete 1-2 character setext underline without changing its text.
    let line_count = buf.lines().count();
    if line_count <= 1 {
        return;
    }
    let needs_fix = {
        let last_line = buf.rsplit('\n').next().unwrap_or("");
        let trimmed = last_line.trim();
        trimmed == "-" || trimmed == "--" || trimmed == "=" || trimmed == "=="
    };
    if needs_fix {
        let line_start = buf.rfind('\n').map_or(0, |position| position + 1);
        let offset = buf[line_start..]
            .find(|character: char| !character.is_whitespace())
            .unwrap_or(0);
        buf.insert(line_start + offset, '\\');
    }
}

fn heal_links(buf: &mut String) {
    // Find last unclosed [ or ![. Track fence state and backslash-escape parity
    // inline; calling is_escaped per byte would be O(n^2) on backslash-heavy input.
    let bytes = buf.as_bytes();
    let mut unmatched_opens: Vec<(usize, bool)> = Vec::new(); // (pos, is_image)
    let mut open_fence = None;
    let mut backslashes = 0usize; // consecutive '\' immediately before byte i

    let mut i = 0;
    while i < bytes.len() {
        let escaped = backslashes % 2 == 1;

        if !escaped {
            if let Some(run) = update_fence(buf, i, &mut open_fence) {
                i += run;
                backslashes = 0;
                continue;
            }
        }
        if open_fence.is_some() || escaped {
            backslashes = if bytes[i] == b'\\' {
                backslashes + 1
            } else {
                0
            };
            i += 1;
            continue;
        }
        if bytes[i] == b'[' {
            let is_image = i > 0 && bytes[i - 1] == b'!';
            unmatched_opens.push((if is_image { i - 1 } else { i }, is_image));
        } else if bytes[i] == b']' {
            unmatched_opens.pop();
        }
        backslashes = if bytes[i] == b'\\' {
            backslashes + 1
        } else {
            0
        };
        i += 1;
    }

    // Check for incomplete URL: [text](url without )
    if let Some(paren_pos) = buf.rfind("](") {
        let after = &buf[paren_pos + 2..];
        if !after.contains(')') && !in_fenced_code_block(buf, paren_pos) {
            append_closing_delimiter(buf, ")");
        }
    }

    // Remove every unmatched opening marker from the end so byte offsets remain valid.
    for (pos, is_image) in unmatched_opens.into_iter().rev() {
        buf.drain(pos..pos + if is_image { 2 } else { 1 });
    }
}

fn heal_bold_italic(buf: &mut String) {
    let (count, last_end) = delimiter_stats_outside_fences(buf, "***");
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        append_closing_delimiter(buf, "***");
    }
}

fn heal_bold(buf: &mut String) {
    let (count, last_end) = delimiter_stats_outside_fences(buf, "**");
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        // If text ends with single *, append just one more
        if buf.ends_with('*') && !buf.ends_with("**") {
            buf.push('*');
        } else {
            append_closing_delimiter(buf, "**");
        }
    }
}

fn heal_italic_double_underscore(buf: &mut String) {
    let (count, last_end) = delimiter_stats_outside_fences(buf, "__");
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        if buf.ends_with('_') && !buf.ends_with("__") {
            buf.push('_');
        } else {
            append_closing_delimiter(buf, "__");
        }
    }
}

fn heal_italic_asterisk(buf: &mut String) {
    // Count single * not part of ** or ***
    let mut count = 0;
    let mut last_end = None;
    let mut open_fence = None;
    let mut i = 0;
    let bytes = buf.as_bytes();
    while i < bytes.len() {
        if let Some(run) = update_fence(buf, i, &mut open_fence) {
            i += run;
            continue;
        }
        if open_fence.is_some() {
            i += 1;
            continue;
        }
        if bytes[i] == b'*' && !is_escaped(buf, i) {
            // Skip if part of ** or ***
            let mut run = 0;
            let start = i;
            while i < bytes.len() && bytes[i] == b'*' {
                run += 1;
                i += 1;
            }
            if run == 1 {
                // Check not word-internal
                let before_word = start > 0
                    && (bytes[start - 1].is_ascii_alphanumeric() || bytes[start - 1] == b'_');
                let after_word =
                    i < bytes.len() && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_');
                if !(before_word && after_word) {
                    count += 1;
                    last_end = Some(i);
                }
            }
            // For runs of 3+, count the leftover single
            if run == 3 {
                count += 1; // The * part of ***
                last_end = Some(i);
            }
            continue;
        }
        i += 1;
    }
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        append_closing_delimiter(buf, "*");
    }
}

fn heal_italic_underscore(buf: &mut String) {
    // Count single _ not part of __
    let mut count = 0;
    let mut last_end = None;
    let mut open_fence = None;
    let mut i = 0;
    let bytes = buf.as_bytes();
    while i < bytes.len() {
        if let Some(run) = update_fence(buf, i, &mut open_fence) {
            i += run;
            continue;
        }
        if open_fence.is_some() {
            i += 1;
            continue;
        }
        if bytes[i] == b'_' && !is_escaped(buf, i) {
            let mut run = 0;
            let start = i;
            while i < bytes.len() && bytes[i] == b'_' {
                run += 1;
                i += 1;
            }
            if run == 1 {
                // Skip word-internal
                let before_word = start > 0
                    && (bytes[start - 1].is_ascii_alphanumeric() || bytes[start - 1] == b'_');
                let after_word =
                    i < bytes.len() && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_');
                if !(before_word && after_word) {
                    count += 1;
                    last_end = Some(i);
                }
            } else if run % 2 == 1 {
                // Pair `__` delimiters and track the remaining single marker.
                count += 1;
                last_end = Some(i);
            }
            continue;
        }
        i += 1;
    }
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        // Insert _ before trailing newlines
        let trimmed_end = buf.trim_end_matches('\n').len();
        let trailing_newlines = buf.split_off(trimmed_end);
        append_closing_delimiter(buf, "_");
        buf.push_str(&trailing_newlines);
    }
}

fn heal_inline_code(buf: &mut String) {
    // Only heal if not inside an unclosed fenced code block
    if unclosed_fence(buf).is_some() {
        return;
    }
    if let Some((run, opener_end)) = unclosed_inline_code(buf) {
        if has_meaningful_content_after(buf, Some(opener_end)) {
            let trimmed_end = buf.trim_end_matches('\n').len();
            let trailing_newlines = buf.split_off(trimmed_end);
            if buf.ends_with('`') {
                // Keep a mismatched trailing run separate from the closer.
                buf.push(' ');
            }
            append_closing_delimiter(buf, &"`".repeat(run));
            buf.push_str(&trailing_newlines);
        }
    }
}

fn heal_strikethrough(buf: &mut String) {
    let (count, last_end) = delimiter_stats_outside_fences(buf, "~~");
    if count % 2 == 1 && has_meaningful_content_after(buf, last_end) {
        if buf.ends_with('~') && !buf.ends_with("~~") {
            buf.push('~');
        } else {
            append_closing_delimiter(buf, "~~");
        }
    }
}

fn heal_block_katex(buf: &mut String) {
    let (count, last_end) = delimiter_stats_outside_fences(buf, "$$");
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
        if !buf.ends_with('\n') {
            buf.push('\n');
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
    fn midline_backticks_are_healed_as_inline_code() {
        assert_eq!(heal_markdown("text ```code"), "text ```code```");
    }
}
