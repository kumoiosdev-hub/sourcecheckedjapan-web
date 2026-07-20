(function () {
  "use strict";

  // JbO self-hosted measurement (no cookies, no persistent IDs, no third-party analytics).
  // Event schema = C1 spec. Backend = own serverless endpoint (Twilio) + Sync counters.
  var ENDPOINT = "https://jbo-metrics-3370-prod.twil.io/ingest";
  window.JBO_INGEST = ENDPOINT;

  var memory = new Set();
  var prefix = "jbo:event:";

  function alreadySent(name) {
    if (memory.has(name)) return true;
    try {
      return window.sessionStorage.getItem(prefix + name) === "1";
    } catch (_) {
      return false;
    }
  }

  function remember(name) {
    memory.add(name);
    try {
      window.sessionStorage.setItem(prefix + name, "1");
    } catch (_) {}
  }

  function deliver(name) {
    var body = new URLSearchParams({ kind: "event", e: name });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
    } catch (_) {}
    try {
      fetch(ENDPOINT, { method: "POST", body: body, keepalive: true }).catch(function () {});
    } catch (_) {}
  }

  function trackOnce(name) {
    if (!name || alreadySent(name)) return;
    remember(name);
    deliver(name);
  }

  document.querySelectorAll("[data-jbo-cta]").forEach(function (cta) {
    var experiment = cta.dataset.jboCta;
    var observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) {
        return entry.isIntersecting && entry.intersectionRatio >= 0.5;
      })) {
        trackOnce("cta_impression__" + experiment);
        observer.disconnect();
      }
    }, { threshold: [0.5] });
    observer.observe(cta);
  });

  document.addEventListener("click", function (event) {
    var target = event.target.closest("[data-jbo-events]");
    if (!target) return;
    target.dataset.jboEvents.split(/\s+/).filter(Boolean).forEach(trackOnce);
  });

  document.querySelectorAll("form[data-jbo-form]").forEach(function (form) {
    var experiment = form.dataset.jboForm;
    var start = function () {
      trackOnce("form_start__" + experiment);
      form.removeEventListener("focusin", start);
      form.removeEventListener("input", start);
    };
    form.addEventListener("focusin", start);
    form.addEventListener("input", start);
  });

  // Sessionized-unique page view (deduped per tab session; no identifier leaves the browser)
  var path = (location.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  trackOnce("page_view__" + path.replace(/[^a-z0-9\/\-]/g, ""));

  window.jboTrackOnce = trackOnce;

  // Shared signup submitter for CTA forms (posts to our endpoint; no third-party form service)
  window.jboSignup = function (fields, onOk, onErr) {
    var body = new URLSearchParams(fields);
    body.set("kind", "signup");
    fetch(ENDPOINT, { method: "POST", body: body })
      .then(function (r) { return r.json(); })
      .then(function (j) { (j && j.ok ? onOk : onErr)(); })
      .catch(function () { onErr(); });
  };
})();
