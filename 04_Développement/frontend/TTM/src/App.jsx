 import React from 'react'


import Nav from './Nav';
import Accueil from './Accueil';
import AcccueilInfo from './AcccueilInfo';
import Histoire from './Histoire';
import Services from './Services';
import Avis from './Avis';
import Tarifs from './Tarifs';

 
 const App = () => {
   return (
     <> 
      <Nav />
      <Accueil />
      <AcccueilInfo />        
      <Histoire />
      <Services />
      <Avis />
      <Tarifs />

     </>
   )
 }
 
 export default App