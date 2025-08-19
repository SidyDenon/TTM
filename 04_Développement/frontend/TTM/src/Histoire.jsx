import React from 'react'

function Histoire() {
  return (
    <div className='flex text-white ' > 
      <div className='z-5 h-screen  bg-white/80 flex justify-center items-center gap-20' >
        <div className="histoireBloc text-black w-[30%] h-[50%] overflow-hidden">
                <h1 className='font-bold text-2xl'>Notre Histoire</h1>
                <p className="mt-5 font-medium leading-7">
            Tow Truck Mali (TTM) est né d'un besoin simple: rendre le dépannage
            automobile rapide, fiable et accessible partout. Des routes de Bamako aux
            trajets interurbains, nous avons construit un réseau d'opérateurs
            formés et une application pensée pour intervenir en quelques minutes.
                </p>

              <p className="mt-4 font-medium leading-7">
            Notre équipe a d'abord cartographié les zones d'intervention,
            puis conçu un parcours utilisateur clair pour le client, l'opérateur et
            l'administrateur. Aujourd'hui, TTM évolue avec des fonctionnalités
            financières intégrées et un suivi de mission transparent.
              </p>

          {/* <div >
            <p className="mt-4 text-black leading-7">
              Demain, nous visons l'expansion régionale, la prévention (diagnostic
              rapide), et des partenariats avec garages, assureurs et vendeurs de
              pièces, afin d'offrir une expérience de mobilité complète et
              sécurisée.
            </p>
          </div> */}

          <button className='border-[#800E08] border-2 px-5 rounded-2xl leading-7'>En savoir plus</button>
        </div>
        <div className="histoirePhoto w-[30%] h-[45%] relative flex justify-end ">
              <div className="bg-[#800E08]  w-[95%]  h-[95%] rounded-tr-lg "></div>
              <div className=" absolute h-full">
                  <img src="/assets/histoire.png" alt="histoire" className='w-[95%] h-full mt-[5%] rounded-l-lg'/>
              </div>
        </div>
            
      </div> 
    </div>
  )
}

export default Histoire