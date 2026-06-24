"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calendar, BarChart2, TrendingUp, Settings, Sparkles, Image as ImageIcon, ListOrdered, MessageSquare, Users } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Overview', path: '/', icon: Home },
    { name: 'Smart Inbox', path: '/inbox', icon: MessageSquare },
    { name: 'Accounts', path: '/accounts', icon: Users },
    { name: 'Planner', path: '/planner', icon: Calendar },
    { name: 'Content Generator', path: '/studio', icon: Sparkles },
    { name: 'Content Library', path: '/library', icon: ImageIcon },
    { name: 'Analytics', path: '/analytics', icon: BarChart2 },
    { name: 'Trend Insight', path: '/trends', icon: TrendingUp },
  ];

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 bg-slate-50 text-slate-600 flex flex-col border-r border-slate-200 z-20">
      <div className="p-6 flex items-center gap-3 border-b border-slate-200/50">
        <div className="text-green-600">
          <Sparkles size={24} strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Digi<span className="text-green-600">Mar</span></h1>
      </div>
      
      <nav className="flex-1 mt-6 overflow-y-auto">
        <div className="px-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Menu</div>
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <li key={item.path}>
                <Link 
                  href={item.path} 
                  className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 text-sm ${
                    isActive 
                      ? 'bg-green-100/50 text-green-700 font-semibold' 
                      : 'hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <Icon size={18} className={isActive ? 'text-green-600' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-slate-200">
        <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sistem</div>
        <Link 
          href="/settings" 
          className={`flex items-center space-x-3 p-3 rounded-lg transition-colors duration-200 text-sm font-medium ${
            pathname === '/settings'
              ? 'bg-green-100/50 text-green-700 font-semibold'
              : 'hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Settings size={18} className={pathname === '/settings' ? 'text-green-600' : 'text-slate-400'} />
          <span>Pengaturan</span>
        </Link>
      </div>
    </aside>
  );
}
