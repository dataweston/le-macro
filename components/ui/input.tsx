import * as React from "react";
import { clsx } from "clsx";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={clsx(
          "flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
