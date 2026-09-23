/**
 * Application Controller
 * Handles UI interactions, Tab Navigation, BMS Sync, and Live Simulation
 */

document.addEventListener("DOMContentLoaded", () => {

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

  const cellsGrid = document.getElementById("cellsGrid");
  const cellVoltages = [
    4.032, 4.028, 4.030, 4.025, 4.034, 4.029, 4.041,
    4.030, 4.027, 4.031, 4.026, 4.023, 4.032, 4.028
  ];
  cellVoltages.forEach((volt, idx) => {
    const box = document.createElement("div");
    box.className = "cell-box";
    box.innerHTML = `
      <div class="cell-name">S${String(idx + 1).padStart(2, '0')}</div>
      <div class="cell-volt">${volt.toFixed(3)}V</div>
    `;
    cellsGrid.appendChild(box);
  });

  const terminalLogs = document.getElementById("terminalLogs");
  function appendLog(msg, type = "info") {
    const row = document.createElement("div");
    row.className = `log-row ${type}`;
    const time = new Date().toTimeString().split(' ')[0];
    row.textContent = `[${time}] ${msg}`;
    terminalLogs.appendChild(row);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }
  window.bleManager.onLog = appendLog;

  const btnConnect = document.getElementById("btnConnect");
  const blePulse = document.getElementById("blePulse");
  const deviceName = document.getElementById("deviceName");

  window.bleManager.onConnectionChanged = (connected) => {
    if (connected) {
      blePulse.className = "pulse-indicator connected";
      deviceName.textContent = "M1365262501142 (Connected)";
      btnConnect.textContent = "DISCONNECT";
    } else {
      blePulse.className = "pulse-indicator disconnected";
      deviceName.textContent = "M1365262501142 (Disconnected)";
      btnConnect.textContent = "CONNECT BLE";
    }
  };

  btnConnect.addEventListener("click", async () => {
    if (!window.bleManager.isConnected) {
      try {
        await window.bleManager.connect();
      } catch (e) {
        appendLog("Interactive Simulation active...", "warn");
        simulateBikeData();
      }
    } else {
      window.bleManager.device?.gatt.disconnect();
    }
  });

  const toggleHeadlight = document.getElementById("toggleHeadlight");
  const txtLightState = document.getElementById("txtLightState");
  toggleHeadlight.addEventListener("change", (e) => {
    const on = e.target.checked;
    txtLightState.textContent = on ? "ON" : "OFF";
    window.bleManager.setHeadlight(on);
  });

  const toggleBikePower = document.getElementById("toggleBikePower");
  const txtPowerState = document.getElementById("txtPowerState");
  toggleBikePower.addEventListener("change", (e) => {
    const on = e.target.checked;
    txtPowerState.textContent = on ? "ARMED / ON" : "OFF";
    window.bleManager.setIgnition(on);
  });

  const modeButtons = document.querySelectorAll(".btn-mode");
  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      modeButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.getAttribute("data-mode");
      window.bleManager.setDriveMode(mode);
    });
  });

  const sliderOvp = document.getElementById("sliderOvp");
  const ovpVal = document.getElementById("ovpVal");
  sliderOvp.addEventListener("input", (e) => {
    ovpVal.textContent = `${parseFloat(e.target.value).toFixed(2)} V`;
  });

  const sliderUvp = document.getElementById("sliderUvp");
  const uvpVal = document.getElementById("uvpVal");
  sliderUvp.addEventListener("input", (e) => {
    uvpVal.textContent = `${parseFloat(e.target.value).toFixed(2)} V`;
  });

  const sliderThermal = document.getElementById("sliderThermal");
  const thermalVal = document.getElementById("thermalVal");
  sliderThermal.addEventListener("input", (e) => {
    thermalVal.textContent = `${e.target.value} °C`;
  });

  document.getElementById("btnSyncBms").addEventListener("click", () => {
    const ovp = parseFloat(sliderOvp.value);
    const uvp = parseFloat(sliderUvp.value);
    const thermal = parseInt(sliderThermal.value);
    window.bleManager.syncBMSLimits(ovp, uvp, thermal);
    appendLog(`BMS Thresholds Synced: OVP=${ovp}V, UVP=${uvp}V, Therm=${thermal}°C`, "success");
  });

  function simulateBikeData() {
    blePulse.className = "pulse-indicator connected";
    deviceName.textContent = "M1365262501142 (Connected)";
    let speed = 28;
    setInterval(() => {
      speed = Math.max(0, Math.min(45, speed + (Math.random() * 4 - 2)));
      document.getElementById("speedDisplay").textContent = Math.round(speed);
      document.getElementById("tripDist").textContent = (14.2 + (speed * 0.001)).toFixed(1) + " km";
    }, 1200);
  }

  document.getElementById("btnClearLog").addEventListener("click", () => {
    terminalLogs.innerHTML = "";
  });

});
