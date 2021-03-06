'use strict';
const winston = require('winston');
const config = require('./lib/configuration-handler.js').Configuration;
const userSession = require('./lib/user-handler');
const lodash = require('lodash');

const basicTemplateHandler = require('./routeHandlers/BasicTemplateHandler');
const startHandler = require('./routeHandlers/StartHandler');

// Submission route handlers
const chooseFileHandler = require('./routeHandlers/submissions/ChooseFileHandler');
const preloadHandler = require('./routeHandlers/submissions/PreloadHandler');
const confirmFileHandler = require('./routeHandlers/submissions/ConfirmFileHandler');
const emailHandler = require('./routeHandlers/submissions/EmailHandler');
const pinHandler = require('./routeHandlers/submissions/PinHandler');
const fileSendHandler = require('./routeHandlers/submissions/FileSendHandler');
const fileSentHandler = require('./routeHandlers/submissions/FileSentHandler');
const correctionTableHandler = require('./routeHandlers/submissions/CorrectionTableHandler');
const correctionDetailHandler = require('./routeHandlers/submissions/CorrectionDetailHandler');
const fileInvalidHandler = require('./routeHandlers/submissions/FileInvalidHandler');
const fileUnavailableHandler = require('./routeHandlers/submissions/FileUnavailableHandler');

// Reference material lookup handlers
const controlledListHandler = require('./routeHandlers/lookup/ControlledListHandler');
const eaIdLookupHandler = require('./routeHandlers/lookup/EaIdLookupHandler');

const contentReviewHandler = require('./routeHandlers/ContentReviewHandler');

const fileUploadConfig = {
    payload: {
        maxBytes: config.get('csv.maxFileSizeMb') * Math.pow(2, 20),
        timeout: false,
        output: 'file',
        parse: true,
        uploads: config.get('upload.path'),
        // Fail action is set to ignore so that we can handle errors inside the handler
        failAction: 'ignore'
    }
};

const staticAssetDir = function (type, paths) {
    return {
        method: 'GET',
        path: `/public/${type}/{param*}`,
        handler: {
            directory: {
                path: paths,
                etagMethod: 'hash' // Allows assets to be cached by the client.
            }
        }
    };
};

const handlers = [
    // Static assets.
    staticAssetDir('images', [
        'public/images',
        'node_modules/govuk_template_mustache/assets/images',
        'node_modules/govuk_frontend_toolkit/images'

    ]),
    staticAssetDir('javascripts', [
        'public/javascripts',
        'node_modules/govuk_template_mustache/assets/javascripts',
        'node_modules/govuk_frontend_toolkit/javascripts'

    ]),
    staticAssetDir('stylesheets', [
        'public/stylesheets',
        'node_modules/govuk_template_mustache/assets/stylesheets'

    ]),
    // Serve html files from guidance
    {
        method: 'GET',
        path: '/guidance/{page*}',
        handler: function (request, reply) {
            if (request.params.page) {
                reply.view(`data-returns/guidance/${request.params.page}`, {
                    src: request.info.referrer || '/guidance/landfill-data-rules'
                });
            } else {
                // TODO: At some point we should make the default page index.html and communicate this to Martin
                reply.redirect('/guidance/landfill-data-rules.html');
            }
        }
    },
    /*
     * Redirect to the start for no valid routes
     */
    {
        method: '*',
        path: '/{p*}', // catch-all path
        handler: function (request, reply) {
            reply.redirect('/start');
        }
    },
    {
        method: 'GET',
        path: '/',
        handler: function (request, reply) {
            reply.redirect('/start');
        }
    },
    {
        method: 'GET',
        path: '/index',
        handler: function (request, reply) {
            reply.redirect('/start');
        }
    },
    // Start page.
    {
        method: 'GET',
        path: '/start',
        handler: startHandler.getHandler
    },
    {
        method: 'POST',
        path: '/start',
        handler: startHandler.postHandler
    },
    {
        method: 'GET',
        path: '/start/continue',
        handler: startHandler.continueHandler
    },
    // /file/unavailable
    {
        method: 'GET',
        path: '/file/unavailable',
        handler: fileUnavailableHandler.getHandler
    },
    // /file/preload
    {
        method: 'GET',
        path: '/file/preload',
        handler: preloadHandler.getHandler
    },
    {
        method: 'POST',
        path: '/file/preload',
        config: fileUploadConfig,
        handler: preloadHandler.postHandler
    },

    // Controlled list handlers
    {
        method: 'GET',
        path: '/controlled-lists',
        handler: controlledListHandler.availableLists
    },
    {
        method: 'GET',
        path: '/display-list',
        handler: controlledListHandler.getDisplayHandler
    },
    {
        method: 'GET',
        path: '/display-list/search',
        handler: controlledListHandler.getDisplayHandlerWithSearch
    },
    {
        method: 'GET',
        path: '/csv/{list*}',
        handler: controlledListHandler.getCSVHandler
    },

    // EA_ID lookup tool#
    {
        method: 'GET',
        path: '/lookup',
        handler: eaIdLookupHandler.routeHandler
    },

    // /failure
    {
        method: 'GET',
        path: '/failure',
        handler: basicTemplateHandler.getHandler
    },

    {
        method: '*',
        path: '/forbidden',
        handler: function (request, reply) {
            reply(require('boom').forbidden('This operation is not allowed'));
        }
    }
];

