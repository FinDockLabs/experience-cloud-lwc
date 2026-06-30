/**
 * Payment method configuration for the paymentForm component.
 *
 * This file defines which payment methods are shown to the payer and how they behave.
 * Edit it to match the payment methods and processors activated in your org.
 *
 * ---
 * HOW TO POPULATE THIS FILE
 *
 * Step 1 — Discover available payment methods and their parameters.
 * Run the Apex script below in Developer Console → Execute Anonymous. It calls
 * GET /PaymentMethods and prints a ready-to-paste JS config to the debug log.
 *
 * Step 2 — Fill in the `target` field for each method.
 * The merchant account is not returned by GET /PaymentMethods. Open the Flow Builder,
 * open a flow that uses cpm:paymentMethodSelector, click the selector component →
 * Edit → check the Merchant Account field.
 *
 * ---
 * APEX SCRIPT (paste into Developer Console → Execute Anonymous):
 *
 * class ParameterEntry {
 *     String name; String value; Boolean visibleToCustomer;
 *     String displayLabel; Boolean required; String dataType; String description;
 * }
 * class MethodEntry {
 *     String paymentMethod; String paymentProcessor; String target;
 *     Boolean enabledOneTime; Boolean enabledRecurring;
 *     Boolean isDefaultOneTime; Boolean isDefaultRecurring;
 *     Boolean supportsRecurring; String displayLabel;
 *     List<ParameterEntry> parameters;
 * }
 * RestRequest req = new RestRequest();
 * RestResponse res = new RestResponse();
 * RestContext.request = req; RestContext.response = res;
 * req.requestURI = '/services/apexrest/cpm/v2/PaymentMethods';
 * req.httpMethod = 'GET';
 * req.headers.put('verbose', 'true');
 * cpm.API_PaymentMethod_V2.getPaymentMethods();
 * Map<String, Object> apiResponse = (Map<String, Object>) JSON.deserializeUntyped(res.responseBody.toString());
 * List<Object> paymentMethods = (List<Object>) apiResponse.get('PaymentMethods');
 * List<MethodEntry> config = new List<MethodEntry>();
 * Boolean isFirst = true;
 * for (Object m : paymentMethods) {
 *     Map<String, Object> method = (Map<String, Object>) m;
 *     for (Object p : (List<Object>) method.get('Processors')) {
 *         Map<String, Object> proc = (Map<String, Object>) p;
 *         Boolean supportsRecurring = (Boolean) proc.get('SupportsRecurring');
 *         List<ParameterEntry> parameters = new List<ParameterEntry>();
 *         List<Object> rawParams = (List<Object>) proc.get('Parameters');
 *         if (rawParams != null) {
 *             for (Object raw : rawParams) {
 *                 Map<String, Object> rp = (Map<String, Object>) raw;
 *                 ParameterEntry pe = new ParameterEntry();
 *                 pe.name = (String) rp.get('Name'); pe.value = '';
 *                 pe.visibleToCustomer = false; pe.displayLabel = (String) rp.get('Name');
 *                 pe.required = (Boolean) rp.get('Required'); pe.dataType = (String) rp.get('DataType');
 *                 pe.description = (String) rp.get('Description');
 *                 parameters.add(pe);
 *             }
 *         }
 *         MethodEntry entry = new MethodEntry();
 *         entry.paymentMethod = (String) method.get('Name');
 *         entry.paymentProcessor = (String) proc.get('Name');
 *         entry.target = 'TODO — check Flow CPE UI';
 *         entry.enabledOneTime = true; entry.enabledRecurring = supportsRecurring;
 *         entry.isDefaultOneTime = isFirst; entry.isDefaultRecurring = isFirst && supportsRecurring;
 *         entry.supportsRecurring = supportsRecurring;
 *         entry.displayLabel = (String) method.get('Name');
 *         entry.parameters = parameters.isEmpty() ? null : parameters;
 *         config.add(entry); isFirst = false;
 *     }
 * }
 * List<String> out = new List<String>();
 * out.add('[');
 * for (Integer mi = 0; mi < config.size(); mi++) {
 *     MethodEntry e = config[mi];
 *     out.add('    {');
 *     out.add('        paymentMethod: \'' + e.paymentMethod + '\',');
 *     out.add('        paymentProcessor: \'' + e.paymentProcessor + '\',');
 *     out.add('        target: \'' + e.target + '\',');
 *     out.add('        enabledOneTime: ' + e.enabledOneTime + ',');
 *     out.add('        enabledRecurring: ' + e.enabledRecurring + ',');
 *     out.add('        isDefaultOneTime: ' + e.isDefaultOneTime + ',');
 *     out.add('        isDefaultRecurring: ' + e.isDefaultRecurring + ',');
 *     out.add('        supportsRecurring: ' + e.supportsRecurring + ',');
 *     if (e.parameters != null) {
 *         out.add('        displayLabel: \'' + e.displayLabel + '\',');
 *         out.add('        parameters: [');
 *         for (Integer pi = 0; pi < e.parameters.size(); pi++) {
 *             ParameterEntry p = e.parameters[pi];
 *             out.add('            {');
 *             out.add('                name: \'' + p.name + '\',');
 *             out.add('                value: \'\',');
 *             out.add('                visibleToCustomer: ' + p.visibleToCustomer + ',');
 *             out.add('                displayLabel: \'' + p.displayLabel + '\',');
 *             out.add('                required: ' + p.required + ',');
 *             out.add('                data_type: \'' + p.dataType + '\',');
 *             out.add('                description: \'' + p.description.replace('\'', '\\\'') + '\'');
 *             out.add(pi < e.parameters.size() - 1 ? '            },' : '            }');
 *         }
 *         out.add('        ]');
 *     } else {
 *         out.add('        displayLabel: \'' + e.displayLabel + '\'');
 *     }
 *     out.add(mi < config.size() - 1 ? '    },' : '    }');
 * }
 * out.add(']');
 * System.debug(String.join(out, '\n'));
 *
 * ---
 * FIELD REFERENCE
 *
 * PAYMENT INTENT FIELDS  (sent to POST /PaymentIntent as PaymentMethod.*)
 *
 *   paymentMethod
 *     Name of the payment method.
 *     Maps to PaymentMethod.Name. Required.
 *     Source: PaymentMethods[].Name from GET /PaymentMethods.
 *     Example: "CreditCard"
 *
 *   paymentProcessor
 *     Name of the FinDock package for the payment processor. If no processor is specified,
 *     FinDock uses the default processor configured for the payment method.
 *     Maps to PaymentMethod.Processor.
 *     Source: PaymentMethods[].Processors[].Name from GET /PaymentMethods.
 *     Example: "PaymentHub-Stripe"
 *
 *   target
 *     The merchant account that gets the money from the payment. If no target is provided,
 *     FinDock uses whichever target that is set as the default in the payment processor configuration.
 *     Maps to PaymentMethod.Target.
 *     How to find the value:
 *       - Native FinDock processors: GET /PaymentMethods returns Targets[] per processor.
 *       - PSPs (e.g. PaymentHub-Stripe): open FinDock Setup → Processors & Methods →
 *         click the processor → Accounts tab. The Merchant Account Name is the target value.
 *     Example: "Stripe-Main-Account"
 *
 *   parameters
 *     Additional parameters for the given payment method and processor combination.
 *     Maps to PaymentMethod.Parameters.
 *     Parameters available for a given processor and method are listed in
 *     PaymentMethods[].Processors[].Parameters[] from GET /PaymentMethods.
 *
 * SELECTOR UI FIELDS  (configure the payment method selector shown to the payer)
 *
 *   enabledOneTime
 *     Include this method in the one-time payment options shown to the payer.
 *
 *   enabledRecurring
 *     Include this method in the recurring payment options shown to the payer.
 *     Must be false when supportsRecurring is false for this processor and method combination.
 *
 *   isDefaultOneTime
 *     Pre-select this method when the payer chooses one-time payment. Exactly one entry
 *     in the config should be true.
 *
 *   isDefaultRecurring
 *     Pre-select this method when the payer chooses recurring payment. Exactly one entry
 *     where enabledRecurring is true should be true.
 *
 *   supportsRecurring
 *     Indicates if the payment processor supports recurring payments with this payment method.
 *     Source: PaymentMethods[].Processors[].SupportsRecurring from GET /PaymentMethods.
 *     Defaults to the value of enabledRecurring when omitted.
 *
 *   displayLabel
 *     Custom label shown to the payer in the UI. Defaults to paymentMethod when omitted.
 *
 *   redirectInstruction
 *     Message shown to the payer before they are redirected to the PSP payment page.
 *     Use for methods that redirect to an external page (e.g. iDEAL, Bancontact).
 *
 * PARAMETER FIELDS  (each entry in the parameters array)
 *
 *   name              The name of the parameter.
 *                     Source: PaymentMethods[].Processors[].Parameters[].Name.
 *
 *   value             The value sent to the processor as PaymentMethod.Parameters[name].
 *                     Leave empty for payer-filled fields (visibleToCustomer: true).
 *
 *   visibleToCustomer true — render as an input field for the payer.
 *                     false — send value silently without showing it to the payer (default).
 *                     Note: required description parameters are hidden by default per FinDock convention.
 *
 *   displayLabel      Label shown in the UI when visibleToCustomer is true. Defaults to name.
 *
 *   required          Indicates if the parameter is required.
 *                     Source: PaymentMethods[].Processors[].Parameters[].Required.
 *
 *   data_type         The data type of the parameter.
 *                     Source: PaymentMethods[].Processors[].Parameters[].DataType.
 *                     Example: "String"
 *
 *   description       A description of the purpose of the parameter.
 *                     Source: PaymentMethods[].Processors[].Parameters[].Description.
 */
