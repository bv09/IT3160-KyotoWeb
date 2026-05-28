/**
 * i18next initialization — FacilMap-inspired lazy-init pattern.
 *
 * Usage:
 *   import { t } from "./i18n";
 *   t("routing", "from")   // → "From" (en) or "出発地" (ja)
 */

import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enCommon from "./locales/en/common.json";
import enRouting from "./locales/en/routing.json";
import enSearch from "./locales/en/search.json";
import enAdmin from "./locales/en/admin.json";
import jaCommon from "./locales/ja/common.json";
import jaRouting from "./locales/ja/routing.json";
import jaSearch from "./locales/ja/search.json";
import jaAdmin from "./locales/ja/admin.json";

let _initialized = false;
let _initPromise: Promise<typeof i18next> | null = null;

export function initI18n(): Promise<typeof i18next> {
  if (_initialized) return Promise.resolve(i18next);
  if (_initPromise) return _initPromise;

  _initPromise = i18next
    .use(LanguageDetector)
    .init({
      fallbackLng: "en",
      supportedLngs: ["en", "ja"],
      defaultNS: "common",
      ns: ["common", "routing", "search", "admin"],
      resources: {
        en: { common: enCommon, routing: enRouting, search: enSearch, admin: enAdmin },
        ja: { common: jaCommon, routing: jaRouting, search: jaSearch, admin: jaAdmin },
      },
      detection: {
        order: ["navigator", "cookie", "querystring", "localStorage"],
        caches: ["cookie"],
        lookupCookie: "lang",
        lookupQuerystring: "lang",
      },
      interpolation: {
        escapeValue: false,
      },
    })
    .then(() => {
      _initialized = true;
      return i18next;
    });

  return _initPromise;
}

/**
 * Translate a key within a namespace.
 * Falls back to key if translation is missing.
 */
export function t(ns: string, key: string, options?: Record<string, any>): string {
  if (!_initialized) return key;
  return i18next.t(key, { ns, ...options });
}

/**
 * Get the current language code.
 */
export function currentLang(): string {
  return i18next.language || "en";
}

/**
 * Change the display language.
 */
export function changeLanguage(lang: string): Promise<void> {
  return i18next.changeLanguage(lang).then(() => {});
}

export { i18next };