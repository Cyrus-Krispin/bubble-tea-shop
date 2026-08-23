import type { Meta, StoryObj } from "@storybook/react-vite";

import { Field } from "./Field";

const meta = {
  component: Field,
  parameters: {
    docs: {
      description: {
        component: "Connects a visible label, optional help text, and inline validation error to one form control.",
      },
    },
  },
  title: "Design System/Field",
} satisfies Meta<typeof Field>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <input name="productName" placeholder="Moonlit Milk Tea" />,
    description: "Use the customer-facing menu name.",
    id: "story-product-name",
    label: "Product name",
  },
};

export const Invalid: Story = {
  args: {
    children: <input name="sku" value="" readOnly />,
    error: "A SKU is required.",
    id: "story-product-sku",
    label: "SKU",
  },
};
