import Image from 'next/image';

export function BrandLogo({ className = 'h-auto w-40', preload = false }: { className?: string; preload?: boolean }) {
  return <Image src="/images/time-track-logo.png" alt="Time Track" width={2048} height={542} className={className} preload={preload} />;
}
