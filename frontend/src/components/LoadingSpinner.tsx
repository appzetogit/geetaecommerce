import React from 'react';

/**
 * Lightweight loading spinner component
 * Optimized for fast rendering with faster rotation
 */
export default function LoadingSpinner({
  size = 'md',
  className = ''
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        className={`${sizeClasses[size]} border-gray-200 border-t-green-600 rounded-full animate-[spin_0.6s_linear_infinite]`}
      />
    </div>
  );
}

