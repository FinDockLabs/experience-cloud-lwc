import { createElement } from 'lwc';
import PaymentForm from 'c/paymentForm';

// toBeAccessible() is registered globally by jest.setup.a11y.js via @sa11y/jest setup().
// It runs axe-core with Salesforce preset rules covering WCAG 2.1 AA + WCAG 2.2 AA
// success criteria that can be verified automatically.

function createComponent(props = {}) {
    const element = createElement('c-payment-form', { is: PaymentForm });
    Object.assign(element, { screenMode: 'OneScreen', ...props });
    document.body.appendChild(element);
    return element;
}

async function navigateToStep(element, step) {
    if (step >= 2) {
        element.shadowRoot.querySelector('c-amount-and-frequency').dispatchEvent(
            new CustomEvent('amountfrequencychange', {
                detail: { amountOneTime: 25, amountRecurring: null, frequency: 'oneTime' }
            })
        );
        await Promise.resolve();
        element.shadowRoot.querySelector('lightning-button[data-id="next"]').click();
        await Promise.resolve();
    }
    if (step >= 3) {
        element.shadowRoot.querySelector('lightning-button[data-id="next"]').click();
        await Promise.resolve();
    }
}

describe('c-payment-form WCAG 2.2 AA accessibility', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.useRealTimers();
    });

    // ── 1. OneScreen default state ───────────────────────────────────────────────
    // Covers: 1.3.1 Info and Relationships, 4.1.2 Name, Role, Value
    // All sections visible at once — no step navigation, no ARIA announcements needed.
    it('passes axe scan in OneScreen mode (default state)', async () => {
        const element = createComponent({ screenMode: 'OneScreen' });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 2. MultiScreen step 1 ────────────────────────────────────────────────────
    // Covers: 4.1.3 Status Messages
    // aria-live="polite" region must be present; progress indicator rendered.
    it('passes axe scan in MultiScreen mode on step 1', async () => {
        const element = createComponent({ screenMode: 'MultiScreen' });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });

    // ── 3. MultiScreen step 2 — personal information ─────────────────────────────
    // Covers: 1.3.1 Info and Relationships
    // Input fields must be inside a <fieldset>/<legend> group. axe verifies that
    // form controls have programmatically associated labels and grouping context.
    it('passes axe scan in MultiScreen mode on step 2 (personal information)', async () => {
        const element = createComponent({ screenMode: 'MultiScreen' });
        await navigateToStep(element, 2);
        await expect(element).toBeAccessible();
    });

    // ── 4. MultiScreen step 3 — payment method ───────────────────────────────────
    // The payment method selector is a managed component stub in tests.
    // axe validates our surrounding structure (Back button, step heading).
    it('passes axe scan in MultiScreen mode on step 3 (payment method)', async () => {
        const element = createComponent({ screenMode: 'MultiScreen' });
        await navigateToStep(element, 3);
        await expect(element).toBeAccessible();
    });

    // ── 5. aria-live region is present and polite ─────────────────────────────────
    // Covers: WCAG 4.1.3 Status Messages
    // Screen readers must receive an automatic announcement when the step changes.
    // aria-live="polite" waits for the user to finish before reading the update.
    it('has an aria-live="polite" region for step transition announcements', async () => {
        const element = createComponent({ screenMode: 'MultiScreen' });
        await Promise.resolve();

        const liveRegion = element.shadowRoot.querySelector('[aria-live="polite"]');
        expect(liveRegion).not.toBeNull();
        expect(liveRegion.getAttribute('aria-atomic')).toBe('true');

        await expect(element).toBeAccessible();
    });

    // ── 6. aria-live region contains a step announcement in MultiScreen ───────────
    // Covers: WCAG 4.1.3 Status Messages
    // The stepAnnouncement getter is synchronous — no timer needed. Announces
    // "Step N of 3: <section name>" immediately when currentStep changes.
    it('aria-live region announces the current step in MultiScreen mode', async () => {
        const element = createComponent({ screenMode: 'MultiScreen' });
        await Promise.resolve();

        const liveRegion = element.shadowRoot.querySelector('[aria-live="polite"]');
        expect(liveRegion.textContent).toContain('Step 1');
        expect(liveRegion.textContent).toContain('Amount and Frequency');

        await expect(element).toBeAccessible();
    });

    // ── 7. aria-live region is silent in OneScreen mode ───────────────────────────
    // Covers: WCAG 4.1.3 Status Messages
    // In OneScreen mode there are no step transitions, so no announcement is needed.
    // An empty live region must not cause axe violations.
    it('aria-live region is empty and passes axe in OneScreen mode', async () => {
        const element = createComponent({ screenMode: 'OneScreen' });
        await Promise.resolve();

        const liveRegion = element.shadowRoot.querySelector('[aria-live="polite"]');
        expect(liveRegion.textContent).toBe('');

        await expect(element).toBeAccessible();
    });

    // ── 8. Visually-hidden step headings are present and focusable ────────────────
    // Covers: WCAG 2.4.6 Headings and Labels, WCAG 2.4.3 Focus Order
    // Each step renders an <h2> with tabindex="-1" so renderedCallback can move
    // focus to it on step change. tabindex="-1" keeps it out of the natural tab
    // order while making it programmatically focusable.
    it('step heading is an h2 with tabindex="-1" for focus management', async () => {
        const element = createComponent({ screenMode: 'MultiScreen' });
        await Promise.resolve();

        const heading = element.shadowRoot.querySelector('[data-step-heading]');
        expect(heading).not.toBeNull();
        expect(heading.tagName.toLowerCase()).toBe('h2');
        expect(heading.getAttribute('tabindex')).toBe('-1');

        await expect(element).toBeAccessible();
    });

    // ── 9. Personal information section is grouped with fieldset / legend ─────────
    // Covers: WCAG 1.3.1 Info and Relationships
    // Related inputs (firstName, lastName, email) must be inside a <fieldset> with
    // a <legend> so screen readers can identify the group and its purpose.
    it('personal information inputs are wrapped in fieldset with legend', async () => {
        const element = createComponent({ screenMode: 'MultiScreen' });
        await navigateToStep(element, 2);

        const fieldset = element.shadowRoot.querySelector('fieldset');
        const legend = element.shadowRoot.querySelector('legend');
        expect(fieldset).not.toBeNull();
        expect(legend).not.toBeNull();

        await expect(element).toBeAccessible();
    });

    // ── 10. hideFrequency=true — no frequency toggle visible ─────────────────────
    // Covers: WCAG 1.3.1 Info and Relationships
    // Hiding the frequency toggle should not introduce broken ARIA relationships.
    it('passes axe scan when frequency toggle is hidden', async () => {
        const element = createComponent({ screenMode: 'OneScreen', hideFrequency: true });
        await Promise.resolve();
        await expect(element).toBeAccessible();
    });
});
