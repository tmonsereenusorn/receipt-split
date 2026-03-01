import { clsx } from "clsx";
import { HTMLAttributes } from "react";

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
