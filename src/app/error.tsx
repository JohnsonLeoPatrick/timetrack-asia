'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-6">
        <span className="text-red-500 font-semibold text-xl">!</span>
      </div>
      <h1 className="text-2xl font-semibold normal-case tracking-tight mb-2">Something went wrong</h1>
      <p className="text-sm text-neutral-400 mb-6 max-w-md">
        An unexpected error occurred. Please try again.
      </p>
      <button
        onClick={reset}
        className="px-6 py-3 bg-lime-400 text-black font-bold rounded-full normal-case text-sm tracking-wide hover:bg-lime-300 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
