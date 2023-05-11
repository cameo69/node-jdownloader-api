/* eslint-disable camelcase,no-param-reassign,no-underscore-dangle */

let crypto;
try {
  crypto = require('node:crypto');
  Object.seal(crypto);
} catch (err) {
  throw new Error('crypto support is disabled!');
}

const axios = require('axios')

const __ENPOINT = 'https://api.jdownloader.org';
const __APPKEY = 'my_jd_nodeJS_webinterface';
const __SERVER_DOMAIN = 'server';
const __DEVICE_DOMAIN = 'device';
const __ALGO_HASH = 'sha256';
const __ALGO_HMAC = 'sha256';
const __ALGO_CRYPT = 'aes-128-cbc';

let __rid_counter = 0;
let __loginSecret;
let __deviceSecret;
let __sessionToken;
let __regainToken;
let __serverEncryptionToken;
let __deviceEncryptionToken;
const __apiVer = 1;

const uniqueRid = () => {
  let newRid = Math.floor(Date.now());
  while (newRid <= __rid_counter) {
    newRid++;
  } 
  __rid_counter = newRid;
  return __rid_counter;
};

const SHA256 = (data, encoding = 'byte') => Array.from(new Uint8Array(crypto.createHash(__ALGO_HASH).update(data).digest(encoding)));
const createSecret = (username, password, domain) => SHA256(username + password + domain);
const sign = (key, data) => crypto.createHmac(__ALGO_HMAC, Buffer.from(key)).update(data).digest('hex');

const encrypt = (data, iv_key) => {
  const iv_string = iv_key.slice(0, iv_key.length / 2);
  const key_string = iv_key.slice(iv_key.length / 2);

  const key = Buffer.from(key_string);
  const iv = Buffer.from(iv_string);

  const cipher = crypto.createCipheriv(__ALGO_CRYPT, key, iv);
  const encrypted = cipher.update(data,'utf8','base64') + cipher.final('base64');

  return encrypted;
};

const decrypt = (data, iv_key) => {
  const iv_string = iv_key.slice(0, iv_key.length / 2);
  const key_string = iv_key.slice(iv_key.length / 2);

  const key = Buffer.from(key_string);
  const iv = Buffer.from(iv_string);
  
  const cipher = crypto.createDecipheriv(__ALGO_CRYPT, key, iv);
  const decrypted = cipher.update(data,'base64', 'utf8') + cipher.final('utf8');

  return decrypted;
};

const postQuery = (url, params) => {
  //const l = {"url": url, "params": params};
  //console.log(l);
  if (params === null) {
    return axios.post(url);
  }

  let options = {
    headers: {
      'Content-Type': 'application/aesjson-jd; charset=utf-8'
    }
  };

  return axios.post(url, params, options);
};

const addRidCheck = (obj, senderRid) => {
  obj.senderRid = senderRid;
  obj.ridMatch = (obj.rid === obj.senderRid);
  return obj;
}

const callServer = (query, key, params) => {
  const rid = uniqueRid();
  if (params && key) {
    params = encrypt(params, key);
  }

  if (query.includes('?')) {
    query += '&';
  } else {
    query += '?';
  }
  query = `${query}rid=${rid}`;
  const signature = sign(key, query);
  query += `&signature=${signature}`;
  const url = __ENPOINT + query;

  return new Promise((resolve, rejected) => {
    postQuery(url, params)
      .then((parsedBody) => {
        let result = decrypt(parsedBody.data, key);
        result = addRidCheck(JSON.parse(result), rid)
        resolve(result);
      }).catch((err) => {
        rejected(err);
      });
  });
};

const callAction = (action, deviceId, params) => {
  if (__sessionToken === undefined) {
    return Promise.reject(new Error('Not connected'));
  }
  const query = `/t_${encodeURI(__sessionToken)}_${encodeURI(deviceId)}${action}`;
  let json = {
    url: action,
    rid: uniqueRid(),
    apiVer: __apiVer,
  };
  if (params) {
    json.params = params;
  };
  const senderRid = json.rid;
  const currentDeviceEncryptionToken = __deviceEncryptionToken;
  const jsonData = encrypt(JSON.stringify(json), currentDeviceEncryptionToken);
  const url = __ENPOINT + query;
  return new Promise((resolve, rejected) => {
    postQuery(url, jsonData)
      .then((parsedBody) => {
        let result = decrypt(parsedBody.data, currentDeviceEncryptionToken);
        result = addRidCheck(JSON.parse(result), senderRid)
        resolve(result);
      }).catch((err) => {
        if (typeof(err.error) === "string") {
          rejected(decrypt(err.error, currentDeviceEncryptionToken));
        } else {
          rejected(err)
        }
      });
  });
};

const updateEncryptionToken = (oldTokenBytes, updateToken) => {
  //const buffer = Buffer.from(updateToken, 'hex').toString('hex');
  const buffer = Buffer.from(oldTokenBytes);
  const secondbuffer = Buffer.from(updateToken, 'hex');
  const thirdbuffer = Buffer.concat([buffer, secondbuffer], buffer.length + secondbuffer.length);
  return SHA256(thirdbuffer);
};

exports.callAction = callAction;

