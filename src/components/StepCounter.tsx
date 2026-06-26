import { useState, useEffect } from "react";
import ProgressRing from "./ProgressRing";

export function StepCounter() {
  const [steps, setSteps] = useState(0);
  const goal = 10000;

  useEffect(() => {
    const interval = setInterval(() => {
      setSteps((prev) => Math.min(prev + 100, goal));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const percentage = Math.round((steps / goal) * 100);

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-lg font-semibold mb-2 text-white">Daily Steps</h3>
      <ProgressRing
        percentage={percentage}
        color="#0D9488"
        label="STEPS"
        value={`${steps.toLocaleString()}`}
        glowClass="glow-teal"
      />
      <p className="text-sm mt-2 text-white">
        {steps.toLocaleString()} / {goal.toLocaleString()} steps
      </p>
    </div>
  );
}
