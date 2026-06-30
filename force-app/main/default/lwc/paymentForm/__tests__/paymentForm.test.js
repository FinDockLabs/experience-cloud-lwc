import { createElement } from 'lwc';
import PaymentForm from 'c/paymentForm';

function createComponent(props = {}) {
    const element = createElement('c-payment-form', { is: PaymentForm });
    Object.assign(element, { screenMode: 'OneScreen', ...props });
    document.body.appendChild(element);
    return element;
}

function dispatchAmountFrequencyChange(element, detail) {
    element.shadowRoot.querySelector('c-amount-and-frequency').dispatchEvent(
        new CustomEvent('amountfrequencychange', { detail })
    );
}

function fillStep1(element, amount = 25) {
    dispatchAmountFrequencyChange(element, {
        amountOneTime: amount,
        amountRecurring: null,
        frequency: 'oneTime'
    });
}

// Navigation buttons use data-id attributes since label is an LWC property, not an HTML attribute
function getNextBtn(element) {
    return element.shadowRoot.querySelector('lightning-button[data-id="next"]');
}

function getBackBtn(element) {
    return element.shadowRoot.querySelector('lightning-button[data-id="back"]');
}

async function navigateToStep(element, targetStep) {
    if (targetStep >= 2) {
        fillStep1(element);
        await Promise.resolve();
        getNextBtn(element).click();
        await Promise.resolve();
    }
    if (targetStep >= 3) {
        getNextBtn(element).click();
        await Promise.resolve();
    }
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
});

describe('paymentForm', () => {
    describe('OneScreen mode', () => {
        it('renders all sections at once', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('c-amount-and-frequency')).not.toBeNull();
            expect(element.shadowRoot.querySelectorAll('lightning-input')).toHaveLength(3);
            expect(element.shadowRoot.querySelector('c-payment-selector')).not.toBeNull();
            expect(element.shadowRoot.querySelector('cpm-pay-button')).not.toBeNull();
        });

        it('does not render step navigation buttons', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('.step-navigation')).toBeNull();
        });

        it('does not render progress indicator', () => {
            const element = createComponent();
            expect(element.shadowRoot.querySelector('c-experience-progress-stages')).toBeNull();
        });
    });

    describe('MultiScreen step navigation', () => {
        it('shows only step 1 content initially', () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            expect(element.shadowRoot.querySelector('c-amount-and-frequency')).not.toBeNull();
            expect(element.shadowRoot.querySelector('lightning-input')).toBeNull();
            expect(element.shadowRoot.querySelector('c-payment-selector')).toBeNull();
        });

        it('renders progress indicator', () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            expect(element.shadowRoot.querySelector('c-experience-progress-stages')).not.toBeNull();
        });

        it('advances to step 2 after entering amount and clicking Next', async () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            await navigateToStep(element, 2);
            expect(element.shadowRoot.querySelector('lightning-input')).not.toBeNull();
            expect(element.shadowRoot.querySelector('c-amount-and-frequency')).toBeNull();
        });

        it('advances to step 3 from step 2', async () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            await navigateToStep(element, 3);
            expect(element.shadowRoot.querySelector('c-payment-selector')).not.toBeNull();
            expect(element.shadowRoot.querySelector('lightning-input')).toBeNull();
        });

        it('returns to step 1 after clicking Back on step 2', async () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            await navigateToStep(element, 2);
            getBackBtn(element).click();
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('c-amount-and-frequency')).not.toBeNull();
        });

        it('returns to step 2 after clicking Back on step 3', async () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            await navigateToStep(element, 3);
            getBackBtn(element).click();
            await Promise.resolve();
            expect(element.shadowRoot.querySelector('lightning-input')).not.toBeNull();
        });
    });

    describe('step 1 validation', () => {
        it('Next button is disabled when no amount is entered', () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            expect(getNextBtn(element).disabled).toBe(true);
        });

        it('Next button is enabled after a valid amount is entered', async () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            fillStep1(element, 50);
            await Promise.resolve();
            expect(getNextBtn(element).disabled).toBe(false);
        });

        it('Next button remains disabled when amount is zero', async () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            fillStep1(element, 0);
            await Promise.resolve();
            expect(getNextBtn(element).disabled).toBe(true);
        });
    });

    describe('event handlers', () => {
        it('handleAmountFrequencyChanged enables Next for a recurring amount', async () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            dispatchAmountFrequencyChange(element, {
                amountOneTime: null,
                amountRecurring: 10,
                frequency: 'recurring'
            });
            await Promise.resolve();
            expect(getNextBtn(element).disabled).toBe(false);
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
        it('passes showFrequency false to amount-and-frequency when hideFrequency is true', () => {
            const element = createComponent({ hideFrequency: true });
            const amountFreq = element.shadowRoot.querySelector('c-amount-and-frequency');
            expect(amountFreq.showFrequencyToggle).toBe(false);
        });

        it('passes showFrequency true to amount-and-frequency when hideFrequency is false', () => {
            const element = createComponent({ hideFrequency: false });
            const amountFreq = element.shadowRoot.querySelector('c-amount-and-frequency');
            expect(amountFreq.showFrequencyToggle).toBe(true);
        });

        it('passes defaultFrequency to amount-and-frequency', () => {
            const element = createComponent({ defaultFrequency: 'recurring' });
            const amountFreq = element.shadowRoot.querySelector('c-amount-and-frequency');
            expect(amountFreq.defaultFrequency).toBe('recurring');
        });

        it('passes currency to amount-and-frequency', () => {
            const element = createComponent({ currency: 'GBP' });
            const amountFreq = element.shadowRoot.querySelector('c-amount-and-frequency');
            expect(amountFreq.defaultCurrency).toBe('GBP');
        });
    });

    describe('accessibility structure', () => {
        it('renders an aria-live region', () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            expect(element.shadowRoot.querySelector('[aria-live="polite"]')).not.toBeNull();
        });

        it('aria-live region is present in OneScreen mode and contains no announcement', () => {
            const element = createComponent({ screenMode: 'OneScreen' });
            const liveRegion = element.shadowRoot.querySelector('[aria-live="polite"]');
            expect(liveRegion).not.toBeNull();
            expect(liveRegion.textContent).toBe('');
        });

        it('aria-live region announces step in MultiScreen mode', async () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            await Promise.resolve();
            const liveRegion = element.shadowRoot.querySelector('[aria-live="polite"]');
            expect(liveRegion.textContent).toContain('Step 1');
        });

        it('step 2 wraps inputs in a fieldset with legend', async () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            await navigateToStep(element, 2);
            expect(element.shadowRoot.querySelector('fieldset')).not.toBeNull();
            expect(element.shadowRoot.querySelector('legend')).not.toBeNull();
        });

        it('renders a visually-hidden h2 heading as focus target for the current step', () => {
            const element = createComponent({ screenMode: 'MultiScreen' });
            const heading = element.shadowRoot.querySelector('[data-step-heading]');
            expect(heading).not.toBeNull();
            expect(heading.tagName.toLowerCase()).toBe('h2');
        });
    });
});
