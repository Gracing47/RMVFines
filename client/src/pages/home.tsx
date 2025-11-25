import { VoiceInterface } from "@/components/voice-interface";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <header className="p-4 sm:p-6 flex justify-center border-b border-white/10 bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <span className="text-primary">🚆 RMV</span> 
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">Voice</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Ihre Fahrplanauskunft per Sprache</p>
        </div>
      </header>
      
      <main className="container mx-auto px-2">
        <VoiceInterface />
      </main>

      <footer className="fixed bottom-2 sm:bottom-4 w-full text-center text-xs text-muted-foreground/50 pointer-events-none">
        Powered by RMV HAFAS API
      </footer>
    </div>
  );
}
