import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { LoaderCircle } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-input bg-background text-foreground hover:border-primary/70 hover:bg-interactive-hover aria-expanded:border-interactive-selected-border aria-expanded:bg-interactive-selected aria-expanded:text-interactive-selected-foreground dark:bg-input/30",
        secondary:
          "bg-secondary text-secondary-foreground hover:border-primary/60 hover:bg-secondary-hover aria-expanded:border-interactive-selected-border aria-expanded:bg-interactive-selected aria-expanded:text-interactive-selected-foreground",
        ghost:
          "text-foreground hover:bg-interactive-hover hover:ring-1 hover:ring-primary/40 aria-expanded:bg-interactive-selected aria-expanded:text-interactive-selected-foreground aria-expanded:ring-1 aria-expanded:ring-primary/70",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/70 hover:bg-destructive/30 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40",
        danger:
          "border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/70 hover:bg-destructive/30 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        regular:
          "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        compact:
          "h-9 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "regular",
    },
  }
)

function Button({
  children,
  className,
  disabled = false,
  isLoading = false,
  loadingLabel = "Working",
  variant = "default",
  size = "regular",
  asChild = false,
  type = "button",
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    isLoading?: boolean
    loadingLabel?: string
}) {
  const controlClassName = cn(buttonVariants({ variant, size, className }))

  if (asChild) {
    const unavailable = disabled || isLoading

    return (
      <Slot.Root
        aria-busy={isLoading || undefined}
        aria-disabled={unavailable || undefined}
        data-disabled={unavailable || undefined}
        data-slot="button"
        data-variant={variant}
        data-size={size}
        {...props}
        className={cn(controlClassName, unavailable && "pointer-events-none opacity-50")}
        onClick={(event) => {
          if (unavailable) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          props.onClick?.(event as React.MouseEvent<HTMLButtonElement>)
        }}
        tabIndex={unavailable ? -1 : props.tabIndex}
      >
        {children}
      </Slot.Root>
    )
  }

  return (
    <button
      aria-busy={isLoading || undefined}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      disabled={disabled || isLoading}
      type={type}
      className={controlClassName}
      {...props}
    >
      {isLoading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
      {isLoading ? <span aria-hidden="true">{children}</span> : children}
      {isLoading ? <span className="sr-only">{loadingLabel}</span> : null}
    </button>
  )
}

export { Button }
