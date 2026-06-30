import { api, LightningElement, track } from "lwc";
import { PAYMENT_METHOD_CONFIG } from "./paymentMethodConfiguration";
import { labels } from "./paymentFormLabels";

export default class PaymentForm extends LightningElement {
    @api recordId;
    @api screenMode = 'OneScreen'; // 'OneScreen' — all steps on one page; 'MultiScreen' — steps split across screens
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
    @track currentStep = 1;

    labels = labels;
    paymentMethodConfig = PAYMENT_METHOD_CONFIG;
    _prevStep = 1;

    @track paymentIntent = {};
    @track paymentError = null;
    @track configError = null;

    get isMultiScreen() {
        return this.screenMode === 'MultiScreen';
    }

    get showAmountStep() {
        return !this.isMultiScreen || this.currentStep === 1;
    }

    get showPersonalInfoStep() {
        return !this.isMultiScreen || this.currentStep === 2;
    }

    get showPaymentStep() {
        return !this.isMultiScreen || this.currentStep === 3;
    }

    get isStep1NextDisabled() {
        const amount = this.frequency === 'recurring' ? this.amountRecurring : this.amountOneTime;
        return !(amount && Number(amount) > 0);
    }

    get isStep2NextDisabled() {
        const inputs = this.template.querySelectorAll('lightning-input');
        const allInputsValid = [...inputs].every(input => input.checkValidity());
        return !(this.firstName && this.lastName && this.email) || !allInputsValid;
    }

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

    get stepAnnouncement() {
        if (!this.isMultiScreen) return '';
        const stepNames = [
            this.labels.ec_sr_step_amount_frequency,
            this.labels.ec_sr_step_personal_info,
            this.labels.ec_sr_step_payment_method,
        ];
        const template = this.labels.ec_sr_progress_step_announcement;
        return template
            .replace('{0}', this.currentStep)
            .replace('{1}', stepNames.length)
            .replace('{2}', stepNames[this.currentStep - 1]);
    }

    connectedCallback() {
        this.configError = this._validateConfig(PAYMENT_METHOD_CONFIG);
    }

    renderedCallback() {
        if (this.isMultiScreen && this._prevStep !== this.currentStep) {
            this._prevStep = this.currentStep;
            const heading = this.template.querySelector('[data-step-heading]');
            if (heading) heading.focus();
        }
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

    handleNextStep() {
        if (this.currentStep < 3) this.currentStep += 1;
    }

    handlePreviousStep() {
        if (this.currentStep > 1) this.currentStep -= 1;
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
