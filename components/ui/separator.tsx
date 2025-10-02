import * as React from "react";
import { clsx } from "clsx";

type SeparatorProps = React.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical";
};

export function Separator({
  orientation = "horizontal",
  className,
  ...props
}: SeparatorProps) {
  return (
    <div
      role="separator"
      className={clsx(
        orientation === "horizontal"
          ? "my-4 h-px w-full bg-border"
          : "mx-4 h-full w-px bg-border",
        className
      )}
      {...props}
    />
  );
}
