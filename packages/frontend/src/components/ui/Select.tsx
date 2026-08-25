import React from 'react';

export interface Option {
  label: string;
  value: string | number;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: Option[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, hint, error, options, className = '', children, ...props }, ref) => {
    const selectId = id || React.useId();
    const describedByIds: string[] = [];
    if (hint) describedByIds.push(`${selectId}-hint`);
    if (error) describedByIds.push(`${selectId}-error`);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative mt-1">
          <select
            id={selectId}
            ref={ref}
            aria-invalid={!!error}
            aria-describedby={describedByIds.join(' ') || undefined}
            className={`w-full appearance-none rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ${
              error ? 'border-red-300' : 'border-gray-300'
            } ${className}`}
            {...props}
          >
            {children}
            {options.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {hint && !error && (
          <p id={`${selectId}-hint`} className="mt-1 text-xs text-gray-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${selectId}-error`} className="mt-1 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';

export default Select;
