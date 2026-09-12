// ═══════════════════════════════════════════════════════════════
// TrainerNavShell (Phase 89 Item 1–3) — Vault-style navigation for
// the TRAINER role only (client nav is untouched in Layout).
//
// Layout pattern borrowed from the Vault reference AppShell (drawer/
// sidebar, NAV_ITEMS, active-state rail, user chip) re-themed with
// AzFIT CSS variables only — none of the Vault black/gold styling.
//
//  · Desktop ≥1024: persistent collapsible sidebar (280px ⇄ 72px
//    icon rail), collapse state in localStorage (device-local UX only;
//    only visibility prefs are server-persisted).
//  · Mobile: hamburger drawer — closes on navigate / Escape /
//    backdrop tap, focus-trapped while open, focus returns to the
//    hamburger on close.
//  · Edit mode (pencil, top of nav): eye toggles per item; Dashboard
//    is permanent (lock, no toggle). Exit saves to
//    profiles.nav_preferences; on write failure the previous state
//    is kept and the UI says so (honest-data rule).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Check,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTrainerNav } from "@/hooks/useTrainerNav";
import {
  TRAINER_NAV_ITEMS,
  toggleHiddenId,
  visibleNavItems,
  type TrainerNavItem,
} from "@/lib/trainerNav";
import { supabase } from "@/lib/supabase";

export const TRAINER_NAV_COLLAPSE_KEY = "azfit-trainer-nav-collapsed";

interface TrainerNavShellProps {
  /** Mobile drawer state, owned by Layout (the Navbar hamburger sets it). */
  mobileOpen: boolean;
  onMobileClose: () => void;
  /** Ref to the Navbar hamburger — drawer returns focus here on close. */
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  /** Desktop collapse is owned by Layout so main's margin can track it. */
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function isItemActive(pathname: string, path: string): boolean {
  if (path === "/dashboard") return pathname === "/dashboard" || pathname === "/";
  return pathname === path;
}

export default function TrainerNavShell({
  mobileOpen,
  onMobileClose,
  menuButtonRef,
  collapsed,
  onToggleCollapse,
}: TrainerNavShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hiddenIds, saveHidden } = useTrainerNav(user?.id);

  const [editMode, setEditMode] = useState(false);
  const [draftHidden, setDraftHidden] = useState<string[]>([]);
  const drawerRef = useRef<HTMLElement>(null);

  const handleNav = (path: string) => {
    if (path !== location.pathname) navigate(path);
    onMobileClose();
  };

  const enterEdit = () => {
    setDraftHidden(hiddenIds);
    setEditMode(true);
  };

  const exitEdit = async () => {
    setEditMode(false);
    if (draftHidden.join() === hiddenIds.join()) return;
    const ok = await saveHidden(draftHidden);
    if (!ok) {
      toast.error("Could not save nav preferences — keeping your previous layout");
    }
  };

  // ── Mobile drawer: focus trap + Escape + focus return (Item 3) ──
  useEffect(() => {
    if (!mobileOpen) return;
    const menuButton = menuButtonRef.current;
    const drawer = drawerRef.current;
    const focusables = drawer
      ? Array.from(
          drawer.querySelectorAll<HTMLElement>(
            'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        )
      : [];
    const first = focusables[0] ?? drawer;
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onMobileClose();
        return;
      }
      if (e.key !== "Tab" || focusables.length === 0) return;
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      menuButton?.focus();
    };
  }, [mobileOpen, onMobileClose, menuButtonRef]);

  const items = editMode ? TRAINER_NAV_ITEMS : visibleNavItems(hiddenIds);

  // Row content shared by view mode (single button) and edit mode (nav
  // button + separate toggle control, so the switch never pollutes the
  // nav button's accessible name).
  const itemRowStyles = (active: boolean, hidden: boolean) => ({
    backgroundColor: active ? "var(--light-elevated)" : "transparent",
    color: active ? "var(--azfit-primary)" : "var(--light-text-muted)",
    opacity: hidden ? 0.45 : 1,
    borderLeft: "3px solid transparent",
  });

