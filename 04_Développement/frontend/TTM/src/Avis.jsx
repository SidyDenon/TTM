import React from "react"; 
import CountUp from "react-countup";

const TESTIMONIALS = [
  {
    name: "Moussa Diarra",
    rating: 5,
    text:
      "Intervention rapide et très pro. Remorquage en moins de 30 minutes, et suivi jusqu’au garage. Je recommande !",
  },
  {
    name: "Aïcha Koné",
    rating: 5,
    text:
      "Panne de batterie au bureau : démarrage + contrôle alternateur. Service nickel et prix clair.",
  },
  {
    name: "Ibrahim Traoré",
    rating: 4,
    text:
      "Livraison de carburant sur autoroute. Bon contact, arrivée à l’heure annoncée, parfait.",
  },
  {
    name: "Fatoumata Sangaré",
    rating: 5,
    text:
      "Ouverture de porte sans aucune rayure. Très précautionneux et rassurants.",
  },
];

// tableau de stats
const STATS = [
  { value: 400, label: "Clients dépannés" },
  { value: 120, label: "Remorquages / mois" },
  { value: 95,  label: "Satisfaction (%)" },
];

function Stars({ n = 5 }) {
  return (
    <div className="flex gap-1 text-amber-500" aria-label={`${n} étoiles`}>
      {Array.from({ length: n }).map((_, i) => (
        <i key={i} className="fa-solid fa-star" />
      ))}
    </div>
  );
}

export default function Avis() {
  return (
    <section className="w-full min-h-screen flex">
      <div className="z-5 w-full bg-white/85 backdrop-blur-sm text-zinc-900 flex flex-col items-center gap-8 py-16 px-4">
        {/* Titre */}
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Avis Client</h2>

        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-[320px,1fr] gap-10 items-start">
          {/* Colonne gauche : photo + compteurs */}
          <div className="flex justify-center items-center md:items-start gap-8">
            {/* Cadre accent + photo */}
            <div className="relative h-[200px] ">
              <div className="absolute -left-3 -top-3 h-[80%] w-[95%] rounded-2xl bg-[#800E08] opacity-90" />
              <img
                src="/assets/avisr.png"   
                alt="Client satisfait"
                className="relative z-10 h-full max-w-[300px] md:max-w-[260px] object-cover rounded-2xl shadow-xl translate-x-2 md:translate-x-4  "
                loading="lazy"
              />
            </div>

            {/* Stats animées */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center md:text-left w-full">
              {STATS.map((s, i) => (
                <div key={i}>
                  <div className="text-4xl md:text-5xl font-extrabold text-[#800E08] leading-tight">
                    <CountUp end={s.value} duration={2} enableScrollSpy />+
                  </div>
                  <p className="text-sm md:text-base text-zinc-600">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Colonne droite : liste d'avis */}
          <div className="grid gap-4">
            {TESTIMONIALS.map((t, i) => (
              <article
                key={i}
                className="rounded-2xl bg-white ring-1 ring-zinc-200 shadow-sm p-4 md:p-5 hover:shadow-md transition"
              >
                <header className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{t.name}</h3>
                  <Stars n={t.rating} />
                </header>
                <p className="mt-2 text-zinc-700 leading-relaxed">{t.text}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
