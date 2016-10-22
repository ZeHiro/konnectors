// Generated by CoffeeScript 1.10.0
var Konnector, async, cozydb, konnectorHash, localization, log;

cozydb = require('cozydb');

async = require('async');

konnectorHash = require('../lib/konnector_hash');

localization = require('../lib/localization_manager');

log = require('printit')({
  prefix: null,
  date: true
});

module.exports = Konnector = cozydb.getModel('Konnector', {
  slug: String,
  fieldValues: Object,
  accounts: [Object],
  "default": [{}],
  password: {
    type: String,
    "default": '[{}]'
  },
  lastSuccess: Date,
  lastImport: Date,
  lastAutoImport: Date,
  isImporting: {
    type: Boolean,
    "default": false
  },
  importInterval: {
    type: String,
    "default": 'none'
  },
  errorMessage: {
    type: String,
    "default": null
  },
  importErrorMessage: {
    type: String,
    "default": null
  },
  _passwordStillEncrypted: Boolean
});

Konnector.all = function(callback) {
  return Konnector.request('all', function(err, konnectors) {
    var j, konnector, len;
    if (konnectors == null) {
      konnectors = [];
    }
    for (j = 0, len = konnectors.length; j < len; j++) {
      konnector = konnectors[j];
      if (konnector.shallRaisEncryptsFieldError()) {
        konnector.importErrorMessage = 'encrypted fields';
      } else {
        konnector.injectEncryptedFields();
      }
    }
    return callback(err, konnectors);
  });
};

Konnector.get = function(slug, callback) {
  return Konnector.request('all', function(err, konnectors) {
    var konnector;
    konnector = konnectors.find(function(konnector) {
      return konnector.slug === slug;
    });
    return callback(err, konnector);
  });
};

Konnector.prototype.getFields = function() {
  var ref;
  if (konnectorHash[this.slug] != null) {
    return (ref = konnectorHash[this.slug]) != null ? ref.fields : void 0;
  } else {
    return this.fields;
  }
};

Konnector.prototype.injectEncryptedFields = function(callback) {
  var error, error1, i, j, len, name, parsedPasswords, passwords, results, val;
  try {
    parsedPasswords = JSON.parse(this.password);
    this.cleanFieldValues();
    results = [];
    for (i = j = 0, len = parsedPasswords.length; j < len; i = ++j) {
      passwords = parsedPasswords[i];
      if (this.accounts[i] != null) {
        results.push((function() {
          var results1;
          results1 = [];
          for (name in passwords) {
            val = passwords[name];
            results1.push(this.accounts[i][name] = val);
          }
          return results1;
        }).call(this));
      } else {
        results.push(void 0);
      }
    }
    return results;
  } catch (error1) {
    error = error1;
    log.error("Attempt to retrieve password for " + this.slug + " failed: " + error);
    log.error(this.password);
    return log.error("It may be due to an error while unencrypting password field.");
  }
};

Konnector.prototype.removeEncryptedFields = function(fields) {
  var account, j, len, name, password, passwords, ref, type;
  if (fields == null) {
    log.warn("Fields variable undefined, use current one instead.");
    fields = this.getFields();
  }
  this.cleanFieldValues();
  password = [];
  ref = this.accounts;
  for (j = 0, len = ref.length; j < len; j++) {
    account = ref[j];
    passwords = {};
    for (name in fields) {
      type = fields[name];
      if (!(type === "password")) {
        continue;
      }
      passwords[name] = account[name];
      delete account[name];
    }
    password.push(passwords);
  }
  return this.password = JSON.stringify(password);
};

Konnector.prototype.updateFieldValues = function(data, callback) {
  var fields;
  fields = this.getFields();
  if (data.accounts == null) {
    data.accounts = [];
  }
  if (data.fieldValues != null) {
    data.accounts.unshift(data.fieldValues);
  }
  this.accounts = data.accounts;
  this.removeEncryptedFields(fields);
  this.importInterval = data.importInterval || this.importInterval;
  data = {
    accounts: this.accounts,
    password: this.password,
    importInterval: this.importInterval
  };
  return this.updateAttributes(data, (function(_this) {
    return function(err) {
      return callback(err, _this);
    };
  })(this));
};

