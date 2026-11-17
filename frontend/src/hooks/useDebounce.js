import { useState, useEffect } from 'react';

/**
 * Reusable debounce hook for search queries and autocomplete inputs.
 * Delays state updates until the user has stopped typing for `delay` milliseconds.
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
