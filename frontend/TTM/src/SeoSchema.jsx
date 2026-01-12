import React from "react";
import { FAQS } from "./config/faq";
import { useSupportConfig } from "./context/SupportConfigContext";

const BASE_URL = "https://towtruckmali.com";

export default function SeoSchema() {
  const { support } = useSupportConfig();

  const schema = {
    "@context": "https://schema.org",
    "@type": "TowingService",
    name: "Tow Truck Mali (TTM)",
    description: "Depannage auto et remorquage au Mali. Intervention rapide 24/7.",
    url: `${BASE_URL}/`,
    telephone: support.phone,
    email: support.email,
    areaServed: "Mali",
    serviceType: [
      "Remorquage",
      "Depannage",
      "Batterie",
      "Carburant",
      "Ouverture de porte",
      "Diagnostic",
    ],
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a.replace(/\s+/g, " ").trim(),
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </>
  );
}
