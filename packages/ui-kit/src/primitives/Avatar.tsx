import { cn } from "../lib/cn";

const sizes: Record<string, string> = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-[var(--text-xs)]",
  lg: "h-10 w-10 text-[var(--text-sm)]",
  xl: "h-12 w-12 text-[var(--text-base)]",
};

export type AvatarProps = {
  src?: string | null;
  alt?: string;
  initials?: string;
  size?: keyof typeof sizes;
  className?: string;
};

export function Avatar({
  src,
  alt = "",
  initials,
  size = "md",
  className,
}: AvatarProps) {
  const sizeClass = sizes[size];

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn(
          "inline-flex shrink-0 rounded-full object-cover",
          sizeClass,
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-label={alt || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] font-semibold text-[var(--color-text-inverse)]",
        sizeClass,
        className,
      )}
    >
      {initials ?? "?"}
    </span>
  );
}
