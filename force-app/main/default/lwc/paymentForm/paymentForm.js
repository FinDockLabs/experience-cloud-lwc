import { api, LightningElement, track } from "lwc";
import { PAYMENT_METHOD_CONFIG } from "./paymentMethodConfiguration";
import { labels } from "./paymentFormLabels";
import LOCALE from '@salesforce/i18n/locale';

// Ensures unique radio `name`/id attributes when multiple payment forms are on the same page.
let _nextInstanceId = 0;

// Only cadence supported today. Revisit as an @api property if other cadences are needed.
const RECURRING_FREQUENCY = 'Monthly';

// Maps the friendly values shown in the App Builder / Experience Builder "Default Frequency"
// picklist to the internal frequency codes used throughout the component. Falls back to the
// raw value so the legacy 'oneTime'/'recurring' codes still work if set programmatically.
const FREQUENCY_ALIASES = {
    'one time': 'oneTime',
    'monthly': 'recurring'
};

function normalizeFrequency(value) {
    if (!value) return 'oneTime';
    return FREQUENCY_ALIASES[value.toLowerCase()] ?? value;
}

// Recurring.StartDate is required by the Payment API (yyyy-mm-dd). No date picker on the form
// today, so recurring payments always start today, in the payer's local time.
function todayISODate() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

export default class PaymentForm extends LightningElement {
    @api recordId;
    @api currency = 'EUR';
    @api amount;
    @api showFrequency;
    @api defaultFrequency = 'oneTime';

    @track firstName = '';
    @track lastName = '';
    @track email = '';
    @track amountValue = '';
    @track frequency = 'oneTime';
    @track selectedPaymentMethod = null;
    @track paymentIntent = {};
    @track paymentError = null;
    @track configError = null;

    labels = labels;
    paymentMethodConfig = PAYMENT_METHOD_CONFIG;
    _instanceId = ++_nextInstanceId;
    _initialAmountFormatted = false;

    get shouldShowFrequency() {
        return this.showFrequency !== false;
    }

    get _currencyFormatInfo() {
        try {
            const parts = new Intl.NumberFormat(LOCALE, {
                style: 'currency',
                currency: this.currency,
                currencyDisplay: 'narrowSymbol'
            }).formatToParts(1);
            const currencyIndex = parts.findIndex(part => part.type === 'currency');
            const integerIndex = parts.findIndex(part => part.type === 'integer');
            const currencyPart = parts[currencyIndex];
            return {
                symbol: currencyPart ? currencyPart.value : this.currency,
                isBefore: currencyIndex !== -1 && currencyIndex < integerIndex
            };
        } catch {
            return { symbol: this.currency, isBefore: true };
        }
    }

    get currencySymbol() {
        return this._currencyFormatInfo.symbol;
    }

    get symbolBefore() {
        return this._currencyFormatInfo.isBefore;
    }

    get symbolAfter() {
        return !this._currencyFormatInfo.isBefore;
    }

    get _currencyDecimals() {
        try {
            return new Intl.NumberFormat(LOCALE, {
                style: 'currency',
                currency: this.currency
            }).resolvedOptions().maximumFractionDigits;
        } catch {
            return 2;
        }
    }

    get amountInputId() {
        return `payment-form-amount-${this._instanceId}`;
    }

    get frequencyGroupName() {
        return `payment-form-frequency-${this._instanceId}`;
    }

    get oneTimeFrequencyId() {
        return `payment-form-frequency-onetime-${this._instanceId}`;
    }

    get recurringFrequencyId() {
        return `payment-form-frequency-recurring-${this._instanceId}`;
    }

    get isOneTimeFrequencySelected() {
        return this.frequency === 'oneTime';
    }

    get isRecurringFrequencySelected() {
        return this.frequency === 'recurring';
    }

    get isPayButtonDisabled() {
        const inputs = this.template.querySelectorAll('lightning-input');
        const allInputsValid = [...inputs].every(input => input.checkValidity());
        return !(
            this.firstName &&
            this.lastName &&
            this.email &&
            this.amountValue &&
            Number(this.amountValue) > 0 &&
            this.selectedPaymentMethod &&
            allInputsValid
        );
    }

