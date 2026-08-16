// ScrollToTopProgress.jsx
import React from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";

export default function ScrollToTopProgress() {
  const { scrollYProgress } = useScroll();

  // lissage du progrès (plus doux)
  const smooth = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 20,
    mass: 0.25,
  });

  // opacité du bouton: caché tout en haut, visible après 5% de scroll
  const opacity = useTransform(smooth, [0, 0.05, 1], [0, 0.95, 1]);

  // cercle SVG
  const size = 56;                // taille globale du bouton
  const stroke = 5;               // épaisseur du contour
  const r = (size - stroke) / 2;  // rayon du cercle
  const C = 2 * Math.PI * r;      // circonférence

  // la partie non remplie du trait (plus on scrolle, plus on réduit l'offset)
  const dashOffset = useTransform(smooth, (p) => C * (1 - p));

  const onClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <motion.button
      onClick={onClick}
      aria-label="Revenir en haut"
      title="Revenir en haut"
      style={{ opacity }}
      className="
        fixed bottom-5 right-5 z-[70]
        grid place-items-center
        h-14 w-14 rounded-full
        bg-black/60 text-white
        backdrop-blur-sm
        shadow-lg shadow-black/25
        ring-1 ring-white/10
        hover:bg-black/70 active:scale-95
        transition
      "
    >
      {/* fond + anneau de progression */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        {/* piste grise */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,.25)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* progression (couleur TTM) */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#800E08"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={C}
          style={{ strokeDashoffset: dashOffset }}
          // commence en haut (par défaut à droite)
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      {/* icône flèche vers le haut */}
      <i className="fa-solid fa-arrow-up relative z-10" />
    </motion.button>
  );
}
