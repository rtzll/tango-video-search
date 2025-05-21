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
          {options.map((option) => (
            <Select.Item key={option.id} value={option.name}>
              <div className="flex items-center" title={`${option.name} (${option.count})`}>
                <span className="truncate max-w-[240px]">{option.name}</span>
                <span className="ml-1">({option.count})</span>
              </div>
            </Select.Item>
          ))}
        </Select.Group>
      </Select.Content>
    </Select.Root>
  );
};

export { OptionsSelect };
