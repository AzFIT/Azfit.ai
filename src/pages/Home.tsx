import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Dumbbell,
  Apple,
  ChevronDown,
  Star,
  Quote,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import Footer from "@/components/Footer";
import { useTheme } from "@/hooks/useTheme";
import AIShowcase from "@/components/AIShowcase";

/* ──────────────────────── Animation helpers ──────────────────────── */

const easeDefault = [0.25, 0.46, 0.45, 0.94] as [
  number,
  number,
  number,
  number,
];
const easeBounce = [0.34, 1.56, 0.64, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easeDefault, delay },
  }),
};

/* ──────────────────────── Scale-in variant (unused but available) ──────────────────────── */
/*
const scaleIn = {
  hidden: { opacity: 0, scale: 0 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: easeBounce, delay },
  }),
};
*/

/* ──────────────────────── Scroll-reveal wrapper ──────────────────────── */

function ScrollReveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      custom={delay}
      variants={fadeUp}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────── Animated counter ──────────────────────── */

function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
}: {
  target: number;
  suffix?: string;
  prefix?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.round(eased * target);
      setCount(start);
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ──────────────────────── Hero Navigation ──────────────────────── */

function HeroNav({
  onMenuOpen,
  onNavigate,
}: {
  onMenuOpen: () => void;
  onNavigate: (path: string) => void;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-4 transition-all duration-300 lg:px-8"
      style={{
        backgroundColor: scrolled ? "rgba(15, 23, 42, 0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img
          src="./azfit-logo-text.png"
          alt="AzFIT"
          className="h-9 object-contain"
        />
      </div>

      {/* Desktop nav links */}
      <div className="hidden items-center gap-8 md:flex">
        {["Features", "How It Works", "Testimonials", "Download"].map(
          (item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().replace(/ /g, "-")}`}
              className="text-sm font-medium text-white transition-opacity duration-200 hover:opacity-80"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
            >
              {item}
            </a>
          ),
        )}
        <button
          onClick={() => onNavigate("/dashboard")}
          className="rounded-full bg-[#0D9488] px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#14B8A6] active:scale-[0.97]"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
        >
          View Demo
        </button>
        <button
          onClick={() => onNavigate("/login")}
          className="text-sm font-semibold text-white transition-opacity duration-200 hover:opacity-80"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
        >
          Log In
        </button>
        <button
          onClick={() => onNavigate("/signup")}
          className="rounded-full border-2 border-white/60 px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 hover:border-white/80 active:scale-[0.97]"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
        >
          Sign Up
        </button>
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={onMenuOpen}
        className="flex h-10 w-10 items-center justify-center text-white md:hidden active:scale-[0.92]"
      >
        <Menu size={24} />
      </button>
    </nav>
  );
}

/* ──────────────────────── Section 1: Hero ──────────────────────── */

function HeroSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section
      id="hero"
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden"
    >
      {/* Background image with Ken Burns */}
      <motion.div
        className="absolute inset-0"
        animate={{ scale: [1, 1.05] }}
        transition={{
          duration: 20,
          ease: "linear",
          repeat: Infinity,
          repeatType: "reverse",
        }}
      >
        <img
          src="./azfit-hero-bg.png"
          alt=""
          className="h-full w-full object-cover"
        />
      </motion.div>

      {/* Dark overlay gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(15,23,42,0.3) 0%, rgba(15,23,42,0.7) 60%, rgba(15,23,42,0.95) 100%)",
        }}
      />

      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(6,182,212,0.03) 1px, rgba(6,182,212,0.03) 2px)",
        }}
      />

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {/* AI Showcase Orb */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1, ease: easeDefault }}
        >
          <AIShowcase />
        </motion.div>

        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: easeDefault }}
          className="mb-4 text-xs font-bold uppercase tracking-[0.15em]"
          style={{
            color: "#22D3EE",
            textShadow:
              "0 0 12px rgba(6,182,212,0.4), 0 2px 4px rgba(0,0,0,0.3)",
          }}
        >
          Personal Training, Reimagined.
        </motion.p>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: easeDefault }}
          className="max-w-[640px] text-4xl font-extrabold leading-[1.05] tracking-tight text-white lg:text-[56px]"
          style={{
            textShadow: "0 2px 4px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3)",
          }}
        >
          Your Fitness Data, Beautifully Visualized.
        </motion.h1>
        {/* Live Demo Badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-600 text-white text-sm font-medium shadow-lg"
        >
          <span>🚀</span>
          <span>Live Demo Available</span>
        </motion.div>
        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6, ease: easeDefault }}
          className="mt-6 max-w-[480px] text-base leading-relaxed lg:text-lg"
          style={{
            color: "#CBD5E1",
            textShadow: "0 2px 4px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3)",
          }}
        >
          Track workouts, monitor nutrition, and crush your goals with AzFIT —
          the intelligent training companion that turns your data into progress.
        </motion.p>

        {/* CTA Group */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.8, ease: easeDefault }}
          className="mt-8 flex flex-col items-center gap-4 sm:flex-row"
        >
          <button
            onClick={() => onNavigate("/dashboard")}
            className="rounded-full bg-[#0D9488] px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#14B8A6] active:scale-[0.97] lg:px-10 lg:py-4 lg:text-base"
            style={{
              textShadow: "0 1px 3px rgba(0,0,0,0.3)",
              boxShadow: "0 0 20px rgba(13,148,136,0.4)",
            }}
          >
            Download AzFIT
          </button>
          <button
            onClick={() => onNavigate("/demo")}
            className="rounded-full border-2 border-white/40 px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:border-white/60 hover:bg-white/10 active:scale-[0.97] lg:px-10 lg:py-4 lg:text-base"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
          >
            View Dashboard Demo
          </button>
        </motion.div>

        {/* App Store Coming Soon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.0, ease: easeDefault }}
          className="mt-6 flex items-center gap-3"
        >
          <div 
            className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
            style={{ borderColor: '#334155', color: '#94A3B8' }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <span>App Store — Coming Soon</span>
          </div>
          <div 
            className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm"
            style={{ borderColor: '#334155', color: '#94A3B8' }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
            </svg>
            <span>Google Play — Coming Soon</span>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 0.4, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <ChevronDown
          size={28}
          className="animate-bounce-slow"
          style={{ color: "#22D3EE" }}
        />
      </motion.div>
    </section>
  );
}

/* ──────────────────────── Section 2: Stats Bar ──────────────────────── */

function StatsSection() {
  return (
    <section
      id="features"
      className="flex h-auto items-center py-10 lg:h-[140px] lg:py-0"
      style={{ backgroundColor: "#0F172A" }}
    >
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-8 px-6 lg:grid-cols-4 lg:gap-0">
        {[
          { value: 270, suffix: "+", label: "Exercise Movements", prefix: "" },
          { value: 3, suffix: "", label: "Simple Tiers", prefix: "" },
          { value: 116, suffix: "+", label: "Clients Coached by AzTechFit", prefix: "" },
          { value: 1, suffix: "/5", label: "Built for Coaches First", prefix: "" },
        ].map((stat, i) => (
          <ScrollReveal
            key={stat.label}
            delay={i * 0.1}
            className="flex flex-col items-center text-center"
          >
            <span
              className="text-2xl font-extrabold lg:text-[30px]"
              style={{
                color: "#22D3EE",
                textShadow:
                  "0 0 12px rgba(6,182,212,0.4), 0 2px 4px rgba(0,0,0,0.3)",
              }}
            >
              {stat.label === "Built for Coaches First" ? (
                <>
                  5<span className="text-lg">/5</span>
                </>
              ) : (
                <AnimatedCounter
                  target={stat.value}
                  suffix={stat.suffix}
                  prefix={stat.prefix}
                />
              )}
            </span>
            <span
              className="mt-1 text-xs font-medium lg:text-sm"
              style={{ color: "#64748B" }}
            >
              {stat.label}
            </span>
            {/* Separator */}
            {i < 3 && (
              <div
                className="absolute right-0 top-1/2 hidden h-10 w-px -translate-y-1/2 lg:block"
                style={{ backgroundColor: "#475569" }}
              />
            )}
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────── Section 3: Feature Cards ──────────────────────── */

const features = [
  {
    icon: TrendingUp,
    iconBg: "rgba(13,148,136,0.1)",
    iconColor: "#0D9488",
    title: "Visual Progress Tracking",
    description:
      "See your fitness score, body composition, and performance trends with beautiful charts and circular progress indicators.",
  },
  {
    icon: Dumbbell,
    iconBg: "rgba(6,182,212,0.1)",
    iconColor: "#06B6D4",
    title: "Smart Workout Logging",
    description:
      "Log sets, reps, and weight with our spreadsheet-style interface. Track RPE, rest times, and exercise history effortlessly.",
  },
  {
    icon: Apple,
    iconBg: "rgba(139,92,246,0.1)",
    iconColor: "#8B5CF6",
    title: "Nutrition Monitoring",
    description:
      "Track macros, calories, and meal timing. Get insights into your protein, carbs, and fat intake to fuel your performance.",
  },
];

function FeaturesSection() {
  return (
    <section
      id="features"
      className="px-6 py-16 lg:py-24"
      style={{ backgroundColor: "var(--light-bg, #F8FAFC)" }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <ScrollReveal className="mb-12 text-center lg:mb-16">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.1em]"
            style={{ color: "#0D9488" }}
          >
            FEATURES
          </p>
          <h2
            className="text-3xl font-bold tracking-tight lg:text-[40px]"
            style={{ color: "#0F172A" }}
          >
            Everything You Need to Train Smarter
          </h2>
          <p
            className="mx-auto mt-4 max-w-[560px] text-base leading-relaxed lg:text-lg"
            style={{ color: "#475569" }}
          >
            From workout logging to nutrition tracking, AzFIT gives you complete
            visibility into your fitness journey.
          </p>
        </ScrollReveal>

        {/* Feature cards grid */}
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature, i) => (
            <ScrollReveal key={feature.title} delay={i * 0.15}>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border bg-white p-6 transition-shadow duration-200 hover:shadow-lg lg:p-8"
                style={{ borderColor: "#E2E8F0" }}
              >
                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1 }}
                  className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ backgroundColor: feature.iconBg }}
                >
                  <feature.icon
                    size={24}
                    style={{ color: feature.iconColor }}
                  />
                </motion.div>

                <h3
                  className="mb-3 text-xl font-semibold"
                  style={{ color: "#0F172A" }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-sm leading-relaxed lg:text-base"
                  style={{ color: "#475569" }}
                >
                  {feature.description}
                </p>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── Section 4: How It Works ──────────────────────── */

const steps = [
  {
    number: "01",
    title: "Log Your Data",
    description:
      "Use our intuitive spreadsheet mode to quickly enter workouts, meals, and daily metrics. Autofill and smart suggestions save you time.",
  },
  {
    number: "02",
    title: "Watch Your Progress",
    description:
      "Your dashboard visualizes every rep, every meal, and every night's sleep. Circular progress rings and trend charts keep you motivated.",
  },
  {
    number: "03",
    title: "Crush Your Goals",
    description:
      "Achievement badges celebrate milestones. Your coach reviews your data and adjusts your program — all within the app.",
  },
];

function HowItWorksSection() {
  const lineRef = useRef<HTMLDivElement>(null);
  const inView = useInView(lineRef, { once: true, margin: "-20% 0px" });

  return (
    <section
      id="how-it-works"
      className="px-6 py-16 lg:py-24"
      style={{ backgroundColor: "#F1F5F9" }}
    >
      <div className="mx-auto max-w-4xl">
        {/* Section header */}
        <ScrollReveal className="mb-12 text-center lg:mb-16">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.1em]"
            style={{ color: "#0D9488" }}
          >
            HOW IT WORKS
          </p>
          <h2
            className="text-3xl font-bold tracking-tight lg:text-[40px]"
            style={{ color: "#0F172A" }}
          >
            Three Steps to Better Training
          </h2>
        </ScrollReveal>

        {/* Steps */}
        <div className="relative" ref={lineRef}>
          {/* Connecting line (desktop only) */}
          <div className="absolute top-5 left-0 hidden h-0.5 w-full md:block">
            <motion.div
              className="h-full origin-left"
              style={{ backgroundColor: "#E2E8F0" }}
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ duration: 1, ease: easeDefault, delay: 0.3 }}
            />
          </div>

          <div className="relative grid gap-10 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className="flex flex-col items-center text-center"
              >
                {/* Step number */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-20% 0px" }}
                  transition={{
                    duration: 0.5,
                    ease: easeBounce,
                    delay: i * 0.2,
                  }}
                  className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#0D9488] text-sm font-bold text-white"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
                >
                  {step.number}
                </motion.div>

                {/* Title */}
                <motion.h3
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20% 0px" }}
                  transition={{
                    duration: 0.5,
                    ease: easeDefault,
                    delay: i * 0.2,
                  }}
                  className="mb-3 text-xl font-semibold"
                  style={{ color: "#0F172A" }}
                >
                  {step.title}
                </motion.h3>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20% 0px" }}
                  transition={{
                    duration: 0.5,
                    ease: easeDefault,
                    delay: i * 0.2 + 0.1,
                  }}
                  className="text-sm leading-relaxed lg:text-base"
                  style={{ color: "#475569" }}
                >
                  {step.description}
                </motion.p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── Section 5: Testimonials ──────────────────────── */

const testimonials = [
  {
    name: "Coach in Hong Kong",
    role: "Personal Trainer",
    quote:
      "AzFIT transformed how I program for my clients. The spreadsheet mode is fast — I can build a full week in minutes, and the progress rings keep my clients accountable for sleep and habits.",
    avatar: "./avatar-alex.jpg",
  },
  {
    name: "Client in Hong Kong",
    role: "Strength Trainee",
    quote:
      "My coach uses the coach view to program my workouts and track my progress remotely. The achievement badges are surprisingly motivating, and the BioPrint tracking is something no other app gave me.",
    avatar: "./avatar-sarah.jpg",
  },
  {
    name: "Competitive Athlete",
    role: "Powerlifter",
    quote:
      "I've tried dozens of fitness apps. AzFIT is the first one that actually understands how serious lifters track data. The RPE logging, rest timer, and volume charts are exactly what I needed.",
    avatar: "./avatar-marcus.jpg",
  },
];

function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="px-6 py-16 lg:py-24"
      style={{ backgroundColor: "var(--light-bg, #F8FAFC)" }}
    >
      <div className="mx-auto max-w-6xl">
        {/* Section header */}
        <ScrollReveal className="mb-12 text-center lg:mb-16">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.1em]"
            style={{ color: "#0D9488" }}
          >
            TESTIMONIALS
          </p>
          <h2
            className="text-3xl font-bold tracking-tight lg:text-[40px]"
            style={{ color: "#0F172A" }}
          >
            Built with Coaches, For Clients
          </h2>
        </ScrollReveal>

        {/* Testimonial cards */}
        <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 md:grid md:grid-cols-3 md:overflow-visible">
          {testimonials.map((t, i) => (
            <ScrollReveal
              key={t.name}
              delay={i * 0.15}
              className="w-[85vw] flex-shrink-0 snap-start md:w-auto"
            >
              <div
                className="relative rounded-2xl border bg-white p-6 lg:p-8"
                style={{ borderColor: "#E2E8F0" }}
              >
                {/* Quote icon */}
                <Quote
                  size={24}
                  className="mb-4 opacity-30"
                  style={{ color: "#0D9488" }}
                />

                {/* Quote text */}
                <p
                  className="mb-6 text-base italic leading-relaxed lg:text-lg"
                  style={{
                    color: "#0F172A",
                    textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                  }}
                >
                  "{t.quote}"
                </p>

                {/* Author row */}
                <div className="flex items-center gap-3">
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "#0F172A" }}
                    >
                      {t.name}
                    </p>
                    <p className="text-xs" style={{ color: "#94A3B8" }}>
                      {t.role}
                    </p>
                  </div>
                </div>

                {/* Star rating */}
                <div className="mt-4 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      size={14}
                      fill="#F59E0B"
                      style={{ color: "#F59E0B" }}
                    />
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── Section 5.5: Trusted By ──────────────────────── */

function TrustedBySection() {
  const partners = [
    "Elite Fitness Academy",
    "CrossFit Central",
    "Iron Gym",
    "FitLife Pro",
    "PowerHouse Training",
    "Velocity Athletics",
  ];

  return (
    <section className="px-6 py-12 lg:py-16" style={{ backgroundColor: "#0F172A" }}>
      <div className="mx-auto max-w-6xl">
        <ScrollReveal className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: "#64748B" }}>
            Trusted by leading fitness brands
          </p>
        </ScrollReveal>
        <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
          {partners.map((partner) => (
            <div
              key={partner}
              className="text-sm font-semibold opacity-40 transition-opacity hover:opacity-70"
              style={{ color: "#94A3B8" }}
            >
              {partner}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── Section 5.7: Pricing ──────────────────────── */

function PricingSection({ onNavigate }: { onNavigate: (path: string) => void }) {
  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for individual athletes",
      features: [
        "Workout logging & tracking",
        "Basic progress charts",
        "Community challenges",
        "Mobile app access",
      ],
      cta: "Get Started",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$9.99",
      period: "/month",
      description: "For serious lifters",
      features: [
        "Everything in Free",
        "AI Program Builder",
        "Advanced analytics",
        "Nutrition tracking",
        "Priority support",
      ],
      cta: "Start Free Trial",
      highlighted: true,
    },
    {
      name: "Coach",
      price: "$29.99",
      period: "/month",
      description: "For personal trainers",
      features: [
        "Everything in Pro",
        "Unlimited clients",
        "Client management",
        "Custom branding",
        "API access",
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="px-6 py-16 lg:py-24" style={{ backgroundColor: "#0F172A" }}>
      <div className="mx-auto max-w-6xl">
        <ScrollReveal className="mb-12 text-center lg:mb-16">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.1em]"
            style={{ color: "#0D9488" }}
          >
            Pricing
          </p>
          <h2
            className="text-3xl font-bold tracking-tight text-white lg:text-[40px]"
          >
            Simple, Transparent Pricing
          </h2>
          <p className="mt-3 text-sm" style={{ color: "#94A3B8" }}>
            Start free, upgrade when you need more power
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <ScrollReveal key={plan.name} delay={i * 0.1}>
              <div
                className="relative rounded-2xl border p-6 lg:p-8"
                style={{
                  backgroundColor: plan.highlighted ? "#1E293B" : "#0F172A",
                  borderColor: plan.highlighted ? "#0D9488" : "#334155",
                  boxShadow: plan.highlighted ? "0 0 30px rgba(13,148,136,0.15)" : "none",
                }}
              >
                {plan.highlighted && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-white"
                    style={{ backgroundColor: "#0D9488" }}
                  >
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm" style={{ color: "#64748B" }}>{plan.period}</span>
                </div>
                <p className="mt-2 text-sm" style={{ color: "#94A3B8" }}>{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: "#CBD5E1" }}>
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="#0D9488" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => onNavigate(plan.name === "Coach" ? "/login" : "/signup")}
                  className="mt-6 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-90"
                  style={{
                    backgroundColor: plan.highlighted ? "#0D9488" : "transparent",
                    border: plan.highlighted ? "none" : "1px solid #475569",
                  }}
                >
                  {plan.cta}
                </button>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────── Section 6: Download CTA + Footer ──────────────────────── */

function DownloadCTA({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section
      id="download"
      className="relative overflow-hidden px-6 py-16 lg:py-24"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="./azfit-hero-bg.png"
          alt=""
          className="h-full w-full object-cover dark-img-dim"
          style={{ filter: "brightness(0.4)" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <ScrollReveal>
          <h2
            className="text-4xl font-extrabold leading-tight tracking-tight text-white lg:text-[56px]"
            style={{
              textShadow: "0 2px 4px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3)",
            }}
          >
            Start Your Journey Today
          </h2>
          <p
            className="mt-6 text-base leading-relaxed lg:text-lg"
            style={{
              color: "#CBD5E1",
              textShadow: "0 2px 4px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3)",
            }}
          >
            Try AzFIT in your browser today. Native iOS and Android apps are on the roadmap.
          </p>

          {/* CTA Button */}
          <button
            onClick={() => onNavigate("/demo")}
            className="mt-8 rounded-full bg-[#0D9488] px-10 py-4 text-base font-semibold text-white transition-all duration-200 hover:bg-[#14B8A6] active:scale-[0.97]"
            style={{
              textShadow: "0 1px 3px rgba(0,0,0,0.3)",
              boxShadow: "0 0 24px rgba(13,148,136,0.5)",
            }}
          >
            Try AzFIT Free
          </button>

          {/* App Store badges — disabled until native apps ship */}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm opacity-70"
                style={{ borderColor: "#334155", color: "#94A3B8" }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                <span>App Store — Coming Soon</span>
              </div>
              <div
                className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm opacity-70"
                style={{ borderColor: "#334155", color: "#94A3B8" }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                </svg>
                <span>Google Play — Coming Soon</span>
              </div>
            </div>
            <p className="text-xs" style={{ color: "#64748B" }}>
              PWA install available on mobile browsers now.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

/* ──────────────────────── Mobile Drawer ──────────────────────── */

function MobileDrawer({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const { theme, toggleTheme } = useTheme();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60]"
            style={{ backgroundColor: "var(--backdrop)" }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.3, ease: easeDefault }}
            className="fixed left-0 top-0 z-[70] h-full w-[280px] overflow-y-auto"
            style={{
              backgroundColor: "var(--dark-surface, #1E293B)",
              boxShadow:
                theme === "dark"
                  ? "0 0 40px rgba(0,0,0,0.4)"
                  : "0 0 40px rgba(0,0,0,0.15)",
            }}
          >
            {/* Header */}
            <div className="flex h-16 items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <img
                  src="./azfit-logo-text.png"
                  alt="AzFIT"
                  className="h-8 object-contain"
                />
              </div>
              <button
                onClick={onClose}
                className="text-white active:scale-[0.92]"
              >
                <X size={24} />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex flex-col gap-1 p-3">
              {["Features", "How It Works", "Testimonials", "Download"].map(
                (item) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase().replace(/ /g, "-")}`}
                    onClick={onClose}
                    className="flex h-12 items-center gap-4 rounded-lg px-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
                  >
                    {item}
                  </a>
                ),
              )}
              <div
                className="my-2 h-px"
                style={{ backgroundColor: "var(--dark-border, #475569)" }}
              />
              <button
                onClick={() => {
                  onNavigate("/dashboard");
                  onClose();
                }}
                className="flex h-12 items-center gap-4 rounded-lg bg-[#0D9488] px-3 text-sm font-semibold text-white active:scale-[0.98]"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => {
                  onNavigate("/login");
                  onClose();
                }}
                className="flex h-12 items-center gap-4 rounded-lg px-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Log In
              </button>
              <button
                onClick={() => {
                  onNavigate("/signup");
                  onClose();
                }}
                className="flex h-12 items-center gap-4 rounded-lg border border-white/40 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Sign Up
              </button>
              <button
                onClick={() => {
                  toggleTheme();
                }}
                className="mt-2 flex h-12 items-center gap-4 rounded-lg px-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/10"
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ──────────────────────── Main Home Page ──────────────────────── */

export default function Home() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  return (
    <div className="min-h-[100dvh]">
      {/* Hero-level navigation */}
      <HeroNav
        onMenuOpen={() => setDrawerOpen(true)}
        onNavigate={handleNavigate}
      />

      {/* Mobile drawer */}
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* Sections */}
      <HeroSection onNavigate={handleNavigate} />
      <StatsSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <TrustedBySection />
      <PricingSection onNavigate={handleNavigate} />
      <DownloadCTA onNavigate={handleNavigate} />

      {/* Footer */}
      <div style={{ backgroundColor: "#0F172A" }}>
        <Footer />
      </div>
    </div>
  );
}
