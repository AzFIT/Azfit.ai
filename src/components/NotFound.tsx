import { useNavigate } from "react-router";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div
      className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ backgroundColor: "var(--page-bg)", color: "var(--text-primary)" }}
    >
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        The page you're looking for doesn't exist.
      </p>
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="rounded-md px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        style={{ background: "linear-gradient(90deg, #00AEEF, #8B5CF6)" }}
      >
        Back to Dashboard
      </button>
    </div>
  );
}
