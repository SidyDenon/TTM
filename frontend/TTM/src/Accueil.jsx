import React from 'react';

function Accueil() {
  const HERO = "/assets/accueil.png"; // or .png/.webp — exact name & case

  return (
    <div
       className="min-h-screen w-full flex items-center justify-center fixed"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.45)), url(${HERO})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}>
        <div className="bg-[#00000051] w-full h-full ">
        </div>
    </div>
  )
}

export default Accueil;