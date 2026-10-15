import type { ComponentProps } from "react";
import { cn } from "cn";

type CheckboxProps = Omit<ComponentProps<"input">, "type"> & {
  indeterminate?: boolean;
};

// Native checkbox styled to match the inputs, with an "indeterminate" state.
export function Checkbox({ indeterminate = false, className, ...props }: CheckboxProps) {
  return (
    <input
      type="checkbox"
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      className={cn("size-4 cursor-pointer rounded border-input accent-primary align-middle", className)}
      {...props}
    />
  );
}
