import { api, wire, LightningElement, track } from "lwc";
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import FINDOCK_PAYMENT_FLOW from '@salesforce/messageChannel/cpm__findockPaymentFlow__c';
import LOCALE from '@salesforce/i18n/locale';

import { PAYMENT_FLOW_MESSAGE_TYPES, matchesGroup } from 'cpm/paymentFlowChannel';
import { responseHasFieldLevelError } from 'cpm/paymentMethodValidators';
import { PAYMENT_METHOD_CONFIG } from "./paymentMethodConfiguration";
import { labels } from "./paymentFormLabels";

// Distinguishes multiple forms on one page (used as the channel correlation key).
let _nextInstanceId = 0;

// Only cadence supported today. Revisit as an @api property if other cadences are needed.
const RECURRING_FREQUENCY = 'Monthly';

// Maps the friendly App/Experience Builder "Default Frequency" values to internal codes.
// Falls back to the raw value so 'oneTime'/'recurring' still work if set programmatically.
const FREQUENCY_ALIASES = {
    'one time': 'oneTime',
    'monthly': 'recurring'
};

function normalizeFrequency(value) {
    if (!value) return 'oneTime';
    return FREQUENCY_ALIASES[value.toLowerCase()] ?? value;
}

function todayISODate() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

// Validates strict yyyy-mm-dd format (ISO). Rejects locale formats and invalid calendar dates.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(value) {
    if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) {
        return false;
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default class PaymentForm extends LightningElement {
    @api currency = 'EUR';
    @api amount;
    @api defaultFrequency = 'oneTime';
    @api startDate;

    @track firstName = '';
    @track lastName = '';
    @track email = '';
    @track selectedPaymentMethod = null;
    @track paymentIntent = {};
    @track paymentError = null;
    @track configError = null;

    labels = labels;
    paymentMethodConfig = PAYMENT_METHOD_CONFIG;
    _instanceId = ++_nextInstanceId;
    _subscription = null;

    // Per-instance key so two forms on a page don't cross-react on the channel.
    get paymentGroupId() {
        return `pf-${this._instanceId}`;
    }

    get frequency() {
        return normalizeFrequency(this.defaultFrequency);
    }

    get isRecurring() {
        return this.frequency === 'recurring';
    }

    get recurringStartDate() {
        return isValidISODate(this.startDate) ? this.startDate : todayISODate();
    }

    // Config entry for the selected method, matched by processor + method.
    get selectedMethodConfig() {
        const selected = this.selectedPaymentMethod;
        if (!selected) {
            return null;
        }
        return PAYMENT_METHOD_CONFIG.find(
            entry => entry.paymentProcessor === selected.processor && entry.paymentMethod === selected.name
        ) ?? null;
    }

    // Whether a recurring payment also takes a first payment now, per the method's
    // initialPaymentOnRecurring policy: 'required' always, 'optional' only for a same-day
    // start, otherwise never (the API rejects a OneTime block for those methods).
    get includeInitialPayment() {
        if (!this.isRecurring) {
            return false;
        }
        const policy = this.selectedMethodConfig?.initialPaymentOnRecurring ?? 'unsupported';
        if (policy === 'required') {
            return true;
        }
        if (policy === 'optional') {
            return this.recurringStartDate === todayISODate();
        }
        return false;
    }

    get formattedAmount() {
        if (this.amount == null || this.amount === '') {
            return '';
        }
        try {
            return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: this.currency }).format(Number(this.amount));
        } catch {
            return `${this.amount} ${this.currency}`;
        }
    }

    get frequencyLabel() {
        return this.isRecurring
            ? this.labels.ec_label_frequency_recurring
            : this.labels.ec_label_frequency_one_time;
    }

    get isPayButtonDisabled() {
        const inputs = this.template.querySelectorAll('lightning-input');
        const allInputsValid = [...inputs].every(input => input.checkValidity());
        return !(
            this.firstName &&
            this.lastName &&
            this.email &&
            Number(this.amount) > 0 &&
            this.selectedPaymentMethod &&
            allInputsValid
        );
    }

    // Hidden for field-level errors: the field already shows the message.
    get showPaymentErrorBanner() {
        if (!this.paymentError) {
            return false;
        }
        return !responseHasFieldLevelError(this.paymentError.errorCode);
    }

    // Payer-facing heading, categorised server-side.
    get paymentErrorLabel() {
        return this.paymentError?.errorLabel;
    }

    // Provider message under the heading, only for a recognised non-field code.
    // Field-level errors show inline; a codeless response has only a raw fallback.
    get paymentErrorDetails() {
        const code = this.paymentError?.errorCode;
        if (!code || responseHasFieldLevelError(code)) {
            return [];
        }
        const message = (this.paymentError?.errorMessage ?? '').trim();
        return message ? [message] : [];
    }

    get hasPaymentErrorDetails() {
        return this.paymentErrorDetails.length > 0;
    }

    // TEMP DEBUG (PaymentHub testing only) — remove before merging back
    get paymentErrorJson() {
        return JSON.stringify(this.paymentError, null, 2);
    }

    connectedCallback() {
        this.subscribeToPaymentFlow();
        this.configError = this._validateConfig(PAYMENT_METHOD_CONFIG);
        this._updatePaymentIntentContext();
    }

    disconnectedCallback() {
        unsubscribe(this._subscription);
        this._subscription = null;
    }

    // Apex calls
    @wire(MessageContext)
    messageContext;

    // Utility methods
    subscribeToPaymentFlow() {
        this._subscription = subscribe(
            this.messageContext,
            FINDOCK_PAYMENT_FLOW,
            (message) => this.handlePaymentFlowMessage(message)
        );
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
        const amount = this.amount != null ? String(this.amount) : '';
        const oneTimeBlock = { Amount: amount, CurrencyISOCode: this.currency };

        let scheduleBlocks;
        if (this.isRecurring) {
            scheduleBlocks = {
                Recurring: {
                    Amount: amount,
                    CurrencyISOCode: this.currency,
                    Frequency: RECURRING_FREQUENCY,
                    StartDate: this.recurringStartDate
                }
            };
            // First payment now (shown on the hosted page). A future start skips it:
            // the mandate is set up and the first charge lands on StartDate instead.
            if (this.includeInitialPayment) {
                scheduleBlocks.OneTime = oneTimeBlock;
            }
        } else {
            scheduleBlocks = { OneTime: oneTimeBlock };
        }

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
            ...scheduleBlocks,
            PaymentMethod: {
                Name: this.selectedPaymentMethod?.name,
                Processor: this.selectedPaymentMethod?.processor,
                Target: this.selectedPaymentMethod?.target
            }
        };
    }

    // PAYMENT_ERROR drives the banner; a new attempt (PAYMENT_PENDING) clears it.
    handlePaymentFlowMessage(message) {
        if (!matchesGroup(this.paymentGroupId, message)) {
            return;
        }
        if (message?.type === PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_ERROR) {
            this.paymentError = message.body;
        } else if (message?.type === PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_PENDING
                && message.body?.isPending === true) {
            this.paymentError = null;
        }
    }

    handleFieldChange(event) {
        this[event.target.dataset.field] = event.detail.value;
        this._updatePaymentIntentContext();
    }

    handlePaymentMethodChanged(event) {
        this.selectedPaymentMethod = event.detail;
        this._updatePaymentIntentContext();
    }
}
