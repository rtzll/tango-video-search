import { Select } from "@radix-ui/themes";

export type Option = {
  id: number;
  name: string;
  count: number;
};

export interface OptionsSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder: string;
}

const OptionsSelect = ({
  value,
  onValueChange,
  options,
  placeholder,
}: OptionsSelectProps) => {
  return (
    <Select.Root value={value} onValueChange={onValueChange} size="2">
      <Select.Trigger placeholder={placeholder} variant="ghost">
        {value === "any" ? placeholder : value}
      </Select.Trigger>
      <Select.Content>
        <Select.Group>
          <Select.Item value="any">{placeholder}</Select.Item>
          {/* TODO: fix for very long names */}
          {options.map((option) => (
            <Select.Item key={option.id} value={option.name}>
              {option.name} ({option.count})
            </Select.Item>
          ))}
        </Select.Group>
      </Select.Content>
    </Select.Root>
  );
};

export { OptionsSelect };
