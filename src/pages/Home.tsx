import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Dumbbell,
  Apple,
  ChevronDown,
  Menu,
  X,
  Sun,
  Moon,
} from "lucide-react";
import Footer from "@/components/Footer";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/lib/supabase";
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
        {["Features", "How It Works", "Pricing", "Waitlist"].map(
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
          onClick={() => onNavigate("/demo")}
          className="rounded-full bg-[var(--azfit-primary)] px-5 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--azfit-primary-light)] active:scale-[0.97]"
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
      className="relative flex min-h-[100dvh] flex-col overflow-hidden"
    >
      {/* Background image (no baked logo) with a subtle Ken Burns drift */}
      <motion.div
        className="absolute inset-0"
        animate={{ scale: [1.05, 1.12] }}
        transition={{
          duration: 20,
          ease: "linear",
          repeat: Infinity,
          repeatType: "reverse",
        }}
        style={{ transformOrigin: "50% 50%" }}
      >
        <img
          src={`${import.meta.env.BASE_URL}images/bg-wireframe-gym.webp`}
          alt=""
          fetchPriority="high"
          className="h-full w-full object-cover"
        />
      </motion.div>

      {/* Dark overlay gradient — keeps text readable while letting the
          baked-in logo cluster show through */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,17,32,0.6) 0%, rgba(11,17,32,0.72) 55%, rgba(11,17,32,0.92) 100%)",
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

      {/* Hero content: headline at top, orb unit in the middle, sub + CTA
          at bottom — all in normal flow on one central axis */}
      <div className="relative z-10 flex flex-1 flex-col items-center px-6 text-center">
        {/* Top block: eyebrow + headline + badge */}
        <div className="flex flex-col items-center pt-24 lg:pt-28">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: easeDefault }}
          className="mb-4 text-xs font-bold uppercase tracking-[0.15em]"
          style={{
            color: "var(--azfit-secondary-light)",
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
        </div>

        {/* Orb unit in normal flow — centered between headline and sub */}
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.1, ease: easeDefault }}
          >
            <AIShowcase />
          </motion.div>
        </div>

        {/* Bottom block: subheadline + CTA + store badges */}
        <div className="mt-auto flex flex-col items-center pb-8">
        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6, ease: easeDefault }}
          className="mx-auto mt-6 max-w-[480px] text-base leading-relaxed lg:text-lg"
          style={{
            color: "var(--dark-text-secondary)",
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
            onClick={() => onNavigate("/demo")}
            className="rounded-full bg-[var(--azfit-primary)] px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[var(--azfit-primary-light)] active:scale-[0.97] lg:px-10 lg:py-4 lg:text-base"
            style={{
              textShadow: "0 1px 3px rgba(0,0,0,0.3)",
              boxShadow: "0 0 20px rgba(13,148,136,0.4)",
            }}
          >
            Try the Live Demo
          </button>
          <a
            href="#waitlist"
            className="rounded-full border-2 border-white/40 px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:border-white/60 hover:bg-white/10 active:scale-[0.97] lg:px-10 lg:py-4 lg:text-base"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
          >
            Join the Waitlist
          </a>
        </motion.div>
        </div>
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
          style={{ color: "var(--azfit-secondary-light)" }}
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
      style={{ backgroundColor: "var(--dark-bg)" }}
    >
      <div className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-8 px-6 lg:grid-cols-4 lg:gap-0">
        {[
          { value: 270, suffix: "+", label: "Exercise Movements", prefix: "" },
          { value: 3, suffix: "", label: "Simple Tiers", prefix: "" },
          { value: 116, suffix: "+", label: "Clients Coached by AzFIT", prefix: "" },
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
                color: "var(--azfit-secondary-light)",
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
              style={{ color: "var(--dark-text-muted)" }}
            >
              {stat.label}
            </span>
            {/* Separator */}
            {i < 3 && (
              <div
                className="absolute right-0 top-1/2 hidden h-10 w-px -translate-y-1/2 lg:block"
                style={{ backgroundColor: "var(--dark-border)" }}
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
    iconColor: "var(--azfit-primary)",
    title: "Visual Progress Tracking",
    description:
      "See your fitness score, body composition, and performance trends with beautiful charts and circular progress indicators.",
  },
  {
    icon: Dumbbell,
    iconBg: "rgba(6,182,212,0.1)",
    iconColor: "var(--azfit-secondary)",
    title: "Smart Workout Logging",
    description:
      "Log sets, reps, and weight with our spreadsheet-style interface. Track RPE, rest times, and exercise history effortlessly.",
  },
  {
    icon: Apple,
    iconBg: "rgba(139,92,246,0.1)",
    iconColor: "var(--azfit-accent)",
    title: "Nutrition Monitoring",
    description:
      "Track macros, calories, and meal timing. Get insights into your protein, carbs, and fat intake to fuel your performance.",
  },
];

function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative overflow-hidden px-6 py-16 lg:py-24"
      style={{ backgroundColor: "var(--light-bg)" }}
    >
      {/* Holographic gym backdrop with a light overlay to preserve readability */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={`${import.meta.env.BASE_URL}images/bg-holo-gym.webp`}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(rgba(248,250,252,0.9), rgba(241,245,249,0.94))" }}
        />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Section header */}
        <ScrollReveal className="mb-12 text-center lg:mb-16">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--azfit-primary)" }}
          >
            FEATURES
          </p>
          <h2
            className="text-3xl font-bold tracking-tight lg:text-[40px]"
            style={{ color: "var(--light-text-primary)" }}
          >
            Everything You Need to Train Smarter
          </h2>
          <p
            className="mx-auto mt-4 max-w-[560px] text-base leading-relaxed lg:text-lg"
            style={{ color: "var(--light-text-secondary)" }}
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
                style={{ borderColor: "var(--light-border)" }}
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
                  style={{ color: "var(--light-text-primary)" }}
                >
                  {feature.title}
                </h3>
                <p
                  className="text-sm leading-relaxed lg:text-base"
                  style={{ color: "var(--light-text-secondary)" }}
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
      style={{ backgroundColor: "var(--light-elevated)" }}
    >
      <div className="mx-auto max-w-4xl">
        {/* Section header */}
        <ScrollReveal className="mb-12 text-center lg:mb-16">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--azfit-primary)" }}
          >
            HOW IT WORKS
          </p>
          <h2
            className="text-3xl font-bold tracking-tight lg:text-[40px]"
            style={{ color: "var(--light-text-primary)" }}
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
              style={{ backgroundColor: "var(--light-border)" }}
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
                  className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--azfit-primary)] text-sm font-bold text-white"
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
                  style={{ color: "var(--light-text-primary)" }}
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
                  style={{ color: "var(--light-text-secondary)" }}
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
    <section id="pricing" className="px-6 py-16 lg:py-24" style={{ backgroundColor: "var(--dark-bg)" }}>
      <div className="mx-auto max-w-6xl">
        <ScrollReveal className="mb-12 text-center lg:mb-16">
          <p
            className="mb-3 text-xs font-bold uppercase tracking-[0.1em]"
            style={{ color: "var(--azfit-primary)" }}
          >
            Pricing
          </p>
          <h2
            className="text-3xl font-bold tracking-tight text-white lg:text-[40px]"
          >
            Simple, Transparent Pricing
          </h2>
          <p className="mt-3 text-sm" style={{ color: "var(--light-text-muted)" }}>
            Start free, upgrade when you need more power
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <ScrollReveal key={plan.name} delay={i * 0.1}>
              <div
                className="relative rounded-2xl border p-6 lg:p-8"
                style={{
                  backgroundColor: plan.highlighted ? "var(--dark-surface)" : "var(--dark-bg)",
                  borderColor: plan.highlighted ? "var(--azfit-primary)" : "var(--dark-elevated)",
                  boxShadow: plan.highlighted ? "0 0 30px rgba(13,148,136,0.15)" : "none",
                }}
              >
                {plan.highlighted && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-white"
                    style={{ backgroundColor: "var(--azfit-primary)" }}
                  >
                    Most Popular
                  </div>
                )}
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-sm" style={{ color: "var(--dark-text-muted)" }}>{plan.period}</span>
                </div>
                <p className="mt-2 text-sm" style={{ color: "var(--light-text-muted)" }}>{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: "var(--dark-text-secondary)" }}>
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="var(--azfit-primary)" strokeWidth={2}>
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
                    backgroundColor: plan.highlighted ? "var(--azfit-primary)" : "transparent",
                    border: plan.highlighted ? "none" : "1px solid var(--dark-border)",
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

