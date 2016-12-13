"use strict";
const winston = require("winston");
var cacheHandler = require('../../lib/cache-handler');
var userHandler = require('../../lib/user-handler');
var errorHandler = require('../../lib/error-handler');
var redisKeys = require('../../lib/redis-keys');
const lodash = require("lodash");

module.exports = {
    /*
     * HTTP GET Handler for /correction/detail route
     */
    getHandler: function (request, reply) {
        let sessionID = userHandler.getSessionID(request);
        var fileUuid = request.query.uuid;
        let errorId = request.query.id || -1;

        if (sessionID !== null && fileUuid !== null && errorId !== null) {
            winston.info(`Loading correction details. Session: ${sessionID}, File: ${fileUuid}, ErrorId: ${errorId}`);
            const fileDataKey = redisKeys.ERROR_PAGE_METADATA.compositeKey([sessionID, fileUuid]);

            cacheHandler.getJsonValue(fileDataKey).then(function (fileData) {
                if (fileData === null) {
                    winston.warn(`Unable to retrieve valid file data for session: ${sessionID}, file: ${fileUuid}, redirecting to chooser`);
                    return reply.redirect("/file/choose");
                }
                winston.info(`Getting error details. Session: ${sessionID}, File: ${fileUuid}, ErrorId: ${errorId}`);

                let lineErrorsForErrorCode = fileData.correctionsData.lineErrors.filter(value => value.errorCode.toString() === errorId.toString());
                if (lineErrorsForErrorCode.length !== 1) {
                    winston.error(new Error(`Found ${lineErrorsForErrorCode.length} errors for a single error code, should be exactly 1`));
                    return reply.redirect('data-returns/failure');
                }

                // Set up metadata to display the corrections detail for the appropriate error code
                let errorDetail = lineErrorsForErrorCode[0];
                var errorSummaryData = {
                    uuid: fileUuid,
                    filename: fileData.name,
                    fieldName: errorDetail.fieldName,
                    fieldHeadingText: errorDetail.fieldHeadingText,
                    errorCode: errorDetail.errorCode
                };

                // Render the error summary displayed at the top of the correction details page
                let summaries = new Array();
                for (let type of errorDetail.errorTypes) {
                    let summary = {
                        errorType: type,
                        link: "#" + type.name,
                        guidance: errorHandler.renderCorrectionMessage(errorDetail.errorCode, type.name, errorSummaryData, type.message)
                    };
                    summaries.push(summary);
                }
                // Render more help for use in the correction details
                let moreHelp = errorHandler.renderCorrectionMessage(errorDetail.errorCode, "MoreHelp", errorSummaryData);

                reply.view('data-returns/correction-detail', lodash.merge({}, fileData, errorSummaryData, {
                    summaries: summaries,
                    errorDetail: errorDetail,
                    moreHelp: moreHelp
                }));
            }).catch(function (err) {
                winston.error(err);
                return reply.redirect('data-returns/failure');
            });
        } else {
            reply.redirect('/file/choose');
        }
    }
};