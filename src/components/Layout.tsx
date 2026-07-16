import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  UserCircle,
  Settings,
  LogOut,
  X,
  Moon,
  Sun,
  Apple,
  Scale,
  Dumbbell,
  Sparkles,
  Calendar as CalendarIcon,
  Camera,
  Download,
  Timer,
  Trophy,
  Flame,
  Brain,
  ChevronDown,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Badge from "@/components/Badge";
import AzFitChat from "@/components/chat/AzFitChat";

interface LayoutProps {
  children: React.ReactNode;
  showNav?: boolean;
  transparentNav?: boolean;
  mode?: "dashboard" | "sheets";
  onModeToggle?: (mode: "dashboard" | "sheets") => void;
}

// Base secondary navigation (without Coach - added conditionally)
const baseSecondaryNavItems = [
  { icon: Sparkles, label: "AI Builder", path: "/ai-program-builder" },
  { icon: CalendarIcon, label: "Schedule", path: "/schedule" },
  { icon: Scale, label: "Bio Print", path: "/bioprint" },
  { icon: Camera, label: "Photos", path: "/progress-photos" },
  { icon: Timer, label: "Timer", path: "/timer" },
  { icon: Flame, label: "Warm-up", path: "/warmup" },
  { icon: Brain, label: "Recovery", path: "/deload" },
  { icon: Download, label: "Export", path: "/export" },
  { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
];

export default function Layout({
  children,
  showNav = true,
  transparentNav = false,
  mode = "dashboard",
  onModeToggle,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandMore, setExpandMore] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const { user, isTrainer } = useAuth();

  // Dynamic navigation based on user role
  const primaryNavItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
    { icon: Users, label: "Clients", path: "/clients" },
    { icon: Dumbbell, label: "Workouts", path: "/sheets" },
    { icon: Apple, label: "Nutrition", path: "/nutrition" },
    { icon: BarChart3, label: "Analytics", path: "/analytics" },
  ];

  // Secondary nav: add Coach only for trainers/admins
  const secondaryNavItems = isTrainer
    ? [...baseSecondaryNavItems, { icon: UserCircle, label: "Coach", path: "/coach" }]
    : baseSecondaryNavItems;

  // Mobile tabs: clients see Schedule instead of Clients, no Coach
  const tabItems = isTrainer
    ? [
        { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
        { icon: Users, label: "Clients", path: "/clients" },
        { icon: Dumbbell, label: "Workouts", path: "/sheets" },
        { icon: Apple, label: "Nutrition", path: "/nutrition" },
        { icon: Settings, label: "Settings", path: "/settings" },
      ]
    : [
        { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
        { icon: Dumbbell, label: "Workouts", path: "/sheets" },
        { icon: Apple, label: "Nutrition", path: "/nutrition" },
        { icon: CalendarIcon, label: "Schedule", path: "/schedule" },
        { icon: Settings, label: "Settings", path: "/settings" },
      ];

  const isActive = useCallback(
    (path: string) => {
      if (path === "/dashboard")
        return location.pathname === "/dashboard" || location.pathname === "/";
      return location.pathname === path;
    },
    [location.pathname],
  );

  const handleNav = (path: string) => {
    if (path !== "#" && path !== location.pathname) {
      navigate(path);
    }
    setSidebarOpen(false);
  };

  // Example badge counts — replace with real notification data as needed
  const [navBadges, setNavBadges] = useState<Record<string, number>>({});

  // Fetch unread notification counts from Supabase and map to nav badges.
  // Falls back gracefully if Supabase isn't configured.
  useEffect(() => {
    let mounted = true;
    let clearNoUserTimeout: number | undefined;
    const userId = user?.id;

    if (!userId) {
      clearNoUserTimeout = window.setTimeout(() => {
        if (mounted) setNavBadges({});
      }, 0);
      return () => {
        mounted = false;
        if (clearNoUserTimeout !== undefined) {
          clearTimeout(clearNoUserTimeout);
        }
      };
    }

    async function loadBadges() {
      if (!userId) {
        if (mounted) setNavBadges({});
        return;
      }

      try {
        const { data, error } = await supabase
          .from("notifications")
          .select("type")
          .eq("user_id", userId)
          .eq("read", false);

        if (error) {
          // Supabase not configured or table missing — bail
          if (mounted) setNavBadges({});
          return;
        }

        const counts: Record<string, number> = {};
        const rows = (data || []) as Array<{ type?: string }>;
        rows.forEach((row) => {
          const t = row.type || "general";
          counts[t] = (counts[t] || 0) + 1;
        });

        // Map types to nav labels
        const mapped = {
          Nutrition: counts["meal"] || 0,
          Coach: counts["coach_message"] || 0,
          Leaderboard: counts["leaderboard"] || 0,
          Alerts: counts["alert"] || 0,
        } as Record<string, number>;

        if (mounted) setNavBadges(mapped);
      } catch {
        if (mounted) setNavBadges({});
      }
    }

    loadBadges();
    const id = setInterval(loadBadges, 15000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [user?.id]);

  return (
    <div
      className="min-h-[100dvh]"
      style={{ backgroundColor: "var(--page-bg)" }}
    >
      {/* Skip link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only p-2 text-sm"
        style={{ position: "absolute", left: 8, top: 8, zIndex: 60 }}
      >
        Skip to content
      </a>
      {/* Navbar */}
      {showNav && (
        <Navbar
          onMenuOpen={() => setSidebarOpen(true)}
          mode={mode}
          onModeToggle={onModeToggle}
          transparent={transparentNav}
        />
      )}

      {/* Desktop persistent sidebar */}
      <aside
        className="fixed left-0 top-14 hidden h-[calc(100dvh-3.5rem)] w-[280px] flex-col border-r lg:flex"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <nav className="flex flex-1 flex-col gap-1 p-4 overflow-y-auto">
          {/* Logo */}
          <div className="mb-4 flex items-center gap-3 px-3">
            <img
              src="./azfit-logo.png"
              alt="AzFIT"
              className="h-8 object-contain"
            />
            <span
              className="text-lg font-bold"
              style={{ color: "var(--page-text)" }}
            >
              AzFIT
            </span>
          </div>

          {/* PRIMARY NAVIGATION */}
          <div className="mb-2">
            <span
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--light-text-muted)" }}
            >
              Main
            </span>
          </div>
          {primaryNavItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNav(item.path)}
              aria-current={isActive(item.path) ? "page" : undefined}
              className="flex h-12 items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: isActive(item.path)
                  ? "var(--light-elevated)"
                  : "transparent",
                borderLeft: isActive(item.path)
                  ? "3px solid var(--azfit-primary)"
                  : "3px solid transparent",
                color: isActive(item.path)
                  ? "var(--azfit-primary)"
                  : "var(--light-text-muted)",
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.backgroundColor =
                    "var(--light-elevated)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <item.icon size={20} />
              <span className="text-sm font-medium">{item.label}</span>
              <Badge count={navBadges[item.label] ?? 0} />
            </button>
          ))}

          {/* SECONDARY NAVIGATION - Collapsible "More" */}
          <div
            className="mt-6 pt-4 border-t"
            style={{ borderColor: "var(--card-border)" }}
          >
            <button
              onClick={() => setExpandMore(!expandMore)}
              className="flex h-12 w-full items-center justify-between rounded-lg px-3 text-left transition-all duration-150 active:scale-[0.98]"
              aria-expanded={expandMore}
              style={{
                backgroundColor: expandMore
                  ? "var(--light-elevated)"
                  : "transparent",
                color: expandMore
                  ? "var(--azfit-primary)"
                  : "var(--light-text-muted)",
              }}
              onMouseEnter={(e) => {
                if (!expandMore) {
                  e.currentTarget.style.backgroundColor =
                    "var(--light-elevated)";
                }
              }}
              onMouseLeave={(e) => {
                if (!expandMore) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <span className="text-sm font-medium">More</span>
              <ChevronDown
                size={18}
                style={{
                  transform: expandMore ? "rotate(180deg)" : "rotate(0)",
                  transition: "transform 0.3s ease",
                }}
              />
            </button>

            <AnimatePresence>
              {expandMore && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-2 flex flex-col gap-1"
                >
                  {secondaryNavItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => handleNav(item.path)}
                      aria-current={isActive(item.path) ? "page" : undefined}
                      className="flex h-12 items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 active:scale-[0.98]"
                      style={{
                        backgroundColor: isActive(item.path)
                          ? "var(--light-elevated)"
                          : "transparent",
                        borderLeft: isActive(item.path)
                          ? "3px solid var(--azfit-primary)"
                          : "3px solid transparent",
                        color: isActive(item.path)
                          ? "var(--azfit-primary)"
                          : "var(--light-text-muted)",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive(item.path)) {
                          e.currentTarget.style.backgroundColor =
                            "var(--light-elevated)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive(item.path)) {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <item.icon size={20} />
                      <span className="text-sm font-medium">{item.label}</span>
                      <Badge count={navBadges[item.label] ?? 0} />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Settings, Theme toggle, and Logout at bottom */}
        <div
          className="border-t p-4"
          style={{ borderColor: "var(--card-border)" }}
        >
          <button
            onClick={() => handleNav("/settings")}
            className="flex h-12 w-full items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 hover:bg-[var(--light-elevated)] active:scale-[0.98]"
            style={{
              backgroundColor: isActive("/settings")
                ? "var(--light-elevated)"
                : "transparent",
              borderLeft: isActive("/settings")
                ? "3px solid var(--azfit-primary)"
                : "3px solid transparent",
              color: isActive("/settings")
                ? "var(--azfit-primary)"
                : "var(--light-text-muted)",
            }}
          >
            <Settings size={20} />
            <span className="text-sm font-medium">Settings</span>
          </button>
          <button
            onClick={toggleTheme}
            className="flex h-12 w-full items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 hover:bg-[var(--light-elevated)] active:scale-[0.98]"
            style={{ color: "var(--light-text-muted)" }}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            <span className="text-sm font-medium">
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </span>
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/';
            }}
            className="flex h-12 w-full items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 hover:bg-[var(--light-elevated)] active:scale-[0.98]"
            style={{ color: "var(--light-text-muted)" }}
          >
            <LogOut size={20} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60]"
              style={{ backgroundColor: "var(--backdrop)" }}
              onClick={() => setSidebarOpen(false)}
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{
                duration: 0.3,
                ease: [0.25, 0.46, 0.45, 0.94] as [
                  number,
                  number,
                  number,
                  number,
                ],
              }}
              className="fixed left-0 top-0 z-[70] h-full w-[280px] overflow-y-auto shadow-2xl lg:hidden"
              style={{
                backgroundColor: "var(--card-bg)",
                boxShadow:
                  theme === "dark"
                    ? "0 0 40px rgba(0,0,0,0.4)"
                    : "0 0 40px rgba(0,0,0,0.15)",
              }}
            >
              {/* Close button */}
              <div className="flex h-14 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                  <img
                    src="./azfit-logo.png"
                    alt="AzFIT"
                    className="h-7 object-contain"
                  />
                  <span
                    className="text-base font-bold"
                    style={{ color: "var(--page-text)" }}
                  >
                    AzFIT
                  </span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-lg active:scale-[0.92]"
                  style={{ color: "var(--page-text)" }}
                >
                  <X size={24} />
                </button>
              </div>

              <nav className="flex flex-1 flex-col gap-1 p-3">
                {/* PRIMARY NAVIGATION */}
                <div className="mb-2">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--light-text-muted)" }}
                  >
                    Main
                  </span>
                </div>
                {primaryNavItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleNav(item.path)}
                    aria-current={isActive(item.path) ? "page" : undefined}
                    className="flex h-12 items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 active:scale-[0.98]"
                    style={{
                      backgroundColor: isActive(item.path)
                        ? "var(--light-elevated)"
                        : "transparent",
                      borderLeft: isActive(item.path)
                        ? "3px solid var(--azfit-primary)"
                        : "3px solid transparent",
                      color: isActive(item.path)
                        ? "var(--azfit-primary)"
                        : "var(--light-text-muted)",
                    }}
                  >
                    <item.icon size={20} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}

                {/* SECONDARY NAVIGATION - Collapsible "More" */}
                <div
                  className="mt-4 pt-3 border-t"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <button
                    onClick={() => setExpandMore(!expandMore)}
                    className="flex h-12 w-full items-center justify-between rounded-lg px-3 text-left transition-all duration-150 active:scale-[0.98]"
                    style={{
                      backgroundColor: expandMore
                        ? "var(--light-elevated)"
                        : "transparent",
                      color: expandMore
                        ? "var(--azfit-primary)"
                        : "var(--light-text-muted)",
                    }}
                  >
                    <span className="text-sm font-medium">More</span>
                    <ChevronDown
                      size={18}
                      style={{
                        transform: expandMore ? "rotate(180deg)" : "rotate(0)",
                        transition: "transform 0.3s ease",
                      }}
                    />
                  </button>

                  <AnimatePresence>
                    {expandMore && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2 flex flex-col gap-1"
                      >
                        {secondaryNavItems.map((item) => (
                          <button
                            key={item.label}
                            onClick={() => handleNav(item.path)}
                            aria-current={
                              isActive(item.path) ? "page" : undefined
                            }
                            className="flex h-12 items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 active:scale-[0.98]"
                            style={{
                              backgroundColor: isActive(item.path)
                                ? "var(--light-elevated)"
                                : "transparent",
                              borderLeft: isActive(item.path)
                                ? "3px solid var(--azfit-primary)"
                                : "3px solid transparent",
                              color: isActive(item.path)
                                ? "var(--azfit-primary)"
                                : "var(--light-text-muted)",
                            }}
                          >
                            <item.icon size={20} />
                            <span className="text-sm font-medium">
                              {item.label}
                            </span>
                            <Badge count={navBadges[item.label] ?? 0} />
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </nav>

              {/* Bottom section - Settings (theme/logout moved to Settings page) */}
              <div
                className="border-t p-3"
                style={{ borderColor: "var(--card-border)" }}
              >
                <button
                  onClick={() => handleNav("/settings")}
                  className="flex h-12 w-full items-center gap-4 rounded-lg px-3 text-left transition-all duration-150 active:scale-[0.98]"
                  style={{
                    backgroundColor: isActive("/settings")
                      ? "var(--light-elevated)"
                      : "transparent",
                    color: isActive("/settings")
                      ? "var(--azfit-primary)"
                      : "var(--light-text-muted)",
                  }}
                >
                  <Settings size={20} />
                  <span className="text-sm font-medium">Settings</span>
                </button>
                {/* Theme toggle and Logout moved to Settings page */}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main
        className={`min-h-[100dvh] pb-16 lg:ml-[280px] lg:pb-0 ${showNav ? "pt-14" : ""}`}
        style={{ backgroundColor: "var(--page-bg)" }}
      >
        {children}
      </main>

      {/* Bottom tab bar (mobile only) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t lg:hidden lg:left-[280px]"
        style={{
          backgroundColor: "var(--card-bg)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderColor: "var(--card-border)",
        }}
      >
        <div className="flex h-full items-center justify-around">
          {tabItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-transform duration-100 active:scale-90"
            >
              <item.icon
                size={24}
                style={{
                  color: isActive(item.path)
                    ? "var(--azfit-primary)"
                    : "var(--light-text-muted)",
                }}
              />
              <span
                className="text-[10px] font-medium"
                style={{
                  color: isActive(item.path)
                    ? "var(--azfit-primary)"
                    : "var(--light-text-muted)",
                }}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* AI Chat Bubble */}
      <AzFitChat />
    </div>
  );
}
