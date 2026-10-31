/* ==========================================================================
   Kettlebell 30 lb · Bilingual Public Client Logic (ES / EN)
   ========================================================================== */

(() => {
  const DATA = window.KB_PUBLIC_DATA;
  if (!DATA) {
    console.error("No se encontró window.KB_PUBLIC_DATA");
    return;
  }

  const STORAGE_KEY_LOGS = "kb30_public_logs_v1";
  const STORAGE_KEY_GATES = "kb30_public_gates_v1";
  const STORAGE_KEY_LANG = "kb30_public_lang_v2";

  // Idioma actual: Default SIEMPRE "es" (Español).
  // Solo usa "en" si el usuario explícitamente cambió el idioma usando el botón en esta versión.
  let currentLang = localStorage.getItem(STORAGE_KEY_LANG) || "es";
  if (currentLang !== "en" && currentLang !== "es") {
    currentLang = "es";
  }

  // Estado del entrenamiento
  let currentDay = getInitialDay();
  let timerInterval = null;
  let timerRemainingSeconds = 14 * 60;
  let timerRunning = false;

  // --------------------------------------------------------------------------
  // Persistencia Local
  // --------------------------------------------------------------------------
  function loadLogs() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || "{}");
    } catch {
      return {};
    }
  }

  function saveLogs(logs) {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  }

  function loadGates() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_GATES) || "{}");
    } catch {
      return {};
    }
  }

  function saveGates(gates) {
    localStorage.setItem(STORAGE_KEY_GATES, JSON.stringify(gates));
  }

  function t(key) {
    return DATA.i18n[currentLang]?.[key] || DATA.i18n.es?.[key] || key;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // --------------------------------------------------------------------------
  // Primer Día Pendiente (Self-paced)
  // --------------------------------------------------------------------------
  function getInitialDay() {
    const logs = loadLogs();
    const firstPending = DATA.days.find((d) => {
      const entry = logs[String(d.day)] || {};
      return entry.status !== "Closed";
    });
    return firstPending ? firstPending.day : 1;
  }

  // --------------------------------------------------------------------------
  // Gates de Seguridad
  // --------------------------------------------------------------------------
  function isLoadGateApproved(gates) {
    const loadList = DATA.gates[currentLang]?.load_gate?.checklist || DATA.gates.es.load_gate.checklist;
    return loadList.every((item) => Boolean(gates[item.id]));
  }

  function isSwingGatePreD12Approved(gates) {
    const swingList = DATA.gates[currentLang]?.swing_gate?.checklist || DATA.gates.es.swing_gate.checklist;
    return swingList
      .filter((item) => item.id !== "sg_6")
      .every((item) => Boolean(gates[item.id]));
  }

  function isSwingGateD19Approved(gates) {
    const swingList = DATA.gates[currentLang]?.swing_gate?.checklist || DATA.gates.es.swing_gate.checklist;
    return swingList.every((item) => Boolean(gates[item.id]));
  }

  // --------------------------------------------------------------------------
  // Notificación Toast
  // --------------------------------------------------------------------------
  let toastTimeout = null;
  function showToast(msg) {
    const toast = document.getElementById("toast-msg");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove("show");
    }, 2800);
  }

  // --------------------------------------------------------------------------
  // Audio Beep
  // --------------------------------------------------------------------------
  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch {
      // AudioContext policy fallback
    }
  }

  // --------------------------------------------------------------------------
  // Actualizar Textos Globales según Idioma
  // --------------------------------------------------------------------------
  function applyLanguage() {
    document.documentElement.lang = currentLang;
    document.title = currentLang === "es"
      ? "Kettlebell 30 lb · Programa de 30 Días"
      : "30-Day Kettlebell Program (30 lb / 14 kg)";

    // Botón toggle de idioma (ofrece cambiar al otro idioma)
    const langLabel = document.getElementById("lang-label");
    const langBtn = document.getElementById("lang-toggle-btn");
    if (langLabel) {
      langLabel.textContent = currentLang === "es" ? "English" : "Español";
    }
    if (langBtn) {
      const hint = currentLang === "es" ? "Switch to English" : "Cambiar a Español";
      langBtn.setAttribute("aria-label", hint);
      langBtn.setAttribute("title", hint);
    }

    // Cabecera y botones fijos
    const appTitle = document.getElementById("app-title");
    const appSubtitle = document.getElementById("app-subtitle");
    if (appTitle) appTitle.textContent = t("title");
    if (appSubtitle) appSubtitle.textContent = t("subtitle");

    document.getElementById("btn-guide-text").textContent = t("btn_guide");
    document.getElementById("btn-gates-text").textContent = t("btn_gates");
    document.getElementById("btn-export-text").textContent = t("btn_export");
    const exportBtn = document.getElementById("export-progress-btn");
    if (exportBtn) {
      exportBtn.title = currentLang === "es"
        ? "Descargar copia de seguridad del progreso"
        : "Download progress backup";
    }
    const gridTitle = document.getElementById("day-grid-title");
    const gridHint = document.getElementById("day-grid-hint");
    if (gridTitle) gridTitle.textContent = t("day_grid_title");
    if (gridHint) gridHint.textContent = t("day_grid_hint");
    document.getElementById("footer-text").textContent = t("footer_text");

    // Modal de Gates
    const gData = DATA.gates[currentLang] || DATA.gates.es;
    document.getElementById("gate-dialog-title").textContent = t("btn_gates");
    document.getElementById("gate-dialog-subtitle").textContent = gData.load_gate.subtitle || "";
    document.getElementById("load-gate-title").textContent = gData.load_gate.title;
    document.getElementById("load-gate-desc").textContent = gData.load_gate.rule;
    document.getElementById("swing-gate-title").textContent = gData.swing_gate.title;
    document.getElementById("swing-gate-desc").textContent = gData.swing_gate.rule;
    document.getElementById("gate-save-btn").textContent = currentLang === "es" ? "Guardar y Cerrar" : "Save & Close";

    // Modal de Información / Fuentes
    document.getElementById("info-dialog-title").textContent = t("btn_guide");
    document.getElementById("info-dialog-subtitle").textContent = currentLang === "es"
      ? "Estructura del programa y demostraciones verificadas"
      : "Program structure and verified video demonstrations";
    document.getElementById("tab-overview-btn").textContent = currentLang === "es" ? "Visión General" : "Overview";
    document.getElementById("tab-table-btn").textContent = currentLang === "es" ? "Tabla 30 Días" : "30-Day Table";
    document.getElementById("tab-sources-btn").textContent = currentLang === "es" ? "Fuentes" : "Sources";
    document.getElementById("col-day").textContent = currentLang === "es" ? "Día" : "Day";
    document.getElementById("col-prescription").textContent = currentLang === "es" ? "Prescripción" : "Prescription";
    document.getElementById("col-rpe").textContent = "RPE";

    renderOverviewContent();
    renderSummaryStrip();
    renderDayCarousel();
    renderWorkout();
  }

  function renderOverviewContent() {
    const overview = document.getElementById("overview-content");
    if (!overview) return;

    if (currentLang === "es") {
      overview.innerHTML = `
        <h3>Estructura del Programa (30 Sesiones)</h3>
        <p>Un programa progresivo diseñado para construir fuerza, resistencia y movilidad utilizando una sola kettlebell de 30 lb (13,6 kg) o adaptaciones con peso corporal.</p>
        <ul>
          <li><strong>Duración por sesión:</strong> 24 minutos nominales (4 min calentamiento + 14 min bloque principal + 3 min vuelta a la calma).</li>
          <li><strong>Patrones principales:</strong> Bisagra de cadera (Deadlift, Swings), Sentadilla Goblet, Remo apoyado a una mano, Press de suelo y Suitcase Carry.</li>
          <li><strong>Seguridad primero:</strong> Verificación de <em>Gate de Carga</em> antes de usar peso y <em>Gate de Swing</em> antes de iniciar balísticos en el Día 12.</li>
        </ul>
      `;
    } else {
      overview.innerHTML = `
        <h3>Program Structure (30 Sessions)</h3>
        <p>A progressive program designed to build strength, work capacity, and joint health using a single 30 lb (14 kg) kettlebell or bodyweight regressions.</p>
        <ul>
          <li><strong>Session Duration:</strong> 24 nominal minutes (4 min warm-up + 14 min main block + 3 min cool-down).</li>
          <li><strong>Primary Movement Patterns:</strong> Hip Hinge (Deadlift, Swings), Goblet Squat, Supported Single-Arm Row, Floor Press, and Suitcase Carry.</li>
          <li><strong>Safety First:</strong> Daily <em>Load Gate</em> verification before lifting weight and full <em>Swing Gate</em> verification before ballistic swings in Day 12.</li>
        </ul>
      `;
    }
  }

  // --------------------------------------------------------------------------
  // Barra de Progreso Superior
  // --------------------------------------------------------------------------
  function renderSummaryStrip() {
    const logs = loadLogs();
    let closedCount = 0;

    for (const d of DATA.days) {
      const entry = logs[String(d.day)] || {};
      if (entry.status === "Closed") closedCount += 1;
    }

    const badge = document.getElementById("summary-badge");
    const text = document.getElementById("summary-text");
    const progress = document.getElementById("cycle-progress");

    if (badge) badge.textContent = `${closedCount} / 30`;
    if (text) text.textContent = `${closedCount} ${t("summary_sessions")}`;
    if (progress) {
      progress.value = closedCount;
      progress.textContent = `${Math.round((closedCount / 30) * 100)}%`;
    }
  }

  // --------------------------------------------------------------------------
  // Selector de Días (Grid Tipo Calendario D01 a D30)
  // --------------------------------------------------------------------------
  function renderDayCarousel() {
    const carousel = document.getElementById("day-carousel");
    if (!carousel) return;
    const logs = loadLogs();

    carousel.innerHTML = "";

    DATA.days.forEach((d) => {
      const entry = logs[String(d.day)] || {};
      const isClosed = entry.status === "Closed";
      const isSelected = d.day === currentDay;
      const isGateDay = d.day === 12 || d.day === 19;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `day-pill ${isClosed ? "completed" : ""}`;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", isSelected ? "true" : "false");
      btn.setAttribute("aria-label", `${t("day_prefix")} ${d.day}${isClosed ? ` (${t("completed_tag")})` : ""}`);
      btn.dataset.day = d.day;

      btn.innerHTML = `
        <span class="day-pill-num">${t("pill_prefix")}${String(d.day).padStart(2, "0")}</span>
        <div class="day-pill-indicators">
          ${isClosed ? '<span class="day-pill-check" aria-hidden="true">✓</span>' : ""}
          ${isGateDay ? '<span class="day-pill-gate" title="Gate de Seguridad" aria-hidden="true">🛡️</span>' : ""}
        </div>
      `;

      btn.addEventListener("click", () => {
        currentDay = d.day;
        renderDayCarousel();
        renderWorkout();
        document.getElementById("main-workout")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      carousel.appendChild(btn);
    });
  }

  // --------------------------------------------------------------------------
  // Render: Sesión Principal del Día
  // --------------------------------------------------------------------------
  function renderWorkout() {
    const container = document.getElementById("workout-container");
    if (!container) return;

    const d = DATA.days.find((item) => item.day === currentDay) || DATA.days[0];
    const dayLang = d[currentLang] || d.es;
    const logs = loadLogs();
    const gates = loadGates();
    const entry = logs[String(d.day)] || {
      status: "in progress",
      real_minutes: "24",
      rpe: "5",
      symptoms: "no",
      notes: "",
    };

    // Aviso de Gate para D12 y D19
    let gateAlertHtml = "";
    if (d.day === 12) {
      const ok12 = isSwingGatePreD12Approved(gates);
      gateAlertHtml = `
        <div class="alert-banner" role="alert">
          <strong>⚠️ ${currentLang === "es" ? "Primera Exposición a Swings (Día 12):" : "First Swing Exposure (Day 12):"}</strong>
          ${
            ok12
              ? (currentLang === "es"
                ? "Has verificado los requisitos del Gate de Swing. Puedes realizar 3–5 series de 5 swings con descanso ≥60 s y RPE ≤5."
                : "Swing Gate requirements verified. You may perform 3–5 sets of 5 swings with ≥60 s rest and RPE ≤5.")
              : (currentLang === "es"
                ? "No has validado el Gate de Swing antes de esta sesión. Según la regla de seguridad, hoy corresponde ejecutar <strong>3×6 deadlifts o bisagras sin carga</strong>."
                : "Swing Gate not yet verified. Per safety guidelines, perform <strong>3×6 controlled deadlifts or unloaded hinges</strong> today.")
          }
          <div style="margin-top: 0.4rem;">
            <button type="button" class="btn btn-sm btn-secondary" id="banner-check-gates">
              ${currentLang === "es" ? "Verificar Gate de Swing" : "Verify Swing Gate"}
            </button>
          </div>
        </div>
      `;
    } else if (d.day === 19) {
      const ok19 = isSwingGateD19Approved(gates);
      gateAlertHtml = `
        <div class="alert-banner" role="alert">
          <strong>⚠️ ${currentLang === "es" ? "Swing Opcional (Día 19):" : "Optional Swing (Day 19):"}</strong>
          ${
            ok19
              ? (currentLang === "es"
                ? "Prerrequisitos y recuperación post-D12 validados. Puedes repetir la dosis tolerada de swings."
                : "Prerequisites and Day 12 recovery verified. You may repeat your tolerated swing dose.")
              : (currentLang === "es"
                ? "Falta validar la recuperación habitual tras el Día 12. Hoy no se usa carga: realiza únicamente <strong>3×5 bisagras lentas sin carga (0 lb)</strong> con 45 s de descanso."
                : "Post-Day 12 recovery not yet confirmed. Zero kettlebell load today: perform strictly <strong>3×5 slow bodyweight hinges</strong> with 45 s rest.")
          }
          <div style="margin-top: 0.4rem;">
            <button type="button" class="btn btn-sm btn-secondary" id="banner-check-gates">
              ${currentLang === "es" ? "Verificar Gate Día 19" : "Verify Day 19 Gate"}
            </button>
          </div>
        </div>
      `;
    }

    // Tarjetas de ejercicios del día
    const exerciseCardsHtml = d.exercise_ids
      .map((eid) => {
        const exObj = DATA.exercises[eid];
        if (!exObj) return "";
        const exLang = exObj[currentLang] || exObj.es;

        return `
          <div class="exercise-tile">
            <div class="exercise-tile-title">
              <h4>${escapeHtml(exLang.name)}</h4>
              <p class="exercise-tile-pattern">${escapeHtml(exLang.pattern)}</p>
            </div>

            <div class="exercise-tile-actions">
              <button type="button" class="btn btn-sm btn-primary view-exercise-btn" data-exercise-id="${eid}">
                ${t("btn_view_technique")}
              </button>
            </div>

            <details class="exercise-regression-details">
              <summary>${t("btn_alternatives")}</summary>
              <div class="exercise-regression-content">
                <p><strong>${t("alt_unloaded")}</strong> ${escapeHtml(exLang.alternatives.unloaded)}</p>
                <p><strong>${t("alt_intermediate")}</strong> ${escapeHtml(exLang.alternatives.intermediate)}</p>
                <p style="margin-bottom:0;"><strong>${t("alt_stop")}</strong> ${escapeHtml(exLang.stop_criteria)}</p>
              </div>
            </details>
          </div>
        `;
      })
      .join("");

    container.innerHTML = `
      <!-- Cabecera de la Sesión -->
      <section class="session-hero-card">
        <div class="session-hero-header">
          <div class="session-title-group">
            <h2>${t("day_prefix")} ${String(d.day).padStart(2, "0")} · ${escapeHtml(dayLang.type)}</h2>
            <div class="session-meta-tags">
              <span class="tag-badge badge-time">${t("tag_time")}</span>
              <span class="tag-badge badge-rpe">${t("tag_rpe")} ${escapeHtml(d.rpe_target)}/10</span>
            </div>
          </div>
          <div class="session-nav-arrows">
            <button type="button" class="btn btn-secondary btn-icon" id="prev-day-btn" ${d.day <= 1 ? "disabled" : ""} title="${t("prev_day")}" aria-label="${t("prev_day")}">←</button>
            <button type="button" class="btn btn-secondary btn-icon" id="next-day-btn" ${d.day >= 30 ? "disabled" : ""} title="${t("next_day")}" aria-label="${t("next_day")}">→</button>
          </div>
        </div>

        ${gateAlertHtml}

        <!-- Cronómetro de la Sesión -->
        <div class="timer-section" aria-label="${t("timer_title")}">
          <div class="timer-display-group">
            <div class="timer-clock" id="timer-clock">${formatTime(timerRemainingSeconds)}</div>
            <div class="timer-controls">
              <button type="button" class="btn btn-primary" id="timer-toggle-btn">
                ${timerRunning ? t("timer_pause") : t("timer_start")}
              </button>
              <button type="button" class="btn btn-ghost btn-sm" id="timer-reset-btn" title="${t("timer_reset")}">
                ${t("timer_reset")}
              </button>
            </div>
          </div>

          <div class="timer-presets" role="group" aria-label="Timer presets">
            <button type="button" class="timer-preset-btn" data-sec="840">${currentLang === "es" ? "14m Bloque" : "14m Main Block"}</button>
            <button type="button" class="timer-preset-btn" data-sec="240">${currentLang === "es" ? "4m Calentamiento" : "4m Warm-up"}</button>
            <button type="button" class="timer-preset-btn" data-sec="180">${currentLang === "es" ? "3m Fin" : "3m Cool-down"}</button>
            <button type="button" class="timer-preset-btn" data-sec="75">${currentLang === "es" ? "75s Descanso" : "75s Rest"}</button>
            <button type="button" class="timer-preset-btn" data-sec="60">${currentLang === "es" ? "60s Descanso" : "60s Rest"}</button>
            <button type="button" class="timer-preset-btn" data-sec="30">${currentLang === "es" ? "30s Transición" : "30s Transition"}</button>
          </div>
        </div>
      </section>

      <!-- Pasos del Entrenamiento (1, 2, 3) -->
      <div class="workout-steps">
        <!-- Paso 1: Calentamiento -->
        <section class="step-card">
          <div class="step-card-header">
            <span class="step-badge">1</span>
            <h3>${t("step_1_title")}</h3>
            <span class="step-duration">${t("step_1_time")}</span>
          </div>
          <p style="margin: 0; font-size: 0.95rem;">${escapeHtml(dayLang.warmup_4min)}</p>
        </section>

        <!-- Paso 2: Bloque Principal -->
        <section class="step-card">
          <div class="step-card-header">
            <span class="step-badge">2</span>
            <h3>${t("step_2_title")}</h3>
            <span class="step-duration">${t("step_2_time")}</span>
          </div>

          <div class="main-prescription-banner">
            <p>${escapeHtml(dayLang.prescription)}</p>
            <p class="prescription-criterion"><strong>${t("success_criterion_label")}</strong> ${escapeHtml(dayLang.success_criteria)}</p>
          </div>

          <div class="exercise-cards-list">
            ${exerciseCardsHtml}
          </div>
        </section>

        <!-- Paso 3: Vuelta a la Calma -->
        <section class="step-card">
          <div class="step-card-header">
            <span class="step-badge">3</span>
            <h3>${t("step_3_title")}</h3>
            <span class="step-duration">${t("step_3_time")}</span>
          </div>
          <p style="margin: 0; font-size: 0.95rem;">${escapeHtml(dayLang.cooldown_3min)}</p>
        </section>
      </div>

      <!-- Registro de Práctica Rápido -->
      <section class="completion-card">
        <h3 style="margin-top:0; margin-bottom: 0.75rem;">${t("log_title")}</h3>
        <form id="workout-log-form" class="completion-form">
          <div class="completion-status-group">
            <button type="button" class="status-choice-btn ${entry.status === "Closed" ? "selected" : ""}" data-status="Closed">
              ${t("btn_status_closed")}
            </button>
            <button type="button" class="status-choice-btn ${entry.status === "in progress" ? "selected" : ""}" data-status="in progress">
              ${t("btn_status_progress")}
            </button>
            <button type="button" class="status-choice-btn ${entry.status === "omitida" ? "selected omit" : ""}" data-status="omitida">
              ${t("btn_status_skipped")}
            </button>
          </div>

          <div class="form-row">
            <div class="input-group">
              <label for="log-minutes">${t("label_minutes")}</label>
              <input type="number" id="log-minutes" min="0" max="120" value="${escapeHtml(entry.real_minutes || "24")}">
            </div>

            <div class="input-group">
              <label for="log-rpe">${t("label_rpe")}</label>
              <div class="rpe-slider-wrapper">
                <input type="range" id="log-rpe" min="1" max="10" step="0.5" value="${escapeHtml(entry.rpe || "5")}">
                <span class="rpe-label-val" id="rpe-display">${escapeHtml(entry.rpe || "5")}/10</span>
              </div>
            </div>

            <div class="input-group">
              <label for="log-symptoms">${t("label_symptoms")}</label>
              <select id="log-symptoms">
                <option value="no" ${entry.symptoms === "no" ? "selected" : ""}>${t("symptoms_no")}</option>
                <option value="sí" ${entry.symptoms === "sí" ? "selected" : ""}>${t("symptoms_yes")}</option>
              </select>
            </div>
          </div>

          <div class="input-group">
            <label for="log-notes">${t("label_notes")}</label>
            <input type="text" id="log-notes" value="${escapeHtml(entry.notes)}" placeholder="${t("notes_placeholder")}">
          </div>
        </form>
      </section>
    `;

    // Eventos
    document.getElementById("prev-day-btn")?.addEventListener("click", () => {
      if (currentDay > 1) {
        currentDay -= 1;
        renderDayCarousel();
        renderWorkout();
      }
    });

    document.getElementById("next-day-btn")?.addEventListener("click", () => {
      if (currentDay < 30) {
        currentDay += 1;
        renderDayCarousel();
        renderWorkout();
      }
    });

    document.getElementById("banner-check-gates")?.addEventListener("click", openGateModal);

    container.querySelectorAll(".view-exercise-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        openExerciseModal(btn.getAttribute("data-exercise-id"));
      });
    });

    setupTimerEvents();
    setupLogFormEvents(d, entry);
  }

  // --------------------------------------------------------------------------
  // Cronómetro
  // --------------------------------------------------------------------------
  function setupTimerEvents() {
    const clock = document.getElementById("timer-clock");
    const toggleBtn = document.getElementById("timer-toggle-btn");
    const resetBtn = document.getElementById("timer-reset-btn");

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        if (timerRunning) {
          pauseTimer();
        } else {
          startTimer();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        pauseTimer();
        timerRemainingSeconds = 14 * 60;
        if (clock) clock.textContent = formatTime(timerRemainingSeconds);
        if (toggleBtn) toggleBtn.textContent = t("timer_start");
      });
    }

    document.querySelectorAll(".timer-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        pauseTimer();
        timerRemainingSeconds = parseInt(btn.getAttribute("data-sec"), 10) || 60;
        if (clock) clock.textContent = formatTime(timerRemainingSeconds);
        if (toggleBtn) toggleBtn.textContent = t("timer_start");
      });
    });
  }

  function startTimer() {
    timerRunning = true;
    const toggleBtn = document.getElementById("timer-toggle-btn");
    if (toggleBtn) toggleBtn.textContent = t("timer_pause");

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (timerRemainingSeconds > 0) {
        timerRemainingSeconds -= 1;
        const clock = document.getElementById("timer-clock");
        if (clock) clock.textContent = formatTime(timerRemainingSeconds);
      } else {
        clearInterval(timerInterval);
        timerRunning = false;
        if (toggleBtn) toggleBtn.textContent = t("timer_done");
        playBeep();
        showToast(`⏰ ${t("timer_done")}`);
      }
    }, 1000);
  }

  function pauseTimer() {
    timerRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    const toggleBtn = document.getElementById("timer-toggle-btn");
    if (toggleBtn) toggleBtn.textContent = t("timer_resume");
  }

  // --------------------------------------------------------------------------
  // Formulario de Registro (Auto-guardado instantáneo)
  // --------------------------------------------------------------------------
  function setupLogFormEvents(dayData, currentEntry) {
    let selectedStatus = currentEntry.status || "Closed";

    function autoSave(notify = false) {
      const logs = loadLogs();
      logs[String(dayData.day)] = {
        status: selectedStatus,
        real_minutes: document.getElementById("log-minutes")?.value.trim() || "24",
        rpe: document.getElementById("log-rpe")?.value || "5",
        symptoms: document.getElementById("log-symptoms")?.value || "no",
        notes: document.getElementById("log-notes")?.value.trim() || "",
      };
      saveLogs(logs);
      renderSummaryStrip();
      renderDayCarousel();
      if (notify) {
        showToast(selectedStatus === "Closed"
          ? (currentLang === "es" ? `✓ Día ${dayData.day} completado` : `✓ Day ${dayData.day} completed`)
          : (currentLang === "es" ? "✓ Registro actualizado" : "✓ Log updated")
        );
      }
    }

    document.querySelectorAll(".status-choice-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".status-choice-btn").forEach((b) => b.classList.remove("selected", "omit"));
        selectedStatus = btn.getAttribute("data-status");
        btn.classList.add("selected");
        if (selectedStatus === "omitida") btn.classList.add("omit");
        autoSave(true);
      });
    });

    const rpeInput = document.getElementById("log-rpe");
    const rpeDisplay = document.getElementById("rpe-display");
    if (rpeInput && rpeDisplay) {
      rpeInput.addEventListener("input", () => {
        rpeDisplay.textContent = `${rpeInput.value}/10`;
      });
      rpeInput.addEventListener("change", () => autoSave(false));
    }

    document.getElementById("log-minutes")?.addEventListener("change", () => autoSave(false));
    document.getElementById("log-symptoms")?.addEventListener("change", () => autoSave(false));
    document.getElementById("log-notes")?.addEventListener("change", () => autoSave(false));
  }

  // --------------------------------------------------------------------------
  // Modal de Ejercicio
  // --------------------------------------------------------------------------
  function openExerciseModal(exerciseId) {
    const exObj = DATA.exercises[exerciseId];
    if (!exObj) return;
    const exLang = exObj[currentLang] || exObj.es;

    const dialog = document.getElementById("exercise-dialog");
    const title = document.getElementById("exercise-dialog-title");
    const pattern = document.getElementById("exercise-dialog-pattern");
    const body = document.getElementById("exercise-dialog-body");

    title.textContent = exLang.name;
    pattern.textContent = exLang.pattern;

    const firstVidKey = exObj.videos[0];
    const vid = firstVidKey ? DATA.videos[firstVidKey] : null;

    let videoHtml = "";
    if (vid) {
      videoHtml = `
        <div class="exercise-modal-video">
          <iframe class="video-frame" title="Video tutorial: ${escapeHtml(vid.title)}"
            src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(vid.videoId)}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen loading="lazy"></iframe>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.35rem; font-size:0.82rem; color:var(--muted);">
            <span>${currentLang === "es" ? "Canal" : "Channel"}: <strong>${escapeHtml(vid.author)}</strong> (${escapeHtml(vid.duration)})</span>
            <a href="${escapeHtml(vid.url)}" target="_blank" rel="noopener noreferrer" style="color:var(--brand); font-weight:700;">YouTube ↗</a>
          </div>
          <div style="font-size:0.84rem; margin-top:0.25rem;">
            <strong>${currentLang === "es" ? "Momento clave:" : "Key timestamp:"}</strong> ${escapeHtml(vid.timestamp_focus)}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      ${videoHtml}

      <div class="modal-section-title">${t("modal_setup")}</div>
      <p>${escapeHtml(exLang.setup)}</p>

      <div class="modal-section-title">${t("modal_execution")}</div>
      <ol style="padding-inline-start: 1.25rem; margin: 0.4rem 0;">
        ${exLang.execution.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>

      <div class="modal-section-title">${t("modal_breathing")}</div>
      <p><strong>${currentLang === "es" ? "Respiración:" : "Breathing:"}</strong> ${escapeHtml(exLang.breathing)}</p>
      <ul>
        ${exLang.cues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("")}
      </ul>

      <div class="modal-section-title">${t("modal_errors")}</div>
      <ul>
        ${exLang.common_errors.map((err) => `<li>${escapeHtml(err)}</li>`).join("")}
      </ul>

      <div class="modal-section-title">${t("modal_biomechanics")}</div>
      <figure class="modal-svg-figure">
        <img src="${escapeHtml(exObj.svg)}" alt="Biomechanical schema for ${escapeHtml(exLang.name)}" loading="lazy">
      </figure>
    `;

    dialog.showModal();
  }

  // --------------------------------------------------------------------------
  // Modal de Gates
  // --------------------------------------------------------------------------
  function openGateModal() {
    const dialog = document.getElementById("gate-dialog");
    const gates = loadGates();
    const gData = DATA.gates[currentLang] || DATA.gates.es;

    const loadContainer = document.getElementById("load-gate-checklist");
    const swingContainer = document.getElementById("swing-gate-checklist");

    loadContainer.innerHTML = gData.load_gate.checklist
      .map(
        (item) => `
        <label class="check-row" for="chk-${escapeHtml(item.id)}">
          <input type="checkbox" id="chk-${escapeHtml(item.id)}" data-gate-id="${escapeHtml(item.id)}" ${gates[item.id] ? "checked" : ""}>
          <span><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.detail)}</span>
        </label>
      `
      )
      .join("");

    swingContainer.innerHTML = gData.swing_gate.checklist
      .map(
        (item) => `
        <label class="check-row" for="chk-${escapeHtml(item.id)}">
          <input type="checkbox" id="chk-${escapeHtml(item.id)}" data-gate-id="${escapeHtml(item.id)}" ${gates[item.id] ? "checked" : ""}>
          <span><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.detail)}</span>
        </label>
      `
      )
      .join("");

    dialog.showModal();
  }

  // --------------------------------------------------------------------------
  // Modal de Información / Fuentes
  // --------------------------------------------------------------------------
  function openInfoModal() {
    const dialog = document.getElementById("info-dialog");

    const tbody = document.getElementById("comparison-table-body");
    if (tbody) {
      tbody.innerHTML = DATA.days
        .map((d) => {
          const dayLang = d[currentLang] || d.es;
          return `
            <tr>
              <td><strong>${t("day_prefix")} ${String(d.day).padStart(2, "0")}</strong></td>
              <td><strong>${escapeHtml(dayLang.type)}:</strong> ${escapeHtml(dayLang.prescription)}</td>
              <td>RPE ${escapeHtml(d.rpe_target)}</td>
            </tr>
          `;
        })
        .join("");
    }

    const sourcesList = document.getElementById("sources-list");
    if (sourcesList) {
      sourcesList.innerHTML = Object.values(DATA.videos)
        .map(
          (v) => `
          <div class="source-item">
            <a href="${escapeHtml(v.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.title)}</a>
            <div style="font-size:0.8rem; color:var(--muted); margin-top:2px;">
              ${currentLang === "es" ? "Canal" : "Channel"}: ${escapeHtml(v.author)} · ${escapeHtml(v.duration)} · ${escapeHtml(v.timestamp_focus)}
            </div>
          </div>
        `
        )
        .join("");
    }

    dialog.showModal();
  }

  // --------------------------------------------------------------------------
  // Inicialización de Eventos
  // --------------------------------------------------------------------------
  function initEvents() {
    // Toggle de idioma
    document.getElementById("lang-toggle-btn")?.addEventListener("click", () => {
      currentLang = currentLang === "es" ? "en" : "es";
      localStorage.setItem(STORAGE_KEY_LANG, currentLang);
      applyLanguage();
      showToast(currentLang === "en" ? "Language switched to English" : "Idioma cambiado a Español");
    });

    // Modales
    document.getElementById("open-gates-btn")?.addEventListener("click", openGateModal);
    document.getElementById("open-info-btn")?.addEventListener("click", openInfoModal);

    document.getElementById("close-exercise-dialog-btn")?.addEventListener("click", () => {
      document.getElementById("exercise-dialog").close();
    });
    document.getElementById("close-gate-dialog-btn")?.addEventListener("click", () => {
      document.getElementById("gate-dialog").close();
    });
    document.getElementById("close-info-dialog-btn")?.addEventListener("click", () => {
      document.getElementById("info-dialog").close();
    });

    // Guardado de Gates en tiempo real
    document.getElementById("gate-dialog")?.addEventListener("change", (e) => {
      if (e.target && e.target.matches("input[data-gate-id]")) {
        const gates = loadGates();
        gates[e.target.getAttribute("data-gate-id")] = e.target.checked;
        saveGates(gates);
        renderWorkout();
      }
    });

    // Pestañas de info
    document.querySelectorAll(".info-tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".info-tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".info-tab-pane").forEach((pane) => (pane.hidden = true));
        btn.classList.add("active");
        const targetId = btn.getAttribute("data-tab");
        const pane = document.getElementById(targetId);
        if (pane) pane.hidden = false;
      });
    });

    // Exportar JSON
    document.getElementById("export-progress-btn")?.addEventListener("click", () => {
      const payload = {
        exported_at: new Date().toISOString(),
        program_name: DATA.program_name,
        gates_state: loadGates(),
        session_logs: loadLogs(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "kettlebell_30days_progress.json";
      a.click();
      URL.revokeObjectURL(url);
      showToast(t("toast_exported"));
    });
  }

  // Inicializar
  applyLanguage();
  initEvents();
})();
