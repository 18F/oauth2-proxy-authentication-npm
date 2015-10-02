# oauth2-proxy-authentication

**NOTE: This npm will not work until after bitly/oauth2_proxy#147 is integrated.**

Authenticates requests from
[bitly/oauth2_proxy](https://github.com/bitly/oauth2_proxy) based on a
shared-secret HMAC signature of the request.

## Installation

```sh
$ npm install oauth2-proxy-authentication --save
```

## Usage

Assuming you're using [Express](https://www.npmjs.com/package/express), during
initialization of your application, where `config.secretKey` is the shared
secret between your application and the running instance of
`bitly/oauth2_proxy`:

```js
var express = require('express');
var bodyParser = require('bodyParser');
var oauth2ProxyAuthentication = require('oauth2-proxy-authentication');

function doLaunch(config) {
  var middlewareOptions = {
    verify: oauth2ProxyAuthentication.middlewareValidator(config.secretKey)
  };
  var server = express();
  server.use(bodyParser.raw(middlewareOptions));

  // Continue server initialization...
}
```

If you're not using Express, you can use the function `validateRequest(req,
rawBody, secretKey)` directly, where `rawBody` has already been converted to a
string.

## Public domain

This project is in the worldwide [public domain](LICENSE.md). As stated in [CONTRIBUTING](CONTRIBUTING.md):

> This project is in the public domain within the United States, and copyright and related rights in the work worldwide are waived through the [CC0 1.0 Universal public domain dedication](https://creativecommons.org/publicdomain/zero/1.0/).
>
> All contributions to this project will be released under the CC0
>dedication. By submitting a pull request, you are agreeing to comply
>with this waiver of copyright interest.
