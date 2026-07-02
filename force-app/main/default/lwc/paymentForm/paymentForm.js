import { api, LightningElement, track } from "lwc";
import { PAYMENT_METHOD_CONFIG } from "./paymentMethodConfiguration";
import { labels } from "./paymentFormLabels";

const FREQUENCY_OPTIONS = [
    { label: labels.ec_label_frequency_one_time, value: 'oneTime' },
    { label: labels.ec_label_frequency_recurring, value: 'recurring' }
];

export default class PaymentForm extends LightningElement {
    @api recordId;
    @api currency = 'EUR';
    @api amount;
    @api showFrequency;
    @api defaultFrequency = 'oneTime';

    @track firstName = '';
    @track lastName = '';
    @track email = '';
    @track amountValue = null;
    @track frequency = 'oneTime';
    @track selectedPaymentMethod = null;
    @track paymentIntent = {};
    @track paymentError = null;
    @track configError = null;

    labels = labels;
    paymentMethodConfig = PAYMENT_METHOD_CONFIG;
    frequencyOptions = FREQUENCY_OPTIONS;

    get shouldShowFrequency() {
        return this.showFrequency !== false;
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

    connectedCallback() {
        this.configError = this._validateConfig(PAYMENT_METHOD_CONFIG);
        this.amountValue = this.amount ?? null;
        this.frequency = this.defaultFrequency ?? 'oneTime';
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
                    CurrencyISOCode: this.currency
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
