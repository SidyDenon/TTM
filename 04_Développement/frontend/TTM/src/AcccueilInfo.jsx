import React from 'react';
import Nav from './Nav';

function AccueilInfo() {
  return (
    <div className="h-screen w-full flex justify-center items-center text-white px-2">
      <div className="z-5 max-w-3xl w-full bg-black/60 px-3 py-8 rounded-2xl flex flex-col items-center gap-6">
        
        <h1 className="text-3xl md:text-3xl text-center font-extrabold leading-snug">
          DÉPANNAGE AUTO PARTOUT AU MALI
        </h1>
        
        <div className="flex flex-col gap-3 font-light items-start">
          <div className="flex gap-2 items-center">
            <i className="fa-solid fa-bolt text-red-600 " aria-label="Rapidité"></i>
            <span>Intervention rapide</span>
          </div>
          <div className="flex gap-2 items-center">
            <i className="fa-solid fa-truck text-red-600" aria-label="Mobilité"></i>
            <span>Couverture nationale</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center">
          <button className="px-6 py-2 rounded-2xl bg-red-600 hover:bg-red-700 transition font-bold">
            Contactez-nous
          </button>
          <span className="text-xs mt-2">Disponible 24/24</span>
        </div>
        
      </div>
    </div>
  );
}

export default AccueilInfo;
