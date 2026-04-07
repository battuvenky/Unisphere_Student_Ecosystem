export default function WorkspaceLoading() {
  return (
    <section className="space-y-6 page-enter" aria-busy="true" aria-live="polite">
      <div className="skeleton h-36 w-full rounded-3xl" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-28 rounded-2xl" />
      </div>

      <div className="skeleton h-72 rounded-2xl" />
    </section>
  );
}
