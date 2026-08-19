import { describe, expect, it } from "vitest";

import type { LocaleTree } from "./i18nTestHelpers";
import cs from "./locales/cs.json";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import fr from "./locales/fr.json";
import itLocale from "./locales/it.json";
import ptBR from "./locales/pt-BR.json";
import pt from "./locales/pt.json";
import ru from "./locales/ru.json";
import tr from "./locales/tr.json";
import zhCN from "./locales/zh-CN.json";

const LOCALES: Record<string, LocaleTree> = {
  en,
  es,
  pt,
  fr,
  de,
  it: itLocale,
  ru,
  "pt-BR": ptBR,
  "zh-CN": zhCN,
  cs,
  tr,
};

const REQUIRED_KEYS = [
  "pitchToken.accessibleName",
  "pitchToken.conditionValue",
  "pitchToken.adaptedToSlot",
  "pitchToken.fitUnavailable",
] as const;

function hasKey(tree: LocaleTree, dottedKey: string): boolean {
  let current: unknown = tree;

  for (const segment of dottedKey.split(".")) {
    if (
      typeof current !== "object" ||
      current === null ||
      !(segment in current)
    ) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" && current.trim().length > 0;
}

describe("PitchToken translations", () => {
  it("defines every accessible token phrase in all 11 locales", () => {
    const missing = Object.entries(LOCALES).flatMap(([locale, tree]) =>
      REQUIRED_KEYS.filter((key) => !hasKey(tree, key)).map(
        (key) => `${locale}: ${key}`,
      ),
    );

    expect(missing).toEqual([]);
  });
});
