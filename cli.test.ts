import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const cliPath = new URL("./examples/md.mjs", import.meta.url);

describe("Markdown CLI", () => {
	test("prints help before loading the Wasm artifact", async () => {
		const { stderr, stdout } = await execFileAsync(process.execPath, [
			cliPath.pathname,
			"--help",
		]);

		expect(stderr).toBe("");
		expect(stdout).toContain("Usage: comrak-wasm");
	});

	test("rejects invalid arguments before loading the Wasm artifact", async () => {
		await expect(
			execFileAsync(process.execPath, [cliPath.pathname, "--invalid"]),
		).rejects.toMatchObject({
			code: 1,
			stderr: "error: unknown option '--invalid' (use --help)\n",
		});
	});

	test("renders a Markdown file as plain text", async () => {
		const fixture = new URL("./examples/playground/sample.md", import.meta.url);
		const { stderr, stdout } = await execFileAsync(process.execPath, [
			cliPath.pathname,
			"--text",
			"--no-shadow",
			fixture.pathname,
		]);

		expect(stderr).toBe("");
		expect(stdout).toContain("Comrak feature playground");
		expect(stdout).not.toContain("░");
	});

	test("disables table shadows in ANSI output", async () => {
		const fixture = new URL("./examples/playground/sample.md", import.meta.url);
		const { stderr, stdout } = await execFileAsync(process.execPath, [
			cliPath.pathname,
			"--ansi",
			"--no-shadow",
			fixture.pathname,
		]);

		expect(stderr).toBe("");
		expect(stdout).toContain("Comrak feature playground");
		expect(stdout).not.toContain("░");
	});
});
