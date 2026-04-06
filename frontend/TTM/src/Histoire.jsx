// src/Histoire.jsx
/* eslint-disable no-unused-vars */
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DEFAULT_MESSAGES } from "./config/links";
import { useSupportConfig } from "./context/SupportConfigContext";
import { fetchSiteContent } from "./config/siteContent";

const fadeLeft  = { hidden: {opacity: 0, x: -24}, show: {opacity: 1, x: 0, transition:{duration:.45, ease:"easeOut"}} };
const fadeRight = { hidden: {opacity: 0, x:  24}, show: {opacity: 1, x: 0, transition:{duration:.45, ease:"easeOut"}} };

// Variants pour la modal
const overlayVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.2 } },
  exit:   { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { y: 24, opacity: 0, scale: 0.98 },
  show:   { y: 0,  opacity: 1, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
  exit:   { y: 24, opacity: 0, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" } },
};

export default function Histoire() {
  const [open, setOpen] = React.useState(false);
  const [content, setContent] = React.useState({});
  const { buildSupportWhatsAppLink } = useSupportConfig();
  const histoireContactLink = React.useMemo(
    () => buildSupportWhatsAppLink(DEFAULT_MESSAGES.generalInquiry),
    [buildSupportWhatsAppLink]
  );

  // Esc pour fermer + lock du scroll
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    let active = true;
    fetchSiteContent()
      .then((data) => {
        if (!active) return;
        setContent(data?.histoire || {});
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const title = content?.title || "Notre Histoire";
  const bodyParagraphs = String(content?.modalBody || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const intro1 =
    content?.intro1 ||
    bodyParagraphs[0] ||
    "Tow Truck Mali (TTM) est né d’un besoin simple : rendre le dépannage automobile rapide, fiable et accessible partout. Des routes de Bamako aux trajets interurbains, nous avons bâti un réseau d’opérateurs formés et une application pensée pour intervenir en quelques minutes.";
  const intro2 =
    content?.intro2 ||
    bodyParagraphs[1] ||
    "Nous avons d’abord cartographié les zones d’intervention, puis conçu un parcours clair pour le client, l’opérateur et l’administrateur. Aujourd’hui, TTM évolue avec des fonctionnalités financières intégrées et un suivi de mission transparent.";
  const image =
    content?.image && String(content.image).trim()
      ? String(content.image).trim()
      : "/assets/histoire.png";
  const modalTitle = content?.modalTitle || "L’histoire de TTM";
  const modalSubtitle =
    content?.modalSubtitle ||
    "Depuis les premiers dépannages jusqu’au réseau actuel";
  const modalBody =
    content?.modalBody ||
    `TTM est né sur le terrain, au contact des automobilistes en difficulté : batterie à plat, pneu crevé, panne sèche au milieu d’un trajet.

Nous avons commencé avec un petit groupe d’opérateurs motivés, des outils fiables et une promesse simple : arriver vite et bien.

Très vite, nous avons cartographié les zones d’intervention, mesuré les temps de parcours et standardisé nos protocoles.

Côté technologique, l’application TTM s’est construite autour de trois profils : client, opérateur et administrateur.

Notre objectif reste le même : réduire l’immobilisation et garantir la sécurité.`;

  return (
    <section className="w-full relative">
      <div className="bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Colonne texte */}
          <motion.div
            variants={fadeLeft}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            className="text-zinc-900"
          >
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h2>

            <p className="mt-5 text-[15px] md:text-base leading-7 md:leading-8">
              {intro1}
            </p>

            <p className="mt-4 text-[15px] md:text-base leading-7 md:leading-8">
              {intro2}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#800E08] px-5 py-2 text-[#800E08] hover:bg-[#800E08] hover:text-white transition"
              >
                En savoir plus
                <i className="fa-solid fa-arrow-right" />
              </button>

            </div>
          </motion.div>

          {/* Colonne image — on garde exactement ton style */}
          <motion.div
            variants={fadeRight}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            className="relative flex justify-center items-center lg:justify-end  "
          >
            <div className="relative left-5 -top-5 h-[400px] w-[300px] rounded-2xl bg-[#800E08] opacity-95 hidden sm:block" />
            <img
              src={image}
              alt="Technicien TTM au travail"
              loading="lazy"
              className="absolute h-full z-10 w-[300px] max-w-[420px] aspect-[3/4] object-cover rounded-2xl shadow-xl"
            />
          </motion.div>
        </div>
      </div>

      {/* -------- Modal -------- */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="histoire-title"
            onClick={() => setOpen(false)}
            variants={overlayVariants}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {/* Overlay */}
            <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />

            {/* Panel */}
            <motion.div
              variants={modalVariants}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-3xl rounded-2xl bg-white ring-1 ring-zinc-200 shadow-xl overflow-hidden"
            >
              {/* En-tête */}
              <div className="flex items-start justify-between gap-4 p-5">
                <div>
                  <h3 id="histoire-title" className="text-xl font-semibold text-zinc-900">
                    {modalTitle}
                  </h3>
                  <p className="text-sm text-zinc-500">{modalSubtitle}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition"
                  aria-label="Fermer"
                >
                  <i className="fa-solid fa-xmark text-lg" />
                </button>
              </div>

              {/* Contenu long */}
              <div className="px-5 pb-6">
                <div className="rounded-lg bg-zinc-50 p-4 text-[15px] leading-7 text-zinc-800 max-h-[65vh] overflow-y-auto whitespace-pre-line">
                  {modalBody}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={histoireContactLink}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-[#800E08] px-4 py-2 text-[#800E08] hover:bg-[#800E08] hover:text-white transition"
                  >
                    Nous écrire sur WhatsApp <i className="fa-brands fa-whatsapp" />
                  </a>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg border px-4 py-2 text-zinc-700 hover:bg-zinc-100 transition"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

