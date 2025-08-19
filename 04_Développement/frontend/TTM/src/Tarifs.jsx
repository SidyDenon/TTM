import React from 'react'

import './App.css';  // ⚠️ Important !

const TARIFS = [
  { title: "Remorquage", amount: "20 000 FCFA", img: "/assets/accueil.png" },
  { title: "Crevaison",  amount: "10 000 FCFA", img: "/assets/accueil.png" },
  { title: "Batterie",   amount: "8 000 FCFA",  img: "/assets/accueil.png" },
  { title: "Panne sèche", amount: "5 000 FCFA",  img: "/assets/accueil.png" },
  { title: "Ouverture de porte",amount: "12 000 FCFA", img: "/assets/accueil.png" },
  { title: "Diagnostic rapide", amount: "7 000 FCFA", img: "/assets/accueil.png" },
];

function Tarifs() {
  return (
    <div className='w-full h-screen flex'>
        <div className="z-5 w-full h-full bg-black/50 text-white">
            <h1 className='text-3xl font-bold'>Nos Tarifs</h1>
            <div className="middle ">
                <div className="logo"></div>
                <h1 className=' text-2xl font-bold italic'>NOS TARIFS LES MEILLEURS SUR LE MARCHÉ</h1>
                <p>En savoir plus</p>
            </div>
            <div className="h-auto p-6 flex w-screen overflow-x-auto scroll-smooth hide-scrollbar gap-4">
                {TARIFS.map((item, i)=>(
                    <div key={i} className="border-4 min-w-[200px] h-auto bg-white rounded-2xl overflow-hidden flex flex-col items-center ">
                       <img src={item.img} alt={item.title} className='w-full'/> 
                        <div className=" text-black text-center pb-2 flex flex-col gap-2">
                        <h2 className='font-bold text-l'>{item.title}</h2>
                        <p className='text-xs'>À partir de</p>
                        <h3 className='font-bold text-l text-[#800e08]'>{item.amount}</h3>
                        <p className='border-3 w-[150px] text-center rounded-2xl border-[#800E08]'>En savoir plus</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

    </div>
  )
}

export default Tarifs;

