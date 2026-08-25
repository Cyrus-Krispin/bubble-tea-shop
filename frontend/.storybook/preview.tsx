import type { Preview } from "@storybook/react-vite";

import "../src/components/ui/ui.css";
import "../src/index.css";

document.documentElement.classList.add("dark");

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className="dark min-h-screen bg-background p-8 text-foreground">
        <div className="mx-auto max-w-6xl">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    a11y: { test: "error" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  tags: ["autodocs"],
};

export default preview;
