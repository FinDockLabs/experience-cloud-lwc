import { api, LightningElement, track } from "lwc";
import { PAYMENT_METHOD_CONFIG } from "./paymentMethodConfiguration";
import { labels } from "./paymentFormLabels";

export default class PaymentForm extends LightningElement {
    @api recordId;
    @api currency = 'EUR';
    @api hideFrequency = false;
    @api defaultFrequency = 'oneTime';

    get showFrequency() {
        return !this.hideFrequency;
    }

    @track firstName = '';
    @track lastName = '';
    @track email = '';
    @track amountOneTime = null;
    @track amountRecurring = null;
    @track frequency = 'onetime';
    @track selectedPaymentMethod = null;

    labels = labels;
    paymentMethodConfig = PAYMENT_METHOD_CONFIG;

    @track paymentIntent = {};
    @track paymentError = null;
    @track configError = null;

    get isPayButtonDisabled() {
        const amount = this.frequency === 'recurring' ? this.amountRecurring : this.amountOneTime;
        const inputs = this.template.querySelectorAll('lightning-input');
        const allInputsValid = [...inputs].every(input => input.checkValidity());
        return !(
            this.firstName &&
            this.lastName &&
            this.email &&
            amount &&
            Number(amount) > 0 &&
            this.selectedPaymentMethod &&
            allInputsValid
        );
    }

    connectedCallback() {
        this.configError = this._validateConfig(PAYMENT_METHOD_CONFIG);
    }

    handleFieldChange(event) {
        this[event.target.dataset.field] = event.detail.value;
        this._updatePaymentIntentContext();
    }

    handleAmountFrequencyChanged(event) {
        this.amountOneTime = event.detail.amountOneTime;
        this.amountRecurring = event.detail.amountRecurring;
        this.frequency = event.detail.frequency;
        this._updatePaymentIntentContext();
    }

    handlePaymentMethodChanged(event) {
        this.selectedPaymentMethod = event.detail;
        this._updatePaymentIntentContext();
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

    handlePaymentResult(event) {
        const result = event.detail;
        if (result?.errorMessage || result?.statusCode) {
            this.paymentError = result;
        }
    }

    get paymentErrorJson() {
        return JSON.stringify(this.paymentError, null, 2);
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
                    Amount: this.amountRecurring,
                    CurrencyISOCode: this.currency
                }
            } : {
                OneTime: {
                    Amount: this.amountOneTime,
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
}
