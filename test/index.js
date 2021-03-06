/* jshint node: true */
/* jshint expr: true */
/* jshint mocha: true */
'use strict';

var chai = require('chai');
var httpMocks = require('node-mocks-http');
var validator = require('../index');

var expect = chai.expect;
chai.should();

describe('oauth2ProxyAuthentication', function() {
  describe('resultCodeToString', function() {
    it('should return undefined for out-of-range values', function() {
      expect(validator.resultCodeToString(0)).to.be.undefined;
      expect(validator.resultCodeToString(6)).to.be.undefined;
    });

    it('should return the correct matching strings', function() {
      expect(validator.resultCodeToString(validator.NO_SIGNATURE))
        .to.eql('NO_SIGNATURE');
      expect(validator.resultCodeToString(validator.INVALID_FORMAT))
        .to.eql('INVALID_FORMAT');
      expect(validator.resultCodeToString(validator.UNSUPPORTED_ALGORITHM))
        .to.eql('UNSUPPORTED_ALGORITHM');
      expect(validator.resultCodeToString(validator.MATCH))
        .to.eql('MATCH');
      expect(validator.resultCodeToString(validator.MISMATCH))
        .to.eql('MISMATCH');
    });
  });

  describe('stringToSign and requestSignature', function() {
    it('should correctly sign a POST request', function() {
      var payload = '{ "hello": "world!" }';
      var httpOptions = {
        method: 'POST',
        url: '/foo/bar',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          'Content-MD5': 'deadbeef',
          'Date': '2015-09-28',
          'Authorization': 'trust me',
          'X-Forwarded-User': 'mbland',
          'X-Forwarded-Email': 'mbland@acm.org',
          'X-Forwarded-Access-Token': 'feedbead',
          'Cookie': 'foo; bar; baz=quux',
          'Gap-Auth': 'mbland'
        }
      };
      var req = httpMocks.createRequest(httpOptions);

      expect(validator.stringToSign(req)).to.eql(
        ['POST',
         payload.length.toString(),
         'deadbeef',
         'application/json',
         '2015-09-28',
         'trust me',
         'mbland',
         'mbland@acm.org',
         'feedbead',
         'foo; bar; baz=quux',
         'mbland',
         '/foo/bar'
        ].join('\n'));
      expect(validator.requestSignature(req, payload, 'sha1', 'foobar'))
        .to.eql('sha1 722UbRYfC6MnjtIxqEJMDPrW2mk=');
    });

    it('should correctly sign a GET request', function() {
      var httpOptions = {
        method: 'GET',
        url: '/foo/bar',
        headers: {
          'Date': '2015-09-29',
          'Cookie': 'foo; bar; baz=quux',
          'Gap-Auth': 'mbland'
        }
      };
      var req = httpMocks.createRequest(httpOptions);

      expect(validator.stringToSign(req)).to.eql(
        ['GET',
         '',
         '',
         '',
         '2015-09-29',
         '',
         '',
         '',
         '',
         'foo; bar; baz=quux',
         'mbland',
         '/foo/bar'
        ].join('\n'));
      expect(validator.requestSignature(req, undefined, 'sha1', 'foobar'))
        .to.eql('sha1 JBQJcmSTteQyHZXFUA9glis9BIk=');
    });
  });

  describe('validateRequest and middlewareValidator', function() {
    var createRequest = function(headerSignature) {
      var httpOptions = {
        method: 'GET',
        url: '/foo/bar',
        headers: {
          'Date': '2015-09-29',
          'Cookie': 'foo; bar; baz=quux',
          'Gap-Auth': 'mbland'
        }
      };
      if (headerSignature) {
        httpOptions.headers['Gap-Signature'] = headerSignature;
      }
      return httpMocks.createRequest(httpOptions);
    };

    var validateRequest = function(request, secretKey) {
      var validate = validator.middlewareValidator(secretKey);
      validate(request, undefined, new Buffer(0), 'utf-8');
    };

    it('should throw ValidationError with NO_SIGNATURE', function() {
      var f = function() { validateRequest(createRequest(), 'foobar'); };
      expect(f).to.throw(validator.ValidationError, 'failed: NO_SIGNATURE');
    });

    it('should throw ValidationError with INVALID_FORMAT', function() {
      var badValue = 'should be algorithm and digest value';
      var f = function() {
        var request = createRequest(badValue); 
        validateRequest(request, 'foobar');
      };
      expect(f).to.throw(
        validator.ValidationError,
        'failed: INVALID_FORMAT header: "' + badValue + '"');
    });

    it('should throw ValidationError with UNSUPPORTED_ALGORITHM', function() {
      var request = createRequest();
      var validSignature = validator.requestSignature(
        request, null, 'sha1', 'foobar');
      var components = validSignature.split(' ');
      var signatureWithUnsupportedAlgorithm = 'unsupported ' + components[1];

      var f = function() {
        validateRequest(
          createRequest(signatureWithUnsupportedAlgorithm), 'foobar');
      };
      expect(f).to.throw(
        validator.ValidationError,
        'failed: UNSUPPORTED_ALGORITHM ' +
        'header: "' + signatureWithUnsupportedAlgorithm + '"');
    });

    it('should validate the request with MATCH', function() {
      var request = createRequest();
      var expectedSignature = validator.requestSignature(
        request, null, 'sha1', 'foobar');
      request = createRequest(expectedSignature);
      validateRequest(request, 'foobar');

      // If we reach this point the result was a MATCH. Call
      // validator.validateRequest() directly so we can inspect the values.
      var results = validator.validateRequest(request, undefined, 'foobar');
      var result = results[0];
      var header = results[1];
      var computed = results[2];

      expect(result).to.eql(validator.MATCH);
      expect(header).to.eql(expectedSignature);
      expect(computed).to.eql(expectedSignature);
    });

    it('should throw ValidationError with MISMATCH', function() {
      var request = createRequest();
      var foobarSignature = validator.requestSignature(
        request, null, 'sha1', 'foobar');
      var barbazSignature = validator.requestSignature(
        request, null, 'sha1', 'barbaz');

      var f = function() {
        validateRequest(createRequest(foobarSignature), 'barbaz');
      };
      expect(f).to.throw(
        validator.ValidationError,
        'failed: MISMATCH ' +
        'header: "' + foobarSignature + '" ' +
        'computed: "' + barbazSignature + '"');
    });
  });
});
