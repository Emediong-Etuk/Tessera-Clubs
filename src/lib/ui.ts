// Small shared style helpers so every button/card/input across the app
// pulls from the same visual language (see globals.css for the color
// tokens) instead of each page re-inventing its own className soup.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground shadow-sm hover:opacity-90",
  secondary: "border border-border bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
  danger: "border border-danger/40 text-danger hover:bg-danger-soft",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold",
    "transition-all duration-150 ease-out active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    SIZE[size],
    VARIANT[variant],
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function cardClass(extra = ""): string {
  return [
    "rounded-2xl border border-border bg-surface p-5 shadow-sm",
    "transition-shadow duration-150 hover:shadow-md",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function inputClass(extra = ""): string {
  return [
    "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground",
    "transition-colors placeholder:text-muted-foreground/70",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

export function badgeClass(tone: "accent" | "warn" | "danger" | "neutral" = "neutral", extra = ""): string {
  const tones: Record<string, string> = {
    accent: "bg-accent-soft text-accent",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger-soft text-danger",
    neutral: "bg-surface-muted text-muted-foreground",
  };
  return `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tones[tone]} ${extra}`.trim();
}
