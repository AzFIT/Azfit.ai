import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Clock, ChevronDown, ChevronUp } from "lucide-react";
import type { ClientGeneratedProgram } from "@/types/client";

interface ProgramsTabProps {
  programs: ClientGeneratedProgram[];
}

export default function ProgramsTab({ programs }: ProgramsTabProps) {
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  if (programs.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border py-12"
        style={{
          backgroundColor: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <Dumbbell size={32} style={{ color: "var(--light-text-muted)" }} />
        <p
          className="mt-2 text-sm font-medium"
          style={{ color: "var(--light-text-muted)" }}
        >
          No programs assigned
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {programs.map((program) => (
        <motion.div
          key={program.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border overflow-hidden"
          style={{
            backgroundColor: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          {/* Program Header */}
          <button
            onClick={() =>
              setExpandedProgram(
                expandedProgram === program.id ? null : program.id,
              )
            }
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: "rgba(13,148,136,0.15)" }}
              >
                <Dumbbell size={20} style={{ color: "#0D9488" }} />
              </div>
              <div>
                <h3
                  className="text-sm font-semibold"
                  style={{ color: "var(--page-text)" }}
                >
                  {program.name}
                </h3>
                <p
                  className="text-xs"
                  style={{ color: "var(--light-text-muted)" }}
                >
                  {program.category} • {program.level} • {program.totalWeeks}{" "}
                  weeks
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "rgba(13,148,136,0.1)",
                  color: "#0D9488",
                }}
              >
                {program.frequency}x/week
              </span>
              {expandedProgram === program.id ? (
                <ChevronUp
                  size={16}
                  style={{ color: "var(--light-text-muted)" }}
                />
              ) : (
                <ChevronDown
                  size={16}
                  style={{ color: "var(--light-text-muted)" }}
                />
              )}
            </div>
          </button>

          {/* Expanded Content */}
          <AnimatePresence>
            {expandedProgram === program.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  <p
                    className="text-xs"
                    style={{ color: "var(--light-text-secondary)" }}
                  >
                    {program.description}
                  </p>

                  {/* Phases */}
                  {program.phases.map((phase) => (
                    <div
                      key={phase.id}
                      className="rounded-xl border"
                      style={{
                        backgroundColor: "var(--light-elevated)",
                        borderColor: "var(--card-border)",
                      }}
                    >
                      <button
                        onClick={() =>
                          setExpandedPhase(
                            expandedPhase === phase.id ? null : phase.id,
                          )
                        }
                        className="w-full flex items-center justify-between p-3 text-left"
                      >
                        <div>
                          <span
                            className="text-xs font-semibold"
                            style={{ color: "var(--page-text)" }}
                          >
                            {phase.name}
                          </span>
                          <span
                            className="text-[10px] ml-2"
                            style={{ color: "var(--light-text-muted)" }}
                          >
                            {phase.durationWeeks} weeks
                          </span>
                        </div>
                        {expandedPhase === phase.id ? (
                          <ChevronUp
                            size={14}
                            style={{ color: "var(--light-text-muted)" }}
                          />
                        ) : (
                          <ChevronDown
                            size={14}
                            style={{ color: "var(--light-text-muted)" }}
                          />
                        )}
                      </button>

                      <AnimatePresence>
                        {expandedPhase === phase.id && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-2">
                              {phase.workouts.map((workout) => (
                                <div
                                  key={workout.id}
                                  className="flex items-center justify-between p-2.5 rounded-lg"
                                  style={{ backgroundColor: "var(--card-bg)" }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold"
                                      style={{
                                        backgroundColor:
                                          "rgba(13,148,136,0.15)",
                                        color: "#0D9488",
                                      }}
                                    >
                                      {workout.dayNumber}
                                    </span>
                                    <div>
                                      <p
                                        className="text-xs font-medium"
                                        style={{ color: "var(--page-text)" }}
                                      >
                                        {workout.name}
                                      </p>
                                      <p
                                        className="text-[10px]"
                                        style={{
                                          color: "var(--light-text-muted)",
                                        }}
                                      >
                                        {workout.focus} •{" "}
                                        {workout.exercises.length} exercises
                                      </p>
                                    </div>
                                  </div>
                                  <div
                                    className="flex items-center gap-1 text-[10px]"
                                    style={{ color: "var(--light-text-muted)" }}
                                  >
                                    <Clock size={10} />
                                    {workout.estimatedMinutes}m
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  );
}
