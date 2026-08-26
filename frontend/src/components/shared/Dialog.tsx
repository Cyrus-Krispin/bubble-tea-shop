import type { ReactElement, ReactNode } from "react";

import {
  Dialog as DialogRoot,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";

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
    <DialogRoot onOpenChange={onOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[min(90vh,48rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">{children}</div>
      </DialogContent>
    </DialogRoot>
  );
}
