// src/AccueilInfo.jsx
import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { buildWhatsAppLink, DEFAULT_MESSAGES } from "./config/links";

export default function AccueilInfo() {
  const waUrl = buildWhatsAppLink(DEFAULT_MESSAGES.appInfo);

  // Micro-parallaxe : translateY de 0 à -24px selon le scroll
  const { scrollYProgress } = useScroll();
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, -24]);

  return (
    <section className="min-h-screen w-full flex justify-center items-center text-white px-3">
      <motion.div
        style={{ y: parallaxY }}
        className="z-5 max-w-3xl w-full bg-black/60 px-5 py-8 rounded-2xl flex flex-col items-center gap-6 backdrop-blur-sm shadow-[0_10px_40px_-12px_rgba(0,0,0,.6)]"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <motion.h1
          className="text-3xl md:text-4xl text-center font-extrabold leading-snug"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
        >
          DÉPANNAGE AUTO PARTOUT AU MALI
        </motion.h1>

        <motion.ul
          className="flex flex-col gap-2 font-light items-start text-sm md:text-base"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.5 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
        >
          {[
            { icon: "fa-bolt", label: "Intervention rapide" },
            { icon: "fa-location-crosshairs", label: "Localisation en direct" },
          ].map((it, i) => (
            <motion.li
              key={i}
              className="flex gap-2 items-center"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
            >
              <i className={`fa-solid ${it.icon} text-red-500`} />
              <span>{it.label}</span>
            </motion.li>
          ))}
        </motion.ul>

        {/* CTA WhatsApp */}
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
        >
          <motion.a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="px-6 py-2 rounded-2xl bg-red-600 hover:bg-red-700 transition font-bold inline-flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            aria-label="Nous contacter sur WhatsApp"
          >
            <i className="fa-brands fa-whatsapp text-green-400" />
            Contactez-nous
          </motion.a>
          <span className="text-xs mt-2 opacity-90">Disponible 24/24</span>
        </motion.div>

        {/* Logos stores */}
        <motion.div
          className="w-full flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.35, ease: "easeOut", delay: 0.12 }}
        >
          <p className="text-xs md:text-sm opacity-90">Téléchargez l’app TTM</p>
          <div className="flex items-center gap-3 md:gap-4">
            <motion.a href={waUrl} target="_blank" rel="noreferrer" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <img src="/assets/appstore.png" alt="Disponible sur l’App Store" className="h-10 md:h-12 drop-shadow" />
            </motion.a>
            <motion.a href={waUrl} target="_blank" rel="noreferrer" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <img src="/assets/playstore.png" alt="Disponible sur Google Play" className="h-10 md:h-12 drop-shadow" />
            </motion.a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}


