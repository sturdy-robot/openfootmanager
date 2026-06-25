import { describe, expect, it } from "vitest";

import {
  collectMissingKeys,
  collectUntranslatedKeys,
  type LocaleTree,
} from "./i18nTestHelpers";
import INTENTIONAL_SAME from "./INTENTIONAL_SAME.json";

const allModules = import.meta.glob<{ default: Record<string, unknown> }>(
  "./locales/*/*.json",
  { eager: true },
);

function buildBundle(code: string): LocaleTree {
  const prefix = `./locales/${code}/`;
  return Object.fromEntries(
    Object.entries(allModules)
      .filter(([path]) => path.startsWith(prefix))
      .map(([path, module]) => [path.slice(prefix.length, -5), module.default]),
  ) as LocaleTree;
}

const en = buildBundle("en");

const LOCALES: Record<string, LocaleTree> = {
  de: buildBundle("de"),
  es: buildBundle("es"),
  fr: buildBundle("fr"),
  it: buildBundle("it"),
  pt: buildBundle("pt"),
  "pt-BR": buildBundle("pt-BR"),
  ru: buildBundle("ru"),
  "zh-CN": buildBundle("zh-CN"),
};

describe("locale coverage", () => {
  it("keeps every supported locale aligned with English translation keys", () => {
    const missingKeysByLocale = Object.entries(LOCALES).reduce<
      Record<string, string[]>
    >((accumulator, [localeCode, translations]) => {
      const missingKeys = collectMissingKeys(en, translations);

      if (missingKeys.length > 0) {
        accumulator[localeCode] = missingKeys;
      }

      return accumulator;
    }, {});

    expect(missingKeysByLocale).toEqual({});
  });

  it("has no untranslated strings (only explicitly allowed same-language exceptions)", () => {
    const intentionalSame = INTENTIONAL_SAME as Record<string, string[]>;
    const globalExceptions = new Set(intentionalSame["global"] ?? []);

    const violationsByLocale = Object.entries(LOCALES).reduce<
      Record<string, string[]>
    >((accumulator, [localeCode, translations]) => {
      const localeExceptions = new Set(intentionalSame[localeCode] ?? []);
      const untranslated = collectUntranslatedKeys(en, translations);
      const violations = untranslated.filter(
        (key) => !globalExceptions.has(key) && !localeExceptions.has(key),
      );

      if (violations.length > 0) {
        accumulator[localeCode] = violations;
      }

      return accumulator;
    }, {});

    expect(violationsByLocale).toEqual({});
  });
});
