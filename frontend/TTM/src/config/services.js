import { resolveApiBase } from "./api";

const DEFAULT_IMAGE = "/assets/accueil.png";

const BASE_SERVICES = [
  {
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
`,
    icon: "fa-wrench",
  },
  {
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
`,
    icon: "fa-truck-monster",
    iconImage: "/assets/depanneuse.png",
    iconAlt: "Depanneuse TTM",
    img: "/assets/accueil.png",
    description:
      "Remorquage 24/7 avec dépanneuses équipées (sangles, treuil, cales). Prise en charge sécurisée vers garage partenaire ou adresse de votre choix.",
    featured: true,
    amount: "20 000 FCFA",
  },
  {
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
`,
    icon: "fa-car-battery",
    img: "/assets/batterie.png",
    description:
      "Test de charge, booster pro, remplacement sur place si nécessaire. Contrôle alternateur et conseils d’entretien.",
    featured: true,
    amount: "8 000 FCFA",
  },
  {
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
`,
    icon: "fa-gas-pump",
  },
  {
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
`,
    icon: "fa-key",
    img: "/assets/Porte.jpg",
    description:
      "Ouverture fine et sans casse quand les clés sont à l’intérieur. Méthodes non destructives adaptées au modèle.",
    amount: "12 000 FCFA",
  },
  {
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
`,
    icon: "fa-screwdriver-wrench",
    img: "/assets/diagnostic.jpg",
    description:
      "Lecture OBD/OBD2, inspection visuelle, tests simples (alimentation, fusibles). Explications claires + recommandation.",
    amount: "7 000 FCFA",
  },
  {
    title: "Crevaison",
    img: "/assets/crevaison.jpg",
    description:
      "Intervention sur place : roue de secours, mèche/réparation, vérification pression/valve. Objectif : vous remettre rapidement en sécurité.",
    details: `Interventions typiques :
• Changement de roue (avec/sans roue de secours)
• Réparation mèche selon l’emplacement de la fuite
• Contrôle pression, valve et témoin TPMS

Conseils :
• Évitez de rouler à plat (risque jante)
• Vérifiez la roue de secours 1×/trimestre`,
    featured: true,
    amount: "10 000 FCFA",
  },
  {
    title: "Panne sèche",
    img: "/assets/carburant2.jpeg",
    description:
      "Livraison de carburant (essence/gasoil) pour redémarrer rapidement et rejoindre la station la plus proche.",
    details: `Fonctionnement :
• Indiquez type de carburant et position
• Livraison 5–10 L selon besoin
• Conseils pour rejoindre la station la plus proche

Précautions :
• N’insistez pas sur le démarreur (risque pompe)
• Donnez le modèle exact pour éviter erreur de carburant`,
    featured: true,
    amount: "5 000 FCFA",
  },
  {
    title: "Recharge batterie",
    img: "/assets/batterie2.jpg",
    description:
      "Recharge/boost sécurisé sur place. Vérification des consommateurs parasites et conseils pour éviter les pannes répétitives.",
    details: `Prestation :
• Démarrage + recharge sécurisée
• Vérification consommateurs (lampes, alarme, etc.)
• Conseils d’entretien et d’usage (trajets trop courts, etc.)`,
    amount: "9 000 FCFA",
  },
  {
    title: "Livraison carburant",
    img: "/assets/carburant.png",
    description:
      "Ravitaillement d’urgence certifié (jerrican homologué) avec traçabilité de provenance. Intervention urbaine/périurbaine.",
    details: `Sécurité & qualité :
• Récipients conformes, manipulation sécurisée
• Traçabilité station partenaire
• Aide au redémarrage + consignes sécurité`,
    amount: "6 000 FCFA",
  },
];

const normalizeKey = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const META_BY_KEY = new Map(
  BASE_SERVICES.map((service) => [normalizeKey(service.title), service])
);

const formatPrice = (value) => {
  if (value == null || Number.isNaN(Number(value))) return null;
  const formatted = Number(value).toLocaleString("fr-FR");
  return `${formatted} FCFA`;
};

export const DEFAULT_SERVICES = BASE_SERVICES;

export function mergeServices(apiServices = []) {
  if (!Array.isArray(apiServices) || apiServices.length === 0) {
    return DEFAULT_SERVICES;
  }

  return apiServices.map((svc) => {
    const key = normalizeKey(svc?.name || "");
    const meta = META_BY_KEY.get(key) || {};
    const priceLabel = formatPrice(svc?.price);
    const description = svc?.description || meta.description || meta.desc || "";
    const desc = svc?.description || meta.desc || meta.description || "";
    const iconImage = meta.iconImage || (svc?.icon_url && !String(svc.icon_url).startsWith("fa:") ? svc.icon_url : null);

    return {
      title: svc?.name || meta.title || "Service",
      desc,
      description,
      details: meta.details || svc?.description || "",
      icon: meta.icon || "fa-wrench",
      iconImage,
      iconAlt: meta.iconAlt,
      img: meta.img || DEFAULT_IMAGE,
      featured: meta.featured || false,
      amount: priceLabel || meta.amount || "Sur devis",
    };
  });
}

export async function fetchPublicServices(apiBase = "") {
  const base = apiBase || resolveApiBase();
  if (!base) return DEFAULT_SERVICES;
  const normalized = base.replace(/\/+$/, "");
  const res = await fetch(`${normalized}/api/services/public`);
  if (!res.ok) {
    throw new Error(`SERVICES_FETCH_${res.status}`);
  }
  const json = await res.json();
  const data = json?.data || [];
  return mergeServices(data);
}
