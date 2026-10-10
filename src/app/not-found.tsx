import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 py-20 text-center">
      <p className="kicker text-brand-red">Erreur 404</p>
      <h1 className="mt-4 font-serif text-5xl font-bold tracking-tight text-ink">
        Page introuvable
      </h1>
      <p className="mt-4 max-w-md text-ink-soft">
        La page que vous recherchez n&apos;existe pas, a été déplacée ou n&apos;est plus disponible.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 bg-brand-red px-6 py-3 text-sm font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
