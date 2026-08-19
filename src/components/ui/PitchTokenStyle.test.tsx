import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PitchToken } from "./PitchToken";
import { DEFAULT_SETTINGS, useSettingsStore } from "../../store/settingsStore";
import type { TacticsTokenStyle } from "../../store/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === "pitchToken.conditionValue") {
        return `Condition ${String(options?.condition)}%`;
      }
      if (key === "pitchToken.accessibleName") {
        return `${String(options?.name)} · ${String(options?.condition)} · ${String(options?.fit)}`;
      }
      if (key === "pitchToken.adaptedToSlot") return "Adapted to slot";
      if (key === "pitchToken.fitUnavailable") return "Slot fit unavailable";
      if (key === "squad.naturalFit") return "Natural fit";
      if (key === "squad.outOfPosition") return "Out of position";
      return key;
    },
  }),
}));

/**
 * Issue #429 asked for player faces and kit graphics to be taken off the
 * tactics pitch. The maintainer disagreed with removal — portraits had only
 * just arrived and people like them — and named the real problem: a token draws
 * a face *and* a shirt at once, two pictures of the same player competing for
 * the same forty-odd pixels.
 *
 * So the art becomes a setting with three mutually exclusive treatments. The
 * rule that has to hold in all of them is that a token never draws two.
 *
 * Both the generated avatar and the kit are inline SVGs, so "how many pictures"
 * is simply how many SVGs the token contains. The plain "#7" shirt number only
 * appears when no kit is drawn, which is what separates portrait from shirt.
 */
function renderToken(options: { name?: string; hasFace?: boolean } = {}) {
  const name = options.name ?? "Alex Lane";

  render(
    <PitchToken
      avatar={
        options.hasFace === false
          ? { full_name: name, match_name: name }
          : {
              full_name: name,
              match_name: name,
              media: { face: "data:image/png;base64,AAAA" },
            }
      }
      condition={80}
      fitTone="exact"
      jersey={{
        pattern: "Solid",
        primaryColor: "#1a3a6b",
        secondaryColor: "#ffffff",
        number: 7,
      }}
      name={name}
      ovr={78}
      position="CentralMidfielder"
      positionAbbr="CM"
    />,
  );

  return screen.getByRole("group", {
    name: `${name} · Condition 80% · Natural fit`,
  });
}

function pictureCount(group: HTMLElement): number {
  return group.querySelectorAll("svg").length;
}

function setStyle(style: TacticsTokenStyle): void {
  useSettingsStore.setState((state) => ({
    settings: { ...state.settings, tactics_token_style: style },
  }));
}

describe("pitch token art style", () => {
  beforeEach(() => {
    setStyle("portrait");
  });

  it("defaults to portraits before any settings file is read", () => {
    // Asserted against the store's own defaults, not the value beforeEach set,
    // or this would only be checking the test harness.
    expect(DEFAULT_SETTINGS.tactics_token_style).toBe("portrait");
  });

  it("never draws a face and a kit at the same time", () => {
    // The whole of #429, in one assertion, across every mode.
    for (const style of ["portrait", "shirt", "initials"] as const) {
      setStyle(style);
      const group = renderToken({ name: `Player ${style}` });

      expect(pictureCount(group), style).toBeLessThanOrEqual(1);
    }
  });

  it("draws the portrait and falls back to a plain shirt number", () => {
    const group = renderToken();

    expect(pictureCount(group)).toBe(1);
    expect(within(group).getByText("#7")).toBeInTheDocument();
  });

  it("draws the kit instead, which carries the number itself", () => {
    setStyle("shirt");
    const group = renderToken();

    expect(pictureCount(group)).toBe(1);
    expect(within(group).queryByText("#7")).not.toBeInTheDocument();
  });

  it("draws no picture at all in initials mode, even when a face exists", () => {
    setStyle("initials");
    const group = renderToken();

    expect(pictureCount(group)).toBe(0);
    expect(within(group).getByText("AL")).toBeInTheDocument();
    // A number is how you find a player on a crowded board; dropping both
    // pictures must not take the number with it.
    expect(within(group).getByText("#7")).toBeInTheDocument();
  });

  it("keeps name, position, rating, fit and condition in every mode", () => {
    for (const style of ["portrait", "shirt", "initials"] as const) {
      setStyle(style);
      const group = renderToken({ name: `Player ${style}` });

      expect(within(group).getByText("CM"), style).toBeInTheDocument();
      expect(within(group).getByText("78"), style).toBeInTheDocument();
      expect(
        within(group).getByRole("progressbar", { name: "Condition 80%" }),
        style,
      ).toBeInTheDocument();
      expect(group).toHaveAccessibleName(
        `Player ${style} · Condition 80% · Natural fit`,
      );
    }
  });
});
