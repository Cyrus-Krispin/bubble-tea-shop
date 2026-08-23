import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactElement, ReactNode } from "react";

type DialogProps = {
  children: ReactNode;
  description: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  title: ReactNode;
  trigger: ReactElement;
};

export function Dialog({
  children,
  description,
  onOpenChange,
  open,
  title,
  trigger,
}: DialogProps) {
  return (
    <DialogPrimitive.Root onOpenChange={onOpenChange} open={open}>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="ui-dialog-overlay" />
        <DialogPrimitive.Content className="ui-dialog-content">
          <div className="ui-dialog-heading">
            <div>
              <DialogPrimitive.Title className="ui-dialog-title">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="ui-dialog-description">
                {description}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close aria-label="Close dialog" className="ui-dialog-close">
              <span aria-hidden="true">×</span>
            </DialogPrimitive.Close>
          </div>
          <div className="ui-dialog-body">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
