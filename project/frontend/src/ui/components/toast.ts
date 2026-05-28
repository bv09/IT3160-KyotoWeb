/**
 * Toast notification system. Replaces alert() calls.
 */

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let container: HTMLDivElement | null = null;
let nextId = 0;

function getContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

function show(type: ToastType, message: string, durationMs: number = 5000): void {
  const c = getContainer();
  const id = ++nextId;

  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-msg">${message}</span>
    <button class="toast-close" data-toast="${id}">&times;</button>
  `;
  el.setAttribute("data-toast", String(id));

  const close = () => {
    el.classList.add("toast-exit");
    setTimeout(() => el.remove(), 300);
  };

  el.querySelector(".toast-close")?.addEventListener("click", close);

  c.appendChild(el);

  // Animate in
  requestAnimationFrame(() => el.classList.add("toast-enter"));

  if (durationMs > 0) {
    setTimeout(close, durationMs);
  }
}

export const toast = {
  success(msg: string) { show("success", msg); },
  error(msg: string) { show("error", msg, 7000); },
  info(msg: string) { show("info", msg, 4000); },
};