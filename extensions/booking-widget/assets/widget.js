(function () {
  "use strict";

  function initWidget(root) {
    var productId = root.dataset.productId;
    var proxyBase = (root.dataset.proxyBase || "/apps/booking").replace(/\/$/, "");
    var accent = root.dataset.accent || "#111111";

    root.style.setProperty("--sfb-accent", accent);

    var state = {
      staff: [],
      selectedStaff: null,
      selectedDate: null,
      selectedSlot: null,
      serviceId: null,
    };

    var staffGrid = root.querySelector("[data-sfb-staff-grid]");
    var datesEl = root.querySelector("[data-sfb-dates]");
    var slotsEl = root.querySelector("[data-sfb-slots]");
    var form = root.querySelector("[data-sfb-form]");
    var summary = root.querySelector("[data-sfb-summary]");
    var statusEl = root.querySelector("[data-sfb-status]");
    var detailsTitle = root.querySelector("[data-sfb-details-title]");
    var stepStaff = root.querySelector('[data-sfb-step="staff"]');
    var stepDate = root.querySelector('[data-sfb-step="date"]');
    var stepDetails = root.querySelector('[data-sfb-step="details"]');

    if (!productId) return;

    function show(el) { el && el.classList.remove("sfb-widget__step--hidden"); }
    function hide(el) { el && el.classList.add("sfb-widget__step--hidden"); }

    function fmtTime(iso) {
      try {
        return new Date(iso).toLocaleTimeString(undefined, {
          hour: "2-digit", minute: "2-digit",
        });
      } catch (e) { return iso; }
    }

    function fmtDate(iso) {
      try {
        return new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
          weekday: "short", month: "short", day: "numeric",
        });
      } catch (e) { return iso; }
    }

    // YYYY-MM-DD for the customer's local calendar day.
    function toDateKey(date) {
      var y = date.getFullYear();
      var m = String(date.getMonth() + 1).padStart(2, "0");
      var d = String(date.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + d;
    }

    function nextDays(n) {
      var out = [];
      var today = new Date();
      for (var i = 0; i < n; i += 1) {
        var copy = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
        out.push(toDateKey(copy));
      }
      return out;
    }

    function apiFetch(path) {
      return fetch(proxyBase + path, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            throw new Error(data && data.error ? data.error : "Request failed");
          }
          return data;
        });
      });
    }

    function loadStaff() {
      staffGrid.innerHTML = '<div class="sfb-widget__loading">Loading team…</div>';
      var today = nextDays(1)[0];

      apiFetch(
        "/api/availability?product=" + encodeURIComponent(productId) +
          "&date=" + encodeURIComponent(today)
      )
        .then(function (data) {
          state.staff = data.staff || [];
          state.serviceId = data.service && data.service.id;
          renderStaff();
        })
        .catch(function (error) {
          staffGrid.innerHTML =
            '<div class="sfb-widget__error">' +
            escapeHtml(error.message || "Could not load the team. Please refresh.") +
            "</div>";
        });
    }

    function renderStaff() {
      staffGrid.innerHTML = "";
      if (!state.staff.length) {
        staffGrid.innerHTML =
          '<div class="sfb-widget__error">No staff are available for this service yet.</div>';
        return;
      }
      state.staff.forEach(function (staff) {
        var card = document.createElement("button");
        card.type = "button";
        card.className = "sfb-staff-card";
        card.innerHTML =
          '<div class="sfb-staff-card__avatar" style="background-image:url(' +
          escapeHtml(staff.photoUrl || "") + ')">' +
          (staff.photoUrl ? "" : initials(staff.name)) +
          "</div>" +
          '<div class="sfb-staff-card__name">' + escapeHtml(staff.name) + "</div>" +
          (staff.specialties && staff.specialties.length
            ? '<div class="sfb-staff-card__spec">' +
              escapeHtml(staff.specialties.join(", ")) +
              "</div>"
            : "");
        card.addEventListener("click", function () {
          state.selectedStaff = staff;
          hide(stepStaff);
          show(stepDate);
          renderDates();
        });
        staffGrid.appendChild(card);
      });
    }

    function renderDates() {
      datesEl.innerHTML = "";
      var dates = nextDays(14);
      dates.forEach(function (dateKey, index) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sfb-date-chip";
        btn.textContent = index === 0 ? "Today" : fmtDate(dateKey);
        btn.addEventListener("click", function () {
          state.selectedDate = dateKey;
          Array.prototype.forEach.call(datesEl.children, function (child) {
            child.classList.remove("sfb-date-chip--active");
          });
          btn.classList.add("sfb-date-chip--active");
          loadSlots();
        });
        datesEl.appendChild(btn);
      });
    }

    function loadSlots() {
      slotsEl.innerHTML = '<div class="sfb-widget__loading">Checking availability…</div>';
      hide(stepDetails);

      apiFetch(
        "/api/availability?product=" + encodeURIComponent(productId) +
          "&date=" + encodeURIComponent(state.selectedDate) +
          "&staffId=" + encodeURIComponent(state.selectedStaff.id)
      )
        .then(function (data) {
          var slots = data.slots || [];
          if (!slots.length) {
            slotsEl.innerHTML =
              '<div class="sfb-widget__empty">No times on this day. Try another.</div>';
            return;
          }
          slotsEl.innerHTML = "";
          slots.forEach(function (slot) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sfb-slot";
            btn.textContent = fmtTime(slot.start);
            btn.addEventListener("click", function () {
              state.selectedSlot = slot;
              Array.prototype.forEach.call(slotsEl.children, function (child) {
                child.classList.remove("sfb-slot--active");
              });
              btn.classList.add("sfb-slot--active");
              show(stepDetails);
              renderSummary();
            });
            slotsEl.appendChild(btn);
          });
        })
        .catch(function (error) {
          slotsEl.innerHTML =
            '<div class="sfb-widget__error">' +
            escapeHtml(error.message || "Could not load times.") +
            "</div>";
        });
    }

    function renderSummary() {
      summary.innerHTML =
        "<strong>" + escapeHtml(state.selectedStaff.name) + "</strong><br>" +
        escapeHtml(fmtDate(state.selectedDate)) + " · " +
        escapeHtml(fmtTime(state.selectedSlot.start));
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!state.selectedSlot || !state.serviceId || !state.selectedStaff) {
        statusEl.textContent = "Please choose a time first.";
        return;
      }

      var formData = new FormData(form);
      var submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) submitButton.disabled = true;
      statusEl.textContent = "Sending…";

      fetch(proxyBase + "/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          serviceId: state.serviceId,
          staffId: state.selectedStaff.id,
          start: state.selectedSlot.start,
          customerName: formData.get("customerName"),
          customerEmail: formData.get("customerEmail"),
        }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok || !data.ok) {
              throw new Error(data && data.error ? data.error : "Something went wrong.");
            }
            return data;
          });
        })
        .then(function (data) {
          hide(stepStaff);
          hide(stepDate);
          form.reset();
          form.style.display = "none";
          if (detailsTitle) detailsTitle.textContent = "Your booking";
          statusEl.innerHTML =
            '<div class="sfb-widget__success">Your booking request has been received.' +
            (data.manageUrl
              ? ' Save this link to view, cancel or reschedule it: <a href="' +
                escapeHtml(data.manageUrl) +
                '">manage your booking</a>.'
              : "") +
            "</div>";
        })
        .catch(function (error) {
          if (submitButton) submitButton.disabled = false;
          statusEl.textContent = error.message || "Network error. Please try again.";
        });
    });

    function initials(name) {
      return String(name || "")
        .split(" ")
        .map(function (part) { return part.charAt(0); })
        .slice(0, 2)
        .join("")
        .toUpperCase();
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, function (character) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
      });
    }

    loadStaff();
  }

  function boot() {
    document.querySelectorAll("[data-sfb-widget]").forEach(function (root) {
      if (!root.dataset.sfbInit) {
        root.dataset.sfbInit = "1";
        initWidget(root);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
