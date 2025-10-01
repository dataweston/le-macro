import * as React from "react";
import { clsx } from "clsx";

type SliderProps = React.InputHTMLAttributes<HTMLInputElement> & {
  onValueChange?: (value: number) => void;
};

export function Slider({ className, onValueChange, ...props }: SliderProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    onValueChange?.(value);
    props.onChange?.(event);
  };

  return (
    <input
      type="range"
      className={clsx(
        "h-1 w-full cursor-pointer appearance-none rounded-full bg-muted",
        className
      )}
      onChange={handleChange}
      {...props}
    />
  );
}
