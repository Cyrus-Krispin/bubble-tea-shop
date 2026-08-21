import type { Meta, StoryObj } from "@storybook/react-vite";

import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { ProblemState } from "./ProblemState";

const meta = {
  component: ProblemState,
  parameters: {
    docs: {
      description: {
        component: "Recoverable problem feedback and keyboard-accessible confirmation dialogs for operational workflows.",
      },
    },
  },
  title: "Design System/Feedback and overlays",
} satisfies Meta<typeof ProblemState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecoverableProblem: Story = {
  args: {
    message: "We couldn’t load the menu. Your cart is unchanged.",
    onRetry: () => undefined,
    title: "Menu unavailable",
  },
};

export const ConfirmationDialog: Story = {
  args: RecoverableProblem.args,
  render: () => (
    <Dialog
      description="The manager will immediately lose staff access. Historical activity remains."
      title="Deactivate manager?"
      trigger={<Button variant="danger">Deactivate</Button>}
    >
      <Button variant="danger">Confirm deactivation</Button>
    </Dialog>
  ),
};
