'use client';

import { useRef } from 'react';
import { useInView } from 'motion/react';

interface MarqueeProps {
  text: string;
}

export function Marquee({ text }: MarqueeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);

  return (
    <div ref={ref} className="py-3 bg-brand -rotate-2 overflow-hidden">
      <span className="sr-only">{text}</span>
      <div
        aria-hidden="true"
        style={{ animationPlayState: visible ? 'running' : 'paused' }}
        className="marquee-track flex w-max whitespace-nowrap"
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="text-black font-display font-semibold normal-case text-sm md:text-base tracking-normal mx-8"
          >
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}
