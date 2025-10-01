import * as React from "react";
import { clsx } from "clsx";

type SwitchProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label className={clsx("inline-flex cursor-pointer items-center", className)}>
      <input
        ref={ref}
        type="checkbox"
        className="sr-only"
        {...props}
      />
      <span
        className={clsx(
          "relative inline-flex h-5 w-9 items-center rounded-full bg-muted transition",
          props.checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={clsx(
            "h-4 w-4 rounded-full bg-background shadow transition",
            props.checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </span>
    </label>
  )
);
Switch.displayName = "Switch";
