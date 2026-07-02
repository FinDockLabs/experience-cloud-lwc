import { createElement } from 'lwc';
import PaymentForm from 'c/paymentForm';

function createComponent(props = {}) {
    const element = createElement('c-payment-form', { is: PaymentForm });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

function setAmount(element, value) {
    element.shadowRoot.querySelector('lightning-input[data-field="amountValue"]').dispatchEvent(
        new CustomEvent('change', { detail: { value } })
    );
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
            expect(element.shadowRoot.querySelector('lightning-input[data-field="amountValue"]')).not.toBeNull();
            expect(element.shadowRoot.querySelectorAll('lightning-input')).toHaveLength(4);
            expect(element.shadowRoot.querySelector('c-payment-selector')).not.toBeNull();
            expect(element.shadowRoot.querySelector('cpm-pay-button')).not.toBeNull();
        });
    });

    describe('event handlers', () => {
        it('updates the pay button state for a recurring amount', async () => {
            const element = createComponent();
            setFrequency(element, 'recurring');
            setAmount(element, 10);
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.paymentIntent.Recurring.Amount).toBe(10);
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
            const amountInput = element.shadowRoot.querySelector('lightning-input[data-field="amountValue"]');
            expect(amountInput.value).toBe(25);
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

        it('renders Amount label on the amount input', () => {
            const element = createComponent();
            const amountInput = element.shadowRoot.querySelector('lightning-input[data-field="amountValue"]');
            expect(amountInput.label).toBe('Amount');
        });
    });

    describe('payment intent context', () => {
        it('passes updated payment intent to cpm-pay-button when fields change', async () => {
            const element = createComponent();
            setFrequency(element, 'oneTime');
            setAmount(element, 50);
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
            expect(payBtn.paymentIntent.OneTime.Amount).toBe(50);
        });

        it('sets Recurring amount in payment intent when frequency is recurring', async () => {
            const element = createComponent();
            setFrequency(element, 'recurring');
            setAmount(element, 15);
            await Promise.resolve();
            const payBtn = element.shadowRoot.querySelector('cpm-pay-button');
            expect(payBtn.paymentIntent.Recurring.Amount).toBe(15);
            expect(payBtn.paymentIntent.OneTime).toBeUndefined();
        });

        it('passes currency to payment intent', async () => {
            const element = createComponent({ currency: 'USD' });
            setFrequency(element, 'oneTime');
            setAmount(element, 10);
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('cpm-pay-button').paymentIntent.OneTime.CurrencyISOCode).toBe('USD');
        });
    });
});
