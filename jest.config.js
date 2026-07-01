const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    moduleNameMapper: {
        ...jestConfig.moduleNameMapper,
        '^@salesforce/label/c\\.(.+)$': '<rootDir>/jest-mocks/label/c/$1',
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
