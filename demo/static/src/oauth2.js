/**
 * Author: Gerard Muñoz <gmunoz1979@gmail.com>
 * Date:   11 de febrero de 2015
 */

var oauth2 = window.Oauth2 = function(namespace) {
  if (!localStorage) {
    throw new Error('navegador no soporta Local Storage.');
  }

  var s = this.set = {};
  this.namespace = namespace;
  s['authorization'] = 'https://login.windows.net/common';
  s['path']          = 'oauth2/authorize';
  s['token']         = 'oauth2/token';
  s['response_type'] = 'code';
  s['prompt']        = 'login';
  s['grant_type']    = 'authorization_code';
}

oauth2.prototype.version = "v0.1";

/**
 * @private function
 */
oauth2.prototype._getParams = function() {
  var vars  = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi,    
    function(m,key,value) {
      vars[key] = value;
    }
  );
  return vars;
}

/**
 * @public function
 */
oauth2.prototype.setCode = function() {
  var codename = 'code_'+this.namespace;

  /**
   * Limpiamos el LocalStorage
   */
  localStorage.removeItem(codename);

  var params = this._getParams();
  if (params['code']) {
    localStorage[codename] = params['code'];
    // Cerramos la ventana.
    window.close();
  }
}

/**
 * @public function
 */
oauth2.prototype.setting = function(setting) {
  for (var key in setting) {
    this.set[key] = setting[key];
  }
}

/**
 * @private function
 */
oauth2.prototype._getCodeUrl = function(setting) {
  var getParam = function(name) {
    return name + '=' + encodeURIComponent(setting[name]) + '&';
  }

  return setting.authorization + '/' +
    setting.path + '?' +
    getParam('response_type') +
    getParam('resource') +
    getParam('client_id') +
    getParam('redirect_uri');
}

/**
 * @private function
 */
oauth2.prototype._getTokenForm = function(setting, code, url) {
  var enconde = this._getParamForm('url', url);

  for (var key in setting) {
    enconde += this._getParamForm(key, setting[key]);
  }

  return enconde;
}

/**
 * @private function
 */
oauth2.prototype._getAccessTokenForm = function(setting, code, url) {
  var data = this._getTokenData(setting, code);
  return this._getTokenForm(data, code, url);
}

/**
 * @private function
 */
oauth2.prototype._getParamForm = function(name, value) {
  return name+"="+encodeURIComponent(value)+'&';
}

/**
 * @private function
 */
oauth2.prototype._getTokenData = function(auth, code) {
  var form = {};
  form['grant_type']    = auth['grant_type'];
  form['code']          = code;
  form['client_id']     = auth['client_id'];
  form['redirect_uri']  = auth['redirect_uri'];
  form['client_secret'] = auth['client_secret'];
  
  return form;
}

/**
 * @private function
 */
oauth2.prototype._refreshToken = function(callback) {
  var self = this;
  var xhr  = new XMLHttpRequest();
  xhr.open('POST', this.set['refresh_token'], true);
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8');

  xhr.onload = function() {
    if (xhr.status !== 200) return;
    self._updateToken(JSON.parse(xhr.response));
    callback.call(self);
  }

  var data = {};
  data['grant_type']    = 'refresh_token';
  data['refresh_token'] = this.refreshToken;
  data['resource']      = this.set['resource'];
  data['client_id']     = this.set['client_id'];
  data['client_secret'] = this.set['client_secret'];

  var params = this._getTokenForm(data, null, this.set['authorization']+'/'+this.set['token']);
  xhr.send(params);
}

/**
 * @private function
 */
oauth2.prototype._updateToken = function(data) {
  var accessname  = 'access_'  + this.namespace;
  var typename    = 'type_'    + this.namespace;
  var refreshname = 'refresh_' + this.namespace;

  this.accessToken  = localStorage[accessname]  = data['access_token'];
  this.refreshToken = localStorage[refreshname] = data['refresh_token'];
  this.typeToken    = localStorage[typename]    = data['token_type'];
}

/**
 * @private function

 * Debido a problemas con el Cross-Domain
 * no podemos pedir el token de
 * acceso desde el navegador, asi que un proxy
 * hara el trabajo.
 */
