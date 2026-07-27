/**
 * Supplies the org's active currency ISO codes for the currency picker
 * used only when no explicit allow-list is configured).
 * Consumed by the runtime currencyPicker (auto-detect) and by its Flow CPE (currencyPickerConfig).
 *
 * Guest access: expose this class to the site's Guest User profile/permission set to enable
 * auto-detect on public pages. When it isn't accessible or the call fails, the component falls
 * back to a single default currency, so payments still work.
 */
public with sharing class CurrencyPickerController {
    @AuraEnabled(Cacheable=true)
    public static List<String> getActiveCurrencyIsoCodes() {
        List<String> codes = new List<String>();
        if (UserInfo.isMultiCurrencyOrganization()) {
            // Dynamic SOQL: CurrencyType is not a valid SObject on single-currency orgs.
            for (SObject ct : Database.query('SELECT IsoCode FROM CurrencyType WHERE IsActive = TRUE ORDER BY IsoCode')) {
                codes.add((String) ct.get('IsoCode'));
            }
        } else {
            String defaultCurrency = UserInfo.getDefaultCurrency();
            if (String.isNotBlank(defaultCurrency)) {
                codes.add(defaultCurrency);
            }
        }
        return codes;
    }
}
