@IsTest
private class CurrencyPickerControllerTest {
    @IsTest
    static void getActiveCurrencyIsoCodesReturnsList() {
        Test.startTest();
        List<String> codes = CurrencyPickerController.getActiveCurrencyIsoCodes();
        Test.stopTest();

        Assert.isNotNull(codes, 'Controller should return a non-null list of ISO codes');
    }
}
