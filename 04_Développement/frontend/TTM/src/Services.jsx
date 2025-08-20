import React from "react";

const SERVICES = [
  { icon: "fa-wrench",        title: "Dépannage",         desc: "Intervention rapide sur place." },
  { icon: "fa-truck-monster", title: "Remorquage",        desc: "Prise en charge sécurisée." },
  { icon: "fa-car-battery",   title: "Batterie",          desc: "Boost / remplacement." },
  { icon: "fa-gas-pump",      title: "Carburant",         desc: "Livraison panne sèche." },
  { icon: "fa-key",           title: "Ouverture de porte",desc: "Sans endommager la serrure." },
  { icon: "fa-screwdriver-wrench", title: "Diagnostic",   desc: "Contrôle rapide des pannes." },
];

function ServiceCard({ icon, title, desc }) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-zinc-200">
      <div className="relative z-10 space-y-2 transition duration-500 group-hover:opacity-0">
        <i className={`fa-solid ${icon} text-4xl text-[#800E08]`} />
        <h3 className="font-semibold text-zinc-900">{title}</h3>
        <p className="text-sm text-zinc-600">{desc}</p>
      </div>

      {/* Overlay rouge */}
      <div className="absolute inset-x-0 bottom-0 h-full translate-y-[100%] bg-[#800E08] flex items-center justify-center 
                      transition-transform duration-500 ease-out group-hover:translate-y-0">
        <button className="text-white font-semibold text-lg cursor-pointer">En savoir plus</button>
      </div>
    </div>
  );
}

export default function Services() {
  return (
    <section className="w-full min-h-screen flex">
      <div className="z-5 h-full w-full bg-black/50 text-white flex flex-col items-center gap-6 py-20 px-4">
        <h1 className="text-3xl font-bold">Nos Services</h1>

        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {SERVICES.map((s, i) => (
            <ServiceCard key={i} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}
