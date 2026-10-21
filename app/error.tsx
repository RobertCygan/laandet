"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="container empty-page">
      <h1>Noe gikk ikke helt som det skulle.</h1>
      <p>Prøv å laste inn siden på nytt.</p>
      <button className="button primary" onClick={reset}>
        Prøv igjen
      </button>
    </div>
  );
}