/* ──────────────────────── Waitlist form (Phase 57) ──────────────────────── */

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — bots only
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");

  const submit = async () => {
    const trimmed = email.trim();
    if (website) {
      // honeypot filled → bot: pretend success, write nothing
      setState("done");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setState("error");
      return;
    }
    setState("saving");
    const { error } = await supabase.from("waitlist_emails").insert({ email: trimmed });
    setState(error ? "error" : "done");
  };

  if (state === "done") {
    return (
      <p className="mt-6 text-sm font-semibold" style={{ color: "var(--success)" }}>
        You're on the list — we'll be in touch.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <div className="mx-auto flex max-w-md items-center gap-2">
        {/* honeypot: hidden from humans, irresistible to bots */}
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
          placeholder="Website"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setState("idle");
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="you@email.com"
          aria-label="Email address"
          className="flex-1 rounded-full border px-5 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-[var(--azfit-primary)]"
          style={{ borderColor: "var(--dark-elevated)", backgroundColor: "rgba(255,255,255,0.06)" }}
        />
        <button
          onClick={submit}
          disabled={state === "saving"}
          className="rounded-full bg-[var(--azfit-primary)] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[var(--azfit-primary-light)] active:scale-[0.97] disabled:opacity-60"
        >
          {state === "saving" ? "Joining…" : "Join"}
        </button>
      </div>
      {state === "error" && (
        <p className="mt-2 text-xs" style={{ color: "var(--warning)" }}>
          Enter a valid email address.
        </p>
      )}
    </div>
  );
}

