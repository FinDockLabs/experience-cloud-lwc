# Experience Cloud Payment LWC Templates

This repository contains building blocks to help you build custom Lightning Web Components (LWC) for digital payment experiences using Experience Cloud and FinDock Payment Experiences. Use this repository when you need full control over layout, validation, step, navigation, etc. Your custom LWC leverages the built-in capabilities of FinDock's [Payment Method Selector](https://docs.findock.com/docs/july-26/payments/payment-method-selector) and [Pay Button](https://docs.findock.com/docs/july-26/payments/pay-button) managed LWCs.

This is the code-first alternative to using our managed LWCs directly in Flows. For other options, see [Templates for FinDock Payment Experiences](https://github.com/FinDockLabs/experience-cloud-templates). 

## Deploy

Note: This deploys an example LWC wrapper around FinDock's components. Both out of the box components are part of the FinDock managed package and can be used without the code in this repository.

[![Deploy to Salesforce](https://app.jdeploy.cloud/images/flat.svg)](https://app.jdeploy.cloud/github/FinDockLabs/experience-cloud-lwc/main)

## Components

| Component | Tag | Exposed | Purpose |
| --- | --- | --- | --- |
| `paymentForm` | `c-payment-form` | Yes | Drop-in payment form component that includes both `c-payment-selector` and `cpm-pay-button`. Replaces a payment Screen Flow. Configurable via Experience Builder design properties. |
| `paymentSelector` | `c-payment-selector` | No | Pro-code wrapper around `cpm-payment-method-selector`. Accepts a simplified flat config and enriches it internally. Used by `paymentForm`; can also be embedded directly in custom LWC forms. |

### `c-payment-form` — Design Properties

Out of the box, the payment form uses fixed amount and frequency values. The form displays them as read-only, and the payer fills in their contact details and picks a payment method (a fixed-checkout model). To let the payer choose the amount, fork the form or embed `c-payment-selector` in a custom LWC with your own input.

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `currency` | String | `EUR` | ISO currency code shown next to the amount (e.g. `EUR`, `USD`, `GBP`). |
| `amount` | Integer | — | Amount the payer is charged, preset and displayed as read-only. |
| `defaultFrequency` | String | `One time` | Payment frequency, preset and displayed as read-only. In App Builder / Experience Builder choose `One time` or `Monthly` (the legacy `oneTime`/`recurring` codes are also accepted programmatically). |

Recurring payments are sent with `Recurring.Frequency: 'Monthly'` — the only frequency currently supported. Add a configurable frequency property if another frequency is needed.

`Recurring.StartDate` is required by the Payment API (`yyyy-mm-dd`) for every source, so the form always sends it, defaulting to **today** (payer's local time). It is the *earliest* collection date — the API normalises the exact day to the org's payment schedule (e.g. day-of-month), so the day sent here need not be exact.

### `c-payment-selector` — API

Use `c-payment-selector` directly when you want only the payment method selector in a custom LWC form, without the full `c-payment-form` wrapper.

| Property / Event | Type | Description |
| --- | --- | --- |
| `config` | Array or JSON string | The flat payment method config array (see [Payment Method Configuration](#payment-method-configuration)). |
| `frequency` | String | `'onetime'` or `'recurring'` (case-insensitive). Filters the displayed methods by `enabledOneTime` / `enabledRecurring`. Default: `'onetime'`. |
| `paymentIntentResponse` | Object | Optional. Pass the response from `cpm-pay-button` back to the selector for post-payment state. |
| `onpaymentmethodchanged` | Event | Fired when the payer selects a method. `event.detail` contains the enriched entry (`name`, `processor`, `target`, `parameters`) — ready to use as `PaymentMethod` in a PaymentIntent. Bubbles and is composed. |

Example — embedding the standalone selector in a custom LWC:

```html
<c-payment-selector
    config={paymentMethodConfig}
    frequency={frequency}
    onpaymentmethodchanged={handlePaymentMethodChanged}>
</c-payment-selector>
```

## Installation

1. Click the **Deploy to Salesforce** button above.
2. If the site needs to accept payments from unauthenticated (guest) users, complete the **Experience Cloud & Guest User Setup** steps in [experience-cloud-templates](https://github.com/FinDockLabs/experience-cloud-templates) first — payments will fail at runtime otherwise, even though the page renders correctly.
3. Run `npm run generate:config -- --org <alias>` to generate `paymentMethodConfiguration.js` from your org's active payment methods, then fill in the `target` field for each entry. See [Payment Method Configuration](#payment-method-configuration) below for details.
4. Update `SuccessURL` and `FailureURL` in `paymentForm.js` (`_updatePaymentIntentContext`) to point to pages within your Experience Cloud site. These are currently hardcoded (`https://example.com/...`); they will be exposed as `c-payment-form` design properties in a later release so they can be configured in Experience Builder without editing code.
5. Add `c-payment-form` to your Experience Cloud page in Experience Builder. Set the **Currency**, **Amount**, and other design properties as needed.

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

The script calls `GET /PaymentMethods` via anonymous Apex, formats the response into the flat config array, and overwrites `paymentMethodConfiguration.js` directly. Entries are sorted by `paymentProcessor` first, then `paymentMethod`, so methods for the same processor stay grouped together. After it runs:

1. **Fill in the `target` field** for each entry — it's left empty by the script. Find the value in FinDock Setup → Processors & Methods → Accounts tab. The merchant account is not returned by the API, so this step is always manual.
2. **Review `enabledOneTime` / `enabledRecurring`** — the script enables one-time for all methods and recurring only where `supportsRecurring` is `true`. Adjust if needed.
3. **Set `isDefaultOneTime` / `isDefaultRecurring`** — the script pre-selects the first entry in the sorted list. Change if a different method should be the default.

**Alternative — Developer Console:** paste `scripts/apex/generate-payment-method-config.apex` into Execute Anonymous, run it, then find the `FDPAYCONFIG:` line in the debug log and copy the JSON from there.

### Config field reference

| Field | Description |
| --- | --- |
| `paymentProcessor` | Name of the FinDock processor package (e.g. `PaymentHub-Stripe`). Maps to `PaymentMethod.Processor`. Source: `PaymentMethods[].Processors[].Name`. |
| `paymentMethod` | Name of the payment method. Maps to `PaymentMethod.Name` in the PaymentIntent. Source: `PaymentMethods[].Name` from `GET /PaymentMethods`. |
| `target` | Merchant account name. Maps to `PaymentMethod.Target`. Find it in FinDock Setup → Processors & Methods → Accounts tab. Not returned by the API — must be filled in manually. Optional: leave empty to use the processor's default account, but the processor must have at least one account configured. |
| `enabledOneTime` | Show this method for one-time payments. |
| `enabledRecurring` | Show this method for recurring payments. Must be `false` when `supportsRecurring` is `false`. |
| `isDefaultOneTime` | Pre-select this method for one-time payments. Exactly one entry should be `true`. |
| `isDefaultRecurring` | Pre-select this method for recurring payments. Exactly one entry where `enabledRecurring` is `true` should be `true`. |
| `supportsRecurring` | Whether the processor supports recurring payments for this method. Source: `SupportsRecurring` from `GET /PaymentMethods`. Defaults to `enabledRecurring` when omitted. |
| `initialPaymentOnRecurring` | The method's policy for carrying an initial (first) payment on a recurring payment. One of `'required'`, `'optional'`, `'unsupported'`, `'no'`. Source: `InitialPaymentOnRecurring` from `GET /PaymentMethods`. Defaults to `'unsupported'` when omitted. The form adds an initial `OneTime` payment only for `'required'` methods. See below. |
| `displayLabel` | Label shown to the payer. Defaults to `paymentMethod` when omitted. |
| `redirectInstruction` | Message shown before PSP redirect (e.g. for iDEAL, Bancontact). Omit when there is no redirect. |
| `parameters` | Array of additional processor parameters (e.g. `locale`, `description`). `null` or omit when none. Each entry: `name`, `value`, `visibleToCustomer`, `displayLabel`, `required`, `data_type`, `description`. |

Note that `supportsRecurring` is different from `enabledRecurring`: the former indicates the processor's technical capability, the latter determines if the method is available to the payer. The managed `cpm-payment-method-selector` filters methods on the Recurring tab with `supportsRecurring && enabledRecurring`, so it acts as a runtime guard — if `enabledRecurring` is mistakenly set `true` on a method that doesn't actually support recurring, the method still won't appear on the recurring tab. Keep both fields consistent per the constraint above rather than relying on only one.

### Recurring with an initial payment

Some methods take a first payment up front when a recurring payment is set up. `paymentForm` adds an initial `OneTime` block **only when the method's `initialPaymentOnRecurring` is `required`** (the first payment is then charged immediately); `optional` / `unsupported` methods set up the mandate only. The value is sourced from the org per method, so regenerate the config with `npm run generate:config` rather than hardcoding it.

See [Initial payments for recurring payments](https://docs.findock.com/api/initial-payments-for-recurring-payments) for the full behavior and per-processor support.

### Flat parameter fields

| Field | Meaning |
| --- | --- |
| `name` | Parameter key (maps to `PaymentMethod.Parameters[name]`). Source: `Parameters[].Name` from `GET /PaymentMethods` |
| `value` | Value sent to the processor. Leave empty for payer-filled fields |
| `visibleToCustomer` | `true` → render as an input for the payer; `false` → send silently (default) |
| `displayLabel` | Label shown to the payer when `visibleToCustomer` is `true`. Defaults to `name` |
| `required` | Indicates if the processor requires this parameter |
| `data_type` | `String`, `Enum`, `Boolean`, or `Number` |
| `description` | Explanation of the parameter (for internal use and guidance) |

## How it works

`c-payment-form` assembles the PaymentIntent reactively from the configured amount and frequency plus form state (personal info, selected payment method) and passes the whole object to `cpm-pay-button` via the `payment-intent` property. The managed Pay Button component calls `cpm.API_PaymentIntent_V2.postPaymentIntent()` in-transaction and handles the PSP redirect — no custom Apex controller is needed.

The Pay Button is disabled until all required fields are filled and a payment method is selected.

`c-payment-selector` wraps the managed `cpm-payment-method-selector` component. It accepts the simplified flat config from `paymentMethodConfiguration.js`, enriches it into the format the managed component expects (mapping `paymentMethod` → `name`, `paymentProcessor` → `processor`, generating the `key`, etc.), and re-fires the `paymentmethodchanged` event with `bubbles: true, composed: true` so it propagates through shadow DOM.

To add pre- or post-payment Apex logic, or to change the PaymentIntent shape beyond what the component supports, fork `paymentForm` or build a custom LWC that embeds `c-payment-selector` and `cpm-pay-button` directly.

## Handling payment errors

When a payment fails, the managed `cpm-pay-button` broadcasts a `PAYMENT_ERROR` message on the `findockPaymentFlow` Lightning Message Channel. The classification is done server-side; the browser only receives the resolved values.

**Message body**

| Field | Meaning |
| --- | --- |
| `statusCode` | HTTP status of the PaymentIntent call. `200` on success, `422` when the request was well-formed but rejected (e.g. invalid data), other `4xx`/`5xx` on failure. |
| `errorCode` | FinDock error code, e.g. `202` (invalid IBAN). Used to route the error to a specific payment-method input. Null when the failure has no code. |
| `errorMessage` | Raw provider message (technical, locale-dependent). Prefer `errorLabel` for what you show the payer. |
| `errorLabel` | Payer-facing summary message, categorised server-side from the code (recoverable bank-detail issue, configuration problem, invalid data, or generic). |

See the full **Error and response codes** list in the [Payment API reference](https://docs.findock.com/api).

**What the components do out of the box**

- **Field-level errors** (bank-detail codes `201`–`206`) are highlighted inline on the matching input by the managed `cpm-payment-method-selector` — no code needed.
- **Everything else** is shown by `c-payment-form` as a summary banner using `errorLabel`. When the error is field-level, the banner is suppressed so the message only appears on the field.

**Extending / customizing**

To add your own handling (redirect to a failure page, logging, custom copy, analytics), subscribe to the channel in a custom component and branch on `errorCode` / `statusCode`:

```js
import { subscribe, MessageContext } from 'lightning/messageService';
import FINDOCK_PAYMENT_FLOW from '@salesforce/messageChannel/cpm__findockPaymentFlow__c';
import { PAYMENT_FLOW_MESSAGE_TYPES } from 'cpm/paymentFlowChannel';

// in connectedCallback: subscribe and dispatch on message.type
handlePaymentFlowMessage(message) {
    if (message?.type === PAYMENT_FLOW_MESSAGE_TYPES.PAYMENT_ERROR) {
        const { statusCode, errorCode, errorLabel } = message.body;
        // e.g. show errorLabel, or redirect to your failure URL for non-recoverable errors
    }
}
```

Or, for post-payment handling on the button itself, read the `PaymentIntentResponseContext` returned by `cpm-pay-button` (same `statusCode` / `errorCode` / `errorMessage` / `errorLabel` fields).
