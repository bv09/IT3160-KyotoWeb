/**
 * Sidebar component — role switcher, sub-panel containers, footer.
 * Replaces the inline sidebar HTML from the old index.html.
 */

import { store } from "../core/state";
import { t } from "../i18n";
import { createLanguageSwitcher } from "./components/language-switcher";

export function createSidebar(mapInstance: L.Map): {
  userSection: HTMLElement;
  adminSection: HTMLElement;
  btnOpen: HTMLButtonElement;
} {
  const appContainer = document.getElementById("app")!;

  // ── Open button (visible when sidebar collapsed) ──────────────

  const btnOpen = document.createElement("button");
  btnOpen.id = "btnOpenSidebar";
  btnOpen.className = "sidebar-open-btn";
  btnOpen.title = "Open control panel";
  btnOpen.innerHTML = "&#9776;";
  appContainer.appendChild(btnOpen);

  // ── Sidebar ───────────────────────────────────────────────────

  const sidebar = document.createElement("div");
  sidebar.id = "sidebar";
  sidebar.className = "sidebar";
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-title">
        <span class="sidebar-icon">&#128647;</span>
        <span>${t("common", "app.title")}</span>
      </div>
      <button id="btnCloseSidebar" class="sidebar-close-btn" title="${t("actions", "close")}">&#x2715;</button>
    </div>

    <div class="sidebar-content">
      <div class="role-switcher">
        <button id="btnRoleUser" class="role-btn active" data-role="user">
          <span class="role-icon">&#128100;</span> ${t("common", "roles.user")}
        </button>
        <button id="btnRoleAdmin" class="role-btn" data-role="admin">
          <span class="role-icon">&#128295;</span> ${t("common", "roles.admin")}
        </button>
      </div>

      <div class="divider"></div>

      <div id="userSection" class="role-section active"></div>
      <div id="adminSection" class="role-section"></div>
    </div>

    <div class="sidebar-footer" id="sidebar-footer">
      ${t("common", "app.footer")}
    </div>
  `;

  appContainer.appendChild(sidebar);

  // ── Toggle ────────────────────────────────────────────────────

  const btnClose = sidebar.querySelector("#btnCloseSidebar")!;

  const openSidebar = () => {
    sidebar.classList.remove("collapsed");
    btnOpen.classList.add("hidden");
  };
  const closeSidebar = () => {
    sidebar.classList.add("collapsed");
    btnOpen.classList.remove("hidden");
  };

  btnClose.addEventListener("click", closeSidebar);
  btnOpen.addEventListener("click", openSidebar);

  // ── Role switch ───────────────────────────────────────────────

  const userSection = sidebar.querySelector("#userSection") as HTMLElement;
  const adminSection = sidebar.querySelector("#adminSection") as HTMLElement;
  const btnRoleUser = sidebar.querySelector("#btnRoleUser") as HTMLElement;
  const btnRoleAdmin = sidebar.querySelector("#btnRoleAdmin") as HTMLElement;

  btnRoleUser.addEventListener("click", () => {
    btnRoleUser.classList.add("active");
    btnRoleAdmin.classList.remove("active");
    userSection.classList.add("active");
    adminSection.classList.remove("active");
    store.setRole("user");
  });

  btnRoleAdmin.addEventListener("click", () => {
    btnRoleAdmin.classList.add("active");
    btnRoleUser.classList.remove("active");
    userSection.classList.remove("active");
    adminSection.classList.add("active");
    store.setRole("admin");
  });

  // ── Language switcher in footer ───────────────────────────────

  const footer = sidebar.querySelector("#sidebar-footer") as HTMLElement;
  createLanguageSwitcher(footer);

  // ── Language change re-render ─────────────────────────────────

  store.on("language:changed", () => {
    const title = sidebar.querySelector(".sidebar-title span:last-child") as HTMLElement | null;
    if (title) title.textContent = t("common", "app.title");
    const uBtn = sidebar.querySelector("#btnRoleUser .role-icon + span") as HTMLElement | null;
    if (uBtn) uBtn.textContent = t("common", "roles.user");
    const aBtn = sidebar.querySelector("#btnRoleAdmin .role-icon + span") as HTMLElement | null;
    if (aBtn) aBtn.textContent = t("common", "roles.admin");
    footer.childNodes[0].textContent = t("common", "app.footer");
    (btnClose as HTMLElement).title = t("actions", "close");
  });

  return { userSection, adminSection, btnOpen };
}