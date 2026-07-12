'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard, Users, Calendar, CreditCard, Trophy,
  BarChart3, Settings, LogOut, Tag, FileText, ScrollText,
  Menu, X, Key
} from 'lucide-react';

interface SidebarProps {
  variant: 'admin' | 'organizer' | 'developer';
}

const adminNav = [
  { href: '/admin/dashboard?tab=overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/dashboard?tab=users', label: 'Users', icon: Users },
  { href: '/admin/dashboard?tab=events', label: 'Events', icon: Calendar },
  { href: '/admin/dashboard?tab=payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/dashboard?tab=codes', label: 'Codes', icon: Key },
  { href: '/admin/dashboard?tab=settings', label: 'Settings', icon: Settings },
];

const organizerNav = [
  { href: '/organizer/dashboard?tab=overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/organizer/dashboard?tab=events', label: 'Events', icon: Calendar },
  { href: '/organizer/dashboard?tab=registrations', label: 'Registrations', icon: FileText },
  { href: '/organizer/dashboard?tab=results', label: 'Results', icon: Trophy },
  { href: '/organizer/dashboard?tab=coupons', label: 'Coupons', icon: Tag },
  { href: '/organizer/dashboard?tab=form-templates', label: 'Forms', icon: FileText },
  { href: '/organizer/dashboard?tab=analytics', label: 'Analytics', icon: BarChart3 },
];

const developerNav = [
  { href: '/developer/dashboard', label: 'Users', icon: Users },
  { href: '/developer/dashboard/audit', label: 'Audit', icon: ScrollText },
  { href: '/developer/dashboard/db-monitor', label: 'DB Monitor', icon: BarChart3 },
];

const navMap = { admin: adminNav, organizer: organizerNav, developer: developerNav };
const colorMap = {
  admin: { hover: 'hover:bg-red-500/10 hover:text-red-500', active: 'bg-red-500/10 text-red-500', border: 'border-red-500/20' },
  organizer: { hover: 'hover:bg-blue-500/10 hover:text-blue-500', active: 'bg-blue-500/10 text-blue-500', border: 'border-blue-500/20' },
  developer: { hover: 'hover:bg-purple-500/10 hover:text-purple-500', active: 'bg-purple-500/10 text-purple-500', border: 'border-purple-500/20' },
};

export function Sidebar({ variant }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { signOut } = useSupabaseAuth();
  const [isOpen, setIsOpen] = useState(false);
  const nav = navMap[variant];
  const colors = colorMap[variant];
  const currentTab = searchParams.get('tab') || 'overview';

  return (
    <>
      {/* Mobile Hamburger Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-3.5 left-4 z-40 lg:hidden p-2 text-white/50 hover:text-white bg-black/60 border border-white/10 backdrop-blur-md rounded-xl transition-all hover:scale-105"
      >
        <Menu size={18} />
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`w-64 bg-[#050505] border-r border-white/10 min-h-screen flex flex-col fixed inset-y-0 left-0 z-50 lg:z-10 lg:relative transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center">
              <span className="text-black font-black text-sm">TT</span>
            </div>
            <span className="font-display text-lg font-black tracking-tighter">
              {variant === 'admin' ? 'ADMIN' : variant === 'organizer' ? 'ORGANIZER' : 'DEVELOPER'}
            </span>
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {nav.map((item) => {
            const hrefPath = item.href.split('?')[0];
            const hrefTab = item.href.includes('tab=') ? item.href.split('tab=')[1] : null;
            const isActive = hrefTab
              ? pathname === hrefPath && currentTab === hrefTab
              : pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  isActive ? colors.active : 'text-white/40 ' + colors.hover
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-white/30 hover:bg-white/5 transition-all w-full"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
