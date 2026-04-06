// src/FAQ.jsx
/* eslint-disable no-unused-vars */
import React from "react";
import { DEFAULT_MESSAGES } from "./config/links";
import { motion, AnimatePresence } from "framer-motion";
import { FAQS } from "./config/faq";
import { useSupportConfig } from "./context/SupportConfigContext";
import { fetchSiteContent } from "./config/siteContent";
import { getBaseCandidates } from "./config/api";

/* --------- Variants Motion --------- */
const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};
const imageVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 16 },
  show:   { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};
const headingVariants = {
  hidden: { opacity: 0, x: 16 },
  show:   { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
};
const listVariants = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

/* --------- Item d’accordéon --------- */
function FaqItem({ i, q, a, isOpen, onToggle }) {
  const panelId = `faq-panel-${i}`;
  const btnId = `faq-button-${i}`;

  return (
    <motion.div variants={itemVariants} className="rounded-xl border border-zinc-200 bg-white">
      <button
        id={btnId}
        aria-controls={panelId}
        aria-expanded={isOpen}
        onClick={onToggle}
        className="w-full px-4 py-3 text-left flex items-center justify-between gap-4"
      >
        <span className="font-medium text-zinc-900">{q}</span>
        <i className={`fa-solid fa-chevron-down text-zinc-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={panelId}
            role="region"
            aria-labelledby={btnId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="px-4 pb-4 pt-1 text-sm leading-6 text-zinc-700 whitespace-pre-line">
              {a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* --------- Composant principal --------- */
export default function Faq() {
  const [open, setOpen] = React.useState(0);
  const [contactModalOpen, setContactModalOpen] = React.useState(false);
  const [contactForm, setContactForm] = React.useState({
    name: "",
    email: "",
    message: "",
  });
  const [contactSending, setContactSending] = React.useState(false);
  const [contactFeedback, setContactFeedback] = React.useState("");
  const [sectionContent, setSectionContent] = React.useState({});
  const { buildSupportWhatsAppLink } = useSupportConfig();
  const contactLink = React.useMemo(
    () => buildSupportWhatsAppLink(DEFAULT_MESSAGES.faqQuestion),
    [buildSupportWhatsAppLink]
  );
  const toggle = (i) => setOpen((prev) => (prev === i ? null : i));
  const apiBases = React.useMemo(() => getBaseCandidates(), []);

  React.useEffect(() => {
    let active = true;
    fetchSiteContent()
      .then((data) => {
        if (!active) return;
        setSectionContent(data?.faq || {});
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const faqTitle = sectionContent?.title || "Questions fréquentes";
  const faqSubtitle =
    sectionContent?.subtitle ||
    "Tout savoir sur l’intervention, les tarifs et le fonctionnement.";
  const faqImage = sectionContent?.image || "/assets/faq-screen.jpeg";

  return (
    <div className="w-full flex" id="faq">
      <div className="z-5 w-full bg-white/85">
        <motion.section
          className="w-full"
          variants={sectionVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
              {/* Colonne gauche : image unique animée */}
              <motion.div
                className="order-2 lg:order-1"
                variants={imageVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.4 }}
              >
                <div className="h-full overflow-hidden rounded-2xl bg-zinc-100 shadow-sm">
                  <img
                    src={faqImage}
                    alt="Aperçu application TTM"
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="mt-4 text-sm text-zinc-600">
                  Aperçu de l’app TTM : demande, suivi, mission et paiement.
                </p>
             <div className="flex items-center gap-4 md:gap-4 mt-5">
            <a href="#" target="_blank" rel="noreferrer">
              <img
                src="/assets/appstore.png"
                alt="Disponible sur l’App Store"
                className="h-10 md:h-12 drop-shadow rounded-2xl"
              />
            </a>
            <a href="#" target="_blank" rel="noreferrer">
              <img
                src="/assets/playstore.png"
                alt="Disponible sur Google Play"
                className="h-10 md:h-12 drop-shadow rounded-2xl"
              />
            </a>
          </div>
              </motion.div>

              {/* Colonne droite : titre + liste FAQ en cascade */}
              <div className="order-1 lg:order-2">
                <motion.h2
                  className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900"
                  variants={headingVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.6 }}
                >
                  {faqTitle}
                </motion.h2>
                <motion.p
                  className="mt-2 text-zinc-600"
                  variants={headingVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.6 }}
                >
                  {faqSubtitle}
                </motion.p>

                <motion.div
                  className="mt-6 grid gap-3"
                  variants={listVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                >
                  {FAQS.map((item, i) => (
                    <FaqItem
                      key={i}
                      i={i}
                      q={item.q}
                      a={item.a}
                      isOpen={open === i}
                      onToggle={() => toggle(i)}
                    />
                  ))}
                </motion.div>

                <motion.div
                  className="mt-6 flex flex-wrap gap-3"
                  variants={headingVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.5 }}
                >
                  <a
                    href={contactLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#800E08] px-5 py-2 text-[#800E08] hover:bg-[#800E08] hover:text-white transition"
                  >
                    Poser une question <i className="fa-brands fa-whatsapp" />
                  </a>
                  <a
                    href="#tarifs"
                    className="inline-flex items-center gap-2 rounded-2xl border px-5 py-2 text-zinc-700 hover:bg-zinc-100 transition"
                  >
                    Voir nos tarifs <i className="fa-solid fa-arrow-right" />
                  </a>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.section>
        <footer className="bg-zinc-900 text-zinc-200">
          <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 text-center md:grid-cols-3 gap-8">
            <div>
              <img src="/assets/logoApp2.png" alt="TTM" className="h-[50px]" />
              <p className="mt-3 text-sm leading-6">
                Tow Truck Mali est une solution de dépannage et remorquage au Mali.
                Disponible 24h/24 et 7j/7, nous assurons un service rapide et fiable.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white">Liens utiles</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><a href="#services" className="hover:text-[#800E08]">Nos Services</a></li>
                <li><a href="#histoire" className="hover:text-[#800E08]">Notre Histoire</a></li>
                <li><a href="#faq" className="hover:text-[#800E08]">FAQ</a></li>
                <li><a href="/confidentialite" className="hover:text-[#800E08]">Politique de confidentialité</a></li>
              </ul>
            </div>

            <div className="flex flex-col items-center justify-center">
              <h3 className="text-lg font-semibold text-white">Contactez-nous</h3>
                <img src="/assets/logo1.png" alt="TTM marque" className="h-[70px]" />
                <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setContactFeedback("");
                    setContactModalOpen(true);
                  }}
                  className="hover:text-[#800E08]"
                  aria-label="Ouvrir le contact"
                >
                  <i className="fa-solid fa-envelope" />
                </button>
                <a
                  href={contactLink}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-green-500"
                >
                  <i className="fa-brands fa-whatsapp" />
                </a>
                <a href="#" className="hover:text-blue-500"><i className="fa-brands fa-facebook" /></a>
                <a href="#" className="hover:text-pink-500"><i className="fa-brands fa-tiktok" /></a>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-800 py-4 text-center text-xs text-zinc-500">
            © 2025 Tow Truck Mali – Tous droits réservés | Produit par @DenonTech
          </div>
        </footer>

        <AnimatePresence>
          {contactModalOpen && (
            <motion.div
              className="fixed inset-0 z-[80] flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setContactModalOpen(false)}
            >
              <div className="absolute inset-0 bg-black/60" />
              <motion.div
                initial={{ y: 16, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 16, opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-zinc-900">Contact TTM</h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Envoie-nous un message par email.
                </p>
                <div className="mt-4 space-y-2">
                  <input
                    type="text"
                    placeholder="Votre nom"
                    value={contactForm.name}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-800"
                  />
                  <input
                    type="email"
                    placeholder="Votre email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, email: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-800"
                  />
                  <textarea
                    rows={5}
                    placeholder="Votre message"
                    value={contactForm.message}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, message: e.target.value }))
                    }
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-800"
                  />
                  {contactFeedback ? (
                    <p className="text-sm text-zinc-600">{contactFeedback}</p>
                  ) : null}
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={contactSending}
                    onClick={async () => {
                      if (!contactForm.name || !contactForm.email || !contactForm.message) {
                        setContactFeedback("Tous les champs sont requis.");
                        return;
                      }
                      try {
                        setContactSending(true);
                        setContactFeedback("");
                        let sent = false;
                        let lastErr = null;

                        for (const base of apiBases) {
                          const endpoint = `${String(base).replace(/\/+$/, "")}/api/contact/public`;
                          try {
                            const res = await fetch(endpoint, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(contactForm),
                            });

                            const raw = await res.text();
                            let data = {};
                            if (raw) {
                              try {
                                data = JSON.parse(raw);
                              } catch {
                                data = { error: raw };
                              }
                            }

                            if (res.ok) {
                              sent = true;
                              break;
                            }

                            // 4xx = erreur fonctionnelle: on arrête immédiatement
                            if (res.status >= 400 && res.status < 500) {
                              throw new Error(data?.error || "Erreur envoi");
                            }

                            // 5xx: on tente la base suivante
                            lastErr = new Error(data?.error || "Erreur serveur");
                          } catch (e) {
                            lastErr = e;
                            // en cas d'erreur réseau/CORS, on essaie la base suivante
                            continue;
                          }
                        }

                        if (!sent) {
                          throw lastErr || new Error("Erreur envoi");
                        }
                        setContactFeedback("Message envoyé ✅");
                        setContactForm({ name: "", email: "", message: "" });
                      } catch (err) {
                        setContactFeedback(err.message || "Erreur envoi");
                      } finally {
                        setContactSending(false);
                      }
                    }}
                    className="rounded-lg border border-[#800E08] px-4 py-2 text-[#800E08] hover:bg-[#800E08] hover:text-white disabled:opacity-60"
                  >
                    {contactSending ? "Envoi..." : "Envoyer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactModalOpen(false)}
                    className="rounded-lg border px-4 py-2 text-zinc-700 hover:bg-zinc-100"
                  >
                    Fermer
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

