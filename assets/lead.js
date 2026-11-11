/* Quote form -> Eye To Ad lead server (v2, 2026-11-11).
   Honeypot + 3 s timer + required consent checkbox + "agree to terms" confirm dialog.
   The consent wording and the terms version travel with the lead as proof. No PII in URLs.
   Page contract:
     <form id="quote" data-who="up to three local moving companies" ...> with fields name, phone (required),
       hidden _honey (in .hp) and _t, checkbox name="consent" with a label id="consent-text",
       button[type=submit][data-label], <p id="form-msg" role="status" tabindex="-1">
     <div id="form-done" hidden tabindex="-1"> success box
     A /terms/ page on the site. Dialog styling: style the classes .agree-dlg, .agree-dlg .agree-actions,
       .agree-yes, .agree-no in the site's own CSS (no inline styles: CSP style-src 'self'). */
(function () {
  "use strict";
  var LEAD = "https://clients.eyetoad.com/lead/send.php";
  var TERMS_VERSION = "2026-11-11";
  var form = document.getElementById("quote");
  if (!form) { return; }
  var shown = Date.now();
  var t = form.querySelector("input[name=_t]");
  if (t) { t.value = String(shown); }
  var msg = document.getElementById("form-msg");
  var btn = form.querySelector("button[type=submit]");
  var who = form.getAttribute("data-who") || "up to three companies in our partner network";

  function say(text, bad) {
    msg.textContent = text;
    msg.className = bad ? "form-msg bad" : "form-msg";
    msg.focus();
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text) { e.textContent = text; }
    return e;
  }

  // Agree-to-terms popup. Falls back to window.confirm where <dialog> is unsupported.
  function confirmTerms() {
    return new Promise(function (resolve) {
      var lines = [
        "A real person reviews your request, then sends it to " + who + ".",
        "They may call or text you about this request, including by automated means.",
        "You never have to hire anyone. Agreeing is not a condition of any purchase.",
        "Reply STOP to texts, or email zach@eyetoad.com to have your details deleted."
      ];
      if (typeof HTMLDialogElement !== "function") {
        resolve(window.confirm("Before we send it:\n\n- " + lines.join("\n- ") + "\n\nAgree to the Terms and send?"));
        return;
      }
      var d = el("dialog", "agree-dlg");
      d.setAttribute("aria-labelledby", "agree-h");
      var h = el("h2", "", "Before we send your request");
      h.id = "agree-h";
      d.appendChild(h);
      var ul = el("ul");
      lines.forEach(function (l) { ul.appendChild(el("li", "", l)); });
      d.appendChild(ul);
      var p = el("p");
      p.appendChild(document.createTextNode("Full details: "));
      var a1 = el("a", "", "Terms"); a1.href = "/terms/"; a1.target = "_blank"; a1.rel = "noopener";
      var a2 = el("a", "", "Privacy Policy"); a2.href = "/privacy/"; a2.target = "_blank"; a2.rel = "noopener";
      p.appendChild(a1); p.appendChild(document.createTextNode(" and ")); p.appendChild(a2); p.appendChild(document.createTextNode("."));
      d.appendChild(p);
      var row = el("div", "agree-actions");
      var yes = el("button", "agree-yes", "I agree, send it"); yes.type = "button";
      var no = el("button", "agree-no", "Go back"); no.type = "button";
      row.appendChild(yes); row.appendChild(no);
      d.appendChild(row);
      document.body.appendChild(d);
      function done(v) { d.close(); d.remove(); resolve(v); }
      yes.addEventListener("click", function () { done(true); });
      no.addEventListener("click", function () { done(false); });
      d.addEventListener("cancel", function (e) { e.preventDefault(); done(false); });
      d.showModal();
      yes.focus();
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    if (String(fd.get("_honey") || "").trim()) { form.reset(); say("Thanks. We got your request."); return; }
    if (Date.now() - shown < 3000) { say("Please take a moment to check your details, then send again.", true); return; }
    var digits = String(fd.get("phone") || "").replace(/\D+/g, "");
    if (digits.length === 11 && digits.charAt(0) === "1") { digits = digits.slice(1); }
    if (!String(fd.get("name") || "").trim() || digits.length !== 10) { say("Please enter your name and a 10-digit phone number.", true); return; }
    var consent = form.querySelector("input[name=consent]");
    if (!consent || !consent.checked) { say("Please tick the consent box so we can pass on your request.", true); return; }
    confirmTerms().then(function (ok) {
      if (!ok) { say("Not sent. Nothing was shared.", true); return; }
      var ctext = document.getElementById("consent-text");
      fd.set("consent", "yes");
      fd.append("consent_text", ctext ? ctext.textContent.replace(/\s+/g, " ").trim() : "");
      fd.append("consent_at", new Date().toISOString());
      fd.append("terms_agreed", "popup v" + TERMS_VERSION);
      fd.append("site", location.hostname.replace(/^www\./, ""));
      fd.append("page", location.pathname.slice(0, 200));
      fd.append("_subject", "New lead - " + location.hostname.replace(/^www\./, ""));
      btn.disabled = true;
      btn.textContent = "Sending…";
      fetch(LEAD, { method: "POST", body: fd, headers: { "Accept": "application/json" }, credentials: "omit", referrerPolicy: "strict-origin-when-cross-origin" })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || !j.ok) { throw new Error(j.message || "send failed"); } return j; }); })
        .then(function () {
          form.reset();
          form.hidden = true;
          var doneBox = document.getElementById("form-done");
          doneBox.hidden = false;
          doneBox.focus();
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = btn.getAttribute("data-label");
          say((err && err.message && err.message.indexOf("10-digit") > -1) ? err.message : "Sorry, that didn't go through. Please try again, or email zach@eyetoad.com if it keeps failing.", true);
        });
    });
  });
})();
