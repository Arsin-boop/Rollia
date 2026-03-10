import { motion } from "motion/react";
import { useMemo } from "react";

export function StarryBackground() {
  // Generate random positions for glowing stars
  const stars = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 3 + 1.5,
        delay: Math.random() * 3,
        glowIntensity: Math.random() * 0.5 + 0.5,
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            boxShadow: `0 0 ${star.size * 2}px ${star.size}px rgba(255, 255, 255, ${star.glowIntensity * 0.6}),
                        0 0 ${star.size * 4}px ${star.size * 2}px rgba(255, 255, 255, ${star.glowIntensity * 0.3}),
                        0 0 ${star.size * 6}px ${star.size * 3}px rgba(147, 51, 234, ${star.glowIntensity * 0.2})`,
          }}
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [1, 1.3, 1],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            delay: star.delay,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

