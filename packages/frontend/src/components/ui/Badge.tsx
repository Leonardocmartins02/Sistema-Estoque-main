import React from 'react';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  children: React.ReactNode;
};

const styles: Record<Variant, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200',
  info: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200',
  neutral: 'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-200',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'neutral', className = '', children, ...props }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[variant]} ${className} transition-transform duration-150 ease-out will-change-transform hover:scale-[1.02]`}
    {...props}
  >
    {children}
  </span>
);

export default Badge;
