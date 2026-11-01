'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BrandLogo } from '@/components/shared/brand-logo';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/providers/language-provider';
import { useSupabaseAuth } from '@/hooks/use-auth';
import { motion } from 'motion/react';
import styles from './header.module.css';
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuCloseRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const trigger = menuButtonRef.current;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = (parseFloat(getComputedStyle(document.body).paddingRight) + scrollbarWidth) + 'px';
    }
    menuCloseRef.current?.focus({ preventScroll: true });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(menuPanelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]') ?? [])
        .filter(control => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      document.removeEventListener('keydown', handleKeyDown);
      trigger?.focus({ preventScroll: true });
    };
  }, [mobileOpen]);

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
    <>
    <div className={styles.shell}>
      <motion.header data-site-header
        initial={false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className={styles.header}
      >
        <div className="flex items-center justify-between w-full">
          {/* LOGO */}
          <Link href="/" aria-label="Time Track home" className="flex min-h-11 shrink-0 items-center" onClick={() => setMobileOpen(false)}><BrandLogo className="h-auto w-[154px]" preload /></Link>

          {/* DESKTOP NAV LINKS */}
          {!mobileOpen && (
            <nav className="hidden lg:flex items-center gap-1">
              {activeLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={`min-h-11 inline-flex items-center px-3 py-1.5 text-[length:calc(13px+var(--text-size-increase,2px))] font-semibold normal-case tracking-normal rounded-full transition-colors hover:bg-black/5 whitespace-nowrap ${
                    pathname === link.href ? 'text-[#405400] bg-brand/5' : 'text-slate-600'
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
                className="min-h-11 min-w-11 px-2.5 py-1 text-xs font-semibold normal-case tracking-normal border border-black/15 rounded-full hover:bg-black/5 transition-colors text-slate-700 whitespace-nowrap"
              >
                {language === 'EN' ? 'BM' : 'EN'}
              </button>

              {loading ? null : user ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/profile"
                    aria-label="Your profile"
                    className="w-11 h-11 bg-brand/10 hover:bg-brand/20 rounded-full flex items-center justify-center transition-colors border border-brand/20 shrink-0"
                  >
                    <User size={18} className="text-[#405400]" />
                  </Link>
                  <button
                    onClick={signOut}
                    aria-label="Sign out"
                    className="min-h-11 min-w-11 flex items-center justify-center p-1.5 hover:bg-black/5 rounded-full transition-colors shrink-0"
                  >
                    <LogOut size={18} className="text-slate-500 hover:text-slate-600" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Link href="/login" className="px-3 py-1.5 text-[length:calc(13px+var(--text-size-increase,2px))] font-semibold normal-case tracking-normal text-slate-700 hover:text-slate-900 transition-colors whitespace-nowrap">
                    {t('nav.login')}
                  </Link>
                  <Link href="/signup" className="px-4.5 py-2 text-[length:calc(13px+var(--text-size-increase,2px))] font-semibold normal-case tracking-normal bg-brand text-black rounded-full hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-[1.02] transition-colors whitespace-nowrap">
                    {t('nav.signup')}
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* MOBILE TOGGLE */}
          <button
            ref={menuButtonRef}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            className="lg:hidden inline-flex h-11 w-11 items-center justify-center hover:bg-black/5 rounded-full transition-colors text-slate-700"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

      </motion.header>
    </div>
    {mobileOpen && createPortal(
      <div className={styles.mobileOverlay} onClick={(event) => {
        if (event.target === event.currentTarget) setMobileOpen(false);
      }}>
        <div ref={menuPanelRef} role="dialog" aria-modal="true" aria-labelledby="mobile-navigation-title" id="mobile-navigation" className={styles.mobilePanel}>
          <h2 id="mobile-navigation-title" className="sr-only">{language === 'BM' ? 'Navigasi' : 'Navigation'}</h2>
          <div className={styles.mobileTop}>
            <Link href="/" aria-label="Time Track home" onClick={() => setMobileOpen(false)}><BrandLogo className="h-auto w-[154px]" /></Link>
            <button ref={menuCloseRef} type="button" aria-label="Close navigation" className={styles.mobileClose} onClick={() => setMobileOpen(false)}><X size={22} aria-hidden="true" /></button>
          </div>
        {/* MOBILE NAV DRAWER (DYNAMIC ISLAND CONTENT EXPANSION) */}
        {mobileOpen && (
          <div className={styles.mobileContent}>
            <nav className={styles.mobileLinks}>
              {activeLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`text-lg font-display font-semibold normal-case tracking-tight transition-colors hover:text-[#405400] ${
                    pathname === link.href ? 'text-[#405400]' : 'text-slate-700'
                  }`}
                >
                  {'isLiteral' in link ? link.labelKey : t(link.labelKey)}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-3 mt-2 border-t border-black/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[length:calc(13px+var(--text-size-increase,2px))] font-semibold normal-case tracking-normal text-slate-500">{language === "BM" ? "Bahasa" : "Language"}</span>
                <button
                  onClick={() => setLanguage(language === 'EN' ? 'BM' : 'EN')}
                  className="min-h-11 min-w-14 px-3 py-1 text-[length:calc(12px+var(--text-size-increase,2px))] font-semibold normal-case tracking-normal border border-black/15 rounded-full text-slate-900"
                >
                  {language === 'EN' ? 'BM' : 'EN'}
                </button>
              </div>
              {user ? (
                <div className="flex flex-col gap-2 mt-2">
                  <Link href="/profile" onClick={() => setMobileOpen(false)} className="min-h-11 flex items-center justify-center w-full text-center px-4 py-2 bg-black/5 border border-black/15 text-xs font-semibold normal-case tracking-normal rounded-xl hover:bg-black/10 transition-colors text-slate-900">
                    Profile
                  </Link>
                  <button onClick={signOut} className="min-h-11 flex items-center justify-center w-full text-center px-4 py-2 bg-brand text-black text-xs font-semibold normal-case tracking-normal rounded-xl hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-colors">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="min-h-11 flex items-center justify-center w-full text-center px-4 py-2 bg-black/5 border border-black/15 text-xs font-semibold normal-case tracking-normal rounded-xl hover:bg-black/10 transition-colors text-slate-900">
                    {t('nav.login')}
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)} className="min-h-11 flex items-center justify-center w-full text-center px-4 py-2 bg-brand text-black text-xs font-semibold normal-case tracking-normal rounded-xl hover:shadow-[0_0_20px_rgba(204,255,0,0.3)] transition-colors">
                    {t('nav.signup')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        </div>
      </div>, document.body
    )}
    </>
  );
}
