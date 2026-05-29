/// Heals incomplete markdown by closing unclosed delimiters.
/// Operates as a pre-parser text transform — fixes raw markdown before parsing.

pub fn heal_markdown(input: &str) -> String {
    let mut buf = input.to_string();

    // Strip trailing single space (preserve double-space line breaks)
    if buf.ends_with(' ') && !buf.ends_with("  ") {
        buf.pop();
    }

    // Block-level healers operate on the full text
    heal_html_tag(&mut buf);
    heal_setext(&mut buf);
    heal_links(&mut buf);
    heal_block_katex(&mut buf);
    heal_code_block(&mut buf);

    // Inline formatting healers must only operate on the last paragraph.
    // Inline formatting (bold, italic, etc.) cannot span paragraph boundaries (\n\n),
    // so closing delimiters must be appended within the same paragraph.
    if let Some(para_start) = buf.rfind("\n\n") {
        let split = para_start + 2;
        let mut last_para = buf[split..].to_string();
        heal_bold_italic(&mut last_para);
        heal_bold(&mut last_para);
        heal_italic_double_underscore(&mut last_para);
        heal_italic_asterisk(&mut last_para);
        heal_italic_underscore(&mut last_para);
        heal_inline_code(&mut last_para);
        heal_strikethrough(&mut last_para);
        buf.truncate(split);
        buf.push_str(&last_para);
    } else {
        // Single paragraph — heal the whole thing
        heal_bold_italic(&mut buf);
        heal_bold(&mut buf);
        heal_italic_double_underscore(&mut buf);
        heal_italic_asterisk(&mut buf);
        heal_italic_underscore(&mut buf);
        heal_inline_code(&mut buf);
        heal_strikethrough(&mut buf);
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

fn in_fenced_code_block(s: &str, up_to: usize) -> bool {
    // Snap to char boundary (callers may pass byte offsets inside multi-byte chars)
    let mut pos = up_to.min(s.len());
    while pos > 0 && !s.is_char_boundary(pos) {
        pos -= 1;
    }
    let text = &s[..pos];
    let mut fences = 0;
    let mut i = 0;
    let bytes = text.as_bytes();
    while i < bytes.len() {
        if i + 2 < bytes.len() && bytes[i] == b'`' && bytes[i + 1] == b'`' && bytes[i + 2] == b'`' {
            if !is_escaped(text, i) {
                fences += 1;
                i += 3;
                // Skip to end of backtick run
                while i < bytes.len() && bytes[i] == b'`' {
                    i += 1;
                }
                continue;
            }
        }
        i += 1;
    }
    fences % 2 == 1
}

fn count_fences(s: &str) -> usize {
    let mut count = 0;
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() {
        if i + 2 < bytes.len() && bytes[i] == b'`' && bytes[i + 1] == b'`' && bytes[i + 2] == b'`' {
            if !is_escaped(s, i) {
                count += 1;
                i += 3;
                while i < bytes.len() && bytes[i] == b'`' {
                    i += 1;
                }
                continue;
            }
        }
        i += 1;
    }
    count
}

fn count_backticks_outside_fences(s: &str) -> usize {
    let mut count = 0;
    let mut in_fence = false;
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() {
        if i + 2 < bytes.len() && bytes[i] == b'`' && bytes[i + 1] == b'`' && bytes[i + 2] == b'`' {
            if !is_escaped(s, i) {
                in_fence = !in_fence;
                i += 3;
                while i < bytes.len() && bytes[i] == b'`' {
                    i += 1;
                }
                continue;
            }
        }
        if !in_fence && bytes[i] == b'`' && !is_escaped(s, i) {
            count += 1;
        }
        i += 1;
    }
    count
}

fn count_delimiter_outside_fences(s: &str, delim: &str) -> usize {
    let dlen = delim.len();
    let dbytes = delim.as_bytes();
    let mut count = 0;
    let mut in_fence = false;
    let mut i = 0;
    let bytes = s.as_bytes();
    while i < bytes.len() {
        // Track fences
        if i + 2 < bytes.len() && bytes[i] == b'`' && bytes[i + 1] == b'`' && bytes[i + 2] == b'`' {
            if !is_escaped(s, i) {
                in_fence = !in_fence;
                i += 3;
                while i < bytes.len() && bytes[i] == b'`' {
                    i += 1;
                }
                continue;
            }
        }
        if in_fence {
            i += 1;
            continue;
        }
        // Match delimiter
        if i + dlen <= bytes.len() && &bytes[i..i + dlen] == dbytes && !is_escaped(s, i) {
            count += 1;
            i += dlen;
            continue;
        }
        i += 1;
    }
    count
}

fn has_meaningful_content(s: &str) -> bool {
    s.chars()
        .any(|c| !c.is_whitespace() && c != '*' && c != '_' && c != '~' && c != '`')
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
    // If last line is 1-2 dashes or equals, append a space to prevent setext heading
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
        buf.push(' ');
    }
}

fn heal_links(buf: &mut String) {
    // Find last unclosed [ or ![
    // Track fence state inline to avoid O(n^2) from calling in_fenced_code_block per byte.
    let bytes = buf.as_bytes();
    let mut bracket_depth = 0i32;
    let mut last_open: Option<(usize, bool)> = None; // (pos, is_image)
    let mut in_fence = false;

    let mut i = 0;
    while i < bytes.len() {
        // Track fenced code blocks
        if i + 2 < bytes.len()
            && bytes[i] == b'`'
            && bytes[i + 1] == b'`'
            && bytes[i + 2] == b'`'
            && !is_escaped(buf, i)
        {
            in_fence = !in_fence;
            i += 3;
            while i < bytes.len() && bytes[i] == b'`' {
                i += 1;
            }
            continue;
        }
        if in_fence {
            i += 1;
            continue;
        }
        if is_escaped(buf, i) {
            i += 1;
            continue;
        }
        if bytes[i] == b'[' {
            let is_image = i > 0 && bytes[i - 1] == b'!';
            bracket_depth += 1;
            last_open = Some((if is_image { i - 1 } else { i }, is_image));
        } else if bytes[i] == b']' {
            bracket_depth -= 1;
            if bracket_depth < 0 {
                bracket_depth = 0;
            }
        }
        i += 1;
    }

    if bracket_depth <= 0 {
        // Check for incomplete URL: [text](url without )
        if let Some(paren_pos) = buf.rfind("](") {
            let after = &buf[paren_pos + 2..];
            if !after.contains(')') && !in_fenced_code_block(buf, paren_pos) {
                // Close the URL
                buf.push(')');
                return;
            }
        }
        return;
    }

    // Have unclosed bracket
    if let Some((pos, is_image)) = last_open {
        // Check if we have ]( after it
        let rest = &buf[pos..];
        if let Some(paren_rel) = rest.find("](") {
            let paren_abs = pos + paren_rel;
            let after_paren = &buf[paren_abs + 2..];
            if !after_paren.contains(')') {
                buf.push(')');
                return;
            }
        }
        // No ]( — strip the opening marker
        buf.drain(pos..pos + if is_image { 2 } else { 1 });
    }
}

fn heal_bold_italic(buf: &mut String) {
    let count = count_delimiter_outside_fences(buf, "***");
    if count % 2 == 1 && has_meaningful_content(buf) {
        buf.push_str("***");
    }
}

fn heal_bold(buf: &mut String) {
    let count = count_delimiter_outside_fences(buf, "**");
    if count % 2 == 1 && has_meaningful_content(buf) {
        // If text ends with single *, append just one more
        if buf.ends_with('*') && !buf.ends_with("**") {
            buf.push('*');
        } else {
            buf.push_str("**");
        }
    }
}

fn heal_italic_double_underscore(buf: &mut String) {
    let count = count_delimiter_outside_fences(buf, "__");
    if count % 2 == 1 && has_meaningful_content(buf) {
        if buf.ends_with('_') && !buf.ends_with("__") {
            buf.push('_');
        } else {
            buf.push_str("__");
        }
    }
}

fn heal_italic_asterisk(buf: &mut String) {
    // Count single * not part of ** or ***
    let mut count = 0;
    let mut in_fence = false;
    let mut i = 0;
    let bytes = buf.as_bytes();
    while i < bytes.len() {
        if i + 2 < bytes.len() && bytes[i] == b'`' && bytes[i + 1] == b'`' && bytes[i + 2] == b'`' {
            if !is_escaped(buf, i) {
                in_fence = !in_fence;
                i += 3;
                while i < bytes.len() && bytes[i] == b'`' {
                    i += 1;
                }
                continue;
            }
        }
        if in_fence {
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
                }
            }
            // For runs of 3+, count the leftover single
            if run == 3 {
                count += 1; // The * part of ***
            }
            continue;
        }
        i += 1;
    }
    if count % 2 == 1 && has_meaningful_content(buf) {
        buf.push('*');
    }
}

