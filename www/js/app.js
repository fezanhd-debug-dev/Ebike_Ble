
/**
 * Application Controller - Strictly Real Telemetry
 */

document.addEventListener("DOMContentLoaded", () => {
  // Tabs Navigation
  const navItems = document.querySelectorAll(".nav-item");
  const tabPanes = document.querySelectorAll(".tab-pane");

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      navItems.forEach(n => n.classList.remove("active"));
      tabPanes.forEach(t => t.classList.remove("active"));
      item.classList.add("active");
      const targetTab = item.getAttribute("data-tab");
      document.getElementById(targetTab).classList.add("active");
    });
  });

  // Cell Elements placeholder (starts empty / dashes until real BLE stream arrives)
  const cellsGrid = document.getElementById("cellsGrid");
  cellsGrid.innerHTML = "";
  for (let i = 1; i <= 14; i++) {
    const box = document.createElement("div");
    box.className = "cell-box";
    box.id = `cell-s${i}`;
    box.innerHTML = `
      <div class="cell-name">S${String(i).padStart(2, '0')}</div>
      <div class="cell-volt" id="val-s${i}">-- V</div>
    `;
    cellsGrid.appendChild(box);
  }

  // Terminal & BLE Logs
  const terminalLogs = document.getElementById("terminalLogs");
  function appendLog(msg, type = "info") {
    if (!terminalLogs) return;
    const row = document.createElement("div");
    row.className = `log-row ${type}`;
    const time = new Date().toTimeString().split(' ')[0];
    row.textContent = `[${time}] ${msg}`;
    terminalLogs.appendChild(row);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }
  window.bleManager.onLog = appendLog;

  // BLE Connection Button & Status
  const btnConnect = document.getElementById("btnConnect");
  const blePulse = document.getElementById("blePulse");
  const deviceName = document.getElementById("deviceName");

  window.bleManager.onConnectionChanged = (connected) => {
    if (connected) {
      blePulse.className = "pulse-indicator connected";
      deviceName.textContent = "M1365262501142 (Connected Live)";
      btnConnect.textContent = "DISCONNECT";
    } else {
      blePulse.className = "pulse-indicator disconnected";
      deviceName.textContent = "M1365262501142 (Disconnected)";
      btnConnect.textContent = "CONNECT BLE";

      // Reset values to awaiting data
      document.getElementById("speedDisplay").textContent = "0";
      document.getElementById("batteryPct").textContent = "--%";
      document.getElementById("packVoltage").textContent = "--V";
    }
  };

  btnConnect.addEventListener("click", async () => {
    if (!window.bleManager.isConnected) {
      try {
        await window.bleManager.connect();
      } catch (e) {
        appendLog("BLE Connect Error: " + e.message, "warn");
      }
    } else {
      window.bleManager.device?.gatt?.disconnect();
    }
  });

  // REAL LIVE DATA HOOK (0xFFF1)
  window.bleManager.onTelemetryData = (data) => {
    if (data.speed !== undefined) {
      document.getElementById("speedDisplay").textContent = Math.round(data.speed);
    }
    if (data.voltage) {
      document.getElementById("packVoltage").textContent = data.voltage + "V";
    }
    if (data.current) {
      document.getElementById("currentDraw").textContent = data.current + " A";
    }
    if (data.soc !== undefined && data.soc > 0) {
      document.getElementById("batteryPct").textContent = data.soc + "%";
    }
  };

  // REAL LIVE 14S CELL BALANCER DATA HOOK
  window.bleManager.onCellData = (voltages) => {
    voltages.forEach((volt, idx) => {
      const cellEl = document.getElementById(`val-s${idx + 1}`);
      if (cellEl) {
        cellEl.textContent = `${volt}V`;
      }
    });
  };

  // Switch Controls
  const toggleHeadlight = document.getElementById("toggleHeadlight");
  const txtLightState = document.getElementById("txtLightState");
  toggleHeadlight?.addEventListener("change", (e) => {
    const on = e.target.checked;
    txtLightState.textContent = on ? "ON" : "OFF";
    window.bleManager.setHeadlight(on);
  });

  const toggleBikePower = document.getElementById("toggleBikePower");
  const txtPowerState = document.getElementById("txtPowerState");
  toggleBikePower?.addEventListener("change", (e) => {
    const on = e.target.checked;
    txtPowerState.textContent = on ? "ARMED / ON" : "OFF";
    window.bleManager.setIgnition(on);
  });

  // Drive Mode
  const modeButtons = document.querySelectorAll(".btn-mode");
  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      modeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      window.bleManager.setDriveMode(btn.getAttribute("data-mode"));
    });
  });

  // BMS Sliders
  const sliderOvp = document.getElementById("sliderOvp");
  const ovpVal = document.getElementById("ovpVal");
  sliderOvp?.addEventListener("input", (e) => { ovpVal.textContent = `${parseFloat(e.target.value).toFixed(2)} V`; });

  const sliderUvp = document.getElementById("sliderUvp");
  const uvpVal = document.getElementById("uvpVal");
  sliderUvp?.addEventListener("input", (e) => { uvpVal.textContent = `${parseFloat(e.target.value).toFixed(2)} V`; });

  const sliderThermal = document.getElementById("sliderThermal");
  const thermalVal = document.getElementById("thermalVal");
  sliderThermal?.addEventListener("input", (e) => { thermalVal.textContent = `${e.target.value} °C`; });

  document.getElementById("btnSyncBms")?.addEventListener("click", () => {
    const ovp = parseFloat(sliderOvp.value);
    const uvp = parseFloat(sliderUvp.value);
    const thermal = parseInt(sliderThermal.value);
    window.bleManager.syncBMSLimits(ovp, uvp, thermal);
    appendLog(`BMS Write Request Sent (0xFFF2)`, "success");
  });

  document.getElementById("btnClearLog")?.addEventListener("click", () => {
    terminalLogs.innerHTML = "";
  });
});
