import { VoiceInterface } from "@/components/voice-interface";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="container mx-auto">
        <VoiceInterface />
      </main>

      <footer className="fixed bottom-4 w-full text-center text-xs text-slate-400 pointer-events-none">
        Powered by RMV HAFAS API
      </footer>
    </div>
  );
}
