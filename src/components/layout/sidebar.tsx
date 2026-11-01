'use client';

import { BrandLogo } from '@/components/shared/brand-logo';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from '@/hooks/use-auth';
import {
  LayoutDashboard, Users, Calendar, CreditCard, Trophy,
  BarChart3, Settings, LogOut, Tag, FileText, ScrollText,
  Menu, Key
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

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
  { href: '/organizer/dashboard?tab=settings', label: 'Settings', icon: Settings },
  { href: '/organizer/dashboard?tab=overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/organizer/dashboard?tab=events', label: 'Events', icon: Calendar },
  { href: '/organizer/dashboard?tab=registrations', label: 'Registrations', icon: FileText },
  { href: '/organizer/dashboard?tab=results', label: 'Results', icon: Trophy },
  { href: '/organizer/dashboard?tab=coupons', label: 'Coupons', icon: Tag },
  { href: '/organizer/dashboard?tab=form-templates', label: 'Forms', icon: FileText },
  { href: '/organizer/dashboard?tab=analytics', label: 'Analytics', icon: BarChart3 },
];

const developerNav = [
  { href: '/developer/dashboard?tab=users', label: 'Users', icon: Users },
  { href: '/developer/dashboard?tab=audit', label: 'Audit', icon: ScrollText },
  { href: '/developer/dashboard?tab=db-monitor', label: 'DB Monitor', icon: BarChart3 },
];

const navMap = { admin: adminNav, organizer: organizerNav, developer: developerNav };

export function Sidebar({ variant }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { signOut, user } = useSupabaseAuth();
  const [isOpen, setIsOpen] = useState(false);
  const nav = [...navMap[variant], ...(user?.role === 'SUPER_ADMIN' ? [
    ...(variant !== 'admin' ? [{ href: '/admin/dashboard', label: 'Admin dashboard', icon: LayoutDashboard }] : []),
    ...(variant !== 'organizer' ? [{ href: '/organizer/dashboard', label: 'Organizer dashboard', icon: Calendar }] : []),
    ...(variant !== 'developer' ? [{ href: '/developer/dashboard?tab=users', label: 'Developer dashboard', icon: Settings }] : []),
  ] : [])];
  const currentTab = searchParams.get('tab') || (variant === 'developer' ? 'users' : 'overview');

  useEffect(() => {
    const viewport = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (viewport.matches) setIsOpen(false); };
    viewport.addEventListener('change', closeOnDesktop);
    return () => viewport.removeEventListener('change', closeOnDesktop);
  }, []);

  const navigation = () => <>
    <div className="border-b border-slate-200 px-6 py-7">
      <Link href="/" className="inline-flex min-h-11 items-center" aria-label="TimeTrack home"><BrandLogo className="h-auto w-32" /></Link>
      <p className="mt-4 text-xs font-medium capitalize tracking-wide text-slate-500">{variant} workspace</p>
    </div>
    <nav aria-label={`${variant} navigation`} className="flex-1 space-y-1 overflow-y-auto p-3">
      {nav.map(item => {
        const [hrefPath, hrefQuery] = item.href.split('?');
        const hrefTab = new URLSearchParams(hrefQuery).get('tab');
        const isActive = pathname === hrefPath && (hrefTab ? currentTab === hrefTab : true);
        return <Link key={item.href} aria-current={isActive ? 'page' : undefined} href={item.href} onClick={() => setIsOpen(false)}
          className={`flex min-h-11 items-center gap-3 border-l-2 px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#4e6500] ${isActive ? 'workspace-active' : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
          <item.icon size={17} aria-hidden="true" />{item.label}
        </Link>;
      })}
    </nav>
    <div className="border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <button onClick={() => { setIsOpen(false); signOut(); }} className="flex min-h-11 w-full items-center gap-3 px-3 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950">
        <LogOut size={17} aria-hidden="true" />Sign out
      </button>
    </div>
  </>;

  return (
    <>
      {/* Mobile Hamburger Trigger */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger aria-label="Open dashboard navigation" className="fixed top-4 left-4 z-30 flex size-11 items-center justify-center border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"><Menu size={20} aria-hidden="true" /></SheetTrigger>

      {/* Backdrop */}
        <SheetContent side="left" data-workspace={variant} className="gap-0 rounded-none bg-white data-[side=left]:w-[min(20rem,calc(100vw-2rem))]">
          <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate your {variant} workspace.</SheetDescription>
          {navigation()}
        </SheetContent>
      </Sheet>

      {/* Sidebar Container */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">{navigation()}</aside>
    </>
  );
}
