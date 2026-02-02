import React from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { useSupportConfig } from "./context/SupportConfigContext";
import { DEFAULT_SERVICES, fetchPublicServices } from "./config/services";
/* ---------- Variants (Framer Motion) ---------- */
const overlayVariants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.2 } },
  exit:   { opacity: 0, transition: { duration: 0.2 } },
};

const modalVariants = {
  hidden: { y: 40, opacity: 0, scale: 0.97 },
  show:   { y: 0,  opacity: 1, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
  exit:   { y: 24, opacity: 0, scale: 0.97, transition: { duration: 0.2, ease: "easeIn" } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28 },
  show:   (i) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: 0.05 * i, ease: "easeOut" },
  }),
};

/* ---------- Modal (animée) ---------- */
function Modal({ open, onClose, service, onWhatsApp }) {
  React.useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && service && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
          aria-labelledby="service-title"
          onClick={onClose}
          variants={overlayVariants}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            variants={overlayVariants}
          />

          {/* Card */}
          <motion.div
            className="relative z-10 w-full max-w-5xl rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200"
            onClick={(e) => e.stopPropagation()}
            variants={modalVariants}
          >
            <div className="flex items-start gap-3 p-5">
              {service.iconImage ? (
                <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-full bg-[#800E08]/10">
                  <img
                    src={service.iconImage}
                    alt={service.iconAlt || service.title}
                    className="h-7 w-7 object-contain"
                    loading="lazy"
                  />
                </div>
              ) : (
                <i className={`fa-solid ${service.icon} text-5xl text-[#800E08] mt-1`} />
              )}
              <div className="flex-1">
                <h2 id="service-title" className="text-xl font-semibold text-zinc-900">
                  {service.title}
                </h2>
                <p className="mt-1 text-zinc-600 text-lg/7">{service.desc}</p>
              </div>
              <button
                onClick={onClose}
                className="ml-2 rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition"
                aria-label="Fermer la fenêtre"
              >
                <i className="fa-solid fa-xmark text-lg" />
              </button>
            </div>

            <div className="px-5 pb-5">
              <div className="rounded-lg h-[500px] overflow-y-scroll bg-zinc-50 p-4 text-sm text-zinc-900 leading-7 tracking-widest whitespace-pre-line">
                {service.details}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-[#800E08] px-4 py-2 text-[#800E08] hover:bg-[#800E08] hover:text-white transition"
                  onClick={() => onWhatsApp(service)}
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

/* ---------- Card (révélation au scroll + hover overlay) ---------- */
function ServiceCard({ icon, iconImage, iconAlt, title, desc, onMore, index }) {
  return (
    <motion.div
      className="group relative overflow-hidden rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-zinc-200"
      variants={cardVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.3 }}
      custom={index}
    >
      {/* Contenu */}
      <div className="relative z-10 space-y-2 transition-opacity duration-500 group-hover:opacity-0 group-hover:pointer-events-none">
        {iconImage ? (
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#800E08]/10">
            <img
              src={iconImage}
              alt={iconAlt || title}
              className="h-7 w-7 object-contain"
              loading="lazy"
            />
          </div>
        ) : (
          <i className={`fa-solid ${icon} text-4xl text-[#800E08]`} />
        )}
        <h3 className="font-semibold text-zinc-900">{title}</h3>
        <p className="text-sm text-zinc-600">{desc}</p>
      </div>

      {/* Fond rouge animé */}
      <div className="absolute inset-0 translate-y-[90%] bg-[#800E08] rounded-xl transition-transform duration-500 ease-in-out group-hover:translate-y-0 pointer-events-none" />

      {/* Bouton centré */}
      <div className="absolute inset-0 translate-y-full flex items-center justify-center transition-transform duration-500 ease-in-out group-hover:translate-y-0 z-20">
        <button
          type="button"
          onClick={onMore}
          className="cursor-pointer text-white font-semibold text-lg border-2 border-white px-4 py-2 rounded-lg hover:bg-white hover:text-[#800E08] transition-colors duration-300"
        >
          En savoir plus <i className="fa-solid fa-arrow-up-right-from-square ml-2" />
        </button>
      </div>
    </motion.div>
  );
}
 
/* ---------- Page Services ---------- */
export default function Services() {
  const [selected, setSelected] = React.useState(null);
  const [open, setOpen] = React.useState(false);
  const [services, setServices] = React.useState(DEFAULT_SERVICES);
  const { buildSupportServiceLink } = useSupportConfig();

  React.useEffect(() => {
    let active = true;
    fetchPublicServices()
      .then((data) => {
        if (!active || !data?.length) return;
        setServices(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const openModal = (service) => {
    setSelected(service);
    setOpen(true);
  };
  const closeModal = () => setOpen(false);
  const openWhatsApp = (service) => {
    window.open(
      buildSupportServiceLink(service),
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <section className="w-full min-h-screen flex relative">

      <div className="z-5 min-h-screen w-full bg-black/50 text-white flex flex-col items-center gap-35 py-20 px-4">
        <motion.h2
          className="text-3xl font-bold"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.4 }}
        >
          Nos Services
        </motion.h2>

        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((s, i) => (
            <ServiceCard
              key={i}
              index={i}
              {...s}
              onMore={() => openModal(s)}
            />
          ))}
        </div>
      </div>

      <Modal open={open} onClose={closeModal} service={selected} onWhatsApp={openWhatsApp} />
    </section>
  );
}

