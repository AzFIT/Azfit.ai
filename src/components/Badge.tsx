interface BadgeProps {
  count?: number;
}

export default function Badge({ count = 0 }: BadgeProps) {
  if (!count || count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-hidden={false}
      role="status"
      className="ml-auto inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ backgroundColor: "var(--azfit-primary)", color: "#fff" }}
    >
      {label}
    </span>
  );
}
