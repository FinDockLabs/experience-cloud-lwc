/**
 * @description Unit tests for {@link PaymentMethodSourceController}.
 *
 * Two layers:
 *  - parseResponse(...) tests run against fixed JSON, so the field-mapping logic is verified
 *    deterministically without depending on the org's active payment methods or the API being
 *    reachable in a test context.
 *  - getPaymentMethods() runs end-to-end over the managed cpm.API_PaymentMethod_V2 REST method.
 */
@IsTest
private with sharing class PaymentMethodSourceControllerTest {

    @TestSetup
    static void testSetup() {
        cpm.TestService.initTestSource();
        cpm.TestService.initTestPSPExtension();
        cpm.TestService.activateAllPaymentMethods();
    }

    // ── parseResponse: field mapping ──────────────────────────────────────────────

    @IsTest
    static void parseResponse_withFullResponse_shouldMapMethodAndProcessorFields() {
        String body = JSON.serialize(new Map<String, Object>{
            'PaymentMethods' => new List<Object>{
                new Map<String, Object>{
                    'Name' => 'CreditCard',
                    'Processors' => new List<Object>{
                        new Map<String, Object>{
                            'Name' => 'PaymentHub-Stripe',
                            'SupportsRecurring' => true,
                            'InitialPaymentOnRecurring' => 'optional'
                        }
                    }
                },
                new Map<String, Object>{
                    'Name' => 'Ideal',
                    'Processors' => new List<Object>{
                        new Map<String, Object>{
                            'Name' => 'PaymentHub-Stripe',
                            'SupportsRecurring' => false,
                            'InitialPaymentOnRecurring' => 'unsupported'
                        }
                    }
                }
            }
        });

        Test.startTest();
        List<PaymentMethodSourceController.PaymentMethodInfo> result =
            PaymentMethodSourceController.parseResponse(body);
        Test.stopTest();

        Assert.areEqual(2, result.size(), 'Both methods should be parsed');

        PaymentMethodSourceController.PaymentMethodInfo creditCard = result[0];
        Assert.areEqual('CreditCard', creditCard.name, 'Method name should be mapped from Name');
        Assert.areEqual(1, creditCard.processors.size(), 'CreditCard should have one processor');
        Assert.areEqual('PaymentHub-Stripe', creditCard.processors[0].name, 'Processor name should be mapped from Name');
        Assert.areEqual(true, creditCard.processors[0].supportsRecurring, 'supportsRecurring should be mapped from SupportsRecurring');
        Assert.areEqual('optional', creditCard.processors[0].initialPaymentOnRecurring, 'initialPaymentOnRecurring should be mapped from InitialPaymentOnRecurring');

        PaymentMethodSourceController.PaymentMethodInfo ideal = result[1];
        Assert.areEqual('Ideal', ideal.name, 'Second method name should be mapped from Name');
        Assert.areEqual(false, ideal.processors[0].supportsRecurring, 'supportsRecurring should be mapped as false when SupportsRecurring is false');
        Assert.areEqual('unsupported', ideal.processors[0].initialPaymentOnRecurring, 'initialPaymentOnRecurring should be mapped from InitialPaymentOnRecurring');
    }

    @IsTest
    static void parseResponse_shouldMapParameterFields() {
        String body = JSON.serialize(new Map<String, Object>{
            'PaymentMethods' => new List<Object>{
                new Map<String, Object>{
                    'Name' => 'CreditCard',
                    'Processors' => new List<Object>{
                        new Map<String, Object>{
                            'Name' => 'PaymentHub-Stripe',
                            'SupportsRecurring' => true,
                            'InitialPaymentOnRecurring' => 'optional',
                            'Parameters' => new List<Object>{
                                new Map<String, Object>{
                                    'Name' => 'locale',
                                    'Required' => true,
                                    'DataType' => 'Enum',
                                    'Description' => 'Language tag'
                                }
                            }
                        }
                    }
                }
            }
        });

        Test.startTest();
        List<PaymentMethodSourceController.PaymentMethodInfo> result =
            PaymentMethodSourceController.parseResponse(body);
        Test.stopTest();

        List<PaymentMethodSourceController.MethodParameter> params = result[0].processors[0].parameters;
        Assert.areEqual(1, params.size(), 'One parameter should be parsed');
        Assert.areEqual('locale', params[0].name, 'Parameter name should be mapped from Name');
        Assert.areEqual(true, params[0].required, 'Parameter required flag should be mapped from Required');
        Assert.areEqual('Enum', params[0].dataType, 'Parameter dataType should be mapped from DataType');
        Assert.areEqual('Language tag', params[0].description, 'Parameter description should be mapped from Description');
    }

    @IsTest
    static void parseResponse_withMissingSupportsRecurring_shouldDefaultToFalse() {
        // SupportsRecurring absent, Required absent — both must resolve to false, not null.
        String body = JSON.serialize(new Map<String, Object>{
            'PaymentMethods' => new List<Object>{
                new Map<String, Object>{
                    'Name' => 'CreditCard',
                    'Processors' => new List<Object>{
                        new Map<String, Object>{
                            'Name' => 'PaymentHub-Stripe',
                            'Parameters' => new List<Object>{
                                new Map<String, Object>{ 'Name' => 'locale', 'DataType' => 'String' }
                            }
                        }
                    }
                }
            }
        });

        Test.startTest();
        List<PaymentMethodSourceController.PaymentMethodInfo> result =
            PaymentMethodSourceController.parseResponse(body);
        Test.stopTest();

        Assert.areEqual(false, result[0].processors[0].supportsRecurring, 'Missing SupportsRecurring should default to false');
        Assert.areEqual(false, result[0].processors[0].parameters[0].required, 'Missing Required should default to false');
        Assert.isNull(result[0].processors[0].initialPaymentOnRecurring, 'Absent value stays null');
    }

    // ── parseResponse: structural edge cases ──────────────────────────────────────

    @IsTest
    static void parseResponse_withNullBody_shouldReturnEmptyList() {
        Assert.areEqual(0, PaymentMethodSourceController.parseResponse(null).size(), 'Null body should yield an empty list');
    }

    @IsTest
    static void parseResponse_withBlankBody_shouldReturnEmptyList() {
        Assert.areEqual(0, PaymentMethodSourceController.parseResponse('   ').size(), 'Blank body should yield an empty list');
    }

    @IsTest
    static void parseResponse_withoutPaymentMethodsKey_shouldReturnEmptyList() {
        Assert.areEqual(0, PaymentMethodSourceController.parseResponse('{}').size(), 'Missing PaymentMethods key should yield an empty list');
    }

    @IsTest
    static void parseResponse_withMethodWithoutProcessors_shouldReturnEmptyProcessorList() {
        String body = JSON.serialize(new Map<String, Object>{
            'PaymentMethods' => new List<Object>{ new Map<String, Object>{ 'Name' => 'CreditCard' } }
        });

        List<PaymentMethodSourceController.PaymentMethodInfo> result =
            PaymentMethodSourceController.parseResponse(body);

        Assert.areEqual(1, result.size(), 'One method should be parsed');
        Assert.areEqual('CreditCard', result[0].name, 'Method name should be mapped from Name');
        Assert.areEqual(0, result[0].processors.size(), 'Missing Processors becomes an empty list');
    }

    @IsTest
    static void parseResponse_withProcessorWithoutParameters_shouldReturnEmptyParameterList() {
        String body = JSON.serialize(new Map<String, Object>{
            'PaymentMethods' => new List<Object>{
                new Map<String, Object>{
                    'Name' => 'Ideal',
                    'Processors' => new List<Object>{ new Map<String, Object>{ 'Name' => 'PaymentHub-Stripe' } }
                }
            }
        });

        List<PaymentMethodSourceController.PaymentMethodInfo> result =
            PaymentMethodSourceController.parseResponse(body);

        Assert.areEqual(0, result[0].processors[0].parameters.size(), 'Missing Parameters becomes an empty list');
    }

    // ── getPaymentMethods: end-to-end over the managed REST method ────────────────

    @IsTest
    static void getPaymentMethods_withActivePSP_shouldReturnParsedMethods() {
        Test.startTest();
        List<PaymentMethodSourceController.PaymentMethodInfo> result =
            PaymentMethodSourceController.getPaymentMethods();
        Test.stopTest();

        Assert.isNotNull(result, 'A list (possibly empty) is always returned');
        for (PaymentMethodSourceController.PaymentMethodInfo method : result) {
            Assert.isNotNull(method.name, 'Every parsed method has a name');
            Assert.isNotNull(method.processors, 'Every parsed method has a processor list');
        }
    }
}
