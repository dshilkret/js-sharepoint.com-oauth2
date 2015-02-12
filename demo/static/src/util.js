function cameCase(name) {
  return name.replace(/\-(\w)/g, 
    function(o) { 
      return o[1].toUpperCase();
    });
}

function getStyle(el, name) {
  var style;
  var dv = el.ownerDocument.defaultView;

  if (!dv || !dv.getMatchedCSSRules) {
    style = window.getComputedStyle(el);
    name = cameCase(name);
    return style[name];
  }

  var rules = el.ownerDocument.defaultView.getMatchedCSSRules(el, '');

  for (var i=0,len=rules.length; i<len; i++) {
    style = rules[i].style[name] || style;
  }

  return style;
}

function getInt(v) {
  if (!v) { return 0; }
  var t = parseInt(v.replace(/[^-\d\.]+/g, '')) 
  return isNaN(t) ? 0 : t;
}

function getWidth(el) {
  if (el.offsetWidth) return el.offsetWidth;
  if (el.clientWidth) return el.clientWidth;
  if (getInt(el.style.width)) return getInt(el.style.width);
  return getInt(getStyle(el, 'width'));
}

function getHeight(el) {
  if (el.clientHeight) return el.clientHeight;
  if (getInt(el.style.height)) return getInt(el.style.height);
  return getInt(getStyle(el, 'height'));
}