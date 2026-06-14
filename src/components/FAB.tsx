import { Plus } from "lucide-react";

interface FABProps {
  onClick: () => void;
  label?: string;
}

export default function FAB({ onClick, label = "Add" }: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed z-50 flex items-center justify-center rounded-full p-4 shadow-lg transition-transform active:scale-95"
      style={{
        right: 20,
        bottom: 84,
        backgroundColor: "var(--azfit-primary)",
        color: "#fff",
      }}
    >
      <Plus size={20} />
    </button>
  );
}
