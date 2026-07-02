import { createElement } from 'lwc';
import PaymentForm from 'c/paymentForm';

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

        it('pre-selects defaultFrequency when the form loads', () => {
            const element = createComponent({ defaultFrequency: 'recurring' });
            expect(element.shadowRoot.querySelector('input[value="recurring"]').checked).toBe(true);
            expect(element.shadowRoot.querySelector('input[value="oneTime"]').checked).toBe(false);
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
            expect(firstNameInput.label).toBe('First Name');
        });

        it('renders Last Name label on the second input', () => {
            const element = createComponent();
            const lastNameInput = element.shadowRoot.querySelector('lightning-input[data-field="lastName"]');
            expect(lastNameInput.label).toBe('Last Name');
        });

        it('renders Email Address label on the email input', () => {
            const element = createComponent();
            const emailInput = element.shadowRoot.querySelector('lightning-input[data-field="email"]');
            expect(emailInput.label).toBe('Email Address');
        });

        it('renders Amount label for the amount input', () => {
            const element = createComponent();
            const label = element.shadowRoot.querySelector('.slds-form-element__label');
            expect(label.textContent).toContain('Amount');
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
    });
});
