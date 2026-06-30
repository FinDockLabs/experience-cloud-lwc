const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    moduleNameMapper: {
        ...jestConfig.moduleNameMapper,
        '^c/amountAndFrequency$': '<rootDir>/jest-mocks/c/amountAndFrequency/amountAndFrequency',
        '^c/experienceProgressStages$': '<rootDir>/jest-mocks/c/experienceProgressStages/experienceProgressStages',
        '^cpm/payButton$': '<rootDir>/jest-mocks/cpm/payButton/payButton',
        '^cpm/paymentMethodSelector$': '<rootDir>/jest-mocks/cpm/paymentMethodSelector/paymentMethodSelector'
    },
    setupFilesAfterEnv: [
        ...(jestConfig.setupFilesAfterEnv || []),
        '<rootDir>/jest.setup.a11y.js'
    ],
    testTimeout: 15000
};
