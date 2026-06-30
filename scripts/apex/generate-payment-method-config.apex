// Fetches active payment methods from the org and outputs a ready-to-use
// paymentMethodConfiguration.js config array.
//
// Run via sf CLI:
//   sf apex run -f scripts/apex/generate-payment-method-config.apex --target-org <alias>
//
// Or paste into Developer Console → Execute Anonymous → View Log → USER_DEBUG line.
//
// The `target` field is optional — if left empty, FinDock uses the default merchant account
// configured for that processor. Set it only if you need a non-default account.

RestRequest req = new RestRequest();
RestResponse res = new RestResponse();
RestContext.request = req;
RestContext.response = res;
req.requestURI = '/services/apexrest/cpm/v2/PaymentMethods';
req.httpMethod = 'GET';
req.headers.put('verbose', 'true');
cpm.API_PaymentMethod_V2.getPaymentMethods();

Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.responseBody.toString());
List<Object> methods = (List<Object>) body.get('PaymentMethods');

List<Object> config = new List<Object>();
Boolean isFirst = true;

for (Object m : methods) {
    Map<String, Object> method = (Map<String, Object>) m;
    String methodName = (String) method.get('Name');
    List<Object> processors = (List<Object>) method.get('Processors');
    if (processors == null) continue;

    for (Object p : processors) {
        Map<String, Object> proc = (Map<String, Object>) p;
        String procName = (String) proc.get('Name');
        Boolean supportsRecurring = proc.get('SupportsRecurring') == true;

        List<Object> params = new List<Object>();
        List<Object> rawParams = (List<Object>) proc.get('Parameters');
        if (rawParams != null) {
            for (Object rp : rawParams) {
                Map<String, Object> param = (Map<String, Object>) rp;
                params.add(new Map<String, Object>{
                    'name'              => param.get('Name'),
                    'value'             => '',
                    'visibleToCustomer' => false,
                    'displayLabel'      => param.get('Name'),
                    'required'          => param.get('Required'),
                    'data_type'         => param.get('DataType'),
                    'description'       => param.get('Description') != null ? param.get('Description') : ''
                });
            }
        }

        config.add(new Map<String, Object>{
            'paymentMethod'      => methodName,
            'paymentProcessor'   => procName,
            'target'             => '',
            'enabledOneTime'     => true,
            'enabledRecurring'   => supportsRecurring,
            'isDefaultOneTime'   => isFirst,
            'isDefaultRecurring' => isFirst && supportsRecurring,
            'supportsRecurring'  => supportsRecurring,
            'displayLabel'       => methodName,
            'parameters'         => params.isEmpty() ? null : params
        });
        isFirst = false;
    }
}

// Single-line output with marker — extracted by generate-payment-config.mjs
System.debug('FDPAYCONFIG:' + JSON.serialize(config));
