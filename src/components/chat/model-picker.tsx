"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatModelLabel } from "@/lib/model-labels";

export function ModelPicker({
  models,
  value,
  onChange,
  disabled,
}: {
  models: string[];
  value: string;
  onChange: (model: string) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => next && onChange(next)}
      disabled={disabled}
    >
      <SelectTrigger className="w-36 shrink-0 font-ui text-xs sm:w-56" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {models.map((m) => (
          <SelectItem key={m} value={m} className="font-data text-xs">
            {formatModelLabel(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
