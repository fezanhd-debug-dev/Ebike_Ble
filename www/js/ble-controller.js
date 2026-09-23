/**
 * Bluetooth Low Energy Controller for E-Bike
 * Extracted UUIDs from nRF Connect:
 * Service: 0xFFF0
 * Write Characteristic: 0xFFF2 (WRITE, WRITE NO RESPONSE)
 * Notify Characteristic: 0xFFF1 (NOTIFY)
 * CCCD: 0x2902
 */

class EBikeBLEManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.isConnected = false;

    this.SERVICE_UUID = 0xFFF0;
    this.WRITE_CHAR_UUID = 0xFFF2;
    this.NOTIFY_CHAR_UUID = 0xFFF1;

    this.onTelemetryReceived = null;
    this.onConnectionChanged = null;
    this.onLog = null;
  }

  log(msg, type = 'info') {
    if (this.onLog) this.onLog(msg, type);
    console.log(`[BLE] ${msg}`);
  }

  async connect() {
    try {
      this.log("Requesting Bluetooth device M1365262501142...");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [this.SERVICE_UUID] }],
        optionalServices: ['generic_access', 'generic_attribute', 0xFFF0]
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
        if (this.onConnectionChanged) this.onConnectionChanged(false);
        this.log("Device disconnected", "warn");
      });

      this.log(`Connecting to GATT Server...`);
      this.server = await this.device.gatt.connect();

      this.log("Discovering Primary Service 0xFFF0...");
      this.service = await this.server.getPrimaryService(this.SERVICE_UUID);

      this.log("Getting Write Characteristic 0xFFF2...");
      this.writeChar = await this.service.getCharacteristic(this.WRITE_CHAR_UUID);

      this.log("Enabling notifications on 0xFFF1...");
      this.notifyChar = await this.service.getCharacteristic(this.NOTIFY_CHAR_UUID);
      await this.notifyChar.startNotifications();

      this.notifyChar.addEventListener('characteristicvaluechanged', (event) => {
        if (this.onTelemetryReceived) {
          this.onTelemetryReceived(event.target.value);
        }
      });

      this.isConnected = true;
      if (this.onConnectionChanged) this.onConnectionChanged(true);
      this.log("BLE connected and telemetry stream active!", "success");

    } catch (err) {
      this.log("BLE Error: " + err.message, "warn");
      throw err;
    }
  }

  async sendCommand(hexBytes) {
    if (!this.writeChar) {
      this.log("Command simulated (Not connected): " + hexBytes.map(b => '0x' + b.toString(16)).join(' '), "warn");
      return;
    }
    try {
      const data = new Uint8Array(hexBytes);
      await this.writeChar.writeValueWithoutResponse(data);
      this.log(`Packet sent: [${hexBytes.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}]`, "info");
    } catch (err) {
      this.log("Write error: " + err.message, "warn");
    }
  }

  setIgnition(turnOn) {
    const packet = turnOn ? [0xA5, 0x01, 0x01, 0xA7] : [0xA5, 0x01, 0x00, 0xA6];
    return this.sendCommand(packet);
  }

  setHeadlight(turnOn) {
    const packet = turnOn ? [0xA5, 0x02, 0x01, 0xA8] : [0xA5, 0x02, 0x00, 0xA7];
    return this.sendCommand(packet);
  }

  setDriveMode(mode) {
    const modeCode = mode === 'eco' ? 0x01 : mode === 'city' ? 0x02 : 0x03;
    return this.sendCommand([0xA5, 0x03, modeCode, (0xA8 + modeCode) & 0xFF]);
  }

  syncBMSLimits(ovp, uvp, thermal) {
    const ovpRaw = Math.round(ovp * 100);
    const uvpRaw = Math.round(uvp * 100);
    const packet = [0x5A, 0x10, (ovpRaw >> 8) & 0xFF, ovpRaw & 0xFF, (uvpRaw >> 8) & 0xFF, uvpRaw & 0xFF, thermal & 0xFF, 0xAA];
    return this.sendCommand(packet);
  }
}

window.bleManager = new EBikeBLEManager();
