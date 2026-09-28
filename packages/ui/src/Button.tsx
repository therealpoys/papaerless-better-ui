import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "link" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "ui-button ui-button--primary",
  secondary: "ui-button ui-button--secondary",
  link: "ui-button ui-button--link",
  danger: "ui-button ui-button--danger",
};

export function Button({ variant = "primary", className, type = "button", ...rest }: ButtonProps) {
  const classes = [VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  return <button type={type} className={classes} {...rest} />;
}
