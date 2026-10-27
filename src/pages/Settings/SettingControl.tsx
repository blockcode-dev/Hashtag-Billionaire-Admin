import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordInput } from "@/components/common/PasswordInput";
import type { Setting } from "@/services/Api/SettingsApi";

const HEX = /^#[0-9a-f]{6}$/i;

interface SettingControlProps {
  setting: Setting;
  // The field's text: "" when empty. Booleans are "true" or "false".
  value: string;
  onChange: (value: string) => void;
  id: string;
  invalid?: boolean;
  describedBy?: string;
}

// The input for one setting, chosen by its type (docs/admin-settings.md, "Controls by type").
export function SettingControl({ setting, value, onChange, id, invalid, describedBy }: SettingControlProps) {
  const common = {
    id,
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
  };
  const placeholder = setting.default ?? undefined;

  if (setting.secret) {
    return (
      <PasswordInput
        {...common}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        placeholder={setting.required ? "Required" : "Not set"}
      />
    );
  }

  switch (setting.type) {
    case "boolean":
      return (
        <div className="flex h-9 items-center gap-2">
          <Switch
            id={id}
            checked={value === "true"}
            onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
            aria-describedby={describedBy}
          />
          <span className="text-sm text-muted-foreground">{value === "true" ? "On" : "Off"}</span>
        </div>
      );

    case "enum":
      return (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger {...common} className="w-full sm:w-64">
            <SelectValue placeholder={placeholder ?? "Choose…"} />
          </SelectTrigger>
          <SelectContent>
            {setting.options?.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "color": {
      const swatch = HEX.test(value) ? value : placeholder && HEX.test(placeholder) ? placeholder : "#000000";
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label={`Pick ${setting.label}`}
            value={swatch.toLowerCase()}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-background p-1"
          />
          <Input
            {...common}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={7}
            spellCheck={false}
            className="w-32 font-mono"
          />
        </div>
      );
    }

    case "integer":
    case "number":
      return (
        <Input
          {...common}
          type="number"
          inputMode={setting.type === "integer" ? "numeric" : "decimal"}
          min={setting.min}
          max={setting.max}
          step={setting.type === "integer" ? 1 : "any"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-40"
        />
      );

    case "code2":
      return (
        <Input
          {...common}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase().slice(0, 2))}
          maxLength={2}
          placeholder={placeholder}
          spellCheck={false}
          className="w-20 font-mono uppercase"
        />
      );

    case "url":
    case "email":
      return (
        <Input
          {...common}
          type={setting.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? (setting.type === "url" ? "https://…" : undefined)}
          spellCheck={false}
        />
      );

    case "sender":
      return (
        <Input
          {...common}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Name <address@example.com>"}
          spellCheck={false}
        />
      );

    case "hosts":
      return (
        <Input
          {...common}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "images.example.com, cdn.example.com"}
          spellCheck={false}
        />
      );

    default:
      return (
        <Input {...common} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      );
  }
}
