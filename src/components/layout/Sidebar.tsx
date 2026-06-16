import Link from 'next/link';
import { Home, Calendar, BarChart2, TrendingUp, Settings } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-wider">DigiMar<span className="text-blue-500">Hub</span></h1>
      </div>
      <nav className="flex-1 mt-6">
        <ul className="space-y-2 px-4">
          <li>
            <Link href="/" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 transition-colors">
              <Home size={20} />
              <span>Beranda</span>
            </Link>
          </li>
          <li>
            <Link href="/planner" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 transition-colors">
              <Calendar size={20} />
              <span>Planner</span>
            </Link>
          </li>
          <li>
            <Link href="/analytics" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 transition-colors">
              <BarChart2 size={20} />
              <span>Analytics</span>
            </Link>
          </li>
          <li>
            <Link href="/trends" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 transition-colors">
              <TrendingUp size={20} />
              <span>Trend Insight</span>
            </Link>
          </li>
        </ul>
      </nav>
      <div className="p-4 border-t border-gray-800">
        <Link href="/settings" className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-800 transition-colors">
          <Settings size={20} />
          <span>Pengaturan</span>
        </Link>
      </div>
    </aside>
  );
}
