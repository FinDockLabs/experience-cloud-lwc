import { api, track, LightningElement } from 'lwc';
import { FlowAttributeChangeEvent } from 'lightning/flowSupport';
import LOCALE from '@salesforce/i18n/locale';
import USER_CURRENCY from '@salesforce/i18n/currency';
import getActiveCurrencyIsoCodes from '@salesforce/apex/CurrencyPickerController.getActiveCurrencyIsoCodes';

import ec_label_currency from '@salesforce/label/c.ec_label_currency';

const labels = { ec_label_currency };

// currencySource values
const SOURCE_FIXED = 'fixed';
const SOURCE_USER = 'user';
const SOURCE_PAGE = 'page';

const ISO_CODE = /^[A-Z]{3}$/;

/**
 * currencyPicker — lets a payer choose the payment currency, and emits the active currency so the
 * amount formatting and Pay Button are correct on load. Works on an Experience Cloud page (design
 * properties) and as a Flow screen component (`value` output). When only one currency is available
 * it collapses (no visible control) and behaves like a fixed currency.
 *
 * Currency list (Decision A — Hybrid): use `allowedCurrencies` (CSV) when set; otherwise auto-detect
 * the org's active currencies via Apex (CurrencyPickerController.getActiveCurrencyIsoCodes). While that
 * loads — and if it fails or the guest can't access it — fall back to a single currency
 * (`defaultCurrency`, else the org/user currency), so the picker is never empty.
 */
export default class CurrencyPicker extends LightningElement {
    labels = labels;

    // CSV allow-list, e.g. "EUR,USD,GBP". Empty → single-currency behaviour.
    @api allowedCurrencies = '';
    // Fixed default (ISO code), used when currencySource = "fixed".
    @api defaultCurrency = '';
    // "fixed" | "user" | "page" — where the initial currency comes from.
    @api currencySource = SOURCE_FIXED;
    // Value injected by the page/flow when currencySource = "page" (page property / Flow variable).
    @api pageCurrency = '';

    @track _value = '';
    _currencies = [];

    // Selected currency (ISO). Exposed for Flow output and for parent binding.
    @api
    get value() {
        return this._value;
    }
    set value(val) {
        const code = normalize(val);
        if (code) {
            this._value = code;
        }
    }

    get options() {
        return this._currencies.map((code) => ({ label: optionLabel(code), value: code }));
    }

    // Show the dropdown only when there is a real choice (more than one currency).
    get showPicker() {
        return this._currencies.length > 1;
    }

    connectedCallback() {
        // Decision A (Hybrid): an explicit allow-list wins and needs no Apex.
        const explicit = dedupe((this.allowedCurrencies || '').split(',').map(normalize).filter(Boolean));
        if (explicit.length) {
            this._applyCurrencies(explicit);
            return;
        }
        // No allow-list: render a safe single default immediately, then auto-detect the org currencies.
        this._applyCurrencies(this._fallbackSingle());
        this._autoDetect();
    }

    handleChange(event) {
        this._value = event.detail.value;
        this._emit();
    }

    // Auto-detect the org's active currencies (Apex). On failure/guest without access, keep the
    // synchronous single-currency fallback so payments still work.
    _autoDetect() {
        getActiveCurrencyIsoCodes()
            .then((isoCodes) => {
                const codes = dedupe((isoCodes || []).map(normalize).filter(Boolean));
                if (codes.length > 1) {
                    this._applyCurrencies(codes);
                }
            })
            .catch(() => {
                /* keep the fallback */
            });
    }

    _applyCurrencies(list) {
        this._currencies = list.length ? list : this._fallbackSingle();
        this._value = this._resolveInitial();
        this._emit();
    }

    _fallbackSingle() {
        const single = normalize(this.defaultCurrency) || normalize(USER_CURRENCY);
        return single ? [single] : [];
    }

    // Decision B resolution: source value → allowed-list check → Fixed default → first allowed.
    _resolveInitial() {
        const candidate = normalize(this._fromSource());
        if (candidate && this._currencies.includes(candidate)) {
            return candidate;
        }
        const fixed = normalize(this.defaultCurrency);
        if (fixed && this._currencies.includes(fixed)) {
            return fixed;
        }
        return this._currencies[0] || candidate || fixed || '';
    }

    _fromSource() {
        switch ((this.currencySource || SOURCE_FIXED).toLowerCase()) {
            case SOURCE_USER:
                return USER_CURRENCY; // org/user currency; for guests this is the org default
            case SOURCE_PAGE:
                return this.pageCurrency || urlParam('currency');
            case SOURCE_FIXED:
            default:
                return this.defaultCurrency;
        }
    }

    _emit() {
        // Experience Cloud: parent (paymentForm) listens for this to reformat the amount.
        this.dispatchEvent(new CustomEvent('currencychange', { detail: { currency: this._value } }));
        // Flow: notify the runtime so the `value` output updates and reactive references
        // (e.g. amountAndFrequency.defaultCurrency = {!currencyPicker.value}) recalculate.
        this.dispatchEvent(new FlowAttributeChangeEvent('value', this._value));
    }
}

function normalize(code) {
    const upper = (code || '').toString().trim().toUpperCase();
    return ISO_CODE.test(upper) ? upper : '';
}

function dedupe(list) {
    return [...new Set(list)];
}

// "EUR (€)" when a symbol is available and differs from the code, otherwise just "EUR".
function optionLabel(code) {
    try {
        const parts = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: code }).formatToParts(0);
        const symbol = parts.find((p) => p.type === 'currency')?.value;
        return symbol && symbol !== code ? `${code} (${symbol})` : code;
    } catch {
        return code;
    }
}

function urlParam(name) {
    try {
        return new URLSearchParams(window.location.search).get(name) || '';
    } catch {
        return '';
    }
}
