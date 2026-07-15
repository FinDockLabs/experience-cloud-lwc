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
        List<PaymentMethodInfo> paymentMethods = new List<PaymentMethodInfo>();
        if (String.isBlank(responseBody)) {
            return paymentMethods;
        }

        Map<String, Object> deserializedBody = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
        List<Object> rawMethods = (List<Object>) deserializedBody.get('PaymentMethods');
        if (rawMethods == null) {
            return paymentMethods;
        }

        for (Object rawMethod : rawMethods) {
            Map<String, Object> methodData = (Map<String, Object>) rawMethod;
            PaymentMethodInfo methodInfo = new PaymentMethodInfo();
            methodInfo.name = (String) methodData.get('Name');
            methodInfo.processors = new List<ProcessorInfo>();

            List<Object> rawProcessors = (List<Object>) methodData.get('Processors');
            if (rawProcessors != null) {
                for (Object rawProcessor : rawProcessors) {
                    Map<String, Object> processorData = (Map<String, Object>) rawProcessor;
                    ProcessorInfo processorInfo = new ProcessorInfo();
                    processorInfo.name = (String) processorData.get('Name');
                    processorInfo.supportsRecurring = processorData.get('SupportsRecurring') == true;
                    processorInfo.initialPaymentOnRecurring = (String) processorData.get('InitialPaymentOnRecurring');
                    processorInfo.parameters = new List<MethodParameter>();

                    List<Object> rawParameters = (List<Object>) processorData.get('Parameters');
                    if (rawParameters != null) {
                        for (Object rawParameter : rawParameters) {
                            Map<String, Object> parameterData = (Map<String, Object>) rawParameter;
                            MethodParameter parameterInfo = new MethodParameter();
                            parameterInfo.name = (String) parameterData.get('Name');
                            parameterInfo.required = parameterData.get('Required') == true;
                            parameterInfo.dataType = (String) parameterData.get('DataType');
                            parameterInfo.description = (String) parameterData.get('Description');
                            processorInfo.parameters.add(parameterInfo);
                        }
                    }
                    methodInfo.processors.add(processorInfo);
                }
            }
            paymentMethods.add(methodInfo);
        }
        return paymentMethods;
    }
}
