import type { IndicatorRenderer, IndicatorSource } from '../rendering/indicator-renderer';

const SLOT_LABELS: Record<'topLeft' | 'topRight' | 'topMiddle', string> = {
  topLeft:   'Top-Left',
  topRight:  'Top-Right',
  topMiddle: 'Top-Middle',
};

const SOURCE_OPTIONS: Array<{ value: IndicatorSource; label: string }> = [
  { value: 'faction_flag', label: 'Faction Flag' },
  { value: 'pregnancy',    label: 'Pregnancy'    },
  { value: 'health_band',  label: 'Health'       },
  { value: 'mood',         label: 'Mood'         },
  { value: 'level',        label: 'Level'        },
  { value: 'none',         label: 'None'         },
];

/**
 * Renders a small configuration UI for the three indicator slots.
 * Call `mount(container)` to inject it into the DOM.
 *
 * v4.2: Allows users to choose what each indicator slot above agents displays.
 */
export class IndicatorConfigPanel {
  constructor(private readonly _indicatorRenderer: IndicatorRenderer) {}

  mount(container: HTMLElement): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'indicator-config';

    const heading = document.createElement('div');
    heading.className = 'indicator-config-heading';
    heading.textContent = 'Agent Indicators';
    wrapper.appendChild(heading);

    for (const slot of ['topLeft', 'topRight', 'topMiddle'] as const) {
      const row = document.createElement('label');
      row.className = 'indicator-config-row';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = SLOT_LABELS[slot];
      row.appendChild(labelSpan);

      const select = document.createElement('select');
      select.className = 'indicator-config-select';
      for (const opt of SOURCE_OPTIONS) {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        this._indicatorRenderer.setSlot(slot, select.value as IndicatorSource);
      });
      row.appendChild(select);
      wrapper.appendChild(row);
    }

    container.appendChild(wrapper);
  }
}
