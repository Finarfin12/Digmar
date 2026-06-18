"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, BarChart2, TrendingUp, Settings, Sparkles, Image as ImageIcon, ListOrdered, MessageSquare } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Beranda', path: '/', icon: Home },
    { name: 'Smart Inbox', path: '/inbox', icon: MessageSquare },
    { name: 'Planner', path: '/planner', icon: Calendar },
    { name: 'Analytics', path: '/analytics', icon: BarChart2 },
    { name: 'Auto-Queue', path: '/queue', icon: ListOrdered },
    { name: 'Content Library', path: '/library', icon: ImageIcon },
    { name: 'Trend Insight', path: '/trends', icon: TrendingUp },
  ];

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-slate-950 text-slate-300 flex flex-col border-r border-slate-800 shadow-2xl z-20">
      <div className="p-8 flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/30">
          <Sparkles className="text-white" size={24} />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">Digi<span className="text-indigo-500">Mar</span></h1>
      </div>
      
      <nav className="flex-1 mt-4">
        <div className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Menu Utama</div>
        <ul className="space-y-1.5 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <Link 
                  href={item.path} 
                  className={`flex items-center space-x-3 p-3.5 rounded-xl transition-all duration-300 font-bold ${
                    isActive 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 translate-x-1' 
                      : 'hover:bg-slate-800 hover:text-indigo-300 hover:translate-x-1'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'} />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="px-1 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sistem</div>
        <Link 
          href="/settings" 
          className={`flex items-center space-x-3 p-3.5 rounded-xl transition-all duration-300 font-bold ${
            pathname === '/settings'
              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 translate-x-1'
              : 'hover:bg-slate-800 hover:text-amber-400 hover:translate-x-1'
          }`}
        >
          <Settings size={20} className={pathname === '/settings' ? 'text-white' : 'text-slate-400'} />
          <span>Pengaturan</span>
        </Link>
      </div>
    </aside>
  );
}
