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
    self._updateToken(xhr.response);
    callback.call(self);
  }

  var data = {};
  data['grant_type']    = 'refresh_token';
  data['refresh_token'] = this.token['refresh_token'];
  data['resource']      = this.set['resource'];
  data['client_id']     = this.set['client_id'];
  data['client_secret'] = this.set['client_secret'];

  var params = this._getTokenForm(data, null, this.set['authorization']+'/'+this.set['token']);
  xhr.send(params);
}

oauth2.prototype._getTokenObject = function(response) {
  if (!response) return null;

  return JSON.parse(response, function(k, v) {
    if (k === 'expires_on') {
      return new Date(parseInt(v*1000));
    }
    if (k === 'not_before') {
      return new Date(parseInt(v*1000));
    }

    return v;
  });
}

/**
 * @private function
 */
oauth2.prototype._updateToken = function(response) {
  localStorage['access_' + this.namespace] = response;
  this.token = this._getTokenObject(response);
}

/**
 * @private function

 * Debido a problemas con el Cross-Domain
 * no podemos pedir el token de
 * acceso desde el navegador, asi que un proxy
 * hara el trabajo.
 */
oauth2.prototype._getAccessToken = function(code, action) {
  var self  = this;
  var token = this.token = this._getTokenObject(localStorage['access_' + this.namespace]);

  if (!token) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', this.set['access_token'], true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=utf-8');

    xhr.onload = function() {
      if (xhr.status !== 200) return;
      self._updateToken(xhr.response);
      token = self.token;
      action.callThenFns(self, [token]);
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
    action.callThenFns(self, [token]);
  }, 100);
}

/**
 * @private function
 */
oauth2.prototype._createAction = function() {
  var a = {};
  a.thenFns = [];
  a.elseFns = [];
  a.then = function(fn) { this.thenFns.push(fn); return this; }
  a.else = function(fn) { this.elseFns.push(fn); return this; }

  a.callThenFns = function(scope, args) {
    args = args || [];
    this.thenFns.forEach(function(fn) { fn.apply(scope, args); });
  }

  a.callElseFns = function(scope, args) {
    args = args || [];
    this.elseFns.forEach(function(fn) { fn.apply(scope, args); });
  }

  return a;
}

/**
 * @public function
 */
oauth2.prototype.getToken = function(resource, action) {
  action = action || this._createAction();

  // Guardamos el resource en el setting.
  this.set.resource = resource;
  this.path = '/_api/v1.0/' + (/\-my/.test(resource) ? 'me/' : '') ;

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
oauth2.prototype.query = function(method, query, action) {
  action = action || this._createAction();

  var self = this;

  /**
   * Validamos que el token no este expirado, sino
   * pedimos un nuevo token.
   */
  if (new Date() >= this.token['expires_on']) {
    this._refreshToken(function() { self.query(method, query, action); });
    return action;
  }

  var url  = this.set.resource + this.path + query;

  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);
  xhr.setRequestHeader('Authorization', this.token['token_type']+' '+this.token['access_token']);
  xhr.setRequestHeader('Accept', 'application/json');
  xhr.onload = function() {
    if (xhr.status === 200) {
      action.callThenFns(self, [JSON.parse(xhr.response)]);
      return;
    }
  }

  xhr.onreadystatechange = function(e) {
    /**
     * No tiene privilegios para ejecutar
     * esta opción.
     */
    if (e.target.readyState === 4 && e.target.status === 401) {
      action.callElseFns(self, [e]);
    }
  }

  xhr.onerror = function(e) {
    /**
     * 
     */
    self._refreshToken(function() { self.query(method, query, action); });
  }
  xhr.send();

  return action;
}

/**
 * @public function
 */
oauth2.prototype.clear = function() {
  localStorage.removeItem('code_' + this.namespace);
  delete this.code;

  localStorage.removeItem('access_' + this.namespace);
  delete this.token;
}

/**
 * @public function
 */
oauth2.prototype.getRoot = function() {
  return this.query('GET', 'files/root');
}

/**
 * @public function
 */
oauth2.prototype.getChildren = function(id) {
  return this.query('GET', 'files/'+id+'/children');
}

/**
 * @public function
 */
oauth2.prototype.createFolder = function(parentId, folderName) {
  return this.query('PUT', 'files/'+parentId+'/children/'+folderName);
}

/**
 * @public function
 */
oauth2.prototype.sendFile = function(parentId, name, file, fnProgress, action) {
  fnProgress = fnProgress || function() {};
  action = action || this._createAction();

  var self = this;

  /**
   * Validamos que el token no este expirado, sino
   * pedimos un nuevo token.
   */
  if (new Date() >= this.token['expires_on']) {
    this._refreshToken(function() { self.createFolder(parentId, name, file, fnProgress, action); });
    return action;
  }

  var url  = this.set.resource + this.path + 'files/'+parentId+'/children/'+name+'/content';
  
  var xhr  = new XMLHttpRequest();
  xhr.open('PUT', url, true);
  xhr.setRequestHeader('Authorization', this.token['token_type']+' '+this.token['access_token']);

  xhr.upload.onprogress = function(e) {
    fnProgress.call(self, (e.loaded/e.total) * 100, e);
  }

  xhr.onload = function() {
    if (xhr.status === 200) {
      action.callThenFns(self, [JSON.parse(xhr.response)]);
      return;
    }
  }

  xhr.onerror = function(e) {
    self._refreshToken(function() { self.createFolder(parentId, name, file, fnProgress, action); });
  }

  xhr.send(file);

  return action
}

/**
 * @public function
 */
oauth2.prototype.delFile = function(fileId) {
  return this.query('DELETE', 'files/'+fileId);
}

/**
 * @public function
 */
oauth2.prototype.getDownload = function(id, name) {
  var self = this;

  /**
   * Validamos que el token no este expirado, sino
   * pedimos un nuevo token.
   */
  if (new Date() >= this.token['expires_on']) {
    this._refreshToken(function() { self.getDownload(id, name); });
    return this;
  }

  var url  = this.set.resource + this.path + 'files/'+id+'/content';

  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.responseType = 'blob';
  xhr.setRequestHeader('Authorization', this.token['token_type']+' '+this.token['access_token']);

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
      self._refreshToken(function() { self.getDownload(id, name); });
      return;
    }
  }

  xhr.send();

  return this;
}