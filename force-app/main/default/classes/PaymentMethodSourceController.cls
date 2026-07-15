/**
 * Live source of the org's payment methods, read from cpm.API_PaymentMethod_V2 (the same data
 * GET /PaymentMethods returns). Lets LWCs enrich the static paymentMethodConfiguration.js entries
 * at runtime with values that must always match the org's actual processor configuration —
 * supportsRecurring, initialPaymentOnRecurring, parameter data types.
 */
public with sharing class PaymentMethodSourceController {

    public class MethodParameter {
        @AuraEnabled public String name;
        @AuraEnabled public Boolean required;
        @AuraEnabled public String dataType;
        @AuraEnabled public String description;
    }

    public class ProcessorInfo {
        @AuraEnabled public String name;
        @AuraEnabled public Boolean supportsRecurring;
        @AuraEnabled public String initialPaymentOnRecurring;
        @AuraEnabled public List<MethodParameter> parameters;
    }

    public class PaymentMethodInfo {
        @AuraEnabled public String name;
        @AuraEnabled public List<ProcessorInfo> processors;
    }

    @AuraEnabled(Cacheable=true)
    public static List<PaymentMethodInfo> getPaymentMethods() {
        try {
            RestRequest req = new RestRequest();
            RestResponse res = new RestResponse();
            RestContext.request = req;
            RestContext.response = res;
            req.requestURI = '/services/apexrest/cpm/v2/PaymentMethods';
            req.httpMethod = 'GET';
            req.headers.put('verbose', 'true');

            cpm.API_PaymentMethod_V2.getPaymentMethods();

            return parseResponse(res.responseBody == null ? null : res.responseBody.toString());
        } catch (Exception e) {
            AuraHandledException auraHandledException = new AuraHandledException(e.getMessage());
            auraHandledException.setMessage(e.getMessage());
            throw auraHandledException;
        }
    }

    @TestVisible
    private static List<PaymentMethodInfo> parseResponse(String responseBody) {
        List<PaymentMethodInfo> methods = new List<PaymentMethodInfo>();
        if (String.isBlank(responseBody)) {
            return methods;
        }
        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
        List<Object> rawMethods = (List<Object>) body.get('PaymentMethods');
        if (rawMethods == null) {
            return methods;
        }

        for (Object m : rawMethods) {
            Map<String, Object> method = (Map<String, Object>) m;
            PaymentMethodInfo info = new PaymentMethodInfo();
            info.name = (String) method.get('Name');
            info.processors = new List<ProcessorInfo>();

            List<Object> rawProcessors = (List<Object>) method.get('Processors');
            if (rawProcessors != null) {
                for (Object p : rawProcessors) {
                    Map<String, Object> proc = (Map<String, Object>) p;
                    ProcessorInfo procInfo = new ProcessorInfo();
                    procInfo.name = (String) proc.get('Name');
                    procInfo.supportsRecurring = proc.get('SupportsRecurring') == true;
                    procInfo.initialPaymentOnRecurring = (String) proc.get('InitialPaymentOnRecurring');
                    procInfo.parameters = new List<MethodParameter>();

                    List<Object> rawParams = (List<Object>) proc.get('Parameters');
                    if (rawParams != null) {
                        for (Object rp : rawParams) {
                            Map<String, Object> param = (Map<String, Object>) rp;
                            MethodParameter paramInfo = new MethodParameter();
                            paramInfo.name = (String) param.get('Name');
                            paramInfo.required = param.get('Required') == true;
                            paramInfo.dataType = (String) param.get('DataType');
                            paramInfo.description = (String) param.get('Description');
                            procInfo.parameters.add(paramInfo);
                        }
                    }
                    info.processors.add(procInfo);
                }
            }
            methods.add(info);
        }
        return methods;
    }
}
