'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/providers/language-provider';
import { useSupabaseAuth } from '@/hooks/use-auth';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, User, LogOut } from 'lucide-react';

const navLinks = [
  { href: '/', labelKey: 'nav.home' },
  { href: '/events', labelKey: 'nav.events' },
  { href: '/results', labelKey: 'nav.results' },
  { href: '/about', labelKey: 'nav.about' },
  { href: '/contact', labelKey: 'nav.contact' },
];

export function Header() {
  const { t, language, setLanguage } = useLanguage();
  const { user, loading, signOut } = useSupabaseAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const getDashboardUrl = () => {
    if (!user) return '/profile';
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return '/admin/dashboard';
    if (user.role === 'ORGANIZER') return '/organizer/dashboard';
    return '/profile';
  };

  const activeLinks = user
    ? [...navLinks, { href: getDashboardUrl(), labelKey: 'Dashboard', isLiteral: true }]
    : navLinks;

  return (
    <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
      <motion.header
        layout
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`pointer-events-auto relative flex flex-col transition-all duration-500 overflow-hidden ${
          mobileOpen 
            ? 'w-full max-w-md rounded-[2.5rem] bg-black border border-brand/30 shadow-[0_0_40px_rgba(204,255,0,0.15)] p-6'
            : scrolled
              ? 'w-full max-w-3xl rounded-full bg-black border border-brand/20 shadow-[0_4px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(204,255,0,0.05)] px-6 py-3'
              : 'w-full max-w-5xl rounded-full bg-black border border-white/10 px-8 py-4'
        }`}
      >
        <div className="flex items-center justify-between w-full">
          {/* LOGO */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center shrink-0">
              <span className="text-black font-black text-xs">TT</span>
            </div>
            <span className="font-display text-base font-black tracking-tighter text-white">
              TIME<span className="text-brand">TRACK</span>
            </span>
          </Link>

          {/* DESKTOP NAV LINKS */}
          {!mobileOpen && (
            <nav className="hidden lg:flex items-center gap-1">
              {activeLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full transition-all hover:bg-white/5 whitespace-nowrap ${
                    pathname === link.href ? 'text-brand bg-brand/5' : 'text-white/70'
                  }`}
                >
                  {'isLiteral' in link ? link.labelKey : t(link.labelKey)}
                </Link>
              ))}
            </nav>
          )}

          {/* DESKTOP ACTIONS */}
          {!mobileOpen && (
            <div className="hidden lg:flex items-center gap-2.5">
              <button
                onClick={() => setLanguage(language === 'EN' ? 'BM' : 'EN')}
                className="px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border border-white/10 rounded-full hover:bg-white/5 transition-all text-white/80 whitespace-nowrap"
              >
                {language === 'EN' ? 'BM' : 'EN'}
              </button>

              {loading ? null : user ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/profile"
                    className="w-7 h-7 bg-brand/10 hover:bg-brand/20 rounded-full flex items-center justify-center transition-all border border-brand/20 shrink-0"
                  >
                    <User size={12} className="text-brand" />
                  </Link>
                  <button
                    onClick={signOut}
                    className="p-1.5 hover:bg-white/5 rounded-full transition-all shrink-0"
                  >
                    <LogOut size={12} className="text-white/40 hover:text-white/70" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Link href="/login" className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/80 hover:text-white transition-all whitespace-nowrap">
                    {t('nav.login')}
                  </Link>
                  <Link href="/signup" className="px-4.5 py-2 text-[10px] font-black uppercase tracking-widest bg-brand text-black rounded-full hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-[1.02] transition-all whitespace-nowrap">
                    {t('nav.signup')}
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* MOBILE TOGGLE */}
          <button
            className="lg:hidden p-1.5 hover:bg-white/5 rounded-full transition-all text-white/80"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* MOBILE NAV DRAWER (DYNAMIC ISLAND CONTENT EXPANSION) */}
        {mobileOpen && (
          <div className="flex flex-col gap-6 mt-6 pt-6 border-t border-white/5 w-full">
            <nav className="flex flex-col gap-4">
              {activeLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-lg font-display font-black uppercase tracking-tight transition-colors hover:text-brand ${
                    pathname === link.href ? 'text-brand' : 'text-white/80'
                  }`}
                >
                  {'isLiteral' in link ? link.labelKey : t(link.labelKey)}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-3 mt-2 border-t border-white/5 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Language</span>
                <button
                  onClick={() => setLanguage(language === 'EN' ? 'BM' : 'EN')}
                  className="px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-full text-white"
                >
                  {language === 'EN' ? 'BM' : 'EN'}
                </button>
              </div>
              {user ? (
                <div className="flex flex-col gap-2 mt-2">
                  <Link href="/profile" className="w-full text-center px-4 py-2 bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all text-white">
                    Profile
                  </Link>
                  <button onClick={signOut} className="w-full text-center px-4 py-2 bg-brand text-black text-xs font-black uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-all">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <Link href="/login" className="w-full text-center px-4 py-2 bg-white/5 border border-white/10 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all text-white">
                    {t('nav.login')}
                  </Link>
                  <Link href="/signup" className="w-full text-center px-4 py-2 bg-brand text-black text-xs font-black uppercase tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-all">
                    {t('nav.signup')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.header>
    </div>
  );
}
