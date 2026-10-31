/* Load with defer; works with several selectors and dynamically mounted views. */
(function (w, d) {
  'use strict';
  if (!w.EPSTheme) return;
  var groups = [];
  function refresh() {
    for (var i = 0; i < groups.length; i++) {
      var buttons = groups[i].querySelectorAll('[data-eps-theme]');
      for (var j = 0; j < buttons.length; j++) {
        buttons[j].setAttribute('aria-pressed',
          String(buttons[j].getAttribute('data-eps-theme') === w.EPSTheme.get()));
      }
      var status = groups[i].querySelector('[data-eps-theme-status]');
      if (status) status.textContent = w.EPSTheme.isPersistent() ? '' :
        'Choix appliqué pour cette session ; la mémorisation est indisponible.';
    }
  }
  function mount(scope) {
    var found = (scope || d).querySelectorAll('[data-eps-theme-selector]');
    for (var i = 0; i < found.length; i++) {
      if (groups.indexOf(found[i]) >= 0) continue;
      groups.push(found[i]);
      var buttons = found[i].querySelectorAll('[data-eps-theme]');
      for (var j = 0; j < buttons.length; j++) {
        buttons[j].addEventListener('click', function () {
          w.EPSTheme.set(this.getAttribute('data-eps-theme'));
        });
      }
    }
    refresh();
  }
  w.EPSTheme.subscribe(refresh);
  w.EPSTheme.mountControls = mount;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { mount(d); });
  else mount(d);
})(window, document);
