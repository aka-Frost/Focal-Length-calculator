/* ==========================================================================
   FocalCalc — script.js
   Vanilla JavaScript, no dependencies.

   Formulas
     Full-frame equivalent = actual focal length × crop factor
     Zoom multiplier       = full-frame equivalent ÷ 1× reference focal length
     Reverse               = actual focal length = (zoom × reference) ÷ crop factor
   ========================================================================== */

(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     Configuration
     ------------------------------------------------------------------------ */

  // Sensor presets. `crop: null` means "use the custom crop factor field".
  const PRESETS = [
    { id: 'ff',         label: 'Full Frame',          crop: 1 },
    { id: 'sony-nikon', label: 'Sony / Nikon APS-C',  crop: 1.5 },
    { id: 'canon',      label: 'Canon APS-C',         crop: 1.6 },
    { id: 'mft',        label: 'Micro Four Thirds',   crop: 2 },
    { id: 'custom',     label: 'Custom crop factor',  crop: null },
  ];

  // Values used on first launch and after "Reset". Edit these to change defaults.
  const DEFAULTS = {
    preset: 'sony-nikon',
    customCrop: '',
    reference: '24',
    mode: 'single',
  };

  // Accepted ranges (inclusive). Keeps typos from producing nonsense.
  const LIMITS = {
    crop:  { min: 0.1,  max: 20 },
    focal: { min: 0.1,  max: 10000 },   // mm
    zoom:  { min: 0.01, max: 1000 },    // ×
  };

  const STORAGE_KEY = 'focalcalc:v1';

  /* ------------------------------------------------------------------------
     DOM references
     ------------------------------------------------------------------------ */

  const $ = (id) => document.getElementById(id);

  const els = {
    sensor:      $('sensor'),
    customField: $('custom-crop-field'),
    customCrop:  $('custom-crop'),
    reference:   $('reference'),
    singleFocal: $('single-focal'),
    rangeMin:    $('range-min'),
    rangeMax:    $('range-max'),
    revZoom:     $('rev-zoom'),
    copyBtn:     $('copy-btn'),
    resetBtn:    $('reset-btn'),
    status:      $('status'),
    installBtn:  $('install-btn'),
  };

  const tabs = Array.from(document.querySelectorAll('.tab'));

  // Every text input on the page (used to clear errors on reset)
  const allInputs = [
    els.customCrop, els.reference, els.singleFocal,
    els.rangeMin, els.rangeMax, els.revZoom,
  ];

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */

  let state = { ...DEFAULTS };   // persisted settings
  let copyText = null;           // text for the Copy button; null when results are invalid/empty

  /* ------------------------------------------------------------------------
     Number parsing, validation and formatting
     ------------------------------------------------------------------------ */

  /**
   * Parse user text into a number. Accepts "17", "17.5", ".5" and "17,5"
   * (a comma is treated as a decimal separator).
   * Returns { empty: true } for blank input, { error } for bad input, or { value }.
   */
  function parseNumber(raw) {
    const text = String(raw).trim().replace(/,/g, '.');
    if (text === '') return { empty: true };
    if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) {
      return { error: 'Enter a number, such as 24 or 17.5.' };
    }
    return { value: parseFloat(text) };
  }

  /** Show or clear an error message under an input. */
  function setError(input, message) {
    const errorEl = $(input.id + '-error');
    if (errorEl) errorEl.textContent = message;
    input.classList.toggle('invalid', Boolean(message));
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  /**
   * Read an input, validate it against `limits`, and show any error.
   * Returns the number, or null if the field is empty or invalid.
   */
  function validate(input, limits, label) {
    const parsed = parseNumber(input.value);
    let message = '';
    let value = null;

    if (parsed.error) {
      message = parsed.error;
    } else if (!parsed.empty) {
      if (parsed.value < limits.min || parsed.value > limits.max) {
        message = `${label} must be between ${limits.min} and ${limits.max}.`;
      } else {
        value = parsed.value;
      }
    }

    setError(input, message);
    return value;
  }

  /** Format to at most 2 decimals, dropping trailing zeros (25.50 → "25.5"). */
  function fmt(n) {
    return String(Number(n.toFixed(2)));
  }

  /* ------------------------------------------------------------------------
     Settings: crop factor and reference focal length
     ------------------------------------------------------------------------ */

  function currentPreset() {
    return PRESETS.find((p) => p.id === state.preset) || PRESETS[0];
  }

  /** Crop factor for the selected sensor, or null if the custom value is invalid/empty. */
  function getCrop() {
    const preset = currentPreset();
    if (preset.crop !== null) {
      setError(els.customCrop, '');
      return preset.crop;
    }
    return validate(els.customCrop, LIMITS.crop, 'Crop factor');
  }

  function getReference() {
    return validate(els.reference, LIMITS.focal, 'Reference focal length');
  }

  /* ------------------------------------------------------------------------
     Calculation modes
     Each function validates its own inputs and returns either
       null  (something is missing or invalid), or
       { values: [first, second], working: "...", line: "..." }
     ------------------------------------------------------------------------ */

  /** Single focal length → full-frame equivalent and zoom multiplier. */
  function calcSingle(crop, ref) {
    const focal = validate(els.singleFocal, LIMITS.focal, 'Focal length');
    if (focal === null || crop === null || ref === null) return null;

    const ff = focal * crop;
    const zoom = ff / ref;

    return {
      values: [`${fmt(ff)} mm`, `${fmt(zoom)}×`],
      working: `${fmt(focal)} mm × ${fmt(crop)} = ${fmt(ff)} mm  ·  ${fmt(ff)} ÷ ${fmt(ref)} = ${fmt(zoom)}×`,
      line: `${fmt(focal)} mm actual → ${fmt(ff)} mm full-frame equivalent → ${fmt(zoom)}× zoom`,
    };
  }

  /** Focal length range → full-frame equivalent range and zoom range. */
  function calcRange(crop, ref) {
    const lo = validate(els.rangeMin, LIMITS.focal, 'Shortest focal length');
    const hi = validate(els.rangeMax, LIMITS.focal, 'Longest focal length');
    if (lo !== null && hi !== null && lo > hi) {
      setError(els.rangeMax, 'Longest must not be shorter than shortest.');
      return null;
    }
    if (lo === null || hi === null || crop === null || ref === null) return null;

    const ffLo = lo * crop, ffHi = hi * crop;
    const zLo = ffLo / ref,  zHi = ffHi / ref;

    return {
      values: [
        `${fmt(ffLo)}–${fmt(ffHi)} mm`,
        `${fmt(zLo)}×–${fmt(zHi)}×`,
      ],
      working: `${fmt(lo)}–${fmt(hi)} mm × ${fmt(crop)}  ·  ÷ ${fmt(ref)} mm`,
      line: `${fmt(lo)}–${fmt(hi)} mm actual → ${fmt(ffLo)}–${fmt(ffHi)} mm full-frame equivalent → ${fmt(zLo)}×–${fmt(zHi)}× zoom`,
    };
  }

  /** Desired zoom multiplier → full-frame equivalent and required actual focal length. */
  function calcReverse(crop, ref) {
    const zoom = validate(els.revZoom, LIMITS.zoom, 'Zoom multiplier');
    if (zoom === null || crop === null || ref === null) return null;

    const ff = zoom * ref;
    const actual = ff / crop;

    return {
      values: [`${fmt(ff)} mm`, `${fmt(actual)} mm`],
      working: `${fmt(zoom)}× × ${fmt(ref)} mm = ${fmt(ff)} mm  ·  ${fmt(ff)} ÷ ${fmt(crop)} = ${fmt(actual)} mm`,
      line: `${fmt(zoom)}× zoom → ${fmt(ff)} mm full-frame equivalent → ${fmt(actual)} mm actual focal length`,
    };
  }

  // Which calculator and output elements belong to each tab
  const MODES = {
    single:  { calc: calcSingle,  outputs: ['single-ff', 'single-zoom'], working: 'single-working' },
    range:   { calc: calcRange,   outputs: ['range-ff', 'range-zoom'],   working: 'range-working' },
    reverse: { calc: calcReverse, outputs: ['rev-ff', 'rev-actual'],     working: 'rev-working' },
  };

  /* ------------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------------ */

  /** Recalculate the active tab and update the page. Called on every change. */
  function update() {
    const mode = MODES[state.mode];
    const crop = getCrop();
    const ref = getReference();
    const result = mode.calc(crop, ref);

    mode.outputs.forEach((id, i) => {
      $(id).textContent = result ? result.values[i] : '—';
    });
    $(mode.working).textContent = result ? result.working : '';

    if (result) {
      copyText =
        `FocalCalc · ${currentPreset().label} (${fmt(crop)}× crop) · 1× = ${fmt(ref)} mm\n` +
        result.line;
    } else {
      copyText = null;
    }
    els.copyBtn.disabled = copyText === null;
  }

  /** Switch tab. `moveFocus` is true when changed with the keyboard. */
  function setMode(mode, moveFocus) {
    state.mode = mode;
    tabs.forEach((tab) => {
      const active = tab.dataset.mode === mode;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      $('panel-' + tab.dataset.mode).hidden = !active;
      if (active && moveFocus) tab.focus();
    });
    save();
    update();
  }

  /** Make the controls match `state` (used on load and after reset). */
  function applyStateToControls() {
    els.sensor.value = state.preset;
    els.customCrop.value = state.customCrop;
    els.reference.value = state.reference;
    els.customField.hidden = currentPreset().crop !== null;
  }

  /* ------------------------------------------------------------------------
     Persistence (remembers sensor, crop and reference between visits)
     ------------------------------------------------------------------------ */

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) { /* storage may be unavailable (private mode); ignore */ }
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === 'object') {
        state = { ...DEFAULTS, ...saved };
        if (!PRESETS.some((p) => p.id === state.preset)) state.preset = DEFAULTS.preset;
        if (!MODES[state.mode]) state.mode = DEFAULTS.mode;
      }
    } catch (_) { /* corrupted or unavailable; fall back to defaults */ }
  }

  /* ------------------------------------------------------------------------
     Copy and reset
     ------------------------------------------------------------------------ */

  /** Announce a message to screen readers and briefly show it on the Copy button. */
  function announce(message) {
    els.status.textContent = message;
  }

  async function copyResults() {
    if (!copyText) return;

    let ok = false;
    try {
      await navigator.clipboard.writeText(copyText);
      ok = true;
    } catch (_) {
      // Fallback for older browsers or non-secure contexts
      const area = document.createElement('textarea');
      area.value = copyText;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      area.remove();
    }

    const original = 'Copy results';
    els.copyBtn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    announce(ok ? 'Results copied to clipboard' : 'Could not copy results');
    setTimeout(() => { els.copyBtn.textContent = original; }, 1500);
  }

  function resetAll() {
    state = { ...DEFAULTS, mode: state.mode };   // stay on the current tab
    [els.singleFocal, els.rangeMin, els.rangeMax, els.revZoom].forEach((el) => { el.value = ''; });
    allInputs.forEach((el) => setError(el, ''));
    applyStateToControls();
    save();
    update();
    announce('Reset to defaults');
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */

  // Settings
  els.sensor.addEventListener('change', () => {
    state.preset = els.sensor.value;
    els.customField.hidden = currentPreset().crop !== null;
    save();
    update();
    if (!els.customField.hidden) els.customCrop.focus();
  });

  els.customCrop.addEventListener('input', () => {
    state.customCrop = els.customCrop.value;
    save();
    update();
  });

  els.reference.addEventListener('input', () => {
    state.reference = els.reference.value;
    save();
    update();
  });

  // Calculator inputs: recalculate instantly on every keystroke
  [els.singleFocal, els.rangeMin, els.rangeMax, els.revZoom].forEach((el) => {
    el.addEventListener('input', update);
  });

  // Tabs (click, plus arrow keys / Home / End as per the ARIA tabs pattern)
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode, false));
    tab.addEventListener('keydown', (event) => {
      const index = tabs.indexOf(tab);
      let next = null;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft')  next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home')       next = 0;
      if (event.key === 'End')        next = tabs.length - 1;
      if (next !== null) {
        event.preventDefault();
        setMode(tabs[next].dataset.mode, true);
      }
    });
  });

  // Quick-pick zoom chips (Reverse tab)
  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      els.revZoom.value = chip.dataset.zoom;
      update();
    });
  });

  els.copyBtn.addEventListener('click', copyResults);
  els.resetBtn.addEventListener('click', resetAll);

  /* ------------------------------------------------------------------------
     PWA: install button and service worker
     ------------------------------------------------------------------------ */

  let deferredInstallPrompt = null;

  // Chrome on Android fires this when the app is installable
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });

  // Service workers need HTTPS (or localhost)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
    });
  }

  /* ------------------------------------------------------------------------
     Start-up
     ------------------------------------------------------------------------ */

  // Fill the sensor dropdown from PRESETS so there is one source of truth
  PRESETS.forEach((preset) => {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.crop === null ? preset.label : `${preset.label} (${fmt(preset.crop)}×)`;
    els.sensor.appendChild(option);
  });

  load();
  applyStateToControls();
  setMode(state.mode, false);   // also runs the first update()
})();
