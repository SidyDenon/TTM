import React from 'react'


// src/App.jsx
import Nav from './Nav';
import Accueil from './Accueil';
import AccueilInfo from './AccueilInfo';
import Histoire from './Histoire';
import Services from './Services';
import Avis from './Avis';
import Tarifs from './Tarifs';
import Faq from './Faq';
import ScrollToTopProgress from './ScrollToTopProgress';
import SeoSchema from './SeoSchema';
import { SupportConfigProvider } from './context/SupportConfigContext';

const App = () => {
  return (
    <>
      <SupportConfigProvider>
        <SeoSchema />
        <Nav />
        <main data-prerender-ready="true">
          {/* Ajoute scroll-mt-24 (≈96px) pour compenser la navbar fixe */}
          <section id="accueil" className="scroll-mt-24">
            <Accueil />
          </section>

          <section id="infos" className="scroll-mt-24">
            <AccueilInfo />
          </section>

          <section id="histoire" className="scroll-mt-24">
            <Histoire />
          </section>

          <section id="services" className="scroll-mt-24">
            <Services />
          </section>

          <section id="avis" className="scroll-mt-24">
            <Avis />
          </section>

          <section id="tarifs" className="scroll-mt-24">
            <Tarifs />
          </section>

          <section id="faq" className="scroll-mt-24">
            <Faq />
          </section>
          <section className="w-full flex relative">
            <ScrollToTopProgress />
            {/* le reste de ta page */}
          </section>
        </main>
      </SupportConfigProvider>
    </>
  );
};

export default App;
