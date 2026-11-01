'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Sidebar } from '@/components/layout/sidebar';
import styles from './dashboard.module.css';

export function DashboardFrame({ variant, title, description, children }: {
  variant: 'admin' | 'organizer' | 'developer';
  title: string;
  description: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div data-workspace={variant} className={`${styles.dashboard} flex min-h-dvh bg-[#f7f8f5]`}>
      <a href="#dashboard-content" className="sr-only z-[100] bg-white p-4 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">Skip to dashboard content</a>
      <Sidebar variant={variant} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex min-h-[76px] items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 pl-20 sm:pr-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs font-medium capitalize text-slate-500">{variant} workspace</p>
            <h1 className="text-lg font-semibold tracking-tight text-slate-950 sm:text-xl">{title}</h1>
          </div>
          <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2 px-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4e6500]">
            <span className="hidden sm:inline">View website</span><ArrowUpRight size={18} aria-hidden="true" /><span className="sr-only sm:hidden">View website</span>
          </Link>
        </header>
        <main id="dashboard-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] p-4 outline-none sm:p-6 lg:p-8">
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
          <motion.div key={`${variant}-${title}`} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

export function DashboardLoading({ label = 'Loading your workspace' }: { label?: string }) {
  return <div role="status" aria-label={label} className="space-y-5">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="grid gap-px border border-slate-200 bg-slate-200 sm:grid-cols-3">
      {[0, 1, 2].map(item => <div key={item} className="space-y-5 bg-white p-6"><div className="h-3 w-24 animate-pulse bg-slate-200" /><div className="h-9 w-32 animate-pulse bg-slate-100" /></div>)}
    </div>
    <div aria-hidden="true" className="space-y-4 border border-slate-200 bg-white p-6">{[0, 1, 2, 3].map(item => <div key={item} className="h-9 animate-pulse bg-slate-100" />)}</div>
  </div>;
}
