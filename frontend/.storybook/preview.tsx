import type { Preview } from "@storybook/react-vite";

import "../src/components/ui/ui.css";
import "../src/index.css";

const preview: Preview = {
  decorators: [
    (Story) => (
      <div style={{ margin: "0 auto", maxWidth: "72rem", padding: "2rem" }}>
        <Story />
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
