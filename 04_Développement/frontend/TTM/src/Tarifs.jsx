import React from "react";
import "./App.css";

const tarifa = [
  { title: "Remorquage",  amount: "20 000 FCFA", img: "/assets/accueil.png" },
  { title: "Crevaison",   amount: "10 000 FCFA", img: "/assets/accueil.png" },
  { title: "Batterie",    amount: "8 000 FCFA",  img: "/assets/accueil.png" },
  { title: "Panne sèche", amount: "5 000 FCFA",  img: "/assets/accueil.png" },
];

const tarifb = [
  { title: "Ouverture de porte", amount: "12 000 FCFA", img: "/assets/accueil.png" },
  { title: "Diagnostic rapide",  amount: "7 000 FCFA",  img: "/assets/accueil.png" },
  { title: "Recharge batterie",  amount: "9 000 FCFA",  img: "/assets/accueil.png" },
  { title: "Livraison carburant",amount: "6 000 FCFA",  img: "/assets/accueil.png" },
];

function Card({ item }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white text-black ring-1 ring-zinc-200 hover:-translate-y-0.5 transition">
      <img src={item.img} alt={item.title} className="w-full h-28 object-cover" />
      <div className="p-3 text-center space-y-1">
        <h2 className="font-bold text-sm sm:text-base">{item.title}</h2>
        <p className="text-[11px] text-zinc-500">À partir de</p>
        <h3 className="font-bold text-[#800E08]">{item.amount}</h3>
        <button className="mx-auto mt-2 inline-block rounded-2xl border border-[#800E08] px-3 py-1 text-[12px] text-[#800E08] hover:bg-[#800E08] hover:text-white transition">
          En savoir plus
        </button>
      </div>
    </div>
  );
}

export default function Tarifs() {
  const [showMore, setShowMore] = React.useState(false);
  const panelRef = React.useRef(null);
  const [panelHeight, setPanelHeight] = React.useState(0);

  // Mesure la hauteur réelle du contenu pour une transition propre
  React.useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const measure = () => setPanelHeight(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <section className="w-full min-h-screen  flex">
    <div className="z-5 w-full bg-black/50 text-white flex flex-col items-center gap-6 py-24 px-4">
        <h1 className="text-3xl font-bold">Nos Tarifs</h1>

        <div className="py-4 flex items-center gap-4">
          <div className="bg-[url('/assets/logoApp2.png')] bg-no-repeat bg-center bg-contain w-28 h-12" />
          <h2 className="text-2xl sm:text-3xl font-extralight italic max-w-[560px]">
            NOS TARIFS LES MEILLEURS SUR LE MARCHÉ
          </h2>
        </div>

        {/* Grille principale */}
        <div className="w-full max-w-6xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {tarifa.map((item, i) => (
            <Card key={`a-${i}`} item={item} />
          ))}
        </div>

       {/* Panneau déroulant SANS calcul de hauteur */}
<div
  className={`w-full max-w-6xl grid transition-[grid-template-rows] duration-500 ease-out ${
    showMore ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
  }`}
  aria-hidden={!showMore}
>
  <div className="overflow-hidden">
    <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 opacity-100 transition-opacity duration-300">
      {tarifb.map((item, i) => (
        <Card key={`b-${i}`} item={item} />
      ))}
    </div>
  </div>
</div>


        {/* Bouton toujours en bas */}
        <button
          onClick={() => setShowMore(v => !v)}
          className="cursor-pointer mt-10 border-2 border-[#800E08] px-6 rounded-3xl text-sm py-2 shadow-white/30 hover:bg-[#800E08] hover:text-white transition inline-flex items-center gap-2"
          aria-expanded={showMore}
        >
          {showMore ? "Voir moins" : "Voir plus"}
          <i
            className={`fa-solid fa-chevron-down transition-transform ${
              showMore ? "rotate-180" : "rotate-0"
            }`}
          />
        </button>
      </div>
    </section>
  );
}
