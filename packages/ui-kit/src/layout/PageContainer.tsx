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
        "flex-1 px-[var(--page-pad-x)] py-[var(--page-pad-y)]",
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
