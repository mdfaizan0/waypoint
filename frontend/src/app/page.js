export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background text-foreground">
      <main className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
          Shift
        </h1>
        <p className="text-xl text-muted-foreground">
          Real-time ride hailing platform
        </p>
      </main>
    </div>
  );
}
