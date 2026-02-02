// src/Tarifs.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupportConfig } from "./context/SupportConfigContext";
import { DEFAULT_SERVICES, fetchPublicServices } from "./config/services";
import "./App.css";

/* ---------- Utils ---------- */
const cx = (...c) => c.filter(Boolean).join(" ");
const formatPrice = (p) => p.replace(/\s/g, "\u202F");
const excerpt = (s, n = 120) => (s.length > n ? s.slice(0, n).trim() + "…" : s);

/* ---------- Modal ---------- */
function TarifModal({ open, onClose, item, onWhatsApp }) {
  // Fermer sur Échap + bloquer le scroll
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && item && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={onClose}
          >
            <div
              className="relative w-full max-w-2xl rounded-2xl bg-white ring-1 ring-zinc-200 shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-[16/9] overflow-hidden">
                <img
                  src={item.img}
                  alt={item.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-zinc-900">{item.title}</h3>
                    <p className="text-[#800E08] font-bold mt-1">{formatPrice(item.amount)}</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition"
                    aria-label="Fermer"
                  >
                    <i className="fa-solid fa-xmark text-lg" />
                  </button>
                </div>

                <div className="mt-3 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-800 whitespace-pre-line leading-6">
                  {item.details || item.description}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => onWhatsApp(item)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#800e08] px-4 py-2 text-[#800e08] hover:bg-[#800e08]/10 transition"
                  >
                    <i className="fa-brands fa-whatsapp" />
                    Demander ce service
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-lg border px-4 py-2 text-zinc-700 hover:bg-zinc-100 transition"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Carte ---------- */
function Card({ item, onMore, onWhatsApp }) {
  return (
    <motion.article
      layout
      className={cx(
        "group rounded-2xl overflow-hidden bg-white text-black",
        "ring-1 ring-zinc-200 shadow-sm transition",
        "hover:-translate-y-0.5 hover:shadow-md focus-within:-translate-y-0.5 focus-within:shadow-md"
      )}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <div className="aspect-[4/3] w-full overflow-hidden">
        <img
          src={item.img}
          alt={`${item.title} – illustration`}
          loading="lazy"
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
        />
      </div>

      <div className="p-4 text-center space-y-2">
        <h2 className="font-bold text-sm sm:text-base text-zinc-900">{item.title}</h2>
        <p className="text-[11px] text-zinc-500 -mt-1">À partir de</p>
        <p className="font-bold text-[#800E08]">{formatPrice(item.amount)}</p>

        <p className="text-[12px] text-zinc-600">{excerpt(item.description, 140)}</p>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onMore}
            className={cx(
              "mt-2 inline-flex items-center justify-center gap-2",
              "rounded-2xl border border-[#800E08] px-3 py-1 text-[12px] text-[#800E08]",
              "transition hover:bg-[#800E08] hover:text-white focus:outline-none",
              "focus-visible:ring-2 focus-visible:ring-[#800E08] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            )}
            aria-label={`En savoir plus sur ${item.title}`}
          >
            En savoir plus
            <i className="fa-solid fa-arrow-up-right-from-square text-[11px]" />
          </button>

          <button
            type="button"
            onClick={() => onWhatsApp(item)}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl border border-[#25D366] px-3 py-1 text-[12px] text-[#128C7E] hover:bg-[#25D366]/10 transition"
            aria-label={`Demander ${item.title} sur WhatsApp`}
            title="Demander ce service sur WhatsApp"
          >
            <i className="fa-brands fa-whatsapp text-[13px]" />
            Demander
          </button>
        </div>
      </div>
    </motion.article>
  );
}

/* ---------- Page Tarifs ---------- */
export default function Tarifs() {
  const [showMore, setShowMore] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const [tarifs, setTarifs] = React.useState(DEFAULT_SERVICES);
  const { buildSupportServiceLink } = useSupportConfig();
  const openWhatsApp = React.useCallback(
    (service) => {
      window.open(
        buildSupportServiceLink(service),
        "_blank",
        "noopener,noreferrer"
      );
    },
    [buildSupportServiceLink]
  );

  React.useEffect(() => {
    let active = true;
    fetchPublicServices()
      .then((data) => {
        if (!active || !data?.length) return;
        setTarifs(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const featured = tarifs.filter((t) => t.featured);
  const visibleFeatured = featured.length ? featured : tarifs;
  const extra = featured.length ? tarifs.filter((t) => !t.featured) : [];

  return (
    <section className="w-full min-h-screen flex">
      <div className="z-5 w-full bg-black/50 text-white flex flex-col items-center gap-15 py-24 px-4">
     <motion.h1
  className="text-4xl font-bold"
  initial={{ opacity: 0, y: -40 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, amount: 0.4 }}
  transition={{ duration: 0.6, ease: "easeOut" }}
>
  Nos Tarifs
</motion.h1>

<header className="py-2 flex items-center gap-4">
  {/* Logo qui glisse depuis la gauche */}
  <motion.div
    className="bg-[url('/assets/logoApp2.png')] bg-no-repeat bg-center bg-cover w-50 h-20"
    initial={{ opacity: 0, x: -50 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, amount: 0.4 }}
    transition={{ duration: 0.6, ease: "easeOut" }}
  />

  {/* Texte qui glisse depuis la droite */}
  <motion.p
    className="text-2xl sm:text-3xl font-extralight italic max-w-[560px]"
    initial={{ opacity: 0, x: 50 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, amount: 0.4 }}
    transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
  >
    NOS TARIFS LES MEILLEURS SUR LE MARCHÉ
  </motion.p>
</header>


        {/* Grille responsive sans trous */}
        <div
          className="w-full max-w-6xl grid gap-5"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
        >
          {visibleFeatured.map((item, i) => (
            <Card
              key={`f-${i}`}
              item={item}
              onMore={() => setSelected(item)}
              onWhatsApp={openWhatsApp}
            />
          ))}
        </div>

        {/* Bloc "voir plus" animé */}
        <AnimatePresence initial={false}>
          {showMore && (
            <motion.div
              className="w-full max-w-6xl"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div
                className="mt-6 grid gap-5"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
              >
                {extra.map((item, i) => (
                  <Card
                    key={`x-${i}`}
                    item={item}
                    onMore={() => setSelected(item)}
                    onWhatsApp={openWhatsApp}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bouton bas */}
        {extra.length > 0 && (
          <button
            onClick={() => setShowMore((v) => !v)}
            className={cx(
              "cursor-pointer mt-10 inline-flex items-center gap-2",
              "border-2 border-[#800E08] px-6 rounded-3xl text-sm py-2",
              "shadow-white/30 hover:bg-[#800E08] hover:text-white transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            )}
            aria-expanded={showMore}
          >
            {showMore ? "Voir moins" : "Voir plus"}
            <i
              className={cx(
                "fa-solid fa-chevron-down transition-transform",
                showMore ? "rotate-180" : "rotate-0"
              )}
            />
          </button>
        )}
      </div>

      {/* Modal détail */}
      <TarifModal
        open={!!selected}
        onClose={() => setSelected(null)}
        item={selected}
        onWhatsApp={openWhatsApp}
      />
    </section>
  );
}