fn heal_italic_underscore(buf: &mut String) {
    // Count single _ not part of __
    let mut count = 0;
    let mut in_fence = false;
    let mut i = 0;
    let bytes = buf.as_bytes();
    while i < bytes.len() {
        if i + 2 < bytes.len() && bytes[i] == b'`' && bytes[i + 1] == b'`' && bytes[i + 2] == b'`' {
            if !is_escaped(buf, i) {
                in_fence = !in_fence;
                i += 3;
                while i < bytes.len() && bytes[i] == b'`' {
                    i += 1;
                }
                continue;
            }
        }
        if in_fence {
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
                }
            }
            continue;
        }
        i += 1;
    }
    if count % 2 == 1 && has_meaningful_content(buf) {
        // Insert _ before trailing newlines
        let trimmed_end = buf.trim_end_matches('\n').len();
        buf.insert(trimmed_end, '_');
    }
}

fn heal_inline_code(buf: &mut String) {
    // Only heal if not inside an unclosed fenced code block
    if count_fences(buf) % 2 == 1 {
        return;
    }
    let count = count_backticks_outside_fences(buf);
    if count % 2 == 1 {
        buf.push('`');
    }
}

fn heal_strikethrough(buf: &mut String) {
    let count = count_delimiter_outside_fences(buf, "~~");
    if count % 2 == 1 && has_meaningful_content(buf) {
        if buf.ends_with('~') && !buf.ends_with("~~") {
            buf.push('~');
        } else {
            buf.push_str("~~");
        }
    }
}

