import { ReactNode } from 'react';

/**
 * Minimal loading state that matches page background
 * Prevents flash by using same background as pages
 */
export default function PageLoader({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      {children || (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-green-600 rounded-full animate-[spin_0.6s_linear_infinite]" />
          <p className="text-sm text-neutral-500">Loading...</p>
        </div>
      )}
    </div>
  );
}

