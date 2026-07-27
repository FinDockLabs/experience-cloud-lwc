import { createElement } from 'lwc';
import currencyPickerConfig from 'c/currencyPickerConfig';
import getActiveCurrencyIsoCodes from '@salesforce/apex/CurrencyPickerController.getActiveCurrencyIsoCodes';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function mount(inputVariables = []) {
    const element = createElement('c-currency-picker-cpe', { is: currencyPickerConfig });
    element.inputVariables = inputVariables;
    document.body.appendChild(element);
    return element;
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
});

describe('c-currency-picker-cpe', () => {
    it('populates the multi-select options from the org active currencies (Apex)', async () => {
        getActiveCurrencyIsoCodes.mockResolvedValueOnce(['EUR', 'USD', 'GBP']);
        const element = mount([]);
        await flush();
        const dual = element.shadowRoot.querySelector('lightning-dual-listbox');
        expect(dual.options.map((o) => o.value)).toEqual(['EUR', 'USD', 'GBP']);
    });

    it('pre-fills the multi-select from the allowedCurrencies CSV input variable', () => {
        const element = mount([{ name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' }]);
        const dual = element.shadowRoot.querySelector('lightning-dual-listbox');
        expect(dual.value).toEqual(['EUR', 'USD']);
    });

    it('limits the default single-select to the selected available currencies', () => {
        const element = mount([{ name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' }]);
        const combo = element.shadowRoot.querySelector('lightning-combobox[data-name="defaultCurrency"]')
            || element.shadowRoot.querySelectorAll('lightning-combobox')[0];
        expect(combo.options.map((o) => o.value)).toEqual(['EUR', 'USD']);
    });

    it('writes the available currencies back as CSV', () => {
        const element = mount([]);
        const changed = [];
        element.addEventListener('configuration_editor_input_value_changed', (e) => changed.push(e.detail));
        element.shadowRoot.querySelector('lightning-dual-listbox').dispatchEvent(
            new CustomEvent('change', { detail: { value: ['EUR', 'USD'] } })
        );
        expect(changed).toContainEqual({ name: 'allowedCurrencies', newValue: 'EUR,USD', newValueDataType: 'String' });
    });

    it('clears the default when it is removed from the available currencies', () => {
        const element = mount([
            { name: 'allowedCurrencies', value: 'EUR,USD', valueDataType: 'String' },
            { name: 'defaultCurrency', value: 'USD', valueDataType: 'String' }
        ]);
        const changed = [];
        element.addEventListener('configuration_editor_input_value_changed', (e) => changed.push(e.detail));
        // Remove USD → only EUR remains; default USD is no longer valid.
        element.shadowRoot.querySelector('lightning-dual-listbox').dispatchEvent(
            new CustomEvent('change', { detail: { value: ['EUR'] } })
        );
        expect(changed).toContainEqual({ name: 'allowedCurrencies', newValue: 'EUR', newValueDataType: 'String' });
        expect(changed).toContainEqual({ name: 'defaultCurrency', newValue: '', newValueDataType: 'String' });
    });
});
