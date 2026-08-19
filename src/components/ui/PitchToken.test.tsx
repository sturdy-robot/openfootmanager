import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { condBgColor } from "../../lib/playerConditionDisplay";
import { PitchToken, type PitchFitTone } from "./PitchToken";

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

const FIT_LABELS: Record<PitchFitTone, string> = {
  exact: "Natural fit",
  adapted: "Adapted to slot",
  out: "Out of position",
  empty: "Slot fit unavailable",
};

function accessibleName(
  name: string,
  condition: number,
  fitTone: PitchFitTone,
): string {
  return `${name} · Condition ${condition}% · ${FIT_LABELS[fitTone]}`;
}

function renderToken(options: {
  name?: string;
  condition: number;
  fitTone: PitchFitTone;
}) {
  const name = options.name ?? "Alex Lane";
  render(
    <PitchToken
      name={name}
      positionAbbr="CM"
      position="CentralMidfielder"
      ovr={78}
      condition={options.condition}
      fitTone={options.fitTone}
    />,
  );

  return screen.getByRole("group", {
    name: accessibleName(name, options.condition, options.fitTone),
  });
}

function conditionBar(group: HTMLElement, condition: number): HTMLElement {
  return within(group).getByRole("progressbar", {
    name: `Condition ${condition}%`,
  });
}

describe("PitchToken condition semantics", () => {
  it("uses the shared 50 and 75 boundaries, including conditions 0 and 100", () => {
    const cases = [
      { condition: 0, colour: "bg-red-500" },
      { condition: 49, colour: "bg-red-500" },
      { condition: 50, colour: "bg-amber-500" },
      { condition: 74, colour: "bg-amber-500" },
      { condition: 75, colour: "bg-primary-500" },
      { condition: 100, colour: "bg-primary-500" },
    ];

    for (const { condition, colour } of cases) {
      const name = `Player ${condition}`;
      const group = renderToken({ name, condition, fitTone: "exact" });
      const bar = conditionBar(group, condition);

      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "100");
      expect(bar).toHaveAttribute("aria-valuenow", String(condition));
      expect(bar).toHaveStyle({ width: `${condition}%` });
      expect(bar).toHaveClass(colour);
      expect(bar).toHaveClass(...condBgColor(condition).split(" "));
    }
  });

  it("keeps condition length and colour identical across every fit tone", () => {
    const bars = (["exact", "adapted", "out", "empty"] as const).map(
      (fitTone) => {
        const group = renderToken({
          name: `Player ${fitTone}`,
          condition: 100,
          fitTone,
        });
        return conditionBar(group, 100);
      },
    );

    for (const bar of bars) {
      expect(bar).toHaveStyle({ width: "100%" });
      expect(bar).toHaveClass("bg-primary-500");
    }
    expect(new Set(bars.map((bar) => bar.className)).size).toBe(1);
  });

  it("keeps the fit ring dependent on fit alone in both themes", () => {
    const expectedLightRing: Record<PitchFitTone, string> = {
      exact: "ring-success-400",
      adapted: "ring-accent-400",
      out: "ring-red-400",
      empty: "ring-white/25",
    };

    for (const fitTone of ["exact", "adapted", "out", "empty"] as const) {
      const ringClasses = [0, 100].map((condition) => {
        const group = renderToken({
          name: `${fitTone} ${condition}`,
          condition,
          fitTone,
        });
        const ringElement = [...group.querySelectorAll<HTMLElement>("[class]")].find(
          (element) => element.className.includes(expectedLightRing[fitTone]),
        );

        expect(
          ringElement,
          `${fitTone} must keep its fit ring at condition ${condition}`,
        ).toBeDefined();
        expect(ringElement?.className).toMatch(/dark:ring-/);
        return ringElement?.className;
      });

      expect(ringClasses[0]).toBe(ringClasses[1]);
    }
  });

  it("gives a no-avatar token one exact accessible name and matching tooltip", () => {
    const label = accessibleName("Alex Lane", 74, "adapted");
    const group = renderToken({ condition: 74, fitTone: "adapted" });

    expect(group).toHaveAttribute("title", label);
    expect(within(group).getByText("AL")).toBeInTheDocument();
    expect(within(group).queryByRole("img", { name: "Alex Lane" })).not.toBeInTheDocument();
  });

  it("gives every shared condition fill a dark-theme partner", () => {
    for (const condition of [0, 50, 75, 100]) {
      expect(condBgColor(condition), `condition ${condition}`).toMatch(/(?:^| )dark:bg-/);
    }
  });
});
