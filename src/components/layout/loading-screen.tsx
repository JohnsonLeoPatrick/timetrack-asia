'use client';

import { BrandLogo } from '@/components/shared/brand-logo';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '@/providers/language-provider';

interface LoadingScreenProps {
  onComplete?: () => void;
}

export function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const { t } = useLanguage();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setProgress((prev) => Math.min(prev + Math.floor(Math.random() * 15), 100));
    }, 150);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (progress < 100) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const timeout = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 500);
    return () => clearTimeout(timeout);
  }, [progress, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-0 z-[100] bg-[#f5f5f7] flex flex-col items-center justify-center"
        >
          <div className="max-w-md w-full px-8 text-center">
            <BrandLogo className="mx-auto mb-8 h-auto w-44" />

            <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden mb-4">
              <motion.div
                className="h-full bg-brand rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <p className="text-sm font-semibold normal-case tracking-normal text-[#405400] mb-1">
              {t('loading.init')}
            </p>
            <p className="text-sm font-semibold normal-case tracking-normal text-slate-600">
              {progress}%
            </p>
            <p className="text-sm font-bold normal-case tracking-normal text-slate-500 mt-4">
              {t('loading.status')}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