oauth2.prototype._getAccessToken = function(code, action) {
  var self = this;

  var accessname  = 'access_'  + this.namespace;
  var typename    = 'type_'    + this.namespace;
  var refreshname = 'refresh_' + this.namespace;

  var accessToken  = this.accessToken  = localStorage[accessname];
  var typeToken    = this.typeToken    = localStorage[typename];
  var refreshToken = this.refreshToken = localStorage[refreshname];

  if (!accessToken || !typeToken || !refreshToken) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', this.set['access_token'], true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8');

    xhr.onload = function() {
      if (xhr.status !== 200) return;
      self._updateToken(JSON.parse(xhr.response));
      accessToken = this.accessToken;
      typeToken   = this.typeToken;
      action.thenFns.forEach(function(thenFn) { thenFn.call(self, accessToken, typeToken) });
    }

    xhr.onerror = function() {
      if (!noRepeat) {
        self.getToken(self.set.resource, action);
        return;
      }
    }

    var params = this._getAccessTokenForm(this.set, code, this.set['authorization']+'/'+this.set['token']);
    xhr.send(params);
    return;
  }

  setTimeout(function() {
    action.thenFns.forEach(function(thenFn) { thenFn.call(self, accessToken, typeToken); });
  }, 100);
}

/**
 * @private function
 */
oauth2.prototype._createAction = function() {
  var a = {};
  a.thenFns = [];
  a.then = function(fn) { this.thenFns.push(fn); }
  return a;
}

/**
 * @public function
 */
oauth2.prototype.getToken = function(resource, action) {
  action = action || this._createAction();

  // Guardamos el resource en el setting.
  this.set.resource = resource;

  /**
   * Verificamos si existe code en el
   * navegador. Sino, lo mandamos
   * a pedir.
   */
  var codename = 'code_'+this.namespace;
  var code = this.code = localStorage[codename];
  if (code) {
    this._getAccessToken(code, action);
  }
  else {
    var self = this;
    var url  = this._getCodeUrl(this.set);
    var win  = window.open(url, 'win', 'width=500, height=500');
    win.onbeforeunload = function() {
      var code = this.code = localStorage[codename];
      if (!code) return;
      self._getAccessToken(code, action);
    }
  }

  return action;
}

/**
 * @public function
 */
oauth2.prototype.query = function(query, callback, noRepeat) {
  var self = this;
  var url  = this.set.resource + '/_api/v1.0/' + query;

  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.setRequestHeader('Authorization', this.typeToken+' '+this.accessToken);
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.onload = function() {
    if (xhr.status === 200) {
      var data = JSON.parse(xhr.response);
      callback.call(self, data);
      return;
    }
  }
  xhr.onerror = function(e) {
    if (!noRepeat) {
      self._refreshToken(function() { self.query(query, callback, true); });
      return;
    }
  }
  xhr.send();

  return this;
}

/**
 * @public function
 */
oauth2.prototype.clear = function() {
  var accessname  = 'access_'  + this.namespace;
  var typename    = 'type_'    + this.namespace;
  var refreshname = 'refresh_' + this.namespace;
  var codename    = 'code_'    + self.namespace;

  localStorage.removeItem(codename);
  delete this.code;

  localStorage.removeItem(accessname);
  delete self.accessToken;

  localStorage.removeItem(typename);
  delete self.typeToken;

  localStorage.removeItem(refreshname);
  delete self.refreshToken;
}

/**
 * @public function
 */
oauth2.prototype.getRoot = function(callback) {
  this.query('files/root', callback);
  return this;
}

/**
 * @public function
 */
oauth2.prototype.getChildren = function(id, callback) {
  this.query('files/'+id+'/children', callback);
  return this;
}

/**
 * @public function
 */
oauth2.prototype.getDownload = function(id, name, noRepeat) {
  var self = this;
  var url  = this.set.resource + '/_api/v1.0/files/'+id+'/content';

  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'blob';
  xhr.setRequestHeader('Authorization', this.typeToken+' '+this.accessToken);

  xhr.onload = function() {
    if (xhr.status === 200) {
      var blob = this.response;
      if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveOrOpenBlob(blob, name);
      } else {
        var url  = window.URL.createObjectURL(blob);
        var a    = document.createElement('a');
        a.style.display = 'none';
        a.download = name;
        a.href   = url;
        document.body.appendChild(a);
        a.onclick = function() {
          a.parentNode.removeChild(a);
        }
        a.click();
      }
      return;
    }
  }
  xhr.onerror = function(e) {
    if (!noRepeat) {
      self._refreshToken(function() { self.getDownload(id, true); });
      return;
    }
  }

  xhr.send();

  return this;
}