export default function SectionTabs({ items, value, onChange, ariaLabel = 'Page sections' }) {
  return (
    <div className="section-tabs print-hide" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? 'section-tab section-tab-active' : 'section-tab section-tab-idle'}
            onClick={() => onChange(item.id)}
          >
            <span>{item.label}</span>
            {item.hint && <small>{item.hint}</small>}
          </button>
        );
      })}
    </div>
  );
}
