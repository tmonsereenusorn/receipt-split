export function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`receipt-section py-4 ${className}`}>
      {children}
      <div className="receipt-separator mt-4 text-sm last:hidden" aria-hidden="true">
        - - - - - - - - - - - - - - - - - - -
      </div>
    </div>
  );
}
