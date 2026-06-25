import { invoke } from "@tauri-apps/api/core";
import i18n, { registerUserLocale } from "./index";

export interface UserLocale {
  code: string;
  content: Record<string, unknown>;
}

let _loaded: UserLocale[] = [];

/**
 * Load user-provided locale files from the OS app-data directory and register
 * them with i18next. Must be called after i18nReady resolves. Failures are
 * caught silently so they never block app startup.
 */
export async function loadUserLocales(): Promise<UserLocale[]> {
  try {
    const locales = await invoke<UserLocale[]>("list_user_locales");

    for (const { code, content } of locales) {
      i18n.addResourceBundle(code, "translation", content, true, false);
      registerUserLocale(code);
    }

    _loaded = locales;
    return locales;
  } catch {
    return [];
  }
}

export function getUserLocales(): UserLocale[] {
  return _loaded;
}
