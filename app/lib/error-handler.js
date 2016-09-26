'use strict';
const winston = require("winston");
const hogan = require('hogan.js');
const utils = require('../lib/utils');
const path = require('path');
const lodash = require('lodash');
const commonViewData = require("../lib/common-view-data");
const templateDir = path.resolve(__dirname, '../error-templates/');
const filenames = utils.getFileListInDir(templateDir);

//preload and compile error-templates
var loadErrorTemplates = function () {
    winston.info('==> Loading Templates...');
    let compiledTemplates = {};
    let templatesLoaded = 0;
    filenames.forEach(function (filename) {
        utils.readFile(filename, function (err, fileContents) {
            if (err) {
                winston.error(err);
            } else {
                let x = filename.lastIndexOf('/');
                let y = filename.indexOf('.html');
                let key = filename.substring(x + 1, y);
                try {
                    let compiledTemplate = hogan.compile(fileContents);
                    compiledTemplates[key] = compiledTemplate;
                } catch (e) {
                    winston.error(`Failed to compile template for ${filename}: ${e.message}`, e);
                }
            }
        });
        templatesLoaded++;
    });
    winston.info(`<== ${templatesLoaded} templates loaded`);
    return compiledTemplates;
};

var compiledTemplates = loadErrorTemplates();

/**
 * Render an error snippet for the given errorCode
 *
 *
 * @param errorCode the numeric error code (e.g. 860)
 * @param metadata metadata to supply to the view
 * @param defaultErrorMessage the default error message to render if an appropriate template cannot be found
 * @returns the result of rendering the mustache template
 */
module.exports.render = function (errorCode, metadata, defaultErrorMessage) {
    let viewData = lodash.merge({}, commonViewData, metadata);
    let key = 'DR' + utils.pad(errorCode, 4);
    let template = compiledTemplates[key];
    if (template) {
        return template.render(viewData);
    } else {
        return defaultErrorMessage;
    }
};

/**
 * Render a correction message for the given arguments.
 *
 * This method attempts to find the appropriate html snippet for the errorCode and violation type.  If the specific
 * snippet
 *
 *
 * @param errorCode the numeric error code (e.g. 9140)
 * @param violationType the violation type text (e.g. Missing, Incorrect, Length)
 * @param metadata metadata to supply to the view
 * @param defaultErrorMessage the default error message to render if an appropriate template cannot be found
 * @returns the result of rendering the mustache template
 */
module.exports.renderCorrectionMessage = function (errorCode, violationType, metadata, defaultErrorMessage) {
    let viewData = lodash.merge({}, commonViewData, metadata);
    let snippetCode = `DR${utils.pad(errorCode, 4)}`;
    let key =  `${snippetCode}-${violationType}`;
    let template = compiledTemplates[key];
    let defaultTemplate = compiledTemplates[`Default-${violationType}`];
    if (template) {
        return template.render(viewData);
    } else if (defaultTemplate) {
        return defaultTemplate.render(viewData);
    } else {
        return defaultErrorMessage;
    }
};