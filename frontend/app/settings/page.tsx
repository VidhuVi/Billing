import Sidebar from '@/components/Sidebar';

export default function SettingsPage() {
  return (
    <div className="flex h-full bg-[#0B0E14]">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden bg-[#0B0E14] p-8">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-4xl text-[#4d8eff]">settings</span>
            <h1 className="text-3xl font-bold text-white">Settings</h1>
          </div>
          <p className="text-[#c2c6d6]">Configure API keys and Zoho integration.</p>
        </header>
        <div className="flex-1 border-2 border-dashed border-[#1F2937] rounded-xl flex items-center justify-center flex-col text-[#424754]">
          <span className="material-symbols-outlined text-6xl mb-4 opacity-50">build</span>
          <p className="font-mono">Under Construction</p>
          <p className="text-sm mt-2">This feature is planned for the next release phase.</p>
        </div>
      </main>
    </div>
  );
}