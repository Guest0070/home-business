import { useEffect, useMemo, useRef, useState } from 'react';

export default function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Type to search',
  required = false,
  getOptionLabel = (option) => option.label ?? option.name ?? option.vehicle_no ?? '',
  getSearchText = (option) => getOptionLabel(option),
  inputValue,
  onInputValueChange,
  allowCustom = false,
  emptyText = 'No matches found',
  disabled = false,
  maxOptions = 30
}) {
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const generatedIdRef = useRef(id || `searchable-select-${Math.random().toString(36).slice(2, 10)}`);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [internalInput, setInternalInput] = useState('');
  const inputId = id || generatedIdRef.current;

  const selectedOption = useMemo(
    () => options.find((option) => String(option.id) === String(value)),
    [options, value]
  );

  const textValue = inputValue ?? internalInput;
  const indexedOptions = useMemo(
    () => options.map((option) => ({
      option,
      label: getOptionLabel(option),
      searchText: getSearchText(option),
      normalizedLabel: getOptionLabel(option).trim().toLowerCase(),
      normalizedSearchText: getSearchText(option).trim().toLowerCase()
    })),
    [options, getOptionLabel, getSearchText]
  );

  const filteredOptions = useMemo(() => {
    const normalized = textValue.trim().toLowerCase();
    if (!normalized) return indexedOptions.slice(0, maxOptions);
    return indexedOptions
      .filter(({ normalizedSearchText }) => normalizedSearchText.includes(normalized))
      .slice(0, maxOptions);
  }, [indexedOptions, maxOptions, textValue]);

  useEffect(() => {
    if (inputValue !== undefined) return;
    if (!value) {
      setInternalInput('');
      return;
    }
    setInternalInput(selectedOption ? getOptionLabel(selectedOption) : '');
  }, [value, selectedOption, getOptionLabel, inputValue]);

  useEffect(() => {
    function handleClick(event) {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (activeIndex < 0) setActiveIndex(0);
    if (activeIndex >= filteredOptions.length) setActiveIndex(Math.max(filteredOptions.length - 1, 0));
  }, [activeIndex, filteredOptions.length]);

  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector(`[data-option-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  function setText(nextValue) {
    if (onInputValueChange) onInputValueChange(nextValue);
    else setInternalInput(nextValue);
  }

  function selectOption(option) {
    const label = getOptionLabel(option);
    onChange(option.id, option);
    setText(label);
    setOpen(false);
  }

  function resolveValue(rawValue) {
    const normalized = rawValue.trim().toLowerCase();
    if (!normalized) {
      onChange('', null);
      return false;
    }

    const matched = indexedOptions.find(({ normalizedLabel, normalizedSearchText }) => (
      normalizedLabel === normalized || normalizedSearchText === normalized
    ));

    if (matched) {
      onChange(matched.option.id, matched.option);
      setText(matched.label);
      return true;
    }

    onChange('', null);
    return false;
  }

  function handleInputChange(nextValue) {
    setText(nextValue);
    setOpen(true);
    setActiveIndex(0);
    if (!nextValue.trim()) {
      onChange('', null);
    }
  }

  function handleBlur() {
    window.setTimeout(() => {
      const matched = resolveValue(textValue);
      if (!allowCustom && textValue.trim() && !matched) {
        setText('');
      }
      setOpen(false);
    }, 120);
  }

  function handleKeyDown(event) {
    if (disabled) return;

    if (!open && ['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) {
      setOpen(true);
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      if (open && filteredOptions[activeIndex]) {
        event.preventDefault();
        selectOption(filteredOptions[activeIndex].option);
        return;
      }
      if (!allowCustom) {
        resolveValue(textValue);
      }
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="searchable-select">
      <input
        id={inputId}
        value={textValue}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={`${inputId}-panel`}
        aria-autocomplete="list"
      />

      {open && (
        <div ref={listRef} id={`${inputId}-panel`} className="searchable-select-panel" role="listbox">
          {filteredOptions.length === 0 ? (
            <div className="searchable-select-empty">{emptyText}</div>
          ) : (
            filteredOptions.map(({ option, label, searchText }, index) => (
              <button
                key={option.id}
                type="button"
                className={`searchable-select-option ${index === activeIndex ? 'searchable-select-option-active' : ''}`}
                data-option-index={index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectOption(option)}
                role="option"
                aria-selected={index === activeIndex}
              >
                <span className="searchable-select-title">{label}</span>
                <span className="searchable-select-subtitle">{searchText}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
