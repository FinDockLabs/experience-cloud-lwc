const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    moduleNameMapper: {
        ...jestConfig.moduleNameMapper,
        '^@salesforce/label/c\\.(.+)$': '<rootDir>/jest-mocks/label/c/$1',
        '^@salesforce/label/cpm\\.(.+)$': '<rootDir>/jest-mocks/label/cpm/$1',
        '^@salesforce/i18n/currency$': '<rootDir>/jest-mocks/i18n/currency',
        '^@salesforce/apex/CurrencyPickerController\\.getActiveCurrencies$': '<rootDir>/jest-mocks/apex/getActiveCurrencies',
        '^lightning/messageService$': '<rootDir>/jest-mocks/lightning/messageService',
        '^lightning/flowSupport$': '<rootDir>/jest-mocks/lightning/flowSupport',
        '^cpm/payButton$': '<rootDir>/jest-mocks/cpm/payButton/payButton',
        '^cpm/paymentMethodSelector$': '<rootDir>/jest-mocks/cpm/paymentMethodSelector/paymentMethodSelector',
        '^cpm/paymentFlowChannel$': '<rootDir>/jest-mocks/cpm/paymentFlowChannel/paymentFlowChannel',
        '^cpm/paymentMethodValidators$': '<rootDir>/jest-mocks/cpm/paymentMethodValidators/paymentMethodValidators'
    },
    setupFilesAfterEnv: [
        ...(jestConfig.setupFilesAfterEnv || []),
        '<rootDir>/jest.setup.a11y.js'
    ],
    testTimeout: 15000
};
