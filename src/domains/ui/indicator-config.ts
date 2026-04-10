import type { IndicatorRenderer, IndicatorSource } from '../rendering/indicator-renderer';

type SlotKey = 'topLeft' | 'topRight' | 'topMiddle';

const SLOT_LABELS: Record<SlotKey, string> = {
  topLeft:   'Top-Left',
  topRight:  'Top-Right',
  topMiddle: 'Top-Middle',
};

const SOURCE_OPTIONS: { value: IndicatorSource; label: string }[] = [
  { value: 'none',         label: 'None' },
  { value: 'faction_flag', label: 'Faction Flag' },
  { value: 'pregnancy',    label: 'Pregnancy' },
  { value: 'health_band',  label: 'Health Band' },
  { value: 'mood',         label: 'Mood' },
];

/**
 * Mounts three dropdowns that control IndicatorRenderer slot sources.
 * Call mount() with the container element from the tools overlay.
 */
export class IndicatorConfigPanel {
  constructor(private readonly indicatorRenderer: IndicatorRenderer) {}

  mount(container: HTMLElement): void {
    container.innerHTML = '';
    for (const slot of ['topLeft', 'topRight', 'topMiddle'] as SlotKey[]) {
      const row = document.createElement('div');
      row.className = 'indicator-row';

      const label = document.createElement('span');
      label.className = 'indicator-label';
      label.textContent = SLOT_LABELS[slot];

      const select = document.createElement('select');
      select.className = 'indicator-select';
      select.id = `indicatorSlot_${slot}`;

      for (const opt of SOURCE_OPTIONS) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === this.indicatorRenderer.slotConfig[slot].source) {
          option.selected = true;
        }
        select.appendChild(option);
      }

      select.addEventListener('change', () => {
        this.indicatorRenderer.slotConfig[slot].source = select.value as IndicatorSource;
      });

      row.appendChild(label);
      row.appendChild(select);
      container.appendChild(row);
    }
  }
}
