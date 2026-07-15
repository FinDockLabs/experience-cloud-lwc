import { LightningElement, api, wire } from 'lwc';
import getPaymentMethods from '@salesforce/apex/PaymentMethodSourceController.getPaymentMethods';

export default class PaymentSelector extends LightningElement {
    @api frequency = 'onetime';
    @api paymentGroupId;

    @api
    get config() {
        return this._config;
    }
    set config(value) {
        this._config = value;
    }

    _config;
    _liveMethodsIndex = null;

    get enrichedConfigString() {
        const enriched = this._buildConfig(this._config);
        return enriched ? JSON.stringify(enriched) : null;
    }

    get normalizedFrequency() {
        return (this.frequency ?? 'onetime').toLowerCase();
    }

    @wire(getPaymentMethods)
    wiredPaymentMethods({ data, error }) {
        if (data) {
            this._liveMethodsIndex = this._indexPaymentMethods(data);
        } else if (error) {
            this._liveMethodsIndex = null;
        }
    }

    _indexPaymentMethods(methods) {
        const index = new Map();
        for (const method of methods ?? []) {
            for (const proc of method.processors ?? []) {
                index.set(`${method.name}::${proc.name}`, proc);
            }
        }
        return index;
    }

    _buildConfig(value) {
        if (!value) return null;
        try {
            const input = typeof value === 'string' ? JSON.parse(value) : value;
            if (!Array.isArray(input) || input.length === 0) return null;
            return input.map(m => this._enrich(m));
        } catch (e) {
            console.error('[paymentSelector] Failed to parse config:', e);
            return null;
        }
    }

    _enrich(m) {
        const live = this._liveMethodsIndex?.get(`${m.paymentMethod}::${m.paymentProcessor}`);
        return {
            key: `${m.paymentProcessor}-${m.paymentMethod}`,
            name: m.paymentMethod,
            processor: m.paymentProcessor,
            processorPrettyName: m.processorPrettyName ?? m.paymentProcessor,
            processorFriendlyName: m.processorFriendlyName ?? m.paymentProcessor,
            merchantAccount: m.target,
            merchantAccountGroup: 'static',
            target: m.target,
            displayLabel: m.displayLabel ?? m.paymentMethod,
            redirectInstruction: m.redirectInstruction ?? '',
            enabledOneTime: m.enabledOneTime ?? false,
            enabledRecurring: m.enabledRecurring ?? false,
            isDefaultOneTime: m.isDefaultOneTime ?? false,
            isDefaultRecurring: m.isDefaultRecurring ?? false,
            supportsRecurring: live?.supportsRecurring ?? m.enabledRecurring ?? false,
            initialPaymentOnRecurring: live?.initialPaymentOnRecurring ?? 'unsupported',
            active: true,
            parameters: this._enrichParameters(m.parameters, live?.parameters)
        };
    }

    _enrichParameters(parameters, liveParameters) {
        const liveByName = new Map((liveParameters ?? []).map(p => [p.name, p]));
        return (parameters ?? []).map(p => ({
            name: p.name,
            value: p.value ?? '',
            visibleToCustomer: p.visibleToCustomer ?? false,
            displayLabel: p.displayLabel ?? p.name,
            required: p.required ?? false,
            data_type: liveByName.get(p.name)?.dataType ?? 'String',
            description: p.description ?? ''
        }));
    }

    handlePaymentMethodChanged(event) {
        event.stopPropagation();
        this.dispatchEvent(new CustomEvent('paymentmethodchanged', {
            detail: event.detail,
            bubbles: true,
            composed: true
        }));
    }
}
