Node My.Jdownloader API
======
**A NodeJS wrapper for My.jdownloader.org API**

https://my.jdownloader.org/developers/

https://github.com/cameo69/node-jdownloader-api

Changes
--------
- Uses node:crypro instead of ezcrypto
- Replaced deprecated request-promise with axios

Forked from https://github.com/malleguisse/node-jdownloader-api, which, at the time of writing this, used deprecated packages.
malleguisse/node-jdownloader-api is a rewritten version of this PHP wrapper https://github.com/tofika/my.jdownloader.org-api-php-class

Features
--------
- Connect to the My.JDownloader service
- Reconnect
- Disconnect from the My.JDownloader service
- List Devices
- Add Links and start download
- List actual links from the download are
- List all packages and get current download status

Usage
--------

To install `myjdownloader-api` in your node.js project:

```
npm install myjdownloader-api
```

And to access it from within node, simply add:

```javascript
const jdownloaderAPI = require('myjdownloader-api');
```
API
--------
## Connect

```javascript
jdownloaderAPI.connect(_USERNAME_, _PASSWORD_)
```

## Disconnect

```javascript
jdownloaderAPI.disconnect()
```
## Reconnect

```javascript
jdownloaderAPI.reconnect()
```

## listDevices

```javascript
// List all active devices from the connected account
// deviceName and deviceId
jdownloaderAPI.listDevices()
```

## addLinks

```javascript
// This will add links to the device and autostart downloads if 
// autostart parameter is true otherwise it will leave the package in the linkGrabber
// nb : links must be comma separated
jdownloaderAPI.addLinks(LINKS, DEVICEID, true(autostart))
```

## queryLinks

```javascript
// List all links from the download area of the specified device
// optional PACKAGESUUIDS should be an array of numbers; you can get them from the queryPackages method
jdownloaderAPI.queryLinks(DEVICEID, PACKAGESUUIDS)
```

## queryPackages

```javascript
// List all packages from the download area of the specified device
// current status, total bytes loaded, etc ...
// nb : packagesUUIS must be comma separated
jdownloaderAPI.queryPackages(DEVICEID, PACKAGESUUIDS)
```

## Links

[npm](https://www.npmjs.com/package/myjdownloader-api) https://www.npmjs.com/package/myjdownloader-api

[GitHub](https://github.com/cameo69/node-jdownloader-api) https://github.com/cameo69/node-jdownloader-api
