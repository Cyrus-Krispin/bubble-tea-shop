import { cloneElement, type ReactElement, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Label } from "../ui/label";

type FieldControlProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "false" | "true";
  className?: string;
  id?: string;
};

type FieldProps = {
  children: ReactElement<FieldControlProps>;
  description?: ReactNode;
  error?: ReactNode;
  id: string;
  label: ReactNode;
};

export function Field({ children, description, error, id, label }: FieldProps) {
  const descriptionId = description === undefined ? undefined : `${id}-description`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [children.props["aria-describedby"], descriptionId, errorId]
    .filter(Boolean)
    .join(" ") || undefined;
  const isTextarea = children.type === "textarea";

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, {
        "aria-describedby": describedBy,
        "aria-invalid": error === undefined ? children.props["aria-invalid"] : true,
        className: cn(
          "w-full rounded-lg border border-input bg-input/30 px-3 text-base text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          isTextarea ? "min-h-24 py-2" : "h-11",
          children.props.className,
        ),
        id,
      })}
      {description === undefined ? null : <small className="text-sm leading-5 text-muted-foreground" id={descriptionId}>{description}</small>}
      {error === undefined ? null : (
        <p className="text-sm font-medium text-destructive" id={errorId} role="alert">{error}</p>
      )}
    </div>
  );
}
