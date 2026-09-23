/**
 * Real Hardware BLE Controller & Protocol Parser for E-Bike
 * Target: Device M1365262501142
 * Service: 0xFFF0 | Notify: 0xFFF1 | Write: 0xFFF2
 */

class EBikeBLEManager {
  constructor() {
    this.device = null;
    this.server = null;
    this.service = null;
    this.writeChar = null;
    this.notifyChar = null;
    this.isConnected = false;

    // Nordic Custom GATT UUIDs
    this.SERVICE_UUID = '0000fff0-0000-1000-8000-00805f9b34fb';
    this.WRITE_CHAR_UUID = '0000fff2-0000-1000-8000-00805f9b34fb';
    this.NOTIFY_CHAR_UUID = '0000fff1-0000-1000-8000-00805f9b34fb';

    this.onTelemetryData = null;
    this.onCellData = null;
    this.onConnectionChanged = null;
    this.onLog = null;
  }

  log(msg, type = 'info') {
    if (this.onLog) this.onLog(msg, type);
    console.log(`[BLE] ${msg}`);
  }

  async connect() {
    try {
      this.log("Scanning for E-Bike BLE (M1365262501142)...", "info");

      if (
        window.Capacitor &&
        window.Capacitor.Plugins &&
        window.Capacitor.Plugins.BluetoothLe
      ) {
        await this.connectCapacitorNative();
        return;
      }

      if (!navigator.bluetooth) {
        throw new Error("Bluetooth API not supported on this device/browser");
      }

      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          this.SERVICE_UUID,
          0xFFF0,
          'generic_access',
          'generic_attribute'
        ]
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;

        if (this.onConnectionChanged) {
          this.onConnectionChanged(false);
        }

        this.log("E-Bike Disconnected!", "warn");
      });

      this.log("Connecting to GATT Server...", "info");

      this.server = await this.device.gatt.connect();

      this.log("Discovering Service 0xFFF0...", "info");

      this.service = await this.server.getPrimaryService(0xFFF0);

      this.log("Binding Notify Characteristic 0xFFF1...", "info");

      this.notifyChar =
        await this.service.getCharacteristic(0xFFF1);

      await this.notifyChar.startNotifications();

      this.notifyChar.addEventListener(
        'characteristicvaluechanged',
        (event) => {
          this.parseRealHardwarePacket(event.target.value);
        }
      );

      this.log("Binding Write Characteristic 0xFFF2...", "info");

      this.writeChar =
        await this.service.getCharacteristic(0xFFF2);

      this.isConnected = true;

      if (this.onConnectionChanged) {
        this.onConnectionChanged(true);
      }

      this.log(
        "Connected! Streaming live bike data...",
        "success"
      );

    } catch (err) {
      this.log(
        "Connection Failed: " + err.message,
        "warn"
      );

      if (this.onConnectionChanged) {
        this.onConnectionChanged(false);
      }

      throw err;
    }
  }

  async connectCapacitorNative() {
    const Ble =
      window.Capacitor.Plugins.BluetoothLe;

    await Ble.initialize();

    const device = await Ble.requestDevice({
      services: ['FFF0']
    });

    await Ble.connect({
      deviceId: device.deviceId
    });

    this.log(
      `Connected to ${device.deviceId}`,
      "success"
    );

    await Ble.startNotifications(
      {
        deviceId: device.deviceId,
        service: 'FFF0',
        characteristic: 'FFF1'
      },
      (result) => {
        if (result && result.value) {
          const rawString = atob(result.value);

          const buffer =
            new ArrayBuffer(rawString.length);

          const view =
            new Uint8Array(buffer);

          for (
            let i = 0;
            i < rawString.length;
            i++
          ) {
            view[i] =
              rawString.charCodeAt(i);
          }

          this.parseRealHardwarePacket(
            new DataView(buffer)
          );
        }
      }
    );

    this.isConnected = true;

    if (this.onConnectionChanged) {
      this.onConnectionChanged(true);
    }
  }

  parseRealHardwarePacket(dataView) {
    const len = dataView.byteLength;

    if (len < 4) return;

    let hexStr = "";
    const rawBytes = [];

    for (let i = 0; i < len; i++) {
      const b = dataView.getUint8(i);

      rawBytes.push(b);

      hexStr +=
        b.toString(16)
          .padStart(2, '0')
          .toUpperCase() + " ";
    }

    this.log(
      `RX (0xFFF1): ${hexStr}`,
      "info"
    );

    // Telemetry
    if (rawBytes[0] === 0x55 || len >= 14) {
      try {
        const rawSpeed =
          dataView.getUint16(1, false);

        const speed =
          rawSpeed < 1000
            ? (rawSpeed / 10).toFixed(1)
            : rawBytes[2].toString();

        const rawVolt =
          dataView.getUint16(3, false);

        const packVoltage =
          rawVolt > 2000 && rawVolt < 8000
            ? (rawVolt / 100).toFixed(1)
            : (rawVolt / 10).toFixed(1);

        const rawCurrent =
          dataView.getInt16(5, false);

        const currentA =
          Math.abs(rawCurrent) < 5000
            ? (rawCurrent / 100).toFixed(1)
            : (rawCurrent / 10).toFixed(1);

        const soc =
          Math.min(
            100,
            Math.max(0, rawBytes[7])
          );

        const temp =
          rawBytes[8]
            ? rawBytes[8] - 40
            : 28;

        if (this.onTelemetryData) {
          this.onTelemetryData({
            speed: isNaN(speed) ? 0 : speed,
            voltage: isNaN(packVoltage)
              ? 0
              : packVoltage,
            current: isNaN(currentA)
              ? 0
              : currentA,
            soc: isNaN(soc) ? 0 : soc,
            temp: temp
          });
        }

      } catch (e) {
        console.error(
          "Telemetry parsing error",
          e
        );
      }
    }

    // 14S Cell Voltages
    if (rawBytes[0] === 0x5A || len >= 28) {
      try {
        const cellVoltages = [];

        let offset = 2;

        for (let i = 0; i < 14; i++) {
          if (offset + 1 < len) {
            const mV =
              dataView.getUint16(
                offset,
                false
              );

            cellVoltages.push(
              (mV / 1000).toFixed(3)
            );

            offset += 2;
          }
        }

        if (
          this.onCellData &&
          cellVoltages.length > 0
        ) {
          this.onCellData(cellVoltages);
        }

      } catch (e) {
        console.error(
          "Cell parsing error",
          e
        );
      }
    }
  }

  async sendCommand(hexBytes) {
    if (
      !this.writeChar &&
      !window.Capacitor?.Plugins?.BluetoothLe
    ) {
      this.log(
        "Command cannot be sent: Bike not connected via BLE!",
        "warn"
      );

      return;
    }

    try {
      const data =
        new Uint8Array(hexBytes);

      if (this.writeChar) {
        await this.writeChar.writeValueWithoutResponse(
          data
        );
      }

      this.log(
        `TX -> 0xFFF2: [${hexBytes
          .map(
            b =>
              '0x' +
              b
                .toString(16)
                .padStart(2, '0')
          )
          .join(', ')}]`,
        "info"
      );

    } catch (err) {
      this.log(
        "Write Error: " + err.message,
        "warn"
      );
    }
  }

  setIgnition(turnOn) {
    const packet = turnOn
      ? [0xA5, 0x01, 0x01, 0xA7]
      : [0xA5, 0x01, 0x00, 0xA6];

    return this.sendCommand(packet);
  }

  setHeadlight(turnOn) {
    const packet = turnOn
      ? [0xA5, 0x02, 0x01, 0xA8]
      : [0xA5, 0x02, 0x00, 0xA7];

    return this.sendCommand(packet);
  }

  setDriveMode(mode) {
    const modeCode =
      mode === 'eco'
        ? 0x01
        : mode === 'city'
        ? 0x02
        : 0x03;

    return this.sendCommand([
      0xA5,
      0x03,
      modeCode,
      (0xA8 + modeCode) & 0xFF
    ]);
  }

  syncBMSLimits(
    ovp,
    uvp,
    thermal
  ) {
    const ovpRaw =
      Math.round(ovp * 100);

    const uvpRaw =
      Math.round(uvp * 100);

    const packet = [
      0x5A,
      0x10,
      (ovpRaw >> 8) & 0xFF,
      ovpRaw & 0xFF,
      (uvpRaw >> 8) & 0xFF,
      uvpRaw & 0xFF,
      thermal & 0xFF,
      0xAA
    ];

    return this.sendCommand(packet);
  }
}

window.bleManager =
  new EBikeBLEManager();
