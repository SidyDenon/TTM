// src/Avis.jsx
import React from "react";
import { motion } from "framer-motion";
import CountUp from "react-countup";

/* --- Données --- */
const TESTIMONIALS = [
  { name: "Moussa Diarra",   rating: 5, text: "Intervention rapide et très pro. Remorquage en moins de 30 minutes, et suivi jusqu’au garage. Je recommande !" },
  { name: "Aïcha Koné",      rating: 5, text: "Panne de batterie au bureau : démarrage + contrôle alternateur. Service nickel et prix clair." },
  { name: "Ibrahim Traoré",  rating: 4, text: "Livraison de carburant sur autoroute. Bon contact, arrivée à l’heure annoncée, parfait." },
  { name: "Fatoumata Sangaré", rating: 5, text: "Ouverture de porte sans aucune rayure. Très précautionneux et rassurants." },
];

const STATS = [
  { value: 400, label: "Clients dépannés",     suffix: "+" },
  { value: 120, label: "Remorquages / mois",   suffix: "+" },
  { value: 95,  label: "Satisfaction (%)",     suffix: "%" },
];

/* --- Petits composants --- */
function Stars({ n = 5 }) {
  return (
    <div className="flex gap-1 text-amber-500" aria-label={`${n} étoiles`}>
      {Array.from({ length: n }).map((_, i) => <i key={i} className="fa-solid fa-star" />)}
    </div>
  );
}

/* --- Variants Motion --- */
const sectionV = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: .4, ease: "easeOut" } } };

const imageV = {
  hidden: { opacity: 0, y: 16, scale: 0.96, rotate: -1 },
  show:   { opacity: 1, y: 0,  scale: 1,    rotate: 0,  transition: { duration: .55, ease: "easeOut" } }
};

const accentV = {
  hidden: { opacity: 0, x: -10 },
  show:   { opacity: .95, x: 0, transition: { duration: .45, ease: "easeOut", delay: .1 } }
};

const statsContainerV = { hidden: {}, show: { transition: { staggerChildren: .08 } } };
const statItemV       = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: .3, ease: "easeOut" } } };

const listContainerV  = { hidden: {}, show: { transition: { staggerChildren: .09 } } };
const cardV           = { hidden: { opacity: 0, y: 12, scale: .98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: .35, ease: "easeOut" } } };

/* --- Composant principal --- */
export default function Avis() {
  return (
    <motion.section
      className="w-full min-h-screen flex"
      variants={sectionV}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
    >
      <div className="z-5 w-full bg-white/85 backdrop-blur-sm text-zinc-900 flex flex-col items-center gap-8 py-16 px-4">
        {/* Titre */}
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Avis Client</h2>

        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[minmax(0,380px),1fr] gap-10 items-start">
          {/* Colonne gauche : image + stats */}
          <div className="flex flex-col items-center md:items-center gap-6 self-center">
            {/* Image animée, parfaitement centrée */}
            <motion.div
              className="relative w-full max-w-[340px]"
              variants={imageV}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.45 }}
            >
              {/* Accent rouge animé */}
              <motion.div
                className="absolute -left-3 -top-3 h-[86%] w-[92%] rounded-2xl bg-[#800E08]"
                variants={accentV}
              />
              {/* Cadre image */}
              <div className="relative z-10 w-full rounded-2xl shadow-xl overflow-hidden">
                <div className="aspect-[4/3] w-full bg-white/5">
                  <img
                    src="/assets/avsr.png"
                    alt="Client satisfait"
                    loading="lazy"
                    className="h-full w-full object-contain"
                    draggable="false"
                  />
                </div>
              </div>
            </motion.div>

            {/* Stats animées en cascade */}
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 gap-6 w-full text-center md:text-left"
              variants={statsContainerV}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
            >
              {STATS.map((s, i) => (
                <motion.div key={i} variants={statItemV} className="flex flex-col items-center md:items-start">
                  <div className="text-4xl md:text-5xl font-extrabold text-[#800E08] leading-tight">
                    <CountUp end={s.value} duration={2} enableScrollSpy />
                    <span>{s.suffix}</span>
                  </div>
                  <p className="text-sm md:text-base text-zinc-600">{s.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Colonne droite : avis, apparition en cascade */}
          <motion.div
            className="grid gap-4"
            variants={listContainerV}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
          >
            {TESTIMONIALS.map((t, i) => (
              <motion.article
                key={i}
                variants={cardV}
                className="rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm p-4 md:p-5 hover:shadow-md transition w-full"
              >
                <header className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{t.name}</h3>
                  <Stars n={t.rating} />
                </header>
                <p className="mt-2 text-zinc-700 leading-relaxed">{t.text}</p>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