/**
 * These handlers require a session cookie to be in place and will not be called if a session cookie is not present,
 * instead they will be redirected to the no-cookie page.
 *
 * @type {[*]}
 */
const requireCookie = function (handlers) {
    const preRouteHandlers = [
        {
            method: function (request, reply) {
                const sessionID = userSession.getSessionID(request);
                if (!sessionID) {
                    return reply.redirect('/guidance/no-cookie.html').takeover();
                }
                return reply();
            }
        }
    ];

    for (const handler of handlers) {
        handler.config = lodash.defaultsDeep({}, handler.config);
        handler.config.pre = preRouteHandlers.concat(handler.config.pre || []);
    }
    return handlers;
};

const statefulHandlers = requireCookie([
    // /file/choose
    {
        method: 'GET',
        path: '/file/choose',
        handler: chooseFileHandler.getHandler
    },
    {
        method: 'POST',
        path: '/file/choose',
        config: fileUploadConfig,
        handler: chooseFileHandler.postHandler
    },
    // /file/confirm
    {
        method: 'GET',
        path: '/file/confirm',
        handler: confirmFileHandler.getHandler
    },
    // /email
    {
        method: 'GET',
        path: '/email',
        handler: emailHandler.getHandler
    },
    {
        method: 'POST',
        path: '/email',
        handler: emailHandler.postHandler
    },
    // /pin
    {
        method: 'GET',
        path: '/pin',
        handler: pinHandler.getHandler
    },
    {
        method: 'POST',
        path: '/pin',
        handler: pinHandler.postHandler
    },
    // /file/send
    {
        method: 'GET',
        path: '/file/send',
        handler: fileSendHandler.getHandler
    },
    {
        method: 'POST',
        path: '/file/send',
        handler: fileSendHandler.postHandler
    },
    // /file/sent
    {
        method: 'GET',
        path: '/file/sent',
        handler: fileSentHandler.getHandler
    },

    // /correction/table
    {
        method: 'GET',
        path: '/correction/table',
        handler: correctionTableHandler.getHandler
    },
    // /correction/detail
    {
        method: 'GET',
        path: '/correction/detail',
        handler: correctionDetailHandler.getHandler
    },

    // /file/invalid
    {
        method: 'GET',
        path: '/file/invalid',
        handler: fileInvalidHandler.getHandler
    }
]);

if (process.env.NODE_ENV !== 'prod' && process.env.NODE_ENV !== 'production') {
    // Add handler for content review
    handlers.push({
        method: 'GET',
        path: '/content/review',
        handler: contentReviewHandler.getHandler
    });

    // Add handler for logger capability test
    handlers.push({
        method: 'GET',
        path: '/logging/test',
        handler: function (request, reply) {
            winston.debug('Test debug logging');
            winston.info('Test info logging');
            winston.warn('Test warn logging');
            winston.error('Test error message', new Error('Test error logging'));

            const Request = require('request');
            const apiData = {url: config.get('api.endpoints.testLogging')};
            Request.get(apiData, function (err, httpResponse) {
                if (err) {
                    reply({status: 'failed', 'backend': err});
                } else {
                    reply({status: 'ok', 'backend': httpResponse});
                }
            });
        }
    });
}

module.exports = [].concat(handlers, statefulHandlers);
