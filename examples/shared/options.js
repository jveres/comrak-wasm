/**
 * Canonical "GFM and then some" extension preset, shared by the CLI and the
 * playground so the two don't drift.
 * @type {import("../../types").ExtensionOptions}
 */
export const gfmExtensions = {
	strikethrough: true,
	table: true,
	tasklist: true,
	autolink: true,
	headerIds: "",
	frontMatterDelimiter: "---",
	alerts: true,
	footnotes: true,
	inlineFootnotes: true,
	mathDollars: true,
	mathCode: true,
	superscript: true,
	subscript: true,
	underline: true,
	spoiler: true,
	highlight: true,
	insert: true,
	descriptionLists: true,
	multilineBlockQuotes: true,
	wikilinksTitleAfterPipe: true,
	shortcodes: true,
};
