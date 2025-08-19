// import React from "react";

// const TARIFS = [
//   { title: "Remorquage", price: "À partir de", amount: "20 000 FCFA", img: "/assets/accueil.png" },
//   { title: "Crevaison",  price: "À partir de", amount: "10 000 FCFA", img: "/assets/accueil.png" },
//   { title: "Batterie",   price: "À partir de", amount: "8 000 FCFA",  img: "/assets/accueil.png" },
//   { title: "Panne sèche",price: "À partir de", amount: "5 000 FCFA",  img: "/assets/accueil.png" },
//   { title: "Ouverture de porte", price: "À partir de", amount: "12 000 FCFA", img: "/assets/accueil.png" },
//   { title: "Diagnostic rapide", price: "À partir de", amount: "7 000 FCFA", img: "/assets/accueil.png" },
// ];

// function Tarifs() {
//   return (
//     <div className="w-full bg-black/50 text-white py-12">
//       <div className="max-w-7xl mx-auto px-6">
//         <h1 className="text-3xl font-bold text-center mb-8">Nos Tarifs</h1>
        
//         <div className="text-center mb-10">
//           <h2 className="text-2xl font-bold italic">NOS TARIFS LES MEILLEURS SUR LE MARCHÉ</h2>
//           <p className="text-sm text-gray-300 mt-2">En savoir plus</p>
//         </div>

//         <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
//           {TARIFS.map((item, i) => (
//             <div key={i} className="rounded-2xl overflow-hidden bg-white text-black shadow-md hover:shadow-lg transition flex flex-col">
//               <img src={item.img} alt={item.title} className="w-full h-36 object-cover" loading="lazy" />
//               <div className="p-4 flex flex-col items-center text-center gap-2">
//                 <h3 className="font-bold text-lg">{item.title}</h3>
//                 <p className="text-xs text-zinc-600">{item.price}</p>
//                 <h4 className="font-bold text-[#800E08]">{item.amount}</h4>
//                 <button className="mt-2 w-[150px] rounded-2xl border-2 border-[#800E08] text-[#800E08] py-1 text-sm font-medium hover:bg-[#800E08] hover:text-white transition">
//                   En savoir plus
//                 </button>
//               </div>
//             </div>
//           ))}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default Tarifs;
