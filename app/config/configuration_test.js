'use strict';

/*
 * Settings for the 'test' environment.
 */
var config = require('./configuration_global');

// Set a meaningful name for this environment.
config.env = 'test';

/* SMTP Test Configuration */
config.smtp = config.smtp || {};
config.smtp.host = 'smtp.sendgrid.net';
config.smtp.port = 587;
config.smtp.ignoreTLS = true;
config.smtp.username = process.env.smtpuser;
config.smtp.password = process.env.smtppw; 
config.smtp.fromEmailAddress = 'noreply-test@environment-agency.gov.uk';
config.smtp.useFooter = false;
// mail catcher config
// Set config.smtp.useMailCatcher = true; to use http://mailcatcher.me/
config.smtp.useMailCatcher = true; // set to false on AWS servers
config.smtp.mailcatcher.host = '127.0.0.1';
config.smtp.mailcatcher.port = 1025;
config.smtp.mailcatcher.ignoreTLS = true;

//Support Contact details on emails
config.smtp.support = {
  email: 'enquiries@environment-agency.gov.uk',
  UKPhone: '03708 506 506',
  PhoneFromAbroad: '00 44 1709 389 201',
  MiniCommNumber: '03702 422 549'
};

/* cache configuration */
config.redis = {
  clientOptions: {
    host: '10.208.5.97',
    port: 6379
  }
};

// CSV Validation
config.CSV = {
  validate: true,
  VIRUS_SCAN: true,
  maxfilesize: 2 * Math.pow(2, 20) //2MB
};

// API Endpoints
var BASEURL = {
  PROTOCOL: 'http://',
  SERVER: 'internal-TSDRASLB01-409918784.eu-west-1.elb.amazonaws.com:',
  PORT: 9020
};

config.API = {};
config.API.endpoints = {
  'FILEUPLOAD': BASEURL.PROTOCOL + BASEURL.SERVER + BASEURL.PORT + '/data-exchange/upload',
  'FILEUPLOADCOMPLETE': BASEURL.PROTOCOL + BASEURL.SERVER + BASEURL.PORT + '/data-exchange/complete',
  'ERRORCHECKING': 'error_checking',
  'ERRORSENDING': 'error_sending'
};

config.API.STATUS_CODES = {
  OK: 200
};

//DEP specific configuration
config.dep = {
  returnTypeRulesLink: 'http://data-returns-help.herokuapp.com'
};

// Google Analytics configuration.
config.useGoogleAnalytics = true;
config.googleTagManagerId = process.env.DRF_TAG_MANAGER_ID || 'GTM-TEST';

// Publish the configuration.
module.exports = config;