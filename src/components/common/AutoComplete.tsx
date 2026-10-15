import { useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export interface AutoCompleteOption {
  value: string;
  label?: ReactNode;
}

interface AutoCompleteProps {
  value: string;
  options: AutoCompleteOption[];
  // Called on every keystroke with the typed text.
  onChange: (text: string) => void;
  // Called when a suggestion is picked.
  onSelect?: (value: string) => void;
  // Which options to show for the typed text. Defaults to "value contains text".
  filterOption?: (text: string, option: AutoCompleteOption) => boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  // Caps the suggestion list so long option lists stay fast.
  maxResults?: number;
}

const defaultFilter = (text: string, option: AutoCompleteOption) =>
  option.value.toLowerCase().includes(text.toLowerCase());

// Free-text input with a list of suggestions; any text is allowed.
export function AutoComplete({
  value,
  options,
  onChange,
  onSelect,
  filterOption = defaultFilter,
  placeholder,
  className,
  style,
  maxResults = 50,
}: AutoCompleteProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(
    () => options.filter((o) => filterOption(value || "", o)).slice(0, maxResults),
    [options, value, filterOption, maxResults],
  );
  const showList = open && matches.length > 0;

  const pick = (option: AutoCompleteOption) => {
    onChange(option.value);
    onSelect?.(option.value);
    setOpen(false);
  };

  return (
    <Popover open={showList} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          value={value}
          placeholder={placeholder}
          className={className}
          style={style}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (!showList) {
              if (e.key === "ArrowDown") setOpen(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % matches.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + matches.length) % matches.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              pick(matches[active] ?? matches[0]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="max-h-64 w-(--radix-popover-trigger-width) overflow-y-auto p-1"
        // Keep typing focus in the input.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ul id={listId} role="listbox">
          {matches.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={i === active}
              className={cn(
                "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
                i === active && "bg-accent text-accent-foreground",
              )}
              onMouseEnter={() => setActive(i)}
              // mousedown, so the input's blur doesn't close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(option);
              }}
            >
              {option.label ?? option.value}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
