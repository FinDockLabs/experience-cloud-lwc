/**
 * Supplies the org's active currencies to the currencyPicker LWC.
 * Used only when no explicit allow-list is configured on the component.
 *
 * Guest access: expose this class to the site's Guest User profile/permission set to enable
 * auto-detect on public pages. When it isn't accessible or the call fails, the component falls back
 * to a single default currency, so payments still work.
 */
public with sharing class CurrencyPickerController {
    public class CurrencyInfo {
        @AuraEnabled
        public Boolean isMultiCurrency;
        @AuraEnabled
        public List<String> currencies;
        @AuraEnabled
        public String defaultCurrency;
    }

    @AuraEnabled(Cacheable=true)
    public static CurrencyInfo getActiveCurrencies() {
        CurrencyInfo info = new CurrencyInfo();
        info.isMultiCurrency = UserInfo.isMultiCurrencyOrganization();
        info.defaultCurrency = UserInfo.getDefaultCurrency();

        List<String> codes = new List<String>();
        if (info.isMultiCurrency) {
            // CurrencyType only exists in multi-currency orgs — use dynamic SOQL so this class also
            // compiles and deploys in single-currency orgs.
            for (SObject ct : Database.query('SELECT IsoCode FROM CurrencyType WHERE IsActive = TRUE ORDER BY IsoCode')) {
                codes.add((String) ct.get('IsoCode'));
            }
        } else if (String.isNotBlank(info.defaultCurrency)) {
            codes.add(info.defaultCurrency);
        }
        info.currencies = codes;
        return info;
    }
}