fn heal_block_katex(buf: &mut String) {
    let count = count_delimiter_outside_fences(buf, "$$");
    if count % 2 == 1 {
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
    if count_fences(buf) % 2 == 1 {
        if !buf.ends_with('\n') {
            buf.push('\n');
        }
        buf.push_str("```");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Bold ---
    #[test] fn heal_unclosed_bold() { assert_eq!(heal_markdown("**bold"), "**bold**"); }
    #[test] fn heal_half_closed_bold() { assert_eq!(heal_markdown("**bold*"), "**bold**"); }
    #[test] fn heal_closed_bold_unchanged() { assert_eq!(heal_markdown("**bold**"), "**bold**"); }
    #[test] fn heal_bold_with_content() { assert_eq!(heal_markdown("text **bold"), "text **bold**"); }
    #[test] fn heal_nested_bold() {
        // Two ** pairs = even count, no healing needed
        assert_eq!(heal_markdown("**outer **inner"), "**outer **inner");
    }

    // --- Italic ---
    #[test] fn heal_unclosed_italic_star() { assert_eq!(heal_markdown("*italic"), "*italic*"); }
    #[test] fn heal_unclosed_italic_underscore() { assert_eq!(heal_markdown("_italic"), "_italic_"); }
    #[test] fn heal_closed_italic_unchanged() { assert_eq!(heal_markdown("*italic*"), "*italic*"); }

    // --- Bold italic ---
    #[test] fn heal_unclosed_bold_italic() { assert_eq!(heal_markdown("***bold italic"), "***bold italic***"); }

    // --- Strikethrough ---
    #[test] fn heal_unclosed_strikethrough() { assert_eq!(heal_markdown("~~strike"), "~~strike~~"); }
    #[test] fn heal_half_closed_strikethrough() { assert_eq!(heal_markdown("~~strike~"), "~~strike~~"); }
    #[test] fn heal_closed_strikethrough_unchanged() { assert_eq!(heal_markdown("~~strike~~"), "~~strike~~"); }

    // --- Inline code ---
    #[test] fn heal_unclosed_inline_code() { assert_eq!(heal_markdown("use `const"), "use `const`"); }
    #[test] fn heal_closed_inline_code_unchanged() { assert_eq!(heal_markdown("use `const`"), "use `const`"); }

    // --- Code block ---
    #[test] fn heal_unclosed_code_block() {
        let result = heal_markdown("```js\ncode");
        assert!(result.ends_with("\n```"));
        assert!(result.contains("code"));
    }
    #[test] fn heal_closed_code_block_unchanged() {
        assert_eq!(heal_markdown("```js\ncode\n```"), "```js\ncode\n```");
    }
    #[test] fn heal_unclosed_code_block_no_lang() {
        let result = heal_markdown("```\ncode");
        assert!(result.ends_with("\n```"));
    }

    // --- Links ---
    #[test] fn heal_unclosed_link_url() {
        assert_eq!(heal_markdown("[click](http://example.com"), "[click](http://example.com)");
    }
    #[test] fn heal_incomplete_link_text() {
        assert_eq!(heal_markdown("text [incomplete"), "text incomplete");
    }
    #[test] fn heal_complete_link_unchanged() {
        assert_eq!(heal_markdown("[click](http://example.com)"), "[click](http://example.com)");
    }

    // --- Double underscore ---
    #[test] fn heal_unclosed_double_underscore() { assert_eq!(heal_markdown("__underline"), "__underline__"); }
    #[test] fn heal_half_closed_double_underscore() { assert_eq!(heal_markdown("__underline_"), "__underline__"); }

    // --- KaTeX ---
    #[test] fn heal_unclosed_block_katex() {
        let result = heal_markdown("$$\nx^2");
        assert_eq!(result.matches("$$").count(), 2);
    }
    #[test] fn heal_closed_katex_unchanged() {
        assert_eq!(heal_markdown("$$\nx^2\n$$"), "$$\nx^2\n$$");
    }

    // --- HTML tag ---
    #[test] fn heal_incomplete_html_tag() { assert_eq!(heal_markdown("text <div"), "text"); }
    #[test] fn heal_complete_html_tag_unchanged() { assert_eq!(heal_markdown("text <div>"), "text <div>"); }

    // --- Setext ---
    #[test] fn heal_setext_single_dash() {
        let result = heal_markdown("title\n-");
        assert_ne!(result, "title\n-");
    }
    #[test] fn heal_setext_triple_dash_unchanged() {
        assert_eq!(heal_markdown("---"), "---");
    }

    // --- Edge cases ---
    #[test] fn heal_empty_input() { assert_eq!(heal_markdown(""), ""); }
    #[test] fn heal_plain_text_unchanged() { assert_eq!(heal_markdown("hello world"), "hello world"); }
    #[test] fn heal_escaped_delimiter() { assert_eq!(heal_markdown("\\*not italic"), "\\*not italic"); }
    #[test] fn heal_strip_trailing_single_space() { assert_eq!(heal_markdown("text "), "text"); }
    #[test] fn heal_preserve_double_trailing_space() { assert_eq!(heal_markdown("text  "), "text  "); }
    #[test] fn heal_inside_code_block_unchanged() {
        assert_eq!(heal_markdown("```\n**unclosed\n```"), "```\n**unclosed\n```");
    }
    #[test] fn heal_multiple_unclosed() {
        let result = heal_markdown("**bold *italic");
        assert!(result.contains("**"));
        assert!(result.contains("*"));
    }
    #[test] fn heal_word_internal_asterisk_unchanged() {
        assert_eq!(heal_markdown("file*name"), "file*name");
    }
    #[test] fn heal_word_internal_underscore_unchanged() {
        assert_eq!(heal_markdown("var_name"), "var_name");
    }

    // --- Multi-byte Unicode ---
    #[test] fn heal_zwsp_in_text() {
        // ZWSP (U+200B) is 3 bytes — must not panic
        assert_eq!(heal_markdown("Text\u{200B}with\u{200B}ZWSP"), "Text\u{200B}with\u{200B}ZWSP");
    }
    #[test] fn heal_zwsp_with_bold() {
        assert_eq!(heal_markdown("**bold\u{200B}text"), "**bold\u{200B}text**");
    }
    #[test] fn heal_zwsp_with_link() {
        assert_eq!(heal_markdown("[link\u{200B}text](url"), "[link\u{200B}text](url)");
    }
    #[test] fn heal_emoji_in_text() {
        // Emoji are multi-byte (4 bytes)
        assert_eq!(heal_markdown("Hello 🌍 world"), "Hello 🌍 world");
    }
    #[test] fn heal_emoji_with_unclosed_bold() {
        assert_eq!(heal_markdown("**bold 🌍"), "**bold 🌍**");
    }
    #[test] fn heal_cjk_characters() {
        // CJK characters are 3 bytes
        assert_eq!(heal_markdown("你好世界"), "你好世界");
    }
    #[test] fn heal_cjk_with_unclosed_code() {
        assert_eq!(heal_markdown("`代码"), "`代码`");
    }
    #[test] fn heal_mixed_multibyte_unchanged() {
        assert_eq!(heal_markdown("café résumé naïve"), "café résumé naïve");
    }

    // --- Cross-paragraph boundary ---
    #[test] fn heal_bold_does_not_span_paragraphs() {
        // Opening *** in first paragraph should NOT close at end of second
        let result = heal_markdown("***bold\n\nmore text");
        // The *** should not appear at the very end (after "more text")
        assert!(!result.ends_with("***"));
        // First paragraph stays unclosed (literal ***)
        assert!(result.starts_with("***bold"));
    }
    #[test] fn heal_bold_closes_in_same_paragraph() {
        assert_eq!(heal_markdown("**bold"), "**bold**");
    }
    #[test] fn heal_italic_does_not_span_paragraphs() {
        let result = heal_markdown("*italic\n\nmore text");
        assert!(!result.ends_with("*more text*"));
    }
    #[test] fn heal_strikethrough_does_not_span_paragraphs() {
        let result = heal_markdown("~~strike\n\nmore text");
        assert!(!result.ends_with("~~"));
    }
    #[test] fn heal_inline_code_does_not_span_paragraphs() {
        let result = heal_markdown("`code\n\nmore text");
        assert!(!result.ends_with("`"));
    }
    #[test] fn heal_last_paragraph_still_healed() {
        // Unclosed bold in second paragraph should be healed there
        assert_eq!(heal_markdown("normal\n\n**bold"), "normal\n\n**bold**");
    }
    #[test] fn heal_code_block_still_spans_paragraphs() {
        // Block-level constructs should still work across paragraphs
        let result = heal_markdown("```\ncode\n\nmore code");
        assert!(result.ends_with("\n```"));
    }
}
