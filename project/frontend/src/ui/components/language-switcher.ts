/**
 * Language switcher — dropdown button for EN / 日本語.
 */

import { currentLang, changeLanguage } from "../../i18n";
import { store } from "../../core/state";

export function createLanguageSwitcher(container: HTMLElement): void {
  const langLabels: Record<string, string> = { en: "EN", ja: "日本語" };

  const wrapper = document.createElement("div");
  wrapper.className = "lang-switcher";

  const btn = document.createElement("button");
  btn.className = "lang-btn";
  btn.textContent = langLabels[currentLang()] || "EN";
  btn.title = "Switch language";

  const menu = document.createElement("div");
  menu.className = "lang-menu hidden";
  menu.innerHTML = `
    <button data-lang="en" class="lang-option">EN — English</button>
    <button data-lang="ja" class="lang-option">日本語 — Japanese</button>
  `;

  btn.addEventListener("click", () => menu.classList.toggle("hidden"));

  menu.querySelectorAll("button").forEach((opt) => {
    opt.addEventListener("click", async () => {
      const lang = opt.getAttribute("data-lang");
      if (!lang) return;
      await changeLanguage(lang);
      btn.textContent = langLabels[lang] || lang;
      menu.classList.add("hidden");
      store.emit("language:changed", lang);
    });
  });

  // Close menu on outside click
  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target as Node)) {
      menu.classList.add("hidden");
    }
  });

  wrapper.appendChild(btn);
  wrapper.appendChild(menu);
  container.appendChild(wrapper);
}