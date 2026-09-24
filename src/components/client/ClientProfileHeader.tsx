import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Edit3,
  MoreHorizontal,
  Dumbbell,
  Printer,
  Eye,
} from "lucide-react";
import type { Client } from "@/types/client";
import { clientStatusMeta } from "@/lib/clientStatus";
import { displayPhone } from "@/lib/phoneDisplay";
import { useAuth } from "@/hooks/useAuth";
import { useViewAs } from "@/hooks/useViewAs";
import { Button } from "@/components/ui/button";
import LogoHomeButton from "@/components/LogoHomeButton";
import InviteControl from "@/components/client/InviteControl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ClientProfileHeaderProps {
  client: Client;
  onBuildProgram?: () => void;
  onEdit?: () => void;
  onExportPlanPack?: () => void;
  /** Phase 99a: server-stamped invited_at after a successful invite */
  onInvited?: (invitedAt: string) => void;
}

export default function ClientProfileHeader({
  client,
  onBuildProgram,
  onEdit,
  onExportPlanPack,
  onInvited,
}: ClientProfileHeaderProps) {
  const navigate = useNavigate();
  const { isTrainer } = useAuth();
  // Phase 90e: "View As Client" segmented control. Trainers only;
  // hidden while overriding for a DIFFERENT client (the banner's
  // "Back to Coach View" is the way back in that case). Requires an
  // email — the override resolves the target's profiles row by it.
  const { viewAs, beginViewAs, endViewAs } = useViewAs();
  const overrideForThis = viewAs?.clientId === client.id;
  const showViewToggle =
    isTrainer && !!client.email && (!viewAs || overrideForThis);

  const statusMeta = clientStatusMeta(client.status);

  const enterClientView = () => {
    if (overrideForThis) return;
    beginViewAs({ clientId: client.id, email: client.email, name: client.name });
    navigate("/dashboard");
  };

  const backToCoachView = () => {
    endViewAs(); // stays on this profile
  };

  // Phase 90h: below sm the toggle gets its own full-width row (the single
  // flex row crowded to one-word-per-line at 320px); at sm+ it stays inline.
  const viewToggle = (fullWidth: boolean) =>
    showViewToggle && (
      <div
        data-testid={fullWidth ? "view-toggle-mobile" : "view-toggle"}
        role="group"
        aria-label="View mode"
        className={`flex items-center rounded-xl border p-0.5 ${
          fullWidth ? "w-full sm:hidden" : "hidden sm:flex"
        }`}
        style={{
          backgroundColor: "var(--light-elevated)",
          borderColor: "var(--card-border)",
        }}
      >
        <button
          type="button"
          aria-pressed={!overrideForThis}
          onClick={backToCoachView}
          className={`flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
            fullWidth ? "flex-1 justify-center" : ""
          }`}
          style={{
            backgroundColor: overrideForThis
              ? "transparent"
              : "var(--azfit-primary)",
            color: overrideForThis ? "var(--light-text-muted)" : "#fff",
          }}
        >
          Coach View
        </button>
        <button
          type="button"
          data-testid="view-toggle-client"
          aria-pressed={overrideForThis}
          onClick={enterClientView}
          className={`flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors ${
            fullWidth ? "flex-1 justify-center" : ""
          }`}
          style={{
            backgroundColor: overrideForThis
              ? "var(--azfit-primary)"
              : "transparent",
            color: overrideForThis ? "#fff" : "var(--light-text-muted)",
          }}
        >
          <Eye size={12} />
          Client View
        </button>
      </div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border p-4 md:p-5"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <div className="relative flex flex-col gap-3">
        {/* Phase 96a: AzFIT logo → dashboard */}
        <div className="order-first flex w-full justify-center sm:absolute sm:left-1/2 sm:top-1/2 sm:w-auto sm:-translate-x-1/2 sm:-translate-y-1/2">
          <LogoHomeButton />
        </div>
        {/* Phase 90h: below sm this stacks as row 1 (back + avatar + info);
            the view toggle is row 2. At sm+ everything is one row again. */}
        <div className="flex items-start gap-3 sm:gap-4">
        {/* Back Button */}
        <button
          onClick={() => navigate("/dashboard")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border shrink-0 hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: "var(--light-elevated)",
            borderColor: "var(--card-border)",
          }}
        >
          <ArrowLeft size={16} style={{ color: "var(--page-text)" }} />
        </button>

        {/* Avatar */}
        <div className="shrink-0">
          {client.avatar ? (
            <img
              src={client.avatar}
              alt={client.name}
              className="h-16 w-16 rounded-2xl object-cover"
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold"
              style={{ backgroundColor: "var(--azfit-primary)", color: "#fff" }}
            >
              {client.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-lg font-bold truncate"
              style={{ color: "var(--page-text)" }}
            >
              {client.name}
            </h1>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: statusMeta.bg,
                color: statusMeta.color,
              }}
            >
              {statusMeta.label}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {client.email && (
              <span
                className="flex items-center gap-1 text-[11px]"
                style={{ color: "var(--light-text-muted)" }}
              >
                <Mail size={11} />
                {client.email}
              </span>
            )}
            {displayPhone(client.phone) && (
              <span
                className="flex items-center gap-1 text-[11px]"
                style={{ color: "var(--light-text-muted)" }}
              >
                <Phone size={11} />
                {displayPhone(client.phone)}
              </span>
            )}
            {client.location && (
              <span
                className="flex items-center gap-1 text-[11px]"
                style={{ color: "var(--light-text-muted)" }}
              >
                <MapPin size={11} />
                {client.location}
              </span>
            )}
            {client.dateOfBirth && (
              <span
                className="flex items-center gap-1 text-[11px]"
                style={{ color: "var(--light-text-muted)" }}
              >
                <Calendar size={11} />
                {new Date(client.dateOfBirth).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          {client.primaryGoal && (
            <p
              className="text-[11px] mt-1.5"
              style={{ color: "var(--light-text-secondary)" }}
            >
              Goal:{" "}
              <span
                className="font-medium"
                style={{ color: "var(--azfit-primary)" }}
              >
                {client.primaryGoal
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              {client.trainingFrequency &&
                ` • ${client.trainingFrequency} days/week`}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Phase 90e: Coach View | Client View segmented control (sm+;
              below sm it renders as the full-width row beneath the header) */}
          {viewToggle(false)}
          <Button
            size="sm"
            className="gap-1.5 rounded-xl hidden sm:flex"
            style={{ backgroundColor: "var(--azfit-primary)", color: "#fff" }}
            onClick={onBuildProgram}
            disabled={!onBuildProgram}
          >
            <Dumbbell size={13} />
            Build Program
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-xl hidden sm:flex"
            style={{ backgroundColor: "rgba(139,92,246,0.12)", color: "#8B5CF6" }}
            onClick={onExportPlanPack}
            disabled={!onExportPlanPack}
            title="Export Plan Pack (print / Save as PDF)"
          >
            <Printer size={13} />
            Plan Pack
          </Button>
          <Button
            size="sm"
            className="gap-1.5 rounded-xl hidden sm:flex"
            style={{ backgroundColor: "var(--azfit-primary)", color: "#fff" }}
            onClick={onEdit}
            disabled={!onEdit}
          >
            <Edit3 size={13} />
            Edit
          </Button>
          {/* Phase 99a: invite the client to the app (real states only —
              hidden when they already have an account or the row has no
              email). Icon-only below sm to keep the row uncrowded. */}
          {isTrainer && (
            <InviteControl
              clientId={client.id}
              email={client.email}
              invitedAt={client.invitedAt}
              onInvited={onInvited}
            />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="rounded-xl h-8 w-8"
                style={{ borderColor: "var(--card-border)" }}
              >
                <MoreHorizontal
                  size={14}
                  style={{ color: "var(--page-text)" }}
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem className="text-xs rounded-lg cursor-pointer">
                Message Client
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs rounded-lg cursor-pointer">
                Assign Program
              </DropdownMenuItem>
              <DropdownMenuItem className="text-xs rounded-lg cursor-pointer text-red-600">
                Archive Client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </div>

        {/* Phase 90h: the view toggle rides its own full-width row below sm
            (in-flow, never absolute/fixed) */}
        {viewToggle(true)}
      </div>
    </motion.div>
  );
}
