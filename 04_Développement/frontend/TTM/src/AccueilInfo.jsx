// src/AccueilInfo.jsx
import React from "react";

const WHATSAPP_PHONE = "22373585046"; // format international sans 00 ni +

export default function AccueilInfo() {
  const waUrl = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
    "Bonjour 👋, j’aimerais en savoir plus sur l’app TTM."
  )}`;

  return (
    <section className="h-screen w-full flex justify-center items-center text-white px-3">
      <div className="z-5 max-w-3xl w-full bg-black/60 px-5 py-8 rounded-2xl flex flex-col items-center gap-6 backdrop-blur-sm">
        
        <h1 className="text-3xl md:text-4xl text-center font-extrabold leading-snug">
          DÉPANNAGE AUTO PARTOUT AU MALI
        </h1>

        <ul className="flex flex-col gap-2 font-light items-start text-sm md:text-base">
          <li className="flex gap-2 items-center">
            <i className="fa-solid fa-bolt text-red-500"></i>
            <span>Intervention rapide</span>
          </li>
          <li className="flex gap-2 items-center">
            <i className="fa-solid fa-location-dot text-red-500"></i>
            <span>Localisation en direct</span>
          </li>
        </ul>

        {/* CTA WhatsApp */}
        <div className="flex flex-col items-center">
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="px-6 py-2 rounded-2xl bg-red-600 hover:bg-red-700 transition font-bold inline-flex items-center gap-2"
          >
            <i className="fa-brands fa-whatsapp text-green-400" />
            Contactez-nous
          </a>
          <span className="text-xs mt-2 opacity-90">Disponible 24/24</span>
        </div>

        {/* Logos stores → renvoient aussi vers WhatsApp */}
        <div className="w-full flex flex-col items-center gap-2">
          <p className="text-xs md:text-sm opacity-90">Téléchargez l’app TTM</p>
          <div className="flex items-center gap-3 md:gap-4">
            <a href={waUrl} target="_blank" rel="noreferrer">
              <img
                src="/assets/appstore.png"
                alt="Disponible sur l’App Store"
                className="h-10 md:h-12 drop-shadow"
              />
            </a>
            <a href={waUrl} target="_blank" rel="noreferrer">
              <img
                src="/assets/playstore.png"
                alt="Disponible sur Google Play"
                className="h-10 md:h-12 drop-shadow"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
