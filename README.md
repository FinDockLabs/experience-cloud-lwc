# Experience Cloud Payment LWC Templates

LWC components for building payment pages on Experience Cloud as a code-first alternative to Screen Flows. Use this repo when you need full code control over your form's UX — layout, validation, step navigation — while still relying on FinDock's managed `cpm-payment-method-selector` and `cpm-pay-button` components for payment method selection and PaymentIntent submission.

This is the code-first alternative to the [experience-cloud-flow-templates](https://github.com/FinDockLabs/experience-cloud-flow-templates) repo. Both repos use the same managed components; the difference is how the form is assembled: here it is done entirely in LWC, with no Flow configuration required.

## Components

| Component | Tag | Exposed | Purpose |
| --- | --- | --- | --- |
| `paymentForm` | `c-payment-form` | Yes | Drop-in payment form. Replaces a payment Screen Flow. Configurable via Experience Builder design properties. |
| `paymentSelector` | `c-payment-selector` | No | Pro-code wrapper around `cpm-payment-method-selector`. Accepts a simplified flat config and enriches it internally. Used by `paymentForm`; can also be embedded directly in custom LWC forms. |

### `c-payment-form` — Design Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `screenMode` | String | `OneScreen` | `OneScreen` — all steps on one page; `MultiScreen` — three separate steps (Amount, Personal Info, Payment Method) with Back/Next navigation and a progress indicator. |
| `currency` | String | `EUR` | ISO currency code shown in the amount picker (e.g. `EUR`, `USD`, `GBP`). |
| `hideFrequency` | Boolean | `false` | Hide the one-time / recurring frequency toggle. |
| `defaultFrequency` | String | `oneTime` | Pre-selected frequency when the form loads: `oneTime` or `recurring`. |

### `c-payment-selector` — API

Use `c-payment-selector` directly when you want only the payment method selector in a custom LWC form, without the full `c-payment-form` wrapper.

| Property / Event | Type | Description |
| --- | --- | --- |
| `config` | Array or JSON string | The flat payment method config array (see [Payment Method Configuration](#payment-method-configuration)). |
| `frequency` | String | `'onetime'` or `'recurring'` (case-insensitive). Filters the displayed methods by `enabledOneTime` / `enabledRecurring`. Default: `'onetime'`. |
| `paymentIntentResponse` | Object | Optional. Pass the response from `cpm-pay-button` back to the selector for post-payment state. |
| `onpaymentmethodchanged` | Event | Fired when the payer selects a method. `event.detail` contains the enriched entry (`name`, `processor`, `target`, `parameters`) — ready to use as `PaymentMethod` in a PaymentIntent. Bubbles and is composed. |

Example — embedding the selector standalone in a custom LWC:

```html
<c-payment-selector
    config={paymentMethodConfig}
    frequency={frequency}
    onpaymentmethodchanged={handlePaymentMethodChanged}>
</c-payment-selector>
```

## Installation

1. Press the **Deploy to Salesforce** button below.
2. Follow [these instructions](https://help.salesforce.com/s/articleView?id=experience.rss_flow_guestuser.htm&type=5) to set up Guest User access for the site. Make sure the **FinDock Experience Cloud** permission set (included in the FinDock | ProcessingHub package) is assigned to the site's Guest User.
3. Run `npm run generate:config -- --org <alias>` to generate `paymentMethodConfiguration.js` from your org's active payment methods, then fill in the `target` field for each entry. See [Payment Method Configuration](#payment-method-configuration) below for details.
4. Update `SuccessURL` and `FailureURL` in `paymentForm.js` (`_updatePaymentIntentContext`) to point to pages within your Experience Cloud site. These are currently hardcoded (`https://example.com/...`); they will be exposed as `c-payment-form` design properties in a later release so they can be configured in Experience Builder without editing code.
5. Add `c-payment-form` to your Experience Cloud page in Experience Builder. Set the **Screen Mode**, **Currency**, and other design properties as needed.
6. Go to the Experience Cloud Administration → Preferences → enable **Allow guest users to access public APIs**.

### Prerequisites for public (guest-user) pages

For unauthenticated payers the following must all be in place or payments will fail at runtime:

1. **FinDock | ProcessingHub must be installed AND connected** (from FinDock Setup). Installing alone is not enough — the connection step designates an integration user that handles async processing for guest-user payments.
2. **The FinDock Integration User permission set group must be assigned to the ProcessingHub integration user.**
3. **The FinDock Experience Cloud permission set must be assigned to the site's Guest User.**

## Deploy

[![Deploy to Salesforce](https://app.jdeploy.cloud/images/flat.svg)](https://app.jdeploy.cloud/github/FinDockLabs/experience-cloud-lwc/main)

## Payment Method Configuration

Payment methods are defined statically in `paymentMethodConfiguration.js` — no runtime Apex call to `GET /PaymentMethods` is needed. Edit this file to match the payment methods and processors active in your org.

### Generating the config from your org

Use the included script to generate a ready-to-edit `paymentMethodConfiguration.js` from your org's active payment methods.

**Prerequisites:** [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (`sf`) installed and authenticated to the target org.

```bash
npm run generate:config -- --org <orgAlias>
```

Example:

```bash
npm run generate:config -- --org Dev_org
```

The script calls `GET /PaymentMethods` via anonymous Apex, formats the response into the flat config array, and overwrites `paymentMethodConfiguration.js` directly. After it runs:

1. **Fill in the `target` field** for each entry — the script marks these as `TODO` with an inline comment explaining where to find the value (FinDock Setup → Processors & Methods → Accounts tab). The merchant account is not returned by the API, so this step is always manual.
2. **Review `enabledOneTime` / `enabledRecurring`** — the script enables one-time for all methods and recurring only where `supportsRecurring` is `true`. Adjust if needed.
3. **Set `isDefaultOneTime` / `isDefaultRecurring`** — the script pre-selects the first eligible method. Change if a different method should be the default.

**Alternative — Developer Console:** paste `scripts/apex/generate-payment-method-config.apex` into Execute Anonymous, run it, then find the `FDPAYCONFIG:` line in the debug log and copy the JSON from there.

### Config field reference

| Field | Description |
| --- | --- |
| `paymentMethod` | Name of the payment method. Maps to `PaymentMethod.Name` in the PaymentIntent. Source: `PaymentMethods[].Name` from `GET /PaymentMethods`. |
| `paymentProcessor` | Name of the FinDock processor package (e.g. `PaymentHub-Stripe`). Maps to `PaymentMethod.Processor`. Source: `PaymentMethods[].Processors[].Name`. |
| `target` | Merchant account name. Maps to `PaymentMethod.Target`. Find it in FinDock Setup → Processors & Methods → Accounts tab. Not returned by the API — must be filled in manually. |
| `enabledOneTime` | Show this method for one-time payments. |
| `enabledRecurring` | Show this method for recurring payments. Must be `false` when `supportsRecurring` is `false`. |
| `isDefaultOneTime` | Pre-select this method for one-time payments. Exactly one entry should be `true`. |
| `isDefaultRecurring` | Pre-select this method for recurring payments. Exactly one entry where `enabledRecurring` is `true` should be `true`. |
| `supportsRecurring` | Whether the processor supports recurring payments for this method. Source: `SupportsRecurring` from `GET /PaymentMethods`. Defaults to `enabledRecurring` when omitted. |
| `displayLabel` | Label shown to the payer. Defaults to `paymentMethod` when omitted. |
| `redirectInstruction` | Message shown before PSP redirect (e.g. for iDEAL, Bancontact). Omit when there is no redirect. |
| `parameters` | Array of additional processor parameters (e.g. `locale`, `description`). `null` or omit when none. Each entry: `name`, `value`, `visibleToCustomer`, `displayLabel`, `required`, `data_type`, `description`. |

## How it works

`c-payment-form` assembles the PaymentIntent reactively from form state (amount, frequency, personal info, selected payment method) and passes the whole object to `cpm-pay-button` via the `payment-intent` property. The managed Pay Button calls `cpm.API_PaymentIntent_V2.postPaymentIntent()` in-transaction and handles the PSP redirect — no custom Apex controller is needed.

The Pay Button is disabled until all required fields are filled and a payment method is selected.

`c-payment-selector` wraps the managed `cpm-payment-method-selector` component. It accepts the simplified flat config from `paymentMethodConfiguration.js`, enriches it into the format the managed component expects (mapping `paymentMethod` → `name`, `paymentProcessor` → `processor`, generating the `key`, etc.), and re-fires the `paymentmethodchanged` event with `bubbles: true, composed: true` so it propagates through shadow DOM.

To add pre- or post-payment Apex logic, or to change the PaymentIntent shape beyond what the component supports, fork `paymentForm` or build a custom LWC that embeds `c-payment-selector` and `cpm-pay-button` directly.
