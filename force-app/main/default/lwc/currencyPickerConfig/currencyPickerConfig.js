import { api, track, LightningElement } from 'lwc';
import LOCALE from '@salesforce/i18n/locale';
import getActiveCurrencyIsoCodes from '@salesforce/apex/CurrencyPickerController.getActiveCurrencyIsoCodes';

// Custom Property Editor for the currencyPicker Flow screen component. Renders a nicer admin UI in
// Flow Builder: a multi-select for the available currencies and a single-select for the default,
// instead of typing CSV/ISO codes by hand. It reads the component's input variables and writes the
// chosen values back as Strings via configuration_editor_input_value_changed events.
//
// Currency options come from the org's active currencies (same Apex source as the runtime component),
// merged with any already-selected values so an existing configuration still displays.
const ISO_CODE = /^[A-Z]{3}$/;

const SOURCE_OPTIONS = [
    { label: 'Fixed (admin default)', value: 'fixed' },
    { label: 'User (logged-in user)', value: 'user' },
    { label: 'Page (page property / URL param)', value: 'page' }
];

export default class currencyPickerConfig extends LightningElement {
    // Standard CPE inputs provided by Flow Builder.
    @track _inputVariables = [];
    @track _orgCurrencies = [];
    @api builderContext;
    @api genericTypeMappings;
    @api automaticOutputVariables;

    @api
    get inputVariables() {
        return this._inputVariables;
    }
    set inputVariables(value) {
        this._inputVariables = value || [];
    }

    connectedCallback() {
        getActiveCurrencyIsoCodes()
            .then((isoCodes) => {
                this._orgCurrencies = (isoCodes || []).map(normalize).filter(Boolean);
            })
            .catch(() => {
                /* leave options as the currently selected values */
            });
    }

    // Org's active currencies + any already-selected ones (so a saved config still shows).
    get currencyOptions() {
        return dedupe([...this._orgCurrencies, ...this.allowedValue]).map((code) => ({
            label: optionLabel(code),
            value: code
        }));
    }

    get sourceOptions() {
        return SOURCE_OPTIONS;
    }

    // Currently selected available currencies (array), parsed from the CSV input variable.
    get allowedValue() {
        return (this._get('allowedCurrencies') || '')
            .split(',')
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean);
    }

    // The default can only be one of the selected available currencies.
    get defaultOptions() {
        return this.allowedValue.map((code) => ({ label: optionLabel(code), value: code }));
    }

    get defaultValue() {
        return this._get('defaultCurrency') || '';
    }

    get defaultDisabled() {
        return this.allowedValue.length === 0;
    }

    get sourceValue() {
        return this._get('currencySource') || 'fixed';
    }

    handleAllowedChange(event) {
        const selected = event.detail.value; // array
        this._dispatch('allowedCurrencies', selected.join(','));
        // Clear the default if it's no longer among the selected currencies.
        if (this.defaultValue && !selected.includes(this.defaultValue)) {
            this._dispatch('defaultCurrency', '');
        }
    }

    handleDefaultChange(event) {
        this._dispatch('defaultCurrency', event.detail.value);
    }

    handleSourceChange(event) {
        this._dispatch('currencySource', event.detail.value);
    }

    _get(name) {
        return this._inputVariables.find((v) => v.name === name)?.value;
    }

    _dispatch(name, value) {
        this.dispatchEvent(
            new CustomEvent('configuration_editor_input_value_changed', {
                bubbles: true,
                cancelable: false,
                composed: true,
                detail: { name, newValue: value, newValueDataType: 'String' }
            })
        );
    }
}

function normalize(code) {
    const upper = (code || '').toString().trim().toUpperCase();
    return ISO_CODE.test(upper) ? upper : '';
}

function dedupe(list) {
    return [...new Set(list)];
}

function optionLabel(code) {
    try {
        const parts = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: code }).formatToParts(0);
        const symbol = parts.find((p) => p.type === 'currency')?.value;
        return symbol && symbol !== code ? `${code} (${symbol})` : code;
    } catch {
        return code;
    }
}
