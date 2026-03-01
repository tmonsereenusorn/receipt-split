interface SectionProps {
  children: React.ReactNode;
  className?: string;
}

export function Section({ children, className }: SectionProps) {
  return (
    <div className={`receipt-section border-b border-dashed border-zinc-700 py-5 last:border-0 ${className ?? ""}`}>
      {children}
    </div>
  );
}
