/**
 * Loading spinner component.
 * Shows when store.loading > 0.
 */

import { store } from "../../core/state";

let el: HTMLDivElement | null = null;

export function initSpinner(): void {
  el = document.createElement("div");
  el.id = "loading-spinner";
  el.className = "loading-spinner hidden";
  el.innerHTML = `<div class="spinner-dot"></div>`;
  document.body.appendChild(el);

  store.on("loading:changed", (loading: boolean) => {
    if (!el) return;
    if (loading) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });
}