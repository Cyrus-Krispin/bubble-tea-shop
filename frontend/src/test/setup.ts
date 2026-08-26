import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

class TestResizeObserver implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

globalThis.ResizeObserver = TestResizeObserver;
HTMLElement.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
});
