import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);

describe("Wasm initialization", () => {
	test("shares concurrent asynchronous initialization and rejects a sync race", async () => {
		const indexUrl = new URL("./index.js", import.meta.url).href;
		const wasmUrl = new URL("./pkg/comrak.wasm", import.meta.url).href;
		const script = `
			import { readFile } from "node:fs/promises";
			import init, { initSync, mdToHtml } from ${JSON.stringify(indexUrl)};

			const bytes = await readFile(new URL(${JSON.stringify(wasmUrl)}));
			let resolveModule;
			const deferredModule = new Promise((resolve) => {
				resolveModule = resolve;
			});
			const firstPromise = init({ module_or_path: deferredModule });
			const secondPromise = init({ module_or_path: new Uint8Array([0]) });

			let syncRaceMessage = "";
			try {
				initSync({ module: bytes });
			} catch (error) {
				syncRaceMessage = error instanceof Error ? error.message : String(error);
			}

			resolveModule(bytes);
			const [first, second] = await Promise.all([firstPromise, secondPromise]);
			console.log(JSON.stringify({
				sameOutput: first === second,
				sameMemory: first.memory === second.memory,
				syncRaceMessage,
				html: mdToHtml("# Ready", null),
			}));
		`;

		const { stdout } = await execFileAsync(
			process.execPath,
			["--input-type=module", "--eval", script],
			{ cwd: new URL(".", import.meta.url) },
		);
		const output = stdout.trim().split("\n").at(-1);
		if (!output) throw new Error("initialization probe produced no output");

		expect(JSON.parse(output) as unknown).toStrictEqual({
			sameOutput: true,
			sameMemory: true,
			syncRaceMessage:
				"cannot call initSync while asynchronous initialization is in progress",
			html: "<h1>Ready</h1>\n",
		});
	});

	test("allows a retry after asynchronous initialization fails", async () => {
		const indexUrl = new URL("./index.js", import.meta.url).href;
		const wasmUrl = new URL("./pkg/comrak.wasm", import.meta.url).href;
		const script = `
			import { readFile } from "node:fs/promises";
			import init, { mdToHtml } from ${JSON.stringify(indexUrl)};

			let firstError = false;
			try {
				await init({ module_or_path: new Uint8Array([0]) });
			} catch {
				firstError = true;
			}

			const bytes = await readFile(new URL(${JSON.stringify(wasmUrl)}));
			const initialized = await init({ module_or_path: bytes });
			console.log(JSON.stringify({
				firstError,
				hasMemory: initialized.memory instanceof WebAssembly.Memory,
				html: mdToHtml("# Retried", null),
			}));
		`;

		const { stdout } = await execFileAsync(
			process.execPath,
			["--input-type=module", "--eval", script],
			{ cwd: new URL(".", import.meta.url) },
		);
		const output = stdout.trim().split("\n").at(-1);
		if (!output) throw new Error("initialization probe produced no output");

		expect(JSON.parse(output) as unknown).toStrictEqual({
			firstError: true,
			hasMemory: true,
			html: "<h1>Retried</h1>\n",
		});
	});
});
