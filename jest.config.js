const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    moduleNameMapper: {
        ...jestConfig.moduleNameMapper,
        '^@salesforce/label/c\\.(.+)$': '<rootDir>/jest-mocks/label/c/$1',
        '^lightning/messageService$': '<rootDir>/jest-mocks/lightning/messageService',
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
