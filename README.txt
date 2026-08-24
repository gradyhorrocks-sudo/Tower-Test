Current 53 — Franklin Table Parser Lock

- Franklin hotspot Debug/LTE table parser rebuilt around label-bounded spatial values.
- Franklin values are applied after generic OCR parsing so generic logic cannot overwrite them.
- Handles Franklin wrapped table labels without requiring them to survive on one OCR line.
- Preserves cached offline OCR behavior from Current 51/52.
- Preserves automatic two-way cloud registry synchronization and offline upload queue.
- CellMapper remains removed.