Konnector.prototype["import"] = function(callback) {
  this.cleanFieldValues();
  return this.updateAttributes({
    isImporting: true
  }, (function(_this) {
    return function(err) {
      return async.mapSeries(_this.accounts, function(values, next) {
        return _this.runImport(values, next);
      }, function(err, notifContents) {
        var data, errMessage;
        if (err) {
          log.error(err);
          errMessage = err.message != null ? err.message : err.toString();
          data = {
            isImporting: false,
            lastImport: new Date(),
            importErrorMessage: errMessage.replace(/<[^>]*>/ig, '')
          };
        } else {
          data = {
            isImporting: false,
            lastSuccess: new Date(),
            lastImport: new Date(),
            importErrorMessage: null
          };
        }
        return _this.updateAttributes(data, function(err) {
          log.info('Konnector metadata updated.');
          return callback(err, notifContents);
        });
      });
    };
  })(this));
};

Konnector.prototype.runImport = function(values, callback) {
  var konnectorModule;
  if (typeof err !== "undefined" && err !== null) {
    log.error('An error occured while modifying konnector state');
    log.raw(err);
    return callback(err);
  } else {
    konnectorModule = konnectorHash[this.slug];
    if (this.shallRaisEncryptsFieldError()) {
      return callback('encrypted fields', localization.t('encrypted fields'));
    }
    this.injectEncryptedFields();
    values.lastSuccess = this.lastSuccess;
    return konnectorModule.fetch(values, (function(_this) {
      return function(importErr, notifContent) {
        var fields;
        fields = _this.getFields();
        _this.removeEncryptedFields(fields);
        if ((importErr != null) && typeof importErr === 'object' && (importErr.message != null)) {
          return callback(importErr, notifContent);
        } else if ((importErr != null) && typeof importErr === 'string') {
          return callback(importErr, notifContent);
        } else {
          return callback(null, notifContent);
        }
      };
    })(this));
  }
};

Konnector.prototype.appendConfigData = function(konnectorData) {
  var key, match, modelNames, msg, name, ref, value;
  if (konnectorData == null) {
    konnectorData = konnectorHash[this.slug];
  }
  if (konnectorData == null) {
    msg = ("Config data cannot be appended for konnector " + this.slug + ": ") + "missing config file.";
    throw new Error(msg);
  }
  for (key in konnectorData) {
    this[key] = konnectorData[key];
  }
  modelNames = [];
  ref = this.models;
  for (key in ref) {
    value = ref[key];
    name = value.toString();
    if (name.indexOf('Constructor') !== -1) {
      name = name.substring(0, name.length - 'Constructor'.length);
    } else {
      match = name.match(/function ([^(]+)/);
      if ((match != null) && (match[1] != null)) {
        name = match[1];
      }
    }
    modelNames.push(name);
  }
  this.modelNames = modelNames;
  return this;
};

Konnector.getKonnectorsToDisplay = function(callback) {
  return Konnector.all(function(err, konnectors) {
    var error1, konnectorsToDisplay;
    if (err != null) {
      log.error('An error occured while retrieving konnectors');
      return callback(err);
    } else {
      try {
        konnectorsToDisplay = konnectors.filter(function(konnector) {
          return konnectorHash[konnector.slug] != null;
        }).map(function(konnector) {
          konnector.appendConfigData();
          return konnector;
        });
        return callback(null, konnectorsToDisplay);
      } catch (error1) {
        err = error1;
        log.error('An error occured while filtering konnectors');
        return callback(err);
      }
    }
  });
};

Konnector.prototype.cleanFieldValues = function() {
  var password;
  if (this.fieldValues != null) {
    if (this.accounts == null) {
      this.accounts = [];
    }
    if (Object.keys(this.fieldValues).length > 0) {
      this.accounts.unshift(this.fieldValues);
    }
    this.fieldValues = null;
  }
  if ((this.password != null) && this.password[0] === '{') {
    password = JSON.parse(this.password);
    return this.password = JSON.stringify([password]);
  }
};

Konnector.prototype.hasEncryptedPassword = function() {
  return (this._passwordStillEncrypted != null) && this._passwordStillEncrypted;
};

Konnector.prototype.shallRaisEncryptsFieldError = function() {
  return this.hasEncryptedPassword() && JSON.stringify(this.accounts) !== '[]';
};
