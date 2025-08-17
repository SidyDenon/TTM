import React from 'react'

function Avis() {
  return (
    <div className='w-full h-screen flex '>
        <div className="z-5 bg-white/80 w-full flex flex-col items-center py-[90px] gap-4">
          <h1 className='text-3xl font-bold'>Avis Client</h1>
          <div className="w-full h-full flex justify-center items-center py-[70px] gap-5">
                <div className="histoirePhoto w-[30%] h-full relative flex justify-end ">
              <div className="bg-[#800E08]  w-[95%]  h-[95%] rounded-tr-lg  "></div>
              <div className=" absolute h-[95%] bottom-0">
                  <img src="/assets/Avis.jpg" alt="histoire" className='w-[95%] h-full    rounded-l-lg'/>
              </div>
              </div>
                <div className="avisInfo h-full w-[50%]">
                    <div className="flex flex-col items-center gap-4">
                        <div className="userInfo relative">
                        <div className="icon absolute left-[140px]">
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                        </div>
                        <h1 className='font-bold'>Moussa Diarra</h1>
                        <p>Lorem, ipsum dolor sit amet consectetur adipisicing.</p>
                        </div>
                        <div className="userInfo relative">
                        <div className="icon absolute left-[140px]">
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                        </div>
                        <h1 className='font-bold'>Moussa Diarra</h1>
                        <p>Lorem, ipsum dolor sit amet consectetur adipisicing.</p>
                        </div>
                        <div className="userInfo relative">
                        <div className="icon absolute left-[140px]">
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                        </div>
                        <h1 className='font-bold'>Moussa Diarra</h1>
                        <p>Lorem, ipsum dolor sit amet consectetur adipisicing.</p>
                        </div>
                        <div className="userInfo relative">
                        <div className="icon absolute left-[140px]">
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                        </div>
                        <h1 className='font-bold'>Moussa Diarra</h1>
                        <p>Lorem, ipsum dolor sit amet consectetur adipisicing.</p>
                        </div>
                        <div className="userInfo relative">
                        <div className="icon absolute left-[140px]">
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                            <div className="fa-solid fa-star text-amber-500 scale-80"></div>
                        </div>
                        <h1 className='font-bold'>Moussa Diarra</h1>
                        <p>Lorem, ipsum dolor sit amet consectetur adipisicing.</p>
                        </div>
                    </div>
                 </div>
          </div>
        </div>
    </div>
  )
}

export default Avis;