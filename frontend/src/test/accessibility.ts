import axe, { type Result, type RunOptions } from "axe-core";
import { expect } from "vitest";

const wcagOptions: RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
  },
  rules: {
    // jsdom has no layout engine, so axe cannot evaluate rendered color contrast.
    "color-contrast": { enabled: false },
  },
};

function describeViolation(violation: Result) {
  const targets = violation.nodes.flatMap((node) => node.target).join(", ");
  return `${violation.id}: ${violation.help} (${targets})`;
}

export async function expectNoAccessibilityViolations(container: HTMLElement) {
  const results = await axe.run(container, wcagOptions);
  expect(
    results.violations.map(describeViolation),
    "Expected the rendered interface to have no automatically detectable WCAG A/AA violations",
  ).toEqual([]);
}