/* ──────────────────────── Section 6: Download CTA + Footer ──────────────────────── */

function DownloadCTA({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <section
      id="waitlist"
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
              color: "var(--dark-text-secondary)",
              textShadow: "0 2px 4px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.3)",
            }}
          >
            Try AzFIT in your browser today. Native iOS and Android apps are on the roadmap.
          </p>

          {/* CTA Button */}
          <button
            onClick={() => onNavigate("/demo")}
            className="mt-8 rounded-full bg-[var(--azfit-primary)] px-10 py-4 text-base font-semibold text-white transition-all duration-200 hover:bg-[var(--azfit-primary-light)] active:scale-[0.97]"
            style={{
              textShadow: "0 1px 3px rgba(0,0,0,0.3)",
              boxShadow: "0 0 24px rgba(13,148,136,0.5)",
            }}
          >
            Try AzFIT Free
          </button>

          {/* Waitlist — replaces the Coming Soon store badges (Phase 57) */}
          <div className="mt-8">
            <p className="text-sm font-semibold text-white">Join the waitlist</p>
            <p className="mt-1 text-xs" style={{ color: "var(--dark-text-muted)" }}>
              Native iOS and Android apps are on the roadmap — leave your email and we'll tell you when they land.
            </p>
            <WaitlistForm />
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
              backgroundColor: "var(--dark-surface)",
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
              {["Features", "How It Works", "Pricing", "Waitlist"].map(
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
                style={{ backgroundColor: "var(--dark-border)" }}
              />
              <button
                onClick={() => {
                  onNavigate("/dashboard");
                  onClose();
                }}
                className="flex h-12 items-center gap-4 rounded-lg bg-[var(--azfit-primary)] px-3 text-sm font-semibold text-white active:scale-[0.98]"
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
      <PricingSection onNavigate={handleNavigate} />
      <DownloadCTA onNavigate={handleNavigate} />

      {/* Footer */}
      <div style={{ backgroundColor: "var(--dark-bg)" }}>
        <Footer />
      </div>
    </div>
  );
}