exports.connect = (username, password) => {
  const usernameLower = username.toLowerCase();
  __loginSecret = createSecret(usernameLower, password, __SERVER_DOMAIN);
  __deviceSecret = createSecret(usernameLower, password, __DEVICE_DOMAIN);

  const query = `/my/connect?email=${encodeURI(usernameLower)}&appkey=${__APPKEY}`;

  return new Promise((resolve, rejected) => {
    callServer(query, __loginSecret, null).then((val) => {
      __sessionToken = val.sessiontoken;
      __regainToken = val.regaintoken;
      __serverEncryptionToken = updateEncryptionToken(__loginSecret, __sessionToken);
      __deviceEncryptionToken = updateEncryptionToken(__deviceSecret, __sessionToken);
      resolve(true);
    }).catch((error) => {
      rejected(error);
    });
  });
};

exports.reconnect = function () {
  const query = `/my/reconnect?appkey=${encodeURI(__APPKEY)}&sessiontoken=${encodeURI(__sessionToken)}&regaintoken=${encodeURI(__regainToken)}`;
  return new Promise((resolve, rejected) => {
    callServer(query, __serverEncryptionToken).then((val) => {
      __sessionToken = val.sessiontoken;
      __regainToken = val.regaintoken;
      __serverEncryptionToken = updateEncryptionToken(__serverEncryptionToken, __sessionToken);
      __deviceEncryptionToken = updateEncryptionToken(__deviceSecret, __sessionToken);
      resolve(true);
    }).catch((error) => {
      rejected(error);
    });
  });
};

exports.disconnect = function () {
  const query = `/my/disconnect?sessiontoken=${encodeURI(__sessionToken)}`;
  return new Promise((resolve, rejected) => {
    callServer(query, __serverEncryptionToken).then(() => {
      __sessionToken = '';
      __regainToken = '';
      __serverEncryptionToken = '';
      __deviceEncryptionToken = '';
      resolve(true);
    }).catch((error) => {
      rejected(error);
    });
  });
};

exports.listDevices = () => {
  const query = `/my/listdevices?sessiontoken=${encodeURI(__sessionToken)}`;
  return new Promise((resolve, rejected) => {
    callServer(query, __serverEncryptionToken).then((val) => {
      resolve(val.list);
    }).catch((error) => {
      rejected(error);
    });
  });
};

exports.getDirectConnectionInfos = deviceId => new Promise((resolve, rejected) => {
  callAction('/device/getDirectConnectionInfos', deviceId, null)
    .then((val) => {
      resolve(val);
    }).catch((error) => {
      rejected(error);
    });
});

exports.addLinks = (links, deviceId, autostart = true, packageName, destinationFolder) => {
  let params = {
    "priority": "DEFAULT",
    "links": links,
    "autostart": autostart
  };
  if (packageName) {
      params.packageName = packageName;
      params.overwritePackagizerRules = true;
  }
  if (destinationFolder) {
      params.destinationFolder = destinationFolder;
      params.overwritePackagizerRules = true;
  }

  return new Promise((resolve, rejected) => {
    callAction('/linkgrabberv2/addLinks', deviceId, [JSON.stringify(params)])
      .then((val) => {
        resolve(val);
      }).catch((error) => {
        rejected(error);
      });
  });
};

exports.queryLinks = (deviceId, packagesIds) => {
  //params see https://my.jdownloader.org/developers/#tag_98
  let params = {
      "addedDate"        : true,
      "bytesLoaded"      : true,
      "bytesTotal"       : true,
      "comment"          : true,
      "enabled"          : true,
      "eta"              : true,
      "extractionStatus" : true,
      "finished"         : true,
      "finishedDate"     : true,
      "host"             : true,
      "password"         : true,
      "priority"         : true,
      "running"          : true,
      "skipped"          : true,
      "speed"            : true,
      "status"           : true,
      "url"              : true
  };
  
  if (packagesIds) {
      if (typeof packagesIds === "string") {
          params.packageUUIDs = [packagesIds];
      } else if (typeof packagesIds === "number") {
          params.packageUUIDs = [packagesIds];
      } else if (typeof packagesIds === "object" && packagesIds.length > 0) {
          params.packageUUIDs = packagesIds;
      }
  }

  return new Promise((resolve, rejected) => {
      callAction('/downloadsV2/queryLinks', deviceId, [JSON.stringify(params)])
      .then((val) => {
        resolve(val);
      }).catch((error) => {
        rejected(error);
      });
  });
};

exports.queryPackages = (deviceId, packagesIds) => {
  //params see https://my.jdownloader.org/developers/#tag_144
  let params = {
    "bytesLoaded"  : true,
    "bytesTotal"   : true,
    "childCount"   : true,
    "comment"      : true,
    "enabled"      : true,
    "eta"          : true,
    "finished"     : true,
    "hosts"        : true,
    "priority"     : true,
    "running"      : true,
    "saveTo"       : true,
    "speed"        : true,
    "status"       : true
  };

  if (packagesIds) {
    if (typeof packagesIds === "string") {
        params.packageUUIDs = [packagesIds];
    } else if (typeof packagesIds === "number") {
        params.packageUUIDs = [packagesIds];
    } else if (typeof packagesIds === "object" && packagesIds.length > 0) {
        params.packageUUIDs = packagesIds;
    }
  }

  return new Promise((resolve, rejected) => {
    callAction('/downloadsV2/queryPackages', deviceId, [JSON.stringify(params)])
      .then((val) => {
        resolve(val);
      }).catch((error) => {
        rejected(error);
      });
  });
};

exports.cleanUpFinishedLinks = (deviceId) => {
    const params =  ["[]", "[]", "DELETE_FINISHED", "REMOVE_LINKS_ONLY", "ALL"];
    return new Promise((resolve, rejected) => {
      callAction('/downloadsV2/cleanup', deviceId, params)
          .then((val) => {
            resolve(val);
          }).catch((error) => {
            rejected(error);
          });
      });
};
