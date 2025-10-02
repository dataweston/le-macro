import * as React from "react";
import { clsx } from "clsx";

type ScrollAreaProps = React.HTMLAttributes<HTMLDivElement>;

export function ScrollArea({ className, ...props }: ScrollAreaProps) {
  return (
    <div
      className={clsx("overflow-auto", className)}
      {...props}
    />
  );
}
