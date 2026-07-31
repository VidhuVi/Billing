"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar({ onNewEvaluation }: { onNewEvaluation?: () => void }) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'dashboard' },
    { name: 'Experiments', path: '/experiments', icon: 'science' },
    { name: 'Comparison', path: '/comparison', icon: 'compare' },
    { name: 'Prompts', path: '/prompts', icon: 'terminal' },
    { name: 'Settings', path: '/settings', icon: 'settings' },
  ];

  return (
    <aside className="w-64 bg-[#0b0e15] border-r border-[#1F2937] flex flex-col p-4 shrink-0 z-10 hidden md:flex">
      <div className="flex items-center gap-3 mb-8 px-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4d8eff] to-[#004fcf] flex items-center justify-center text-white font-bold text-lg shadow-lg">T</div>
        <h1 className="font-bold text-white tracking-wide">Taxor <span className="text-[#c2c6d6] font-normal text-sm">Eval</span></h1>
      </div>

      <button
        onClick={onNewEvaluation}
        className="w-full mb-6 bg-[#4d8eff] text-[#00285d] hover:bg-[#adc6ff] transition-colors py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 font-medium shadow-sm"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
        New Evaluation
      </button>

      <nav className="flex-1 flex flex-col gap-1 font-mono text-xs">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-[#00a572]/20 text-[#4edea3] font-semibold border border-[#00a572]/30' 
                  : 'text-[#c2c6d6] hover:bg-[#191b23]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[#1F2937] pt-4 flex flex-col gap-1 font-mono text-xs">
        <a className="flex items-center gap-3 px-3 py-2 text-[#c2c6d6] hover:bg-[#191b23] transition-colors rounded-lg" href="#">
          <span className="material-symbols-outlined text-[18px]">description</span>
          Docs
        </a>
        <a className="flex items-center gap-3 px-3 py-2 text-[#c2c6d6] hover:bg-[#191b23] transition-colors rounded-lg" href="#">
          <span className="material-symbols-outlined text-[18px]">help</span>
          Support
        </a>
      </div>
    </aside>
  );
}