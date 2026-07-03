import { createElement } from 'lwc';
import PaymentForm from 'c/paymentForm';

// toBeAccessible() is registered globally by jest.setup.a11y.js via @sa11y/jest setup().
// It runs axe-core with Salesforce preset rules covering WCAG 2.1 AA + WCAG 2.2 AA
// success criteria that can be verified automatically.

function createComponent(props = {}) {
    const element = createElement('c-payment-form', { is: PaymentForm });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

describe('c-payment-form WCAG 2.2 AA accessibility', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.useRealTimers();
    });

    // ── 1. Default state ─────────────────────────────────────────────────────────
    // Covers: 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value
    // All sections visible at once — no step navigation, no ARIA announcements needed.
    it('passes axe scan in the default state', async () => {
        const element = createComponent();
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 2. Personal information is grouped with fieldset / legend ────────────────
    // Covers: WCAG 1.3.1 Info and Relationships
    // Related inputs (firstName, lastName, email) must be inside a <fieldset> with
    // a <legend> so screen readers can identify the group and its purpose.
    it('personal information inputs are wrapped in fieldset with legend', async () => {
        const element = createComponent();
        await Promise.resolve();

        const fieldset = element.shadowRoot.querySelector('fieldset');
        const legend = element.shadowRoot.querySelector('legend');
        expect(fieldset).not.toBeNull();
        expect(legend).not.toBeNull();

        await expect(element).toBeAccessible();
    });

    // ── 3. showFrequency=false — no frequency toggle visible ─────────────────────
    // Covers: WCAG 1.3.1 Info and Relationships
    // Hiding the frequency toggle should not introduce broken ARIA relationships.
    it('passes axe scan when frequency toggle is hidden', async () => {
        const element = createComponent({ showFrequency: false });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });
});
