import bash from "@shikijs/langs/bash";
import css from "@shikijs/langs/css";
import goLang from "@shikijs/langs/go";
import html from "@shikijs/langs/html";
import javascript from "@shikijs/langs/javascript";
import json from "@shikijs/langs/json";
import markdown from "@shikijs/langs/markdown";
import python from "@shikijs/langs/python";
import rust from "@shikijs/langs/rust";
import toml from "@shikijs/langs/toml";
import typescript from "@shikijs/langs/typescript";
import yaml from "@shikijs/langs/yaml";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import type { SyntaxHighlighter } from "comrak-wasm";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import {
	createShikiAdapter,
	type ShikiTheme,
	type SyntaxHighlighterCtor,
} from "../shared/shiki-adapter";

const themes = {
	dark: { name: "github-dark", bg: "#24292e", fg: "#e1e4e8" },
	light: { name: "github-light", bg: "#ffffff", fg: "#1f2328" },
} as const satisfies Record<string, ShikiTheme>;

type ThemeName = keyof typeof themes;

let generation = 0;
let activeHighlighter: HighlighterCore | null = null;
let highlighterPromise: Promise<HighlighterCore> | null = null;
const adapters: Partial<Record<ThemeName, SyntaxHighlighter>> = {};

function disposeHighlighter(highlighter: HighlighterCore): void {
	if (typeof highlighter.dispose === "function") highlighter.dispose();
}

async function createHighlighter(expectedGeneration: number) {
	const highlighter = await createHighlighterCore({
		themes: [githubDark, githubLight],
		langs: [
			typescript,
			javascript,
			rust,
			bash,
			json,
			html,
			css,
			python,
			goLang,
			yaml,
			toml,
			markdown,
		],
		engine: createJavaScriptRegexEngine(),
	});

	if (expectedGeneration !== generation) {
		disposeHighlighter(highlighter);
		throw new Error("Shiki initialization was superseded");
	}

	activeHighlighter = highlighter;
	return highlighter;
}

function loadHighlighter(): Promise<HighlighterCore> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighter(generation);
	}
	return highlighterPromise;
}

export async function getSyntaxHighlighter(
	SyntaxHighlighterClass: SyntaxHighlighterCtor<SyntaxHighlighter>,
	dark: boolean,
): Promise<SyntaxHighlighter> {
	const themeName = dark ? "dark" : "light";
	const cached = adapters[themeName];
	if (cached) return cached;

	const expectedGeneration = generation;
	const highlighter = await loadHighlighter();
	if (expectedGeneration !== generation) {
		throw new Error("Shiki initialization was superseded");
	}

	const current = adapters[themeName];
	if (current) return current;

	const adapter = createShikiAdapter(
		SyntaxHighlighterClass,
		highlighter,
		themes[themeName],
	);
	adapters[themeName] = adapter;
	return adapter;
}

export function releaseShiki(): void {
	generation++;

	for (const themeName of ["light", "dark"] as const) {
		const adapter = adapters[themeName];
		delete adapters[themeName];
		if (adapter && typeof adapter.free === "function") adapter.free();
	}

	const highlighter = activeHighlighter;
	activeHighlighter = null;
	highlighterPromise = null;
	if (highlighter) disposeHighlighter(highlighter);
}
