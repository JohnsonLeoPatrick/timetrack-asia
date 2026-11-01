'use client';

import Link from 'next/link';
import { BrandLogo } from '@/components/shared/brand-logo';
import { useLanguage } from '@/providers/language-provider';

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer data-site-footer className="border-t border-slate-300 bg-[#f5f5f7] text-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <Link href="/" aria-label="Time Track home" className="mb-4 inline-flex"><BrandLogo className="h-auto w-44" /></Link>
            <p className="text-sm text-slate-600 font-bold normal-case tracking-normal">
              {t('footer.copyright')}
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold normal-case tracking-normal text-slate-600 mb-4">
              {t('footer.explore')}
            </h4>
            <div className="flex flex-col gap-2">
              {[
                { href: '/', label: 'nav.home' },
                { href: '/about', label: 'nav.about' },
                { href: '/contact', label: 'nav.contact' },
                { href: '/organizer/login', label: 'Organizer Access' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-bold normal-case tracking-normal text-slate-600 hover:text-[#405400] transition-colors"
                >
                  {t(link.label)}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold normal-case tracking-normal text-slate-600 mb-4">
              {t('footer.policy')}
            </h4>
            <div className="flex flex-col gap-2">
              <Link
                href="/privacy-policy"
                className="text-sm font-bold normal-case tracking-normal text-slate-600 hover:text-[#405400] transition-colors"
              >
                {t('footer.privacy')}
              </Link>
              <Link
                href="/refund-policy"
                className="text-sm font-bold normal-case tracking-normal text-slate-600 hover:text-[#405400] transition-colors"
              >
                {t('footer.refund')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-slate-500 font-bold normal-case tracking-normal">
            {t('footer.copyright')}
          </p>
          <div className="flex gap-3">
            <div className="w-2 h-2 bg-brand/50 rounded-full animate-pulse" />
            <div className="w-2 h-2 bg-brand/30 rounded-full animate-pulse [animation-delay:0.5s]" />
            <div className="w-2 h-2 bg-brand/10 rounded-full animate-pulse [animation-delay:1s]" />
          </div>
        </div>
      </div>
    </footer>
  );
}