  const itemRowInner = (item: TrainerNavItem, active: boolean, condensed: boolean) => (
    <>
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full"
          style={{ backgroundColor: "var(--azfit-primary)" }}
        />
      )}
      <item.icon size={20} className="shrink-0" />
      {!condensed && <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>}
    </>
  );

  const itemButton = (item: TrainerNavItem, condensed: boolean) => {
    const active = isItemActive(location.pathname, item.path);
    const hidden = editMode && !item.permanent && draftHidden.includes(item.id);
    const navButtonClass = `relative flex h-12 items-center gap-4 rounded-lg text-left transition-all duration-150 active:scale-[0.98] ${
      condensed ? "w-full justify-center px-0" : "min-w-0 flex-1 px-3"
    }`;

    if (editMode && !condensed) {
      return (
        <div key={item.id} className="flex w-full items-center gap-1">
          <button
            onClick={() => handleNav(item.path)}
            aria-current={active ? "page" : undefined}
            className={navButtonClass}
            style={itemRowStyles(active, hidden)}
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.backgroundColor = "var(--light-elevated)";
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {itemRowInner(item, active, false)}
          </button>
          {item.permanent ? (
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center"
              style={{ color: "var(--light-text-muted)" }}
            >
              <Lock size={14} aria-label="Always shown" />
            </span>
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={!hidden}
              aria-label={`${hidden ? "Show" : "Hide"} ${item.label}`}
              onClick={() => setDraftHidden((d) => toggleHiddenId(d, item.id))}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{ color: "var(--light-text-muted)" }}
            >
              {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => handleNav(item.path)}
        aria-current={active ? "page" : undefined}
        aria-label={condensed ? item.label : undefined}
        title={condensed ? item.label : undefined}
        className={navButtonClass}
        style={itemRowStyles(active, false)}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.backgroundColor = "var(--light-elevated)";
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        {itemRowInner(item, active, condensed)}
      </button>
    );
  };

  const editBar = (condensed: boolean) => (
    <div className={`flex items-center ${condensed ? "justify-center" : "justify-between px-1"}`}>
      {!condensed && (
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--light-text-muted)" }}
        >
          {editMode ? "Customize nav" : "Menu"}
        </span>
      )}
      <button
        onClick={editMode ? exitEdit : enterEdit}
        aria-label={editMode ? "Save nav customization" : "Customize navigation"}
        className="flex h-11 w-11 items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.92]"
        style={{ color: editMode ? "var(--azfit-primary)" : "var(--light-text-muted)" }}
      >
        {editMode ? <Check size={18} /> : <Pencil size={18} />}
      </button>
    </div>
  );

  const userChip = (condensed: boolean) => {
    const name = user?.full_name || user?.email || "Trainer";
    const initials = name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
    return (
      <div className={`flex items-center gap-3 ${condensed ? "justify-center" : ""}`}>
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            style={{
              backgroundColor: "var(--light-elevated)",
              color: "var(--azfit-primary)",
              border: "1px solid var(--card-border)",
            }}
          >
            {initials || "T"}
          </div>
        )}
        {!condensed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" style={{ color: "var(--page-text)" }}>
              {name}
            </p>
            <p className="text-xs" style={{ color: "var(--light-text-muted)" }}>
              Trainer
            </p>
          </div>
        )}
      </div>
    );
  };

  const logoutButton = (condensed: boolean) => (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        navigate("/login", { replace: true });
      }}
      aria-label="Logout"
      className={`flex h-12 w-full items-center gap-4 rounded-lg text-left transition-all duration-150 active:scale-[0.98] ${
        condensed ? "justify-center px-0" : "px-3"
      }`}
      style={{ color: "var(--light-text-muted)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--light-elevated)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <LogOut size={20} className="shrink-0" />
      {!condensed && <span className="text-sm font-medium">Logout</span>}
    </button>
  );

  const navList = (condensed: boolean) => (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3" aria-label="Trainer navigation">
      {items.map((item) => itemButton(item, condensed))}
    </nav>
  );

  return (
    <>
      {/* ── Desktop persistent sidebar (≥1024), collapsible ── */}
      <aside
        className={`fixed left-0 top-14 hidden h-[calc(100dvh-3.5rem)] flex-col border-r lg:flex ${
          collapsed ? "w-[72px]" : "w-[280px]"
        }`}
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
          transition: "width 0.2s ease",
        }}
        aria-label="Trainer sidebar"
      >
        <div className="flex flex-col p-3">
          {editBar(collapsed)}
        </div>
        {navList(collapsed)}
        <div className="border-t p-3" style={{ borderColor: "var(--card-border)" }}>
          <div className={collapsed ? "flex justify-center pb-2" : "pb-2"}>
            {userChip(collapsed)}
          </div>
          {logoutButton(collapsed)}
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="mt-1 flex h-11 w-full items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.92]"
            style={{ color: "var(--light-text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--light-elevated)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </aside>

      {/* ── Mobile drawer (<1024) ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60]"
              style={{ backgroundColor: "var(--backdrop)" }}
              onClick={onMobileClose}
              aria-hidden
            />
            <motion.aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Trainer navigation menu"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              tabIndex={-1}
              className="fixed left-0 top-0 z-[70] flex h-full w-[280px] flex-col shadow-2xl lg:hidden"
              style={{ backgroundColor: "var(--card-bg)" }}
            >
              <div className="flex h-14 items-center justify-between px-3">
                <div className="flex items-center gap-2">
                  <img src="./azfit-logo.png" alt="AzFIT" className="h-7 object-contain" />
                  <span className="text-base font-bold" style={{ color: "var(--page-text)" }}>
                    AzFIT
                  </span>
                </div>
                <button
                  onClick={onMobileClose}
                  aria-label="Close menu"
                  className="flex h-11 w-11 items-center justify-center rounded-lg active:scale-[0.92]"
                  style={{ color: "var(--page-text)" }}
                >
                  <X size={24} />
                </button>
              </div>
              <div className="px-3 pb-1">{editBar(false)}</div>
              {navList(false)}
              <div className="border-t p-3" style={{ borderColor: "var(--card-border)" }}>
                <div className="pb-2">{userChip(false)}</div>
                {logoutButton(false)}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
