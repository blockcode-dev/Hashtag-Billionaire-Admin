import { useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";

type SearchInputProps = Omit<ComponentProps<"input">, "size" | "prefix"> & {
  // Icon at the start of the field; defaults to a search icon. Pass null for none.
  prefix?: ReactNode;
  // Shows an × that empties the field (it fires onChange with "").
  allowClear?: boolean;
  onPressEnter?: (e: KeyboardEvent<HTMLInputElement>) => void;
  size?: "default" | "large";
  wrapperClassName?: string;
};

export function SearchInput({
  prefix,
  allowClear,
  onPressEnter,
  size = "default",
  className,
  wrapperClassName,
  onKeyDown,
  onChange,
  style,
  ...props
}: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const icon = prefix === undefined ? <Search className="size-4" /> : prefix;
  // Tracks whether an uncontrolled field has text, so the × only shows when useful.
  const [typed, setTyped] = useState(Boolean(props.defaultValue));
  const hasValue = props.value !== undefined ? String(props.value ?? "") !== "" : typed;

  const clear = () => {
    const input = ref.current;
    if (!input) return;
    // Set the value the way React expects so controlled and uncontrolled inputs both see it.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  };

  return (
    <div className={cn("relative flex w-full items-center", wrapperClassName)} style={style}>
      {icon && (
        <span className="pointer-events-none absolute left-3 flex text-muted-foreground">{icon}</span>
      )}
      <Input
        ref={ref}
        className={cn(icon && "pl-9", allowClear && "pr-8", size === "large" && "h-10 text-base md:text-sm", className)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onPressEnter?.(e);
          onKeyDown?.(e);
        }}
        onChange={(e) => {
          setTyped(e.target.value !== "");
          onChange?.(e);
        }}
        {...props}
      />
      {allowClear && hasValue && (
        <button
          type="button"
          aria-label="Clear"
          onClick={clear}
          className="absolute right-2 flex rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
