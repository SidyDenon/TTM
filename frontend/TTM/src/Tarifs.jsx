// src/Tarifs.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSupportConfig } from "./context/SupportConfigContext";
import { DEFAULT_SERVICES, fetchPublicServices } from "./config/services";
import { fetchSiteContent } from "./config/siteContent";
import "./App.css";

/* ---------- Utils ---------- */
const cx = (...c) => c.filter(Boolean).join(" ");
const formatPrice = (p) => (p ? String(p).replace(/\s/g, "\u202F") : "—");
const excerpt = (s, n = 120) => (s.length > n ? s.slice(0, n).trim() + "…" : s);

const tarifModalVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.2 } },
  exit:   { opacity: 0, transition: { duration: 0.2 } },
};

const tarifCardVariants = {
  hidden: { y: 40, opacity: 0, scale: 0.97 },
  show:   { y: 0,  opacity: 1, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
  exit:   { y: 24, opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: "easeIn" } },
};

/* ---------- Modal ---------- */
function TarifModal({ open, onClose, item, onWhatsApp }) {
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
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          onClick={onClose}
          variants={tarifModalVariants}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            variants={tarifModalVariants}
          />

          {/* Card */}
          <motion.div
            className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200"
            onClick={(e) => e.stopPropagation()}
            variants={tarifCardVariants}
          >
            {/* Header: image + titre + prix + fermer */}
            <div className="flex items-start gap-3 p-5">
              {item.img && (
                <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#800E08]/10 overflow-hidden">
                  <img
                    src={item.img}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-zinc-900">{item.title}</h3>
                <p className="mt-1 text-[#800E08] font-bold">{formatPrice(item.amount)}</p>
              </div>
              <button
                onClick={onClose}
                className="ml-2 rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition"
                aria-label="Fermer"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            {/* Corps scrollable – même hauteur que Services */}
            <div className="px-5 pb-5">
              <div className="rounded-lg h-[500px] overflow-y-scroll bg-zinc-50 p-4 text-sm text-zinc-900 leading-7 tracking-widest whitespace-pre-line">
                {item.details || item.description}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-[#800E08] px-4 py-2 text-[#800E08] hover:bg-[#800E08] hover:text-white transition"
                  onClick={() => onWhatsApp(item)}
                >
                  Demander ce service <i className="fa-solid fa-arrow-right" />
                </button>
                <button
                  onClick={onClose}
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
  );
}

/* ---------- Carte ---------- */
function Card({ item, onMore, onWhatsApp }) {
  return (
    <motion.article
      layout
      className={cx(
        "group rounded-2xl overflow-hidden bg-white text-black w-[260px]",
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

        <p className="text-[12px] text-zinc-600">
          {item.subtitle || excerpt(item.description || "", 70)}
        </p>

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
  const [sectionContent, setSectionContent] = React.useState({});
  const [cardsPerRow, setCardsPerRow] = React.useState(4);
  const cardsContainerRef = React.useRef(null);
  const hiddenStartRef = React.useRef(null);
  const { buildSupportServiceLink } = useSupportConfig();
  const collapseMore = React.useCallback(() => {
    setShowMore(false);
    if (!cardsContainerRef.current) return;
    cardsContainerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
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

  React.useEffect(() => {
    let active = true;
    fetchSiteContent()
      .then((data) => {
        if (!active) return;
        setSectionContent(data?.tarifs || {});
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const photosByService = React.useMemo(() => {
    const photos = sectionContent?.photos;
    if (!photos || typeof photos !== "object" || Array.isArray(photos)) return {};
    return photos;
  }, [sectionContent]);

  const tarifsWithPhotos = React.useMemo(
    () =>
      tarifs.map((item) => {
        const key = String(item.title || "").toLowerCase().trim();
        const override = photosByService[key];
        if (!override) return item;
        return { ...item, img: override };
      }),
    [tarifs, photosByService]
  );

  React.useEffect(() => {
    const updateCardsPerRow = () => {
      const node = cardsContainerRef.current;
      if (!node) return;
      const containerWidth = node.clientWidth;
      const cardWidth = 260;
      const gap = 20;
      const perRow = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));
      setCardsPerRow(perRow);
    };

    updateCardsPerRow();
    window.addEventListener("resize", updateCardsPerRow);
    return () => window.removeEventListener("resize", updateCardsPerRow);
  }, []);

  React.useEffect(() => {
    if (!showMore) return;
    if (!hiddenStartRef.current) return;
    hiddenStartRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showMore]);

  const visibleTarifs = tarifsWithPhotos.slice(0, cardsPerRow);
  const sectionTitle = sectionContent?.title || "Nos Tarifs";
  const sectionSubtitle =
    sectionContent?.subtitle || "NOS TARIFS LES MEILLEURS SUR LE MARCHÉ";
  const sectionLogo = sectionContent?.logoImage || "/assets/logoApp2.png";

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
  {sectionTitle}
</motion.h1>

<header className="py-2 flex items-center gap-4">
  {/* Logo qui glisse depuis la gauche */}
  <motion.div
    className="w-50 h-20"
    initial={{ opacity: 0, x: -50 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, amount: 0.4 }}
    transition={{ duration: 0.6, ease: "easeOut" }}
  >
    <img src={sectionLogo} alt="Logo tarifs" className="h-full w-full object-contain" />
  </motion.div>

  {/* Texte qui glisse depuis la droite */}
  <motion.p
    className="text-2xl sm:text-3xl font-extralight italic max-w-[560px]"
    initial={{ opacity: 0, x: 50 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true, amount: 0.4 }}
    transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
  >
    {sectionSubtitle}
  </motion.p>
</header>


        {/* Première ligne visible, le reste au clic sur la flèche */}
        <div ref={cardsContainerRef} className="w-full max-w-6xl flex flex-wrap justify-center gap-5">
          {visibleTarifs.map((item, i) => (
            <Card
              key={`t-${i}`}
              item={item}
              onMore={() => setSelected(item)}
              onWhatsApp={openWhatsApp}
            />
          ))}
        </div>

        {tarifsWithPhotos.length > cardsPerRow && !showMore && (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition"
            aria-label="Afficher plus de tarifs"
          >
            Voir plus
            <i className="fa-solid fa-chevron-down" />
          </button>
        )}

        <AnimatePresence initial={false}>
          {showMore && tarifsWithPhotos.length > cardsPerRow && (
            <motion.div
              key="more-tarifs"
              initial={{ height: 0, opacity: 0, y: -10 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="w-full overflow-hidden"
            >
              <div ref={hiddenStartRef} className="w-full max-w-6xl mx-auto pt-5 flex flex-wrap justify-center gap-5">
                {tarifsWithPhotos.slice(cardsPerRow).map((item, i) => (
                  <Card
                    key={`t-more-${i}`}
                    item={item}
                    onMore={() => setSelected(item)}
                    onWhatsApp={openWhatsApp}
                  />
                ))}
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={collapseMore}
                  className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition"
                  aria-label="Replier les tarifs"
                >
                  Replier
                  <i className="fa-solid fa-chevron-up" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

