import { VoiceInterface } from "@/components/voice-interface";

export default function Home() {
  return (
    <div className="min-h-screen bg-background bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/30 via-background to-background">
      <header className="p-6 flex justify-center border-b border-white/5">
        <h1 className="text-xl font-bold tracking-tight text-foreground/90 flex items-center gap-2">
          <span className="text-primary">RMV</span> Voice
        </h1>
      </header>
      
      <main className="container mx-auto">
        <VoiceInterface />
      </main>

      <footer className="fixed bottom-4 w-full text-center text-xs text-white/20 pointer-events-none">
        Powered by RMV HAFAS API
      </footer>
    </div>
  );
}
