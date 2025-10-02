import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Restaurant Deal Model</h1>
      <p className="max-w-xl text-muted-foreground">
        Navigate to the interactive pro-forma to configure revenue, costs, capital
        structure, and distributions on a monthly basis.
      </p>
      <Link
        href="/deal-model"
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground transition hover:opacity-90"
      >
        Open deal model
      </Link>
    </main>
  );
}
