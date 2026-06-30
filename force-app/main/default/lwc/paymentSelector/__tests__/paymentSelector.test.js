import { createElement } from 'lwc';
import PaymentSelector from 'c/paymentSelector';

const MOCK_CONFIG = [
    {
        paymentMethod: 'CreditCard',
        paymentProcessor: 'PaymentHub-Stripe',
        target: 'Stripe-Main-Account',
        enabledOneTime: true,
        enabledRecurring: true,
        isDefaultOneTime: true,
        isDefaultRecurring: false,
        supportsRecurring: true,
        displayLabel: 'Credit Card',
        parameters: [
            {
                name: 'locale',
                value: 'nl-NL',
                visibleToCustomer: false,
                data_type: 'String',
                description: 'Locale string'
            }
        ]
    },
    {
        paymentMethod: 'Ideal',
        paymentProcessor: 'PaymentHub-Stripe',
        target: 'Stripe-Main-Account',
        enabledOneTime: true,
        enabledRecurring: false,
        isDefaultOneTime: false,
        isDefaultRecurring: false,
        supportsRecurring: false,
        displayLabel: 'iDEAL',
        redirectInstruction: 'You will be redirected to your bank.'
    }
];

function createComponent(props = {}) {
    const element = createElement('c-payment-selector', { is: PaymentSelector });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

// payment-method-config is an LWC property, not an HTML attribute — access via JS property
function getParsedConfig(element) {
    const selector = element.shadowRoot.querySelector('cpm-payment-method-selector');
    const value = selector.paymentMethodConfig;
    return value ? JSON.parse(value) : null;
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
});

