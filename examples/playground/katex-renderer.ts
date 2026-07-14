import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";

export function renderMath(container: HTMLElement): void {
	container.querySelectorAll("[data-math-style]").forEach((element) => {
		const display = element.getAttribute("data-math-style") === "display";
		katex.render(element.textContent ?? "", element as HTMLElement, {
			displayMode: display,
			throwOnError: false,
		});
	});
}
