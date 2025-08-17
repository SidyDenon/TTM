 import React from 'react'


import Nav from './Nav';
import Accueil from './Accueil';
import AcccueilInfo from './AcccueilInfo';
import Histoire from './Histoire';
import Services from './Services';
import Avis from './Avis';


 
 const App = () => {
   return (
     <> 
      <Nav />
      <Accueil />
      <AcccueilInfo />        
      <Histoire />
      <Services />
      <Avis />
     </>
   )
 }
 
 export default App