export const PAYMENT_METHOD_CONFIG = [
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
                description: 'Expected input: language tags as outlined on https://www.oracle.com/java/technologies/javase/jdk13locales.html. Examples: nl-NL, en-US.'
            },
            {
                name: 'description',
                value: '',
                visibleToCustomer: true,
                displayLabel: "Description of the payment for the payer's bank",
                required: false,
                data_type: 'String',
                description: "Description of the payment for the payer's bank."
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
        redirectInstruction: 'You will be redirected to your bank to complete the payment.'
    },
    {
        paymentMethod: 'Bancontact',
        paymentProcessor: 'PaymentHub-Stripe',
        target: 'Stripe-Main-Account',
        enabledOneTime: true,
        enabledRecurring: false,
        isDefaultOneTime: false,
        isDefaultRecurring: false,
        supportsRecurring: false,
        displayLabel: 'Bancontact'
    },
    {
        paymentMethod: 'SEPA Direct Debit',
        paymentProcessor: 'PaymentHub-Stripe',
        target: 'Stripe-Main-Account',
        enabledOneTime: true,
        enabledRecurring: true,
        isDefaultOneTime: false,
        isDefaultRecurring: true,
        supportsRecurring: true,
        displayLabel: 'SEPA Direct Debit'
    },
    {
        paymentMethod: 'BACS Direct Debit',
        paymentProcessor: 'PaymentHub-Stripe',
        target: 'Stripe-Main-Account',
        enabledOneTime: false,
        enabledRecurring: false,
        isDefaultOneTime: false,
        isDefaultRecurring: false,
        supportsRecurring: true,
        displayLabel: 'BACS Direct Debit'
    }
];
