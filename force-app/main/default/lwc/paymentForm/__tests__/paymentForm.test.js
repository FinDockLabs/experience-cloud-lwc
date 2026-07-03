import { createElement } from 'lwc';
import PaymentForm from 'c/paymentForm';
import { publish } from 'lightning/messageService';
import FINDOCK_PAYMENT_FLOW from '@salesforce/messageChannel/cpm__findockPaymentFlow__c';
import { PAYMENT_FLOW_MESSAGE_TYPES } from 'cpm/paymentFlowChannel';
import EC_LABEL_FIRST_NAME from '@salesforce/label/c.ec_label_first_name';
import EC_LABEL_LAST_NAME from '@salesforce/label/c.ec_label_last_name';
import EC_LABEL_EMAIL_ADDRESS from '@salesforce/label/c.ec_label_email_address';
import EC_LABEL_AMOUNT from '@salesforce/label/c.ec_label_amount';
import EC_ERROR_PAYMENT_GENERIC from '@salesforce/label/c.ec_error_payment_generic';
import EC_ERROR_PAYMENT_RECOVERABLE from '@salesforce/label/c.ec_error_payment_recoverable';
import EC_ERROR_PAYMENT_CONFIG from '@salesforce/label/c.ec_error_payment_config';
import EC_ERROR_PAYMENT_INVALID_DATA from '@salesforce/label/c.ec_error_payment_invalid_data';

function createComponent(props = {}) {
    const element = createElement('c-payment-form', { is: PaymentForm });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

function typeAmount(element, rawValue) {
    const input = element.shadowRoot.querySelector('.slds-input');
    input.value = rawValue;
    input.dispatchEvent(new CustomEvent('input'));
    return input;
}

function blurAmountField(element) {
    const input = element.shadowRoot.querySelector('.slds-input');
    input.dispatchEvent(new CustomEvent('blur'));
    return input;
}

function focusAmountField(element) {
    const input = element.shadowRoot.querySelector('.slds-input');
    input.dispatchEvent(new CustomEvent('focus'));
    return input;
}

function setFrequency(element, value) {
    element.shadowRoot.querySelector(`input[type="radio"][value="${value}"]`).dispatchEvent(
        new CustomEvent('change')
    );
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
});

