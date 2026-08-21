import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  size?: "compact" | "regular";
  variant?: "primary" | "secondary" | "danger";
};

export function Button({
  children,
  className,
  disabled = false,
  isLoading = false,
  loadingLabel = "Working",
  size = "regular",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = ["ui-button", `ui-button--${variant}`, `ui-button--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      aria-busy={isLoading || undefined}
      className={classes}
      disabled={disabled || isLoading}
      type={type}
    >
      {isLoading ? <span className="ui-spinner" aria-hidden="true" /> : null}
      <span aria-hidden={isLoading || undefined}>{children}</span>
      {isLoading ? <span className="visually-hidden">{loadingLabel}</span> : null}
    </button>
  );
}
