/* jshint node: true */

'use strict';

var crypto = require('crypto');

var exports = module.exports = {};

exports.HEADERS = [
  'Content-Length',
  'Content-Md5',
  'Content-Type',
  'Date',
  'Authorization',
  'X-Forwarded-User',
  'X-Forwarded-Email',
  'X-Forwarded-Access-Token',
  'Cookie',
  'Gap-Auth'
];

exports.NO_SIGNATURE = 1;
exports.INVALID_FORMAT = 2;
exports.UNSUPPORTED_ALGORITHM = 3;
exports.MATCH = 4;
exports.MISMATCH = 5;

var resultStrings = [
  '',
  'NO_SIGNATURE',
  'INVALID_FORMAT',
  'UNSUPPORTED_ALGORITHM',
  'MATCH',
  'MISMATCH'
];

exports.resultCodeToString = function(code) {
  if (code < 1 || code >= resultStrings.length) { return; }
  return resultStrings[code];
};

function signedHeaders(req) {
  return exports.HEADERS.map(function(header) {
    return req.get(header) || '';
  });
}

exports.stringToSign = function(req) {
  return [req.method, signedHeaders(req).join('\n'), req.url].join('\n');
};

exports.requestSignature = function(req, rawBody, digestName, secretKey) {
  var hmac = crypto.createHmac(digestName, secretKey);
  hmac.update(exports.stringToSign(req));
  hmac.update(rawBody || '');
  return digestName + ' ' + hmac.digest('base64');
};

exports.validateRequest = function(req, rawBody, secretKey) {
  var header = req.get('Gap-Signature');
  if (!header) { return [exports.NO_SIGNATURE]; }
  var components = header.split(' ');
  if (components.length != 2) { return [exports.INVALID_FORMAT, header]; }
  var digestName = components[0];
  try {
    crypto.createHash(digestName); 
  } catch (e) {
    return [exports.UNSUPPORTED_ALGORITHM, header];
  }
  var computed = exports.requestSignature(req, rawBody, digestName, secretKey);
  var result = (header == computed) ? exports.MATCH : exports.MISMATCH;
  return [result, header, computed];
};

function ValidationError(result, header, computed) {
  this.name = 'ValidationError';
  this.result = result;
  this.header = header;
  this.computed = computed;
  this.message = 'oauth2_proxy request validation failed: ' +
    exports.resultCodeToString(result);
  if (header) { this.message += ' header: "' + header + '"'; }
  if (computed) { this.message += ' computed: "' + computed + '"'; }
  this.stack = (new Error()).stack;
}
ValidationError.prototype = Object.create(Error.prototype);
ValidationError.prototype.constructor = ValidationError;
exports.ValidationError = ValidationError;

exports.middlewareValidator = function(secretKey) {
  return function(req, res, buf, encoding) {
    var rawBody = buf.toString(encoding);
    var validationResult = exports.validateRequest(req, rawBody, secretKey);
    var result = validationResult[0];

    if (result != exports.MATCH) {
      var header = validationResult[1];
      var computed = validationResult[2];
      throw new ValidationError(result, header, computed);
    }
  };
};
