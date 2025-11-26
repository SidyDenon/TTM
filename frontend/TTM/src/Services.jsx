import React from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { buildServiceRequestLink } from "./config/links";

/* ---------- Services : descriptions détaillées ---------- */
const SERVICES = [
  { 
    icon: "fa-wrench",        
    title: "Dépannage",         
    desc: "Intervention rapide sur place.",
    details: `Notre service de dépannage couvre la majorité des pannes courantes directement sur place, 24h/24 et 7j/7, pour limiter l’immobilisation de votre véhicule.

Interventions typiques :
- Remplacement ou réparation de roue (crevaison, valve, roue de secours).
- Démarrage de secours (pinces, booster) et contrôle de l’alternateur.
- Petites réparations mécaniques d’urgence (courroie déboîtée, durite desserrée, fusibles).
- Sécurisation de la zone et vérification de sécurité avant reprise de route.

Déroulé d’intervention :
1) Vous nous contactez (WhatsApp/Appel) et précisez votre position.
2) Nous envoyons le dépanneur le plus proche (temps moyen : 20–40 min en zone urbaine).
3) Diagnostic rapide sur place + proposition d’action (dépannage immédiat ou remorquage).

Avantages TTM :
- Couverture étendue (ville, axes interurbains).
- Prix transparents, devis annoncé avant intervention.
- Techniciens formés, matériel conforme et assuré.
`
  },
  {
    icon: "fa-truck-monster",
    title: "Remorquage",
    desc: "Prise en charge sécurisée.",
    details: `Notre service de remorquage est disponible 24h/24 et 7j/7, aussi bien pour les véhicules particuliers que pour les utilitaires. Nos dépanneuses modernes sont équipées pour garantir un transport sans risque d’endommagement.

Zones et délais :
- Couverture urbaine et autoroutière : prise en charge rapide.
- Délai indicatif en ville : 30 minutes selon trafic et disponibilité.

Procédure :
1) Identification du véhicule (modèle, poids, transmission).
2) Sécurisation du chargement (sangles, cales, treuil).
3) Acheminement vers le garage partenaire ou l’adresse de votre choix.

Cas pris en charge :
- Panne immobilisante, accident, véhicule non roulant.
- Remorquage courte et longue distance, sortie de stationnement difficile.

Engagements :
- Sécurité maximale et traçabilité.
- Assurance et photos à la demande.
- Tarification claire selon distance et complexité.
`
  },
  { 
    icon: "fa-car-battery",   
    title: "Batterie",          
    desc: "Boost / remplacement.",
    details: `Nous gérons toutes les problématiques de batterie, de la simple décharge au remplacement sur place, avec test du système de charge (alternateur).

Ce que nous faisons :
- Test de tension et de santé de la batterie.
- Démarrage de secours via booster professionnel.
- Remplacement de batterie (modèles compatibles) et reprise de l’ancienne.

Bonnes pratiques :
- Vérifier l’âge de la batterie (souvent 3–5 ans de durée de vie).
- Contrôler les consommateurs parasites (lumières intérieures, alarme).
- Après remplacement, rouler 15–20 minutes pour stabiliser la charge.

Garantie :
- Matériel certifié, pièces garanties selon le fabricant.
- Conseil d’entretien pour éviter les pannes répétitives.
`
  },
  { 
    icon: "fa-gas-pump",      
    title: "Carburant",         
    desc: "Livraison panne sèche.",
    details: `Livraison de carburant en cas de panne sèche, en zone urbaine et périurbaine. Intervention sécurisée avec jerrican homologué.

Fonctionnement :
1) Vous indiquez votre position et le type de carburant (Essence/Gasoil).
2) Nous livrons la quantité minimale pour redémarrer en sécurité (généralement 5–10 L).
3) Conseils pour rejoindre la station la plus proche.

Sécurité & qualité :
- Récipients conformes, manipulation sécurisée.
- Traçabilité de la provenance (station partenaire).

Précautions :
- Ne pas insister sur le démarreur si le réservoir est à sec (risque pompe).
- Indiquer clairement le modèle du véhicule (éviter erreur d’essence).
`
  },
  { 
    icon: "fa-key",           
    title: "Ouverture de porte",
    desc: "Sans endommager la serrure.",
    details: `Ouverture fine et sécurisée de véhicule lorsque les clés sont à l’intérieur ou le verrouillage défectueux. Nous privilégions les méthodes non destructives.

Méthodes :
- Outils d’air (air wedge) et barres d’accès.
- Crochets spécifiques selon marques/modèles.
- Intervention très précautionneuse pour éviter rayures et dégâts.

Documents :
- Une preuve de propriété peut être demandée (carte grise, pièce d’identité).
- Intervention refusée si doute sur la propriété.

Cas particuliers :
- Véhicules premium/anti-effraction : temps d’intervention plus long.
- Clés perdues/cassées : orientation vers serrurier partenaire si nécessaire.
`
  },
  { 
    icon: "fa-screwdriver-wrench", 
    title: "Diagnostic",   
    desc: "Contrôle rapide des pannes.",
    details: `Diagnostic rapide pour identifier l’origine d’une panne et orienter vers la meilleure solution (réparation sur place, remorquage, garage spécialisé).

Outils et étapes :
- Lecture OBD/OBD2 (codes défauts, capteurs).
- Inspection visuelle (fuites, courroies, connectiques).
- Tests simples (allumage, alimentation, fusibles).

Livrable :
- Explication claire du diagnostic et des risques.
- Recommandation d’action prioritaire + estimation du coût/temps.

Avantages :
- Gain de temps : on évite les remorquages inutiles.
- Transparence : vous décidez de la suite en connaissance de cause.
`
  },
];
function openWhatsApp(service) {
  window.open(
    buildServiceRequestLink(service),
    "_blank",
    "noopener,noreferrer"
  );
}

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
function Modal({ open, onClose, service }) {
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
              <i className={`fa-solid ${service.icon} text-5xl text-[#800E08] mt-1`} />
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
                  onClick={() => openWhatsApp(service)}
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
function ServiceCard({ icon, title, desc, onMore, index }) {
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
        <i className={`fa-solid ${icon} text-4xl text-[#800E08]`} />
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

  const openModal = (service) => {
    setSelected(service);
    setOpen(true);
  };
  const closeModal = () => setOpen(false);

  return (
    <section className="w-full min-h-screen flex relative">

      <div className="z-5 min-h-screen w-full bg-black/50 text-white flex flex-col items-center gap-35 py-20 px-4">
        <motion.h1
          className="text-3xl font-bold"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.4 }}
        >
          Nos Services
        </motion.h1>

        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((s, i) => (
            <ServiceCard
              key={i}
              index={i}
              {...s}
              onMore={() => openModal(s)}
            />
          ))}
        </div>
      </div>

      <Modal open={open} onClose={closeModal} service={selected} />
    </section>
  );
}

