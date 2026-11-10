import { useState } from "react";
import { Checkbox, Select, TextField } from "@shopify/polaris";
import type { CheckboxProps, SelectProps, TextFieldProps } from "@shopify/polaris";

/**
 * Polaris v12 only exposes controlled inputs (`value` + `onChange`). These
 * thin wrappers keep the convenience of `defaultValue` / `defaultChecked`
 * inside plain Remix `<Form>` submissions while remaining fully controlled
 * under the hood.
 */

type UncontrolledTextFieldProps = Omit<TextFieldProps, "value" | "onChange"> & {
  defaultValue?: string;
};

export function UncontrolledTextField({
  defaultValue = "",
  autoComplete,
  ...rest
}: UncontrolledTextFieldProps) {
  const [value, setValue] = useState(defaultValue);
  return (
    <TextField
      {...rest}
      value={value}
      onChange={setValue}
      autoComplete={autoComplete ?? "off"}
    />
  );
}

type UncontrolledSelectProps = Omit<SelectProps, "value" | "onChange"> & {
  defaultValue?: string;
};

export function UncontrolledSelect({
  defaultValue = "",
  ...rest
}: UncontrolledSelectProps) {
  const [value, setValue] = useState(defaultValue);
  return <Select {...rest} value={value} onChange={setValue} />;
}

type UncontrolledCheckboxProps = Omit<CheckboxProps, "checked" | "onChange"> & {
  defaultChecked?: boolean;
};

export function UncontrolledCheckbox({
  defaultChecked = false,
  ...rest
}: UncontrolledCheckboxProps) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <Checkbox
      {...rest}
      checked={checked}
      onChange={(next) => setChecked(next)}
    />
  );
}
