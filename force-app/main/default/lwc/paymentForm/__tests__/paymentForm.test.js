import { createElement } from 'lwc';
import PaymentForm from 'c/paymentForm';
import { publish } from 'lightning/messageService';
import FINDOCK_PAYMENT_FLOW from '@salesforce/messageChannel/cpm__findockPaymentFlow__c';
import { PAYMENT_FLOW_MESSAGE_TYPES } from 'cpm/paymentFlowChannel';
import EC_LABEL_FIRST_NAME from '@salesforce/label/c.ec_label_first_name';
import EC_LABEL_LAST_NAME from '@salesforce/label/c.ec_label_last_name';
import EC_LABEL_EMAIL_ADDRESS from '@salesforce/label/c.ec_label_email_address';
const ERROR_LABEL_GENERIC = 'We could not process your payment.';
const ERROR_LABEL_CONFIG = 'This payment method is not available right now.';

function createComponent(props = {}) {
    const element = createElement('c-payment-form', { is: PaymentForm });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

function setField(element, field, value) {
    element.shadowRoot.querySelector(`lightning-input[data-field="${field}"]`).dispatchEvent(
        new CustomEvent('change', { detail: { value } })
    );
}

function selectMethod(element, { name, processor, target = 'My Stripe Test Account' }) {
    element.shadowRoot.querySelector('c-payment-selector').dispatchEvent(
        new CustomEvent('paymentmethodchanged', {
            detail: { name, processor, target },
            bubbles: true,
            composed: true
        })
    );
}

function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
});

