import { api, wire, LightningElement, track } from "lwc";
import { subscribe, unsubscribe, MessageContext } from 'lightning/messageService';
import FINDOCK_PAYMENT_FLOW from '@salesforce/messageChannel/cpm__findockPaymentFlow__c';
import LOCALE from '@salesforce/i18n/locale';

import { PAYMENT_FLOW_MESSAGE_TYPES, matchesGroup } from 'cpm/paymentFlowChannel';
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

export default class PaymentForm extends LightningElement {
    @api currency = 'EUR';
    @api amount;
    @api defaultFrequency = 'oneTime';

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
        return todayISODate();
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

    // Add an initial OneTime payment only when the method requires it
    get includeInitialPayment() {
        return this.isRecurring
            && this.selectedMethodConfig?.initialPaymentOnRecurring === 'required';
    }

    get availableMethods() {
        if (!Array.isArray(PAYMENT_METHOD_CONFIG)) {
            return [];
        }
        return PAYMENT_METHOD_CONFIG.filter(m =>
            this.isRecurring ? (m.supportsRecurring && m.enabledRecurring) : m.enabledOneTime
        );
    }

    get hasNoMethodsForFrequency() {
        return !this.configError && this.availableMethods.length === 0;
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

    connectedCallback() {
        this.subscribeToPaymentFlow();
        this.configError = this._validateConfig(PAYMENT_METHOD_CONFIG);
        this._updatePaymentIntentContext();
    }

    disconnectedCallback() {
        unsubscribe(this._subscription);
        this._subscription = null;
    }

    @wire(MessageContext)
    messageContext;

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

    // Extension point. The form subscribes to payment events from the Pay Button (findockPaymentFlow
    // channel) and forwards them to parents. It stores the latest error in paymentError.
    // It renders no UI banner itself to avoid duplicate error messages.
    handlePaymentFlowMessage(message) {
        if (!matchesGroup(this.paymentGroupId, message)) {
            return;
        }
        if (message?.type === PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_ERROR) {
            this.paymentError = message.body;
            this.dispatchEvent(new CustomEvent('paymenterror', { detail: message.body }));
        } else if (message?.type === PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_PENDING
                && message.body?.isPending === true) {
            this.paymentError = null;
            this.dispatchEvent(new CustomEvent('paymentpending'));
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
