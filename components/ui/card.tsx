import * as React from "react";
import { clsx } from "clsx";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-lg border border-border bg-background shadow-sm",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={clsx("border-b border-border px-4 py-3", className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: CardProps) {
  return <h3 className={clsx("text-lg font-semibold", className)} {...props} />;
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={clsx("px-4 py-3", className)} {...props} />;
}
