import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

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
  const controlProps = {
    ...children.props,
    "aria-describedby": describedBy,
    "aria-invalid": error === undefined ? children.props["aria-invalid"] : true,
    className: cn(
      isTextarea ? "min-h-24" : "h-11",
      children.props.className,
    ),
    id,
  };

  const control = children.type === "input"
    ? <Input {...controlProps as ComponentProps<"input">} />
    : children.type === "textarea"
      ? <Textarea {...controlProps as ComponentProps<"textarea">} />
      : cloneElement(children, controlProps);

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {description === undefined ? null : <small className="text-sm leading-5 text-muted-foreground" id={descriptionId}>{description}</small>}
      {error === undefined ? null : (
        <p className="text-sm font-medium text-destructive" id={errorId} role="alert">{error}</p>
      )}
    </div>
  );
}
