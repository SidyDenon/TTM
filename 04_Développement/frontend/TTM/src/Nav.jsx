// src/components/Nav.jsx
import React from "react";

const LINKS = [
  { href: "#", label: "Accueil" },
  { href: "#histoire", label: "Notre Histoire" },
  { href: "#services", label: "Services" },
  { href: "#avis", label: "Avis" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

// Garde ton numéro tel quel, on le normalise pour wa.me
const WHATSAPP_NUMBER = "0022373585046";

/* Helpers WhatsApp */
function normalizePhoneForWa(phoneRaw) {
  let p = String(phoneRaw).replace(/\D/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  return p; // format: 22373585046
}

function buildWhatsAppContactUrl() {
  const phone = normalizePhoneForWa(WHATSAPP_NUMBER);
  const text =
    "Bonjour 👋, j’aimerais avoir des informations sur vos services TTM.";
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export default function Nav() {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  // Shrink au scroll
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Fermer le menu quand on repasse en desktop
  React.useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Bloquer le scroll quand le menu mobile est ouvert
  React.useEffect(() => {
    const { body } = document;
    const prev = body.style.overflow;
    if (open) body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* HEADER */}
      <header
        className={[
          "fixed inset-x-0 top-0 z-50 border-b-4 border-[#800E08]",
          "text-white/95 backdrop-blur supports-[backdrop-filter]:bg-black/90",
          "transition-all duration-300",
          scrolled ? "bg-[#000000f0] shadow-[0_6px_16px_-8px_rgba(0,0,0,.5)]" : "bg-[#000000e0]",
        ].join(" ")}
      >
        <nav
          className={[
            "mx-auto max-w-6xl px-4 flex items-center justify-between",
            "transition-[height] duration-300",
            scrolled ? "h-14" : "h-16",
          ].join(" ")}
        >
          {/* Logo */}
          <a href="#" className="inline-flex items-center gap-2">
            <img
              src="/assets/logo1.png"
              alt="TTM"
              className="h-10 md:h-10 w-auto"
              draggable="false"
            />
          </a>

          {/* Liens desktop */}
          <ul className="hidden lg:flex items-center gap-8 text-[0.98rem]">
            {LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="hover:text-white transition-colors text-white/90"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          {/* CTA desktop */}
          <a
            href={buildWhatsAppContactUrl()}
            target="_blank"
            rel="noreferrer"
            className="hidden lg:inline-flex items-center gap-2 rounded-xl border-2 border-[#800E08] px-4 py-1.5 text-sm hover:bg-[#800E08] hover:text-white transition"
          >
            Contact
            <i className="fa-brands fa-whatsapp text-green-500" />
          </a>

          {/* Bouton hamburger (mobile) */}
          <button
            type="button"
            aria-label="Ouvrir le menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-md ring-1 ring-white/10 hover:bg-white/5 mr-2"
          >
            <i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"} text-lg`} />
          </button>
        </nav>

        {/* Menu mobile déroulant */}
        <div
          className={`lg:hidden overflow-hidden transition-[max-height] duration-300 ease-out ${
            open ? "max-h-96" : "max-h-0"
          }`}
        >
          <div className="mx-auto max-w-6xl px-4 pb-4">
            <ul className="grid gap-2">
              {LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-3 py-2 text-white/90 hover:bg-white/5"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>

            {/* CTA WhatsApp mobile */}
            <a
              href={buildWhatsAppContactUrl()}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#800E08] px-4 py-2 text-[#800E08] hover:bg-[#800E08] hover:text-white transition"
            >
              Nous contacter <i className="fa-brands fa-whatsapp" />
            </a>
          </div>
        </div>
      </header>

      {/* Overlay noir quand le menu mobile est ouvert */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Spacer pour ne pas recouvrir le contenu */}
      <div className={scrolled ? "h-14" : "h-16"} />
    </>
  );
}
