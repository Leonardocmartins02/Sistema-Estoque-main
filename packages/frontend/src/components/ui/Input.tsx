import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, hint, error, leftIcon, rightIcon, className = '', ...props }, ref) => {
    const inputId = id || React.useId();
    const describedByIds: string[] = [];
    if (hint) describedByIds.push(`${inputId}-hint`);
    if (error) describedByIds.push(`${inputId}-error`);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative mt-1">
          {leftIcon && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={describedByIds.join(' ') || undefined}
            className={`w-full rounded-md border bg-white py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ${
              error ? 'border-red-300' : 'border-gray-300'
            } ${leftIcon ? 'pl-9 pr-3' : rightIcon ? 'pl-3 pr-9' : 'px-3'} ${className}`}
            {...props}
          />
          {rightIcon && (
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              {rightIcon}
            </span>
          )}
        </div>
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1 text-xs text-gray-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export default Input;
