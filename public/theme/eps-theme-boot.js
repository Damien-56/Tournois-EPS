/* eps.theme 1.0.0 — synchronous bootstrap for Tournois EPS sports individuels. */
(function (w, d) {
  'use strict';
  var root = d.documentElement;
  var app = 'tournois-sports-individuels';
  var key = 'eps.theme.v1.' + app;
  var current = 'light';
  var persistent = true;
  var listeners = [];
  function valid(value) { return value === 'light' || value === 'dark'; }
  function read() {
    try {
      var value = w.localStorage.getItem(key);
      if (valid(value)) return value;
    } catch (error) { persistent = false; }
    return 'light';
  }
  function paint() {
    root.setAttribute('data-theme', current);
    root.style.colorScheme = current;
    var meta = d.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', current === 'dark' ? '#111820' : '#f8f8fc');
  }
  function notify() {
    for (var index = 0; index < listeners.length; index += 1) listeners[index](current, persistent);
  }
  function set(value) {
    if (!valid(value)) return false;
    current = value;
    persistent = true;
    try { w.localStorage.setItem(key, value); }
    catch (error) { persistent = false; }
    paint();
    notify();
    return true;
  }
  current = read();
  paint();
  w.EPSTheme = {
    version: '1.0.0',
    app: app,
    key: key,
    get: function () { return current; },
    set: set,
    isPersistent: function () { return persistent; },
    subscribe: function (listener) {
      listeners.push(listener);
      return function () {
        var index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    }
  };
  w.addEventListener('storage', function (event) {
    if (event.key !== key && event.key !== null) return;
    current = read();
    paint();
    notify();
  });
})(window, document);
