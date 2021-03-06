'use strict';
/*
 * Helper module to help handle multiple errors returned from the backend API
 */
const lodash = require('lodash');
const sequence = require('../lib/array/sequence');
const helpLinks = require('../config/dep-help-links');

const errorTypeInfo = {
    'missing': {
        'order': 0,
        'name': 'Missing',
        'message': 'Your data is missing'
    },
    'length': {
        'order': 1,
        'name': 'Length',
        'message': 'Your data is too long'
    },
    'incorrect': {
        'order': 2,
        'name': 'Incorrect',
        'message': 'Your data is incorrect'
    },
    'conflict': {
        'order': 3,
        'name': 'Conflicting',
        'message': 'Your data is conflicting'
    }
};

const getErrorTypeInfo = function (key) {
    const lookup = key.toLowerCase();
    return errorTypeInfo[lookup];
};

/**
 * Given an array of integers, this method returns a String representation of the array having collapsed sequences
 * of numbers into a range.  E.g. given the array [1, 2, 3, 5, 6, 7, 10, 12] this method shall return "1-3, 5-7, 10, 12"
 *
 * @param intArray the array of integers to bne processed
 * @returns {string} the string representation of the array.
 */
const collapseArrayRanges = function (intArray) {
    const listing = [];
    let start;
    intArray.forEach((currentInt, index) => {
        const previousFilled = intArray[index - 1] === (currentInt - 1);
        const nextFilled = intArray[index + 1] === (currentInt + 1);

        // Next item is empty, and previous was filled, so add range listing
        if (!nextFilled && previousFilled) {
            return listing.push(`${start}-${currentInt}`);
        }

        if (!previousFilled) {
            // Next is empty, so this is a single listing
            if (!nextFilled) {
                listing.push(currentInt);
            }
            start = currentInt;
        }
    });
    return listing.join(', ');
};

/**
 * Helper function - currently the front-end does not support multi-object validation messages
 * @param invalidValues
 * @returns Object The display field and value
 */
const errorDataHelper = function (invalidValues) {
    const fieldNameArr = Object.keys(invalidValues);
    // fieldName will be a comma separated list of column headings
    const fieldName = fieldNameArr.join(', ');
    // fieldHeadingText will be a natural language "Field1, Field2 and Field3" string for use in sentences
    const fieldHeadingText = sequence.humanisedJoin(fieldNameArr);
    const values = fieldNameArr.length > 1 ? fieldNameArr.map(name => `${name}: ${invalidValues[name] || ''}`).join(', ') : invalidValues[fieldNameArr[0]];
    return {fieldName: fieldName, fieldHeadingText: fieldHeadingText, errorValue: values || null};
};

module.exports = {
    /**
     * Transform the backend error structure into a structure we can use to display data on the corrections table
     * and the corrections detail pages.
     *
     * This method processes each error returned by the backend and groups them based on the errorCode.  For each
     * top level item an array of row errors is created to provide the information necessary for the corrections
     * detail pages.
     *
     * @param data
     * @returns {Array}
     */
    groupErrorData: function (data) {
        // The backend may return multiple violations for a single field (e.g. permit format invalid and also
        // not a controlled list item) so collapse these down so as not to confuse the output in the table
        const sortedData = lodash.sortBy(data, ['error_class']);
        const correctionTableData = [];
        let lastTableItem = null;
        for (const dataItem of sortedData) {
            const errorClsMatches = dataItem['error_class'].match(/^DR(\d+)-(\w+)$/);
            if (errorClsMatches) {
                dataItem.errorCode = errorClsMatches[1];
                dataItem.errorType = errorClsMatches[2];
            }

            let tableItem = null;

            if (lastTableItem === null || lastTableItem.errorCode !== dataItem.errorCode) {
                // Create a new display item for the current error
                tableItem = {
                    'errorCode': dataItem.errorCode
                };
                correctionTableData.push(tableItem);
            } else {
                // Get last item encountered
                tableItem = correctionTableData[correctionTableData.length - 1];
            }
            // Update the reference to the last displayed item
            lastTableItem = tableItem;

            // Record list of error types on the display item (e.g. Missing, Incorrect, Conflicting)
            tableItem.errorTypes = tableItem.errorTypes || [];
            tableItem.errorTypes.push(lodash.merge({key: dataItem.errorType, message: dataItem.detail},
                getErrorTypeInfo(dataItem.errorType)));
            tableItem.errorTypes = lodash.uniqBy(tableItem.errorTypes, 'key');

            // Create a violations object to provide information for the correction detail page
            tableItem.violations = tableItem.violations || [];
            tableItem.violationCount = tableItem.violationCount || 0;
            let firstItem = true;

            // Sort instances by the first occurrence
            dataItem.instances = lodash.sortBy(dataItem.instances, (instance) => instance.line_numbers[0]);
            for (const violationInstance of dataItem.instances) {
                // Count the number of record indexes with this error
                tableItem.violationCount += violationInstance.line_numbers.length;

                // Violation information for the lower level corrections detail
                const errorData = errorDataHelper(violationInstance.invalid_values);

                // Pull field name and text from the first available violation instance.
                tableItem.fieldName = tableItem.fieldName || errorData.fieldName;
                tableItem.fieldHeadingText = tableItem.fieldHeadingText || errorData.fieldHeadingText;
                tableItem.definition = helpLinks.links.fieldDefinitions[tableItem.fieldName];

                const violation = {
                    'errorType': dataItem.errorType,
                    'errorTypeInfo': getErrorTypeInfo(dataItem.errorType),
                    'rows': collapseArrayRanges(violationInstance.line_numbers),
                    'errorValue': errorData.errorValue
                };
                if (firstItem) {
                    violation.anchor = dataItem.errorType;
                    firstItem = false;
                }
                tableItem.violations.push(violation);
            }
            tableItem.multipleViolations = tableItem.violationCount > 1;
        }
        return correctionTableData;
    }
};
