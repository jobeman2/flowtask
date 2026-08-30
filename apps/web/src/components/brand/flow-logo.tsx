'use client';

import React from 'react';

interface FlowLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function FlowLogo({ className = '', size = 'md' }: FlowLogoProps) {
  const heightClasses = {
    sm: 'h-5',
    md: 'h-6',
    lg: 'h-8',
  };

  return (
    <div className={`flex items-center gap-1.5 select-none ${className}`}>
      {/* SVG recreation of the official FLOW logo with checkmark in O */}
      <svg
        viewBox="0 0 160 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${heightClasses[size]} w-auto text-blue-600 dark:text-blue-500 fill-current`}
      >
        {/* F */}
        <path
          d="M12 8C7.58172 8 4 11.5817 4 16V36C4 38.2091 5.79086 40 8 40C10.2091 40 12 38.2091 12 36V27H28C30.2091 27 32 25.2091 32 23C32 20.7909 30.2091 19 28 19H12V16C12 13.7909 13.7909 12 16 12H30C32.2091 12 34 10.2091 34 8C34 5.79086 32.2091 4 30 4H16C13.7909 4 12 5.79086 12 8Z"
        />
        {/* L */}
        <path
          d="M44 8C41.7909 8 40 9.79086 40 12V32C40 36.4183 43.5817 40 48 40H68C70.2091 40 72 38.2091 72 36C72 33.7909 70.2091 32 68 32H50C48.8954 32 48 31.1046 48 30V12C48 9.79086 46.2091 8 44 8Z"
        />
        {/* O with Checkmark */}
        <g>
          {/* Outer ring of O */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M96 6C82.7452 6 72 16.7452 72 30C72 43.2548 82.7452 54 96 54C109.255 54 120 43.2548 120 30C120 16.7452 109.255 6 96 6ZM96 14C87.1634 14 80 21.1634 80 30C80 38.8366 87.1634 46 96 46C104.837 46 112 38.8366 112 30C112 21.1634 104.837 14 96 14Z"
          />
          {/* Checkmark inside O */}
          <path
            d="M89 30L94 35L104 23"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>
        {/* W */}
        <path
          d="M125 12C125 9.79086 123.209 8 121 8C118.791 8 117 9.79086 117 12V28C117 34.6274 122.373 40 129 40C132.894 40 136.331 38.1456 138.5 35.2536C140.669 38.1456 144.106 40 148 40C154.627 40 160 34.6274 160 28V12C160 9.79086 158.209 8 156 8C153.791 8 152 9.79086 152 12V28C152 30.2091 150.209 32 148 32C145.791 32 144 30.2091 144 28V16C144 13.7909 142.209 12 140 12C137.791 12 136 13.7909 136 16V28C136 30.2091 134.209 32 132 32C129.791 32 128 30.2091 128 28V12C128 9.79086 126.209 8 125 12Z"
        />
      </svg>
    </div>
  );
}
