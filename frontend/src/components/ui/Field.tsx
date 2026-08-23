import { cloneElement, type ReactElement, type ReactNode } from "react";

type FieldControlProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "false" | "true";
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

  return (
    <div className="ui-field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, {
        "aria-describedby": describedBy,
        "aria-invalid": error === undefined ? children.props["aria-invalid"] : true,
        id,
      })}
      {description === undefined ? null : <small id={descriptionId}>{description}</small>}
      {error === undefined ? null : (
        <p className="ui-field__error" id={errorId} role="alert">{error}</p>
      )}
    </div>
  );
}
