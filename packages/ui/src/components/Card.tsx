import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hover = false, onClick }: CardProps) {
  return (
    <div
      className={`
        bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20
        ${hover ? 'hover:border-purple-500 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20 transition-all cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
