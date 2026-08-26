import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";

type SelectFieldOption = {
  disabled?: boolean;
  label: ReactNode;
  value: string;
};

type SelectFieldProps = {
  description?: ReactNode;
  disabled?: boolean;
  emptyLabel?: ReactNode;
  error?: ReactNode;
  id: string;
  label: ReactNode;
  name?: string;
  onValueChange: (value: string) => void;
  options: readonly SelectFieldOption[];
  placeholder?: string;
  required?: boolean;
  value: string;
};

const EMPTY_VALUE = "__select-field-empty__";

export function SelectField({
  description,
  disabled,
  emptyLabel,
  error,
  id,
  label,
  name,
  onValueChange,
  options,
  placeholder = "Select an option",
  required,
  value,
}: SelectFieldProps) {
  const descriptionId = description === undefined ? undefined : `${id}-description`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        disabled={disabled}
        name={name}
        onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_VALUE ? "" : nextValue)}
        required={required}
        value={value === "" && emptyLabel !== undefined ? EMPTY_VALUE : value}
      >
        <SelectTrigger
          aria-describedby={describedBy}
          aria-invalid={error === undefined ? undefined : true}
          className="h-11 w-full"
          id={id}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="start" position="popper">
          {emptyLabel === undefined ? null : (
            <SelectItem value={EMPTY_VALUE}>{emptyLabel}</SelectItem>
          )}
          {options.map((option) => (
            <SelectItem disabled={option.disabled} key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description === undefined ? null : (
        <small className="text-sm leading-5 text-muted-foreground" id={descriptionId}>
          {description}
        </small>
      )}
      {error === undefined ? null : (
        <p className="text-sm font-medium text-destructive" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export type { SelectFieldOption };
