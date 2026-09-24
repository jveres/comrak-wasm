import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const cliPath = fileURLToPath(new URL("./examples/md.mjs", import.meta.url));

describe("Markdown CLI", () => {
	test("prints help before loading the Wasm artifact", async () => {
		const { stderr, stdout } = await execFileAsync(process.execPath, [
			cliPath,
			"--help",
		]);

		expect(stderr).toBe("");
		expect(stdout).toContain("Usage: comrak-wasm");
	});

	test("rejects invalid arguments before loading the Wasm artifact", async () => {
		await expect(
			execFileAsync(process.execPath, [cliPath, "--invalid"]),
		).rejects.toMatchObject({
			code: 1,
			stderr: "error: unknown option '--invalid' (use --help)\n",
		});
	});

	test("renders a Markdown file as plain text", async () => {
		const fixture = fileURLToPath(
			new URL("./examples/playground/sample.md", import.meta.url),
		);
		const { stderr, stdout } = await execFileAsync(process.execPath, [
			cliPath,
			"--text",
			"--no-shadow",
			fixture,
		]);

		expect(stderr).toBe("");
		expect(stdout).toContain("Comrak feature playground");
		expect(stdout).not.toContain("░");
	});

	test("disables table shadows in ANSI output", async () => {
		const fixture = fileURLToPath(
			new URL("./examples/playground/sample.md", import.meta.url),
		);
		const { stderr, stdout } = await execFileAsync(process.execPath, [
			cliPath,
			"--ansi",
			"--no-shadow",
			fixture,
		]);

		expect(stderr).toBe("");
		expect(stdout).toContain("Comrak feature playground");
		expect(stdout).not.toContain("░");
	});
});