describe('paymentSelector', () => {
    describe('config enrichment', () => {
        it('passes enriched config as JSON string', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const parsed = getParsedConfig(element);
            expect(parsed).toHaveLength(2);
        });

        it('builds key as processor-method with single dash', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const [first] = getParsedConfig(element);
            expect(first.key).toBe('PaymentHub-Stripe-CreditCard');
        });

        it('maps target to both target and merchantAccount', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const [first] = getParsedConfig(element);
            expect(first.target).toBe('Stripe-Main-Account');
            expect(first.merchantAccount).toBe('Stripe-Main-Account');
        });

        it('falls back processorPrettyName and processorFriendlyName to paymentProcessor', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const [first] = getParsedConfig(element);
            expect(first.processorPrettyName).toBe('PaymentHub-Stripe');
            expect(first.processorFriendlyName).toBe('PaymentHub-Stripe');
        });

        it('preserves custom processorPrettyName and processorFriendlyName when provided', () => {
            const config = [{ ...MOCK_CONFIG[0], processorPrettyName: 'Stripe', processorFriendlyName: 'Stripe Payments' }];
            const element = createComponent({ config });
            const [first] = getParsedConfig(element);
            expect(first.processorPrettyName).toBe('Stripe');
            expect(first.processorFriendlyName).toBe('Stripe Payments');
        });

        it('always sets active to true', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            getParsedConfig(element).forEach(m => expect(m.active).toBe(true));
        });

        it('uses supportsRecurring from enabledRecurring when not explicitly set', () => {
            const config = [{ ...MOCK_CONFIG[0] }];
            delete config[0].supportsRecurring;
            const element = createComponent({ config });
            const [first] = getParsedConfig(element);
            expect(first.supportsRecurring).toBe(true);
        });

        it('defaults boolean flags to false when omitted', () => {
            const config = [{ paymentMethod: 'CreditCard', paymentProcessor: 'TestProcessor', target: 'acc' }];
            const element = createComponent({ config });
            const [first] = getParsedConfig(element);
            expect(first.enabledOneTime).toBe(false);
            expect(first.enabledRecurring).toBe(false);
            expect(first.isDefaultOneTime).toBe(false);
            expect(first.isDefaultRecurring).toBe(false);
        });

        it('defaults redirectInstruction to empty string when omitted', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const [first] = getParsedConfig(element);
            expect(first.redirectInstruction).toBe('');
        });

        it('preserves redirectInstruction when provided', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const [, second] = getParsedConfig(element);
            expect(second.redirectInstruction).toBe('You will be redirected to your bank.');
        });
    });

    describe('parameter enrichment', () => {
        it('uses data_type when present', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const [first] = getParsedConfig(element);
            expect(first.parameters[0].data_type).toBe('String');
        });

        it('falls back to dataType (camelCase) when data_type is absent', () => {
            const config = [{ ...MOCK_CONFIG[0], parameters: [{ name: 'locale', dataType: 'String' }] }];
            const element = createComponent({ config });
            const [first] = getParsedConfig(element);
            expect(first.parameters[0].data_type).toBe('String');
        });

        it('defaults data_type to String when neither field is present', () => {
            const config = [{ ...MOCK_CONFIG[0], parameters: [{ name: 'locale' }] }];
            const element = createComponent({ config });
            const [first] = getParsedConfig(element);
            expect(first.parameters[0].data_type).toBe('String');
        });

        it('defaults visibleToCustomer to false', () => {
            const config = [{ ...MOCK_CONFIG[0], parameters: [{ name: 'locale' }] }];
            const element = createComponent({ config });
            const [first] = getParsedConfig(element);
            expect(first.parameters[0].visibleToCustomer).toBe(false);
        });

        it('defaults displayLabel to name', () => {
            const config = [{ ...MOCK_CONFIG[0], parameters: [{ name: 'locale' }] }];
            const element = createComponent({ config });
            const [first] = getParsedConfig(element);
            expect(first.parameters[0].displayLabel).toBe('locale');
        });

        it('defaults value to empty string', () => {
            const config = [{ ...MOCK_CONFIG[0], parameters: [{ name: 'locale' }] }];
            const element = createComponent({ config });
            const [first] = getParsedConfig(element);
            expect(first.parameters[0].value).toBe('');
        });

        it('handles methods with no parameters', () => {
            const config = [{ ...MOCK_CONFIG[1] }];
            const element = createComponent({ config });
            const [first] = getParsedConfig(element);
            expect(first.parameters).toEqual([]);
        });
    });

    describe('frequency normalization', () => {
        it('lowercases the frequency value', () => {
            const element = createComponent({ config: MOCK_CONFIG, frequency: 'Recurring' });
            const selector = element.shadowRoot.querySelector('cpm-payment-method-selector');
            expect(selector.frequency).toBe('recurring');
        });

        it('defaults to onetime when frequency is not set', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const selector = element.shadowRoot.querySelector('cpm-payment-method-selector');
            expect(selector.frequency).toBe('onetime');
        });
    });

    describe('edge cases', () => {
        it('passes null config when config is not set', () => {
            const element = createComponent();
            const selector = element.shadowRoot.querySelector('cpm-payment-method-selector');
            expect(selector.paymentMethodConfig).toBeNull();
        });

        it('passes null config when config is an empty array', () => {
            const element = createComponent({ config: [] });
            const selector = element.shadowRoot.querySelector('cpm-payment-method-selector');
            expect(selector.paymentMethodConfig).toBeNull();
        });

        it('accepts config as a JSON string', () => {
            const element = createComponent({ config: JSON.stringify(MOCK_CONFIG) });
            const parsed = getParsedConfig(element);
            expect(parsed).toHaveLength(2);
        });

        it('passes null config when config is invalid JSON', () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            const element = createComponent({ config: 'not-valid-json' });
            const selector = element.shadowRoot.querySelector('cpm-payment-method-selector');
            expect(selector.paymentMethodConfig).toBeNull();
            jest.restoreAllMocks();
        });
    });

    describe('event handling', () => {
        it('re-emits paymentmethodchanged from the managed selector', () => {
            const element = createComponent({ config: MOCK_CONFIG });
            const handler = jest.fn();
            element.addEventListener('paymentmethodchanged', handler);

            element.shadowRoot.querySelector('cpm-payment-method-selector').dispatchEvent(
                new CustomEvent('paymentmethodchanged', {
                    detail: { name: 'CreditCard', processor: 'PaymentHub-Stripe' },
                    bubbles: true,
                    composed: true
                })
            );

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][0].detail).toEqual({
                name: 'CreditCard',
                processor: 'PaymentHub-Stripe'
            });
        });
    });
});
