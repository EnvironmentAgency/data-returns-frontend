"use strict";
const winston = require("winston");
let cacheHandler = require('../../lib/cache-handler');
let userHandler = require('../../lib/user-handler');
let redisKeys = require('../../lib/redis-keys');
let fileUploadProcessor = require("../../lib/file-upload-processor");

function buildStatusJson(sessionID) {
    return new Promise(function (resolve, reject) {
        let key = redisKeys.UPLOADED_FILES.compositeKey(sessionID);
        cacheHandler.arrayGet(key).then(function (uploads) {
            let hasInvalidUploads = uploads.filter(u => u.status.state !== "ready").length > 0;
            // Sort by filename
            uploads.sort((a, b) => {
                return a.name.toUpperCase().localeCompare(b.name.toUpperCase());
            });
            let status = {
                "canContinue": uploads.length > 0 && !hasInvalidUploads,
                "hasInvalidUploads": hasInvalidUploads,
                "files": uploads
            };
            resolve(status);
        }).catch(function(err) {
            reject(err);
        });
    });
}

function removeUpload(sessionID, uuid) {
    return new Promise(function (resolve, reject) {
        let key = redisKeys.UPLOADED_FILES.compositeKey(sessionID);
        cacheHandler.arrayGet(key).then(function (uploads) {
            for (let upload of uploads) {
                if (upload.id === uuid) return upload;
            }
            return null;
        }).then(function (uploadToRemove) {
            if (uploadToRemove !== null) {
                return cacheHandler.arrayRemove(key, uploadToRemove);
            }
        }).then(resolve).catch(reject);
    });
}

/*
 *  HTTP GET handler for /file/choose
 *  @Param request
 *  @Param reply
 */
module.exports.getHandler = function (request, reply) {
    let sessionID = userHandler.getSessionID(request);
    let loadPageCallback = function (status) {
        reply.view('data-returns/choose-your-file', status);
    };
    let statusJsonCallback = function (status) {
        reply(status).type('application/json');
    };
    let handler = request.query.status === "true" ? statusJsonCallback : loadPageCallback;
    buildStatusJson(sessionID).then(handler);
};


/*
 *  HTTP POST handler for /file/choose
 *  @Param request
 *  @Param reply
 */
module.exports.postHandler = function (request, reply) {
    let sessionID = userHandler.getSessionID(request);
    let usingFineUploader = request.query.fineuploader === 'true';

    // Request payload present - handle normal upload request
    if (request.payload && request.payload.action === "remove") {
        removeUpload(sessionID, request.payload.uuid).then(function () {
            reply.redirect('/file/choose').rewritable(true);
        }).catch(function () {
            reply.redirect('data-returns/failure');
        });
    } else {
        let sessionID = userHandler.getSessionID(request);
        let fileData = fileUploadProcessor.getFileData(request, sessionID);

        let legacyUploaderOnComplete = function() {
            reply.redirect('/file/choose').rewritable(true);
        };
        let fineUploaderOnComplete = function(processorResponse) {
            reply(processorResponse).type('text/plain').code(processorResponse.httpCode || 200);
        };

        let callbacks = 0;
        let resultHandler = function (processorResponse) {
            if (++callbacks === fileData.files.length) {
                usingFineUploader ? fineUploaderOnComplete(processorResponse) : legacyUploaderOnComplete(processorResponse);
            }
        };

        fileData.files.forEach(function (upload) {
            winston.info(`ChooseFileHandler: Processing file ${upload.clientFilename}`);
            fileUploadProcessor.processUploadedFile(upload).then(resultHandler).catch(resultHandler);
        });
    }
};