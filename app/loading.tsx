export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="h-52 animate-pulse rounded-3xl bg-eatlee-green/10" />
      <div className="h-24 animate-pulse rounded-3xl bg-white shadow-soft" />
      <div className="h-[28rem] animate-pulse rounded-3xl bg-white shadow-soft" />
    </main>
  );
}