describe('paymentForm', () => {
    describe('rendering', () => {
        it('renders the read-only summary, contact inputs, selector and pay button', () => {
            const element = createComponent({ amount: 25 });
            expect(element.shadowRoot.querySelector('.payment-summary')).not.toBeNull();
            expect(element.shadowRoot.querySelectorAll('lightning-input')).toHaveLength(3);
            expect(element.shadowRoot.querySelector('c-payment-selector')).not.toBeNull();
            expect(element.shadowRoot.querySelector('cpm-pay-button')).not.toBeNull();
        });

        it('does not render an amount input or a frequency toggle', () => {
            const element = createComponent({ amount: 25 });
            expect(element.shadowRoot.querySelector('.slds-input')).toBeNull();
            expect(element.shadowRoot.querySelector('.frequency-toggle')).toBeNull();
        });
    });

    describe('admin-configured amount and frequency (read-only)', () => {
        it('shows the admin amount, currency-formatted', () => {
            const element = createComponent({ amount: 1000, currency: 'USD' });
            const amount = element.shadowRoot.querySelector('.payment-summary__amount').textContent;
            expect(amount).toContain('1,000');
            expect(amount).toContain('$');
        });

        it('renders a frequency label the payer cannot change', () => {
            const element = createComponent({ amount: 10, defaultFrequency: 'Monthly' });
            expect(element.shadowRoot.querySelector('.payment-summary__frequency').textContent.trim()).not.toBe('');
        });
    });

    describe('payment intent context', () => {
        it('builds the intent from the configured amount as soon as it renders', async () => {
            const element = createComponent({ amount: 50, defaultFrequency: 'One time' });
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.paymentIntent.OneTime.Amount).toBe('50');
        });

        it('includes the payer contact fields as they are entered', async () => {
            const element = createComponent({ amount: 50 });
            setField(element, 'firstName', 'Jane');
            setField(element, 'lastName', 'Doe');
            setField(element, 'email', 'jane@example.com');
            await Promise.resolve();
            const contact = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.Payer.Contact.SalesforceFields;
            expect(contact.FirstName).toBe('Jane');
            expect(contact.LastName).toBe('Doe');
            expect(contact.Email).toBe('jane@example.com');
        });

        it('uses the OneTime block when the admin frequency is one-time', async () => {
            const element = createComponent({ amount: 50, defaultFrequency: 'One time' });
            await Promise.resolve();
            const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
            expect(intent.OneTime.Amount).toBe('50');
            expect(intent.Recurring).toBeUndefined();
        });

        it('uses the Recurring block (Monthly, starting today) when the admin frequency is recurring', async () => {
            const element = createComponent({ amount: 15, defaultFrequency: 'Monthly' });
            await Promise.resolve();
            const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
            const today = new Date();
            const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            expect(intent.Recurring.Amount).toBe('15');
            expect(intent.Recurring.Frequency).toBe('Monthly');
            expect(intent.Recurring.StartDate).toBe(expected);
            expect(intent.OneTime).toBeUndefined();
        });

        it('uses the configured start date when one is set', async () => {
            const element = createComponent({ amount: 15, defaultFrequency: 'Monthly', startDate: '2026-01-15' });
            await Promise.resolve();
            const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
            expect(intent.Recurring.StartDate).toBe('2026-01-15');
        });

        describe('malformed start date falls back to today', () => {
            const today = new Date();
            const expectedToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            it.each([
                ['US-style mm/dd/yyyy', '01/15/2026'],
                ['EU-style dd/mm/yyyy', '15/01/2026'],
                ['non-existent calendar date', '2026-02-30'],
                ['out-of-range month', '2026-13-01'],
                ['empty string', ''],
            ])('ignores %s (%s)', async (_label, startDate) => {
                const element = createComponent({ amount: 15, defaultFrequency: 'Monthly', startDate });
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                expect(intent.Recurring.StartDate).toBe(expectedToday);
            });
        });

        describe('initial payment on recurring', () => {
            it('adds a OneTime initial payment for an "optional" method starting today', async () => {
                const element = createComponent({ amount: 15, defaultFrequency: 'Monthly' });
                selectMethod(element, { name: 'CreditCard', processor: 'PaymentHub-Stripe' });
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                expect(intent.Recurring.Amount).toBe('15');
                expect(intent.Recurring.StartDate).toBe(todayISO());
                // Initial payment charged now, same amount/currency as the recurring schedule.
                expect(intent.OneTime).toEqual({ Amount: '15', CurrencyISOCode: 'EUR' });
            });

            it('omits the OneTime block for an "optional" method with a future start date', async () => {
                const element = createComponent({ amount: 15, defaultFrequency: 'Monthly', startDate: '2099-01-15' });
                selectMethod(element, { name: 'CreditCard', processor: 'PaymentHub-Stripe' });
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                expect(intent.Recurring.StartDate).toBe('2099-01-15');
                expect(intent.OneTime).toBeUndefined();
            });

            it('never adds a OneTime block for an "unsupported" method, even starting today', async () => {
                const element = createComponent({ amount: 15, defaultFrequency: 'Monthly' });
                selectMethod(element, { name: 'SEPA Direct Debit', processor: 'PaymentHub-Stripe' });
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                expect(intent.Recurring.StartDate).toBe(todayISO());
                expect(intent.OneTime).toBeUndefined();
            });

            it('does not add a OneTime block for a one-time payment (initial-payment logic is recurring-only)', async () => {
                const element = createComponent({ amount: 15, defaultFrequency: 'One time' });
                selectMethod(element, { name: 'CreditCard', processor: 'PaymentHub-Stripe' });
                await Promise.resolve();
                const intent = element.shadowRoot.querySelector('cpm-pay-button').paymentIntent;
                expect(intent.OneTime).toEqual({ Amount: '15', CurrencyISOCode: 'EUR' });
                expect(intent.Recurring).toBeUndefined();
            });
        });

        it('passes the configured currency to the intent', async () => {
            const element = createComponent({ amount: 10, currency: 'USD', defaultFrequency: 'One time' });
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.OneTime.CurrencyISOCode).toBe('USD');
        });
    });

    describe('accessibility structure', () => {
        it('groups the contact and payment-method sections in fieldsets with visible legends', () => {
            const element = createComponent({ amount: 25 });
            const legends = element.shadowRoot.querySelectorAll('fieldset > legend.section-header');
            expect(element.shadowRoot.querySelectorAll('fieldset')).toHaveLength(2);
            expect(legends).toHaveLength(2);
        });
    });

    describe('label rendering', () => {
        it('renders First Name label on the first input', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('lightning-input[data-field="firstName"]').label).toBe(EC_LABEL_FIRST_NAME);
        });

        it('renders Last Name label on the second input', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('lightning-input[data-field="lastName"]').label).toBe(EC_LABEL_LAST_NAME);
        });

        it('renders Email Address label on the email input', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('lightning-input[data-field="email"]').label).toBe(EC_LABEL_EMAIL_ADDRESS);
        });
    });

    describe('payment error', () => {
        // Errors reach the form as PAYMENT_ERROR messages on the findockPaymentFlow
        // channel (published by the Pay Button).
        function dispatchPaymentResult(element, body) {
            publish(undefined, FINDOCK_PAYMENT_FLOW, {
                type: PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_ERROR,
                body
            });
            return Promise.resolve();
        }

        function startPaymentAttempt() {
            publish(undefined, FINDOCK_PAYMENT_FLOW, {
                type: PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_PENDING,
                body: { isPending: true }
            });
            return Promise.resolve();
        }

        it('shows no error banner before the pay button reports a result', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('.payment-error-banner')).toBeNull();
        });

        it('shows the server-provided category message in the banner heading', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorLabel: ERROR_LABEL_CONFIG,
                errorMessage: 'Required fields are missing: [SourceConnector]'
            });
            const banner = element.shadowRoot.querySelector('.payment-error-banner');
            expect(banner).not.toBeNull();
            expect(banner.textContent).toContain(ERROR_LABEL_CONFIG);
        });

        it('never renders the raw error message when there is no field-level code', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorLabel: ERROR_LABEL_GENERIC,
                errorMessage: 'IBAN invalid: NL13TEST0123456789'
            });
            expect(element.shadowRoot.querySelector('.payment-error-banner').textContent).not.toContain('NL13TEST0123456789');
        });

        it('clears the error banner when a new payment attempt starts', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorLabel: ERROR_LABEL_CONFIG,
                errorMessage: 'IBAN invalid'
            });
            expect(element.shadowRoot.querySelector('.payment-error-banner')).not.toBeNull();

            await startPaymentAttempt();
            expect(element.shadowRoot.querySelector('.payment-error-banner')).toBeNull();
        });

        it('hides the summary banner when the error is field-level (the field shows the message)', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorCode: '202',
                errorMessage: 'The provided IBAN is not valid'
            });
            expect(element.shadowRoot.querySelector('.payment-error-banner')).toBeNull();
        });

        it('shows the specific message in the banner for a non-field-level error', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorCode: '998',
                errorLabel: ERROR_LABEL_CONFIG,
                errorMessage: 'No default setup record found for category PSP'
            });
            const details = element.shadowRoot.querySelectorAll('.payment-error-banner__detail');
            expect(details).toHaveLength(1);
            expect(details[0].textContent).toBe('No default setup record found for category PSP');
        });
    });

    describe('message scoping (groupId)', () => {
        // The form reads its own key off the child pay button (payment-group-id).
        function groupIdOf(element) {
            return element.shadowRoot.querySelector('cpm-pay-button').paymentGroupId;
        }

        function publishError(groupId) {
            publish(undefined, FINDOCK_PAYMENT_FLOW, {
                type: PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_ERROR,
                body: { statusCode: 422, groupId, errorLabel: ERROR_LABEL_GENERIC, errorMessage: 'boom' }
            });
            return Promise.resolve();
        }

        it('gives each form instance a distinct, non-empty group id', () => {
            const a = createComponent();
            const b = createComponent();
            expect(groupIdOf(a)).toBeTruthy();
            expect(groupIdOf(a)).not.toBe(groupIdOf(b));
        });

        it('shows the error only on the form it is addressed to', async () => {
            const a = createComponent();
            const b = createComponent();
            await publishError(groupIdOf(a));
            expect(a.shadowRoot.querySelector('.payment-error-banner')).not.toBeNull();
            expect(b.shadowRoot.querySelector('.payment-error-banner')).toBeNull();
        });

        it('ignores an error addressed to a different group', async () => {
            const a = createComponent();
            await publishError('pf-does-not-exist');
            expect(a.shadowRoot.querySelector('.payment-error-banner')).toBeNull();
        });

        it('still handles a broadcast that carries no group id', async () => {
            const a = createComponent();
            await publishError(undefined);
            expect(a.shadowRoot.querySelector('.payment-error-banner')).not.toBeNull();
        });
    });
});
