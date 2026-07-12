import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		clearMocks: true,
		mockReset: true,
		restoreMocks: true,
	},
	resolve: {
		alias: {
			// Tests import the package by name so they exercise the public types
			// (types.d.ts via tsconfig paths); at runtime that resolves to the
			// built WASM bindings.
			"comrak-wasm": fileURLToPath(new URL("./index.js", import.meta.url)),
		},
	},
});
