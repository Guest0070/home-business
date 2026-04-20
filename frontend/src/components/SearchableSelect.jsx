import { useEffect, useMemo, useState } from 'react';

export default function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder = 'Type to search',
  required = false,
  allowBlank = false,
  blankLabel = 'None',
  getOptionLabel = (option) => option.label ?? option.name ?? option.vehicle_no ?? '',
  getSearchText = (option) => getOptionLabel(option)
}) {
  const [search, setSearch] = useState('');

  const selectedOption = useMemo(
    () => options.find((option) => String(option.id) === String(value)),
    [options, value]
  );

  useEffect(() => {
    if (!value) {
      setSearch('');
      return;
    }
    setSearch(selectedOption ? getOptionLabel(selectedOption) : '');
  }, [value, selectedOption, getOptionLabel]);

  function handleInput(nextValue) {
    setSearch(nextValue);
    const normalized = nextValue.trim().toLowerCase();
    if (!normalized) {
      onChange('');
      return;
    }
    const matched = options.find((option) => {
      const label = getOptionLabel(option).trim().toLowerCase();
      const searchText = getSearchText(option).trim().toLowerCase();
      return label === normalized || searchText === normalized;
    });
    onChange(matched ? matched.id : '');
  }

  return (
    <>
      <input
        list={id}
        value={search}
        onChange={(event) => handleInput(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
      <datalist id={id}>
        {allowBlank && <option value={blankLabel} />}
        {options.map((option) => (
          <option key={option.id} value={getOptionLabel(option)} />
        ))}
      </datalist>
    </>
  );
}
