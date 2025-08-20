import React from 'react'

function Nav() {
  return (
    <div className=" fixed w-full h-15 border-b-3 text-white border-[#800E08] bg-[#000000ed] flex justify-between px-5 items-center z-10 shadow-xl/50 "> 
        <div src="/assets/react.svg">Logo</div>
        <div className=" flex justify-around gap-10">
            <a href="#">Accueil</a>
            <a href="#">Notre Histoire</a>
            <a href="#">Services</a>
            <a href="#">Avis</a>
            <a href="#">Tarifs</a>
        </div>
        <div className=" border-2 border-[#800E08] px-4 pb-1 rounded-xl text-[.9rem]  py-0 mt-1 ">Contact</div>
    </div>
  )
}

export default Nav;