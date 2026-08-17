import React from "react";

export default class AppErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    if (import.meta.env.DEV) console.error("Erreur interface dashboard:", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <section className="max-w-md w-full rounded-2xl bg-white p-8 text-center shadow-lg">
          <h1 className="text-2xl font-bold text-slate-900">Un problème est survenu</h1>
          <p className="mt-3 text-slate-600">Cette page n’a pas pu être affichée. Rechargez-la pour continuer.</p>
          <button
            type="button"
            className="mt-6 rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
            onClick={() => window.location.reload()}
          >
            Recharger la page
          </button>
        </section>
      </main>
    );
  }
}
