import type { StylePreset } from '../../shared/types';

interface StyleSelectorProps {
  styles: StylePreset[];
  selectedId: string;
  activeIndex?: number;
  onSelect: (styleId: string) => void;
}

export default function StyleSelector({
  styles,
  selectedId,
  activeIndex = -1,
  onSelect
}: StyleSelectorProps): JSX.Element {
  return (
    <div className="grid gap-1.5">
      {styles.map((style, index) => {
        const selected = style.id === selectedId;
        const active = index === activeIndex;

        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onSelect(style.id)}
            className={[
              'group grid grid-cols-[1.1rem_1fr_auto] items-center gap-3 border px-3 py-2 text-left font-mono text-sm transition',
              selected || active
                ? 'border-acid bg-acid/10 text-mist'
                : 'border-line/80 bg-panel/90 text-sub hover:border-cyan/60 hover:text-mist'
            ].join(' ')}
          >
            <span className={['text-xs', selected ? 'text-acid' : 'text-cyan/70'].join(' ')}>
              {selected ? '>' : index === activeIndex ? ':' : '.'}
            </span>
            <span className="min-w-0">
              <span className="block truncate leading-tight">{style.label}</span>
              <span className="block truncate text-[11px] leading-tight text-dim">{style.description}</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-dim">
              {style.action || 'tone'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
