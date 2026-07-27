@IsTest
private class CurrencyPickerControllerTest {
    @IsTest
    static void getActiveCurrenciesReturnsInfo() {
        Test.startTest();
        CurrencyPickerController.CurrencyInfo info = CurrencyPickerController.getActiveCurrencies();
        Test.stopTest();

        Assert.isNotNull(info, 'Controller should return a CurrencyInfo');
        Assert.isNotNull(info.currencies, 'currencies should never be null');
        Assert.areEqual(UserInfo.isMultiCurrencyOrganization(), info.isMultiCurrency, 'isMultiCurrency should match the org');
        if (!info.isMultiCurrency) {
            Assert.areEqual(1, info.currencies.size(), 'Single-currency org should return one code');
            Assert.areEqual(UserInfo.getDefaultCurrency(), info.currencies[0], 'Single-currency org should return the user default');
        }
    }
}
