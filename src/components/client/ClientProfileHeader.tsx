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
} from "lucide-react";
import type { Client } from "@/types/client";
import { clientStatusMeta } from "@/lib/clientStatus";
import { Button } from "@/components/ui/button";
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
}

export default function ClientProfileHeader({
  client,
  onBuildProgram,
  onEdit,
}: ClientProfileHeaderProps) {
  const navigate = useNavigate();

  const statusMeta = clientStatusMeta(client.status);

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
      <div className="flex items-start gap-4">
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
            {client.phone && (
              <span
                className="flex items-center gap-1 text-[11px]"
                style={{ color: "var(--light-text-muted)" }}
              >
                <Phone size={11} />
                {client.phone}
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
            style={{ backgroundColor: "var(--azfit-primary)", color: "#fff" }}
            onClick={onEdit}
            disabled={!onEdit}
          >
            <Edit3 size={13} />
            Edit
          </Button>
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
    </motion.div>
  );
}