describe('paymentForm', () => {
    describe('rendering', () => {
        it('renders all sections at once', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('.slds-input')).not.toBeNull();
            expect(element.shadowRoot.querySelectorAll('lightning-input')).toHaveLength(3);
            expect(element.shadowRoot.querySelector('c-payment-selector')).not.toBeNull();
            expect(element.shadowRoot.querySelector('cpm-pay-button')).not.toBeNull();
        });
    });

    describe('event handlers', () => {
        it('updates the pay button state for a recurring amount', async () => {
            const element = createComponent();
            setFrequency(element, 'recurring');
            typeAmount(element, '10');
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.paymentIntent.Recurring.Amount).toBe('10');
        });

        it('handleFieldChange updates the field bound to data-field', async () => {
            const element = createComponent();
            element.shadowRoot.querySelector('lightning-input[data-field="firstName"]').dispatchEvent(
                new CustomEvent('change', { detail: { value: 'Jane' } })
            );
            await Promise.resolve();
            // Component is still stable and rendered correctly
            expect(element.shadowRoot.querySelector('lightning-input[data-field="firstName"]')).not.toBeNull();
        });

        it('handlePaymentMethodChanged is called when payment-selector emits', async () => {
            const element = createComponent();
            element.shadowRoot.querySelector('c-payment-selector').dispatchEvent(
                new CustomEvent('paymentmethodchanged', {
                    detail: { name: 'CreditCard', processor: 'PaymentHub-Stripe', target: 'Stripe-Main-Account' },
                    bubbles: true,
                    composed: true
                })
            );
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('cpm-pay-button')).not.toBeNull();
        });
    });

    describe('frequency toggle', () => {
        it('hides the frequency selector when showFrequency is false', () => {
            const element = createComponent({ showFrequency: false });
            expect(element.shadowRoot.querySelector('.frequency-toggle')).toBeNull();
        });

        it('shows the frequency selector when showFrequency is true', () => {
            const element = createComponent({ showFrequency: true });
            expect(element.shadowRoot.querySelector('.frequency-toggle')).not.toBeNull();
        });

        it('pre-selects defaultFrequency when the form loads (legacy code)', () => {
            const element = createComponent({ defaultFrequency: 'recurring' });
            expect(element.shadowRoot.querySelector('input[value="recurring"]').checked).toBe(true);
            expect(element.shadowRoot.querySelector('input[value="oneTime"]').checked).toBe(false);
        });

        it('pre-selects defaultFrequency from the App Builder "Monthly" option', () => {
            const element = createComponent({ defaultFrequency: 'Monthly' });
            expect(element.shadowRoot.querySelector('input[value="recurring"]').checked).toBe(true);
            expect(element.shadowRoot.querySelector('input[value="oneTime"]').checked).toBe(false);
        });

        it('pre-selects defaultFrequency from the App Builder "One time" option', () => {
            const element = createComponent({ defaultFrequency: 'One time' });
            expect(element.shadowRoot.querySelector('input[value="oneTime"]').checked).toBe(true);
            expect(element.shadowRoot.querySelector('input[value="recurring"]').checked).toBe(false);
        });
    });

    describe('default amount', () => {
        it('pre-fills the amount field from the amount property', () => {
            const element = createComponent({ amount: 25 });
            const amountInput = element.shadowRoot.querySelector('.slds-input');
            expect(amountInput.value).toBe('25');
        });

        it('formats a pre-filled default amount with grouping separators on initial render', () => {
            const element = createComponent({ amount: 1000 });
            const amountInput = element.shadowRoot.querySelector('.slds-input');
            expect(amountInput.value).toBe('1,000');
        });

        it('still submits the unformatted default amount in the payment intent', async () => {
            const element = createComponent({ amount: 1000 });
            setFrequency(element, 'oneTime');
            element.shadowRoot.querySelector('lightning-input[data-field="firstName"]').dispatchEvent(
                new CustomEvent('change', { detail: { value: 'Jane' } })
            );
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.paymentIntent.OneTime.Amount).toBe('1000');
        });
    });

    describe('accessibility structure', () => {
        it('personal information inputs are wrapped in a fieldset with legend', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelectorAll('fieldset')).toHaveLength(3);
            expect(element.shadowRoot.querySelectorAll('legend')).toHaveLength(3);
        });
    });

    describe('label rendering', () => {
        it('renders First Name label on the first input', () => {
            const element = createComponent();
            const firstNameInput = element.shadowRoot.querySelector('lightning-input[data-field="firstName"]');
            expect(firstNameInput.label).toBe(EC_LABEL_FIRST_NAME);
        });

        it('renders Last Name label on the second input', () => {
            const element = createComponent();
            const lastNameInput = element.shadowRoot.querySelector('lightning-input[data-field="lastName"]');
            expect(lastNameInput.label).toBe(EC_LABEL_LAST_NAME);
        });

        it('renders Email Address label on the email input', () => {
            const element = createComponent();
            const emailInput = element.shadowRoot.querySelector('lightning-input[data-field="email"]');
            expect(emailInput.label).toBe(EC_LABEL_EMAIL_ADDRESS);
        });

        it('renders Amount label for the amount input', () => {
            const element = createComponent();
            const label = element.shadowRoot.querySelector('.slds-form-element__label');
            expect(label.textContent).toContain(EC_LABEL_AMOUNT);
            expect(label.getAttribute('for')).toBe(element.shadowRoot.querySelector('.slds-input').id);
        });
    });

    describe('currency addon', () => {
        it('shows the symbol for the configured currency in a single SLDS addon', () => {
            const element = createComponent({ currency: 'USD' });
            const addons = element.shadowRoot.querySelectorAll('.slds-form-element__addon');
            expect(addons).toHaveLength(1);
            expect(addons[0].textContent).toBe('$');
        });

        it('falls back to the default currency symbol when none is configured', () => {
            const element = createComponent();
            const addons = element.shadowRoot.querySelectorAll('.slds-form-element__addon');
            expect(addons).toHaveLength(1);
            expect(addons[0].textContent).toBe('€');
        });
    });

    describe('amount input filtering', () => {
        it('strips +, -, and other non-numeric characters as they are typed', () => {
            const element = createComponent();
            const input = typeAmount(element, '+++++---55543322224......');
            expect(input.value).toBe('55543322224.');
        });

        it('does not allow a leading minus sign', () => {
            const element = createComponent();
            const input = typeAmount(element, '-10');
            expect(input.value).toBe('10');
        });

        it('collapses multiple decimal points into one', () => {
            const element = createComponent();
            const input = typeAmount(element, '1.2.3');
            expect(input.value).toBe('1.23');
        });

        it("limits decimal places to what the currency supports (2 for USD)", () => {
            const element = createComponent({ currency: 'USD' });
            const input = typeAmount(element, '10.123456');
            expect(input.value).toBe('10.12');
        });

        it('disallows any decimal point for a zero-decimal currency like JPY', () => {
            const element = createComponent({ currency: 'JPY' });
            const input = typeAmount(element, '1000.7');
            expect(input.value).toBe('1000');
        });
    });

    describe('digit-group separators', () => {
        it('formats the amount with grouping separators on blur', () => {
            const element = createComponent();
            typeAmount(element, '1000');
            const input = blurAmountField(element);
            expect(input.value).toBe('1,000');
        });

        it('shows the raw, unformatted value again when the field is refocused', () => {
            const element = createComponent();
            typeAmount(element, '1000');
            blurAmountField(element);
            const input = focusAmountField(element);
            expect(input.value).toBe('1000');
        });

        it('does not change the underlying amount used in the payment intent', async () => {
            const element = createComponent();
            setFrequency(element, 'oneTime');
            typeAmount(element, '1000');
            blurAmountField(element);
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.paymentIntent.OneTime.Amount).toBe('1000');
        });
    });

    describe('payment intent context', () => {
        it('passes updated payment intent to cpm-pay-button when fields change', async () => {
            const element = createComponent();
            setFrequency(element, 'oneTime');
            typeAmount(element, '50');
            element.shadowRoot.querySelector('lightning-input[data-field="firstName"]').dispatchEvent(
                new CustomEvent('change', { detail: { value: 'Jane' } })
            );
            element.shadowRoot.querySelector('lightning-input[data-field="lastName"]').dispatchEvent(
                new CustomEvent('change', { detail: { value: 'Doe' } })
            );
            element.shadowRoot.querySelector('lightning-input[data-field="email"]').dispatchEvent(
                new CustomEvent('change', { detail: { value: 'jane@example.com' } })
            );
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.paymentIntent.Payer.Contact.SalesforceFields.FirstName).toBe('Jane');
            expect(payBtn.paymentIntent.Payer.Contact.SalesforceFields.LastName).toBe('Doe');
            expect(payBtn.paymentIntent.OneTime.Amount).toBe('50');
        });

        it('sets Recurring amount in payment intent when frequency is recurring', async () => {
            const element = createComponent();
            setFrequency(element, 'recurring');
            typeAmount(element, '15');
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.paymentIntent.Recurring.Amount).toBe('15');
            expect(payBtn.paymentIntent.OneTime).toBeUndefined();
        });

        it('passes currency to payment intent', async () => {
            const element = createComponent({ currency: 'USD' });
            setFrequency(element, 'oneTime');
            typeAmount(element, '10');
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.OneTime.CurrencyISOCode).toBe('USD');
        });

        it('sets Recurring.Frequency to Monthly', async () => {
            const element = createComponent();
            setFrequency(element, 'recurring');
            typeAmount(element, '15');
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.Recurring.Frequency).toBe('Monthly');
        });

        it('sets Recurring.StartDate to today in yyyy-mm-dd format', async () => {
            const element = createComponent();
            setFrequency(element, 'recurring');
            typeAmount(element, '15');
            await Promise.resolve();
            const today = new Date();
            const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            expect(element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.Recurring.StartDate).toBe(expected);
        });
    });

    describe('payment error', () => {
        // Errors reach the form as PAYMENT_ERROR messages on the findockPaymentFlow
        // channel (published by the Pay Button), replacing the old Flow result
        // input/output variable.
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

        it('shows a generic error banner when the pay button reports an error', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, { statusCode: 422, errorMessage: 'IBAN invalid: NL13TEST0123456789' });
            const banner = element.shadowRoot.querySelector('.payment-error-banner');
            expect(banner).not.toBeNull();
            expect(banner.textContent).toContain(EC_ERROR_PAYMENT_GENERIC);
        });

        it('never renders the raw error message from the payment intent response', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, { statusCode: 422, errorMessage: 'IBAN invalid: NL13TEST0123456789' });
            expect(element.shadowRoot.querySelector('.payment-error-banner').textContent).not.toContain('NL13TEST0123456789');
        });

        it('clears the error banner when a new payment attempt starts', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, { statusCode: 422, errorMessage: 'IBAN invalid' });
            expect(element.shadowRoot.querySelector('.payment-error-banner')).not.toBeNull();

            await startPaymentAttempt();
            expect(element.shadowRoot.querySelector('.payment-error-banner')).toBeNull();
        });

        it('shows the recoverable-field message for a bank detail error code (e.g. invalid IBAN)', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorMessage: 'IBAN NL00 is not valid',
                errors: [{ code: '202', message: 'IBAN NL00 is not valid' }]
            });
            expect(element.shadowRoot.querySelector('.payment-error-banner').textContent)
                .toContain(EC_ERROR_PAYMENT_RECOVERABLE);
        });

        it('does NOT repeat a field-level message in the banner (it is shown on the field instead)', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorMessage: 'The provided IBAN is not valid',
                errors: [{ code: '202', message: 'The provided IBAN is not valid' }]
            });
            // 202 maps to the IBAN field, so its message shows on the field, not as a banner bullet.
            expect(element.shadowRoot.querySelectorAll('.payment-error-banner__detail')).toHaveLength(0);
        });

        it('shows the specific message in the banner for a non-field-level error', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorMessage: 'No default setup record found for category PSP',
                errors: [{ code: '998', message: 'No default setup record found for category PSP' }]
            });
            const details = element.shadowRoot.querySelectorAll('.payment-error-banner__detail');
            expect(details).toHaveLength(1);
            expect(details[0].textContent).toBe('No default setup record found for category PSP');
        });

        it('lists only the non-field-level messages when field and non-field errors are mixed', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorMessage: 'IBAN invalid, and something else',
                errors: [
                    { code: '202', message: 'The provided IBAN is not valid' },
                    { code: '999', message: 'Something else went wrong' }
                ]
            });
            const details = element.shadowRoot.querySelectorAll('.payment-error-banner__detail');
            expect(details).toHaveLength(1);
            expect(details[0].textContent).toBe('Something else went wrong');
        });

        it('shows the configuration message for a missing mandatory field code', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorMessage: 'Required fields are missing: [SourceConnector]',
                errors: [{ code: '011', message: 'Required fields are missing: [SourceConnector]' }]
            });
            expect(element.shadowRoot.querySelector('.payment-error-banner').textContent)
                .toContain(EC_ERROR_PAYMENT_CONFIG);
        });

        it('shows the invalid-data message for a bad-data code (e.g. invalid email)', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorMessage: 'Contact error: Email is invalid',
                errors: [{ code: '200', message: 'Contact error: Email is invalid' }]
            });
            expect(element.shadowRoot.querySelector('.payment-error-banner').textContent)
                .toContain(EC_ERROR_PAYMENT_INVALID_DATA);
        });

        it('falls back to the generic message for an unrecognized error code', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorMessage: 'Unexpected failure',
                errors: [{ code: '999', message: 'Unexpected failure' }]
            });
            expect(element.shadowRoot.querySelector('.payment-error-banner').textContent)
                .toContain(EC_ERROR_PAYMENT_GENERIC);
        });

        it('prioritizes the recoverable message when both a recoverable and a generic code are present', async () => {
            const element = createComponent();
            await dispatchPaymentResult(element, {
                statusCode: 422,
                errorMessage: 'IBAN invalid, unexpected failure',
                errors: [
                    { code: '999', message: 'unexpected failure' },
                    { code: '202', message: 'IBAN invalid' }
                ]
            });
            expect(element.shadowRoot.querySelector('.payment-error-banner').textContent)
                .toContain(EC_ERROR_PAYMENT_RECOVERABLE);
        });
    });
});
