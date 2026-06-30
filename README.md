# Experience Cloud Payment LWC Templates

LWC components for building payment pages on Experience Cloud **without using Flow**. Use this repo when you need full code control over your form's UX — layout, validation, step navigation — while still relying on FinDock's managed `cpm-payment-method-selector` and `cpm-pay-button` components for payment method selection and PaymentIntent submission.

This is the code-first alternative to the [experience-cloud-flow-templates](https://github.com/FinDockLabs/experience-cloud-flow-templates) repo. Both repos use the same managed components; the difference is how the form is assembled: here it is done entirely in LWC.

## Components

| Component | Tag | Purpose |
| --- | --- | --- |
| `paymentForm` | `c-payment-form` | Drop-in payment form. Replaces a payment Screen Flow. Configurable via Experience Builder design properties. |
| `paymentSelector` | `c-payment-selector` | Internal wrapper around `cpm-payment-method-selector`. Accepts a flat config array and enriches it before passing to the managed selector. Used by `paymentForm`. |

### `c-payment-form` — Design Properties

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `screenMode` | String | `OneScreen` | `OneScreen` — all steps on one page; `MultiScreen` — three separate steps (Amount, Personal Info, Payment Method) with Back/Next navigation and a progress indicator. |
| `currency` | String | `EUR` | ISO currency code shown in the amount picker (e.g. `EUR`, `USD`, `GBP`). |
| `hideFrequency` | Boolean | `false` | Hide the one-time / recurring frequency toggle. |
| `defaultFrequency` | String | `oneTime` | Pre-selected frequency when the form loads: `oneTime` or `recurring`. |

## Installation

1. Press the **Deploy to Salesforce** button below.
2. Follow [these instructions](https://help.salesforce.com/s/articleView?id=experience.rss_flow_guestuser.htm&type=5) to set up Guest User access for the site. Make sure the **FinDock Experience Cloud** permission set (included in the FinDock | ProcessingHub package) is assigned to the site's Guest User.
3. Open `force-app/main/default/lwc/paymentForm/paymentMethodConfiguration.js` and configure the payment methods and processors that are active in your org. See the comments in that file for a ready-to-run Apex script that generates the config automatically from your org.
4. Update `SuccessURL` and `FailureURL` in `paymentForm.js` (`_updatePaymentIntentContext`) to point to pages within your Experience Cloud site.
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

Run the Apex script in the comments of `paymentMethodConfiguration.js` in Developer Console → Execute Anonymous to generate a ready-to-paste config from your org's active methods.

Key fields:

| Field | Description |
| --- | --- |
| `paymentMethod` | Name of the payment method. Maps to `PaymentMethod.Name` in the PaymentIntent. |
| `paymentProcessor` | Name of the FinDock processor package (e.g. `PaymentHub-Stripe`). Maps to `PaymentMethod.Processor`. |
| `target` | Merchant account name. Maps to `PaymentMethod.Target`. Find it in FinDock Setup → Processors & Methods → Accounts tab. |
| `enabledOneTime` | Show this method for one-time payments. |
| `enabledRecurring` | Show this method for recurring payments. Must be `false` when `supportsRecurring` is `false`. |
| `isDefaultOneTime` | Pre-select this method for one-time payments. Exactly one entry should be `true`. |
| `isDefaultRecurring` | Pre-select this method for recurring payments. Exactly one entry where `enabledRecurring` is `true` should be `true`. |
| `displayLabel` | Label shown to the payer. Defaults to `paymentMethod` when omitted. |
| `redirectInstruction` | Message shown before PSP redirect (e.g. for iDEAL, Bancontact). |

## How it works

`c-payment-form` assembles the PaymentIntent reactively from form state (amount, frequency, personal info, selected payment method) and passes the whole object to `cpm-pay-button` via the `payment-intent` property. The managed Pay Button calls `cpm.API_PaymentIntent_V2.postPaymentIntent()` in-transaction and handles the PSP redirect — no custom Apex controller is needed.

The Pay Button is disabled until all required fields are filled and a payment method is selected.

To add pre- or post-payment Apex logic, or to change the PaymentIntent shape beyond what the component supports, fork `paymentForm` or build a custom LWC that embeds `c-payment-selector` and `cpm-pay-button` directly.
