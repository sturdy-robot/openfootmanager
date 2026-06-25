import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { changeAppLanguage, i18nReady } from "./index";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { getUserLocales, loadUserLocales } from "./userLocales";

describe("loadUserLocales", () => {
  beforeEach(async () => {
    await i18nReady;
  });

  afterEach(async () => {
    // Remove the resource bundle so the next test can re-add fresh content.
    // Do NOT remove cs-CZ from _userLocaleCodes or lu.supportedLngs — in
    // production user locales are registered once for the app lifetime, and
    // the early-return guard in registerUserLocale relies on this invariant.
    i18n.removeResourceBundle("cs-CZ", "translation");
    await changeAppLanguage("en");
  });

  it("returns empty array and does not throw when invoke fails", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Tauri unavailable"));

    const result = await loadUserLocales();

    expect(result).toEqual([]);
  });

  it("registers user locale bundle and extends supportedLngs and languageUtils", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { code: "cs-CZ", content: { menu: { newGame: "Nová hra" } } },
    ]);

    const result = await loadUserLocales();

    expect(result).toHaveLength(1);
    expect(result[0].code).toBe("cs-CZ");
    expect(i18n.hasResourceBundle("cs-CZ", "translation")).toBe(true);
    expect(i18n.options.supportedLngs).toContain("cs-CZ");
    // LanguageUtil's internal cache must also be updated so translation lookups work
    const lu = (i18n.services as unknown as Record<string, unknown>)
      .languageUtils as { supportedLngs: string[] | false } | undefined;
    expect(lu?.supportedLngs).toContain("cs-CZ");
  });

  it("exposes user locales via getUserLocales() after loading", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { code: "cs-CZ", content: { menu: { newGame: "Nová hra" } } },
    ]);

    await loadUserLocales();

    const locales = getUserLocales();
    expect(locales).toHaveLength(1);
    expect(locales[0].code).toBe("cs-CZ");
  });

  it("changeAppLanguage uses user locale code directly and builds correct language hierarchy", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([
      { code: "cs-CZ", content: { menu: { newGame: "Nová hra" } } },
    ]);

    await loadUserLocales();
    const resolved = await changeAppLanguage("cs-CZ");

    expect(resolved).toBe("cs-CZ");
    expect(i18n.language).toBe("cs-CZ");
    // i18n.languages drives actual translation lookups; cs-CZ must be in the hierarchy
    expect(i18n.languages).toContain("cs-CZ");
  });

  it("changeAppLanguage normalizes codes not in the user locale registry", async () => {
    // "cimode" is always added to i18n.options.supportedLngs by i18next at init,
    // but it is NOT a user-registered locale. It must be normalized, not passed through.
    const resolved = await changeAppLanguage("cimode");

    expect(resolved).toBe("en");
    expect(i18n.language).toBe("en");
  });
});
