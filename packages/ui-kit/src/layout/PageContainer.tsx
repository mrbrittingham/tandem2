import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type PageContainerProps = {
  children: ReactNode;
  className?: string;
  /** Max width override. Defaults to `--content-max-width` token. */
  maxWidth?: string;
};

export function PageContainer({ children, className, maxWidth }: PageContainerProps) {
  return (
    <main
      className={cn(
        "flex-1 bg-[var(--color-bg)] px-6 py-8 lg:px-10 lg:py-10",
        className,
      )}
    >
      <div
        className="mx-auto w-full space-y-8"
        style={{ maxWidth: maxWidth ?? "var(--content-max-width)" }}
      >
        {children}
      </div>
    </main>
  );
}
