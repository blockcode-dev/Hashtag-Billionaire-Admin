import { useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Spinner } from "./Spinner";

export type ComboboxValue = string | number;

export interface ComboboxOption<V extends ComboboxValue = ComboboxValue> {
  label: ReactNode;
  value: V;
  disabled?: boolean;
}

interface ComboboxProps<V extends ComboboxValue> {
  options: ComboboxOption<V>[];
  value?: V | null;
  onChange: (value: V | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  // Filter the list as the person types. Defaults to true.
  searchable?: boolean;
  // Server-side search: called with the typed text, and the list is shown as given.
  onSearch?: (text: string) => void;
  allowClear?: boolean;
  loading?: boolean;
  disabled?: boolean;
  emptyText?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  // Replaces the chevron at the end of the trigger.
  triggerIcon?: ReactNode;
  size?: "default" | "large";
  className?: string;
  style?: CSSProperties;
}

const labelText = (label: ReactNode) => (typeof label === "string" || typeof label === "number" ? String(label) : "");

// Select with optional type-to-filter, built on Popover + Command.
export function Combobox<V extends ComboboxValue>({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  searchable = true,
  onSearch,
  allowClear,
  loading,
  disabled,
  emptyText = "No results",
  onOpenChange,
  triggerIcon,
  size = "default",
  className,
  style,
}: ComboboxProps<V>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const hasValue = value !== undefined && value !== null && value !== "";

  const changeOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between px-3 font-normal",
            size === "large" && "h-10",
            !selected && "text-muted-foreground",
            className,
          )}
          style={style}
        >
          <span className="truncate">{selected ? selected.label : hasValue ? String(value) : placeholder}</span>
          <span className="ml-2 flex shrink-0 items-center gap-1">
            {loading && <Spinner size="small" />}
            {allowClear && hasValue && !disabled ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(undefined);
                  }
                }}
              >
                <X className="size-3.5" />
              </span>
            ) : (
              (triggerIcon ?? <ChevronsUpDown className="size-4 opacity-50" />)
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-48 p-0" align="start">
        <Command shouldFilter={!onSearch}>
          {searchable && (
            <CommandInput placeholder={searchPlaceholder} onValueChange={onSearch} />
          )}
          <CommandList>
            {loading && !options.length ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={String(option.value)}
                  value={String(option.value)}
                  keywords={[labelText(option.label)]}
                  disabled={option.disabled}
                  onSelect={() => {
                    onChange(option.value);
                    changeOpen(false);
                  }}
                >
                  <Check className={cn("size-4", option.value === value ? "opacity-100" : "opacity-0")} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