    get paymentErrorJson() {
        return JSON.stringify(this.paymentError, null, 2);
    }

    renderedCallback() {
        if (this._initialAmountFormatted) return;
        this._initialAmountFormatted = true;
        const input = this.template.querySelector('.slds-input');
        if (input) {
            this._formatAmountDisplay(input);
        }
    }

    connectedCallback() {
        this.configError = this._validateConfig(PAYMENT_METHOD_CONFIG);
        this.amountValue = this.amount != null ? String(this.amount) : '';
        this.frequency = normalizeFrequency(this.defaultFrequency);
    }

    _validateConfig(config) {
        if (!Array.isArray(config)) {
            return this.labels.ec_error_config_invalid;
        }
        if (config.length === 0) {
            return this.labels.ec_error_config_empty;
        }
        for (const entry of config) {
            for (const field of ['paymentMethod', 'paymentProcessor']) {
                if (!entry[field]) {
                    return this.labels.ec_error_config_missing_field.replace('{0}', field);
                }
            }
        }
        return null;
    }

    _updatePaymentIntentContext() {
        const isRecurring = this.frequency === 'recurring';
        this.paymentIntent = {
            SuccessURL: 'https://example.com/success',
            FailureURL: 'https://example.com/failure',
            Payer: {
                Contact: {
                    SalesforceFields: {
                        FirstName: this.firstName,
                        LastName: this.lastName,
                        Email: this.email,
                    }
                }
            },
            ...(isRecurring ? {
                Recurring: {
                    Amount: this.amountValue,
                    CurrencyISOCode: this.currency,
                    Frequency: RECURRING_FREQUENCY,
                    StartDate: todayISODate()
                }
            } : {
                OneTime: {
                    Amount: this.amountValue,
                    CurrencyISOCode: this.currency
                }
            }),
            PaymentMethod: {
                Name: this.selectedPaymentMethod?.name,
                Processor: this.selectedPaymentMethod?.processor,
                Target: this.selectedPaymentMethod?.target
            }
        };
    }

    handleFieldChange(event) {
        this[event.target.dataset.field] = event.detail.value;
        this._updatePaymentIntentContext();
    }

    handleAmountInput(event) {
        let value = event.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
        const firstDot = value.indexOf('.');
        if (firstDot !== -1) {
            value = value.substring(0, firstDot + 1) + value.substring(firstDot + 1).replace(/\./g, '');
        }
        const decimals = this._currencyDecimals;
        const dotIndex = value.indexOf('.');
        if (decimals === 0 && dotIndex !== -1) {
            value = value.substring(0, dotIndex);
        } else if (decimals > 0 && dotIndex !== -1 && value.length - dotIndex - 1 > decimals) {
            value = value.substring(0, dotIndex + decimals + 1);
        }
        event.target.value = value;
        this.amountValue = value;
        this._updatePaymentIntentContext();
    }

    _formatAmountDisplay(inputEl) {
        if (this.amountValue === '') return;
        const numeric = Number(this.amountValue);
        if (!Number.isFinite(numeric)) return;
        inputEl.value = new Intl.NumberFormat(LOCALE, {
            minimumFractionDigits: 0,
            maximumFractionDigits: this._currencyDecimals
        }).format(numeric);
    }

    handleAmountBlur(event) {
        this._formatAmountDisplay(event.target);
    }

    // Swap back to the raw, unformatted value so grouping separators don't interfere with typing.
    handleAmountFocus(event) {
        event.target.value = this.amountValue;
    }

    handleFrequencyChange(event) {
        this.frequency = event.target.value;
        this._updatePaymentIntentContext();
    }

    handlePaymentMethodChanged(event) {
        this.selectedPaymentMethod = event.detail;
        this._updatePaymentIntentContext();
    }

    handlePaymentResult(event) {
        const result = event.detail;
        if (result?.errorMessage || result?.statusCode) {
            this.paymentError = result;
        }
    }
}
