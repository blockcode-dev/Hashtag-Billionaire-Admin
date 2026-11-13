import { useMemo, useState } from "react";
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

export interface MultiComboboxOption<V extends string | number> {
  value: V;
  label: string;
}

interface MultiComboboxProps<V extends string | number> {
  id?: string;
  options: MultiComboboxOption<V>[];
  value: V[];
  onChange: (value: V[]) => void;
  // The trigger's text with nothing chosen.
  placeholder?: string;
  searchPlaceholder?: string;
  // Singular and plural: the trigger reads "3 categories chosen".
  noun: [string, string];
  // The chip for a chosen value that isn't among the options (gone, or not loaded yet).
  missingLabel?: (value: V) => string;
  // Long lists show this many matches at a time; typing narrows them.
  maxResults?: number;
  loading?: boolean;
  disabled?: boolean;
  "aria-describedby"?: string;
}

// Searchable multi-select built on Popover + Command, like Combobox. The list stays open between
// picks, and the chosen values show as removable chips below. It filters on its own and shows at
// most maxResults rows, so lists of thousands stay quick.
export function MultiCombobox<V extends string | number>({
  id,
  options,
  value,
  onChange,
  placeholder = "None chosen",
  searchPlaceholder = "Search…",
  noun,
  missingLabel,
  maxResults = 100,
  loading,
  disabled,
  "aria-describedby": describedBy,
}: MultiComboboxProps<V>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const chosen = useMemo(() => new Set(value), [value]);
  const labels = useMemo(() => new Map(options.map((option) => [option.value, option.label])), [options]);
  const haystack = useMemo(
    () => options.map((option) => ({ option, text: `${option.label} ${option.value}`.toLowerCase() })),
    [options],
  );

  const term = search.trim().toLowerCase();
  const matches = useMemo(
    () => (term ? haystack.filter((entry) => entry.text.includes(term)) : haystack),
    [haystack, term],
  );
  const shown = matches.slice(0, maxResults);

  const labelOf = (v: V) => labels.get(v) ?? missingLabel?.(v) ?? String(v);
  const toggle = (v: V) => onChange(chosen.has(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-describedby={describedBy}
            disabled={disabled}
            className={cn("w-full justify-between px-3 font-normal", !value.length && "text-muted-foreground")}
          >
            <span className="truncate">
              {value.length ? `${value.length} ${value.length === 1 ? noun[0] : noun[1]} chosen` : placeholder}
            </span>
            <span className="ml-2 flex shrink-0 items-center gap-1">
              {loading && <Spinner size="small" />}
              <ChevronsUpDown className="size-4 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
            <CommandList>
              {loading && !options.length ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : (
                <CommandEmpty>{options.length ? "Nothing matches." : "Nothing to choose from."}</CommandEmpty>
              )}
              <CommandGroup>
                {shown.map(({ option }) => (
                  <CommandItem key={String(option.value)} value={String(option.value)} onSelect={() => toggle(option.value)}>
                    <Check className={cn("size-4", chosen.has(option.value) ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {matches.length > shown.length && (
              <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                Showing {shown.length} of {matches.length.toLocaleString()}. Type to narrow the list.
              </p>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((v) => (
            <span
              key={String(v)}
              className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs text-foreground"
            >
              <span className="truncate">{labelOf(v)}</span>
              <button
                type="button"
                className="shrink-0 rounded text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label={`Remove ${labelOf(v)}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <Button type="button" variant="ghost" size="xs" disabled={disabled} onClick={() => onChange([])}>
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
