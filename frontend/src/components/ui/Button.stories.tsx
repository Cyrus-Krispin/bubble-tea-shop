import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./button";

const meta = {
  args: { children: "Save product" },
  component: Button,
  parameters: {
    docs: {
      description: {
        component: "The shared action control with consistent variants, sizes, disabled state, and accessible loading announcements.",
      },
    },
  },
  title: "Design System/Button",
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: "secondary" } };

export const Danger: Story = { args: { children: "Deactivate manager", variant: "danger" } };

export const Compact: Story = { args: { children: "Refresh", size: "compact", variant: "secondary" } };

export const Loading: Story = {
  args: { isLoading: true, loadingLabel: "Saving product" },
};
