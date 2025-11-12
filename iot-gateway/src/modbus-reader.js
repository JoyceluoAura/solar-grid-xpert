/**
 * Modbus Reader - Reads data from inverters, batteries, and sensors via Modbus TCP/RTU
 */

import ModbusRTU from 'modbus-serial';

export class ModbusReader {
  constructor() {
    this.clients = new Map();
    this.devices = [];
    this.mockMode = process.env.MOCK_MODBUS === 'true'; // For demo/testing
  }

  /**
   * Initialize Modbus connections
   */
  async initialize() {
    // In production, load device configurations from database or config file
    // For demo, we'll use mock data
    this.devices = [
      {
        id: 'inverter-1',
        name: 'Huawei Inverter',
        type: 'inverter',
        connection: {
          type: 'tcp',
          host: '192.168.1.100',
          port: 502,
          unitId: 1
        },
        registers: {
          power: { address: 32080, type: 'int32', scale: 1, unit: 'W' },
          voltage: { address: 32066, type: 'uint16', scale: 10, unit: 'V' },
          current: { address: 32072, type: 'int16', scale: 100, unit: 'A' },
          temperature: { address: 32087, type: 'int16', scale: 10, unit: '°C' },
          dailyEnergy: { address: 32114, type: 'uint32', scale: 100, unit: 'kWh' }
        }
      },
      {
        id: 'battery-1',
        name: 'BYD Battery',
        type: 'battery',
        connection: {
          type: 'tcp',
          host: '192.168.1.101',
          port: 502,
          unitId: 1
        },
        registers: {
          soc: { address: 1000, type: 'uint16', scale: 10, unit: '%' },
          voltage: { address: 1001, type: 'uint16', scale: 100, unit: 'V' },
          current: { address: 1002, type: 'int16', scale: 100, unit: 'A' },
          temperature: { address: 1003, type: 'int16', scale: 10, unit: '°C' },
          power: { address: 1004, type: 'int16', scale: 1, unit: 'W' },
          status: { address: 1005, type: 'uint16', scale: 1, unit: '' }
        }
      }
    ];

    if (this.mockMode) {
      console.log('⚠️  Modbus reader in MOCK mode (demo data)');
      return;
    }

    // Connect to each device
    for (const device of this.devices) {
      try {
        const client = new ModbusRTU();

        if (device.connection.type === 'tcp') {
          await client.connectTCP(device.connection.host, {
            port: device.connection.port
          });
        } else {
          // RTU connection
          await client.connectRTUBuffered(device.connection.port, {
            baudRate: device.connection.baudRate || 9600
          });
        }

        client.setID(device.connection.unitId);
        client.setTimeout(5000);

        this.clients.set(device.id, client);
        console.log(`✅ Connected to ${device.name} (${device.id})`);
      } catch (error) {
        console.error(`❌ Failed to connect to ${device.name}:`, error.message);
      }
    }
  }

  /**
   * Read data from a single device
   */
  async readDevice(deviceId) {
    const device = this.devices.find(d => d.id === deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    // Mock mode - return simulated data
    if (this.mockMode) {
      return this.generateMockData(device);
    }

    const client = this.clients.get(deviceId);
    if (!client) {
      throw new Error(`No connection for device ${deviceId}`);
    }

    const data = {
      deviceId,
      deviceName: device.name,
      type: device.type,
      timestamp: new Date().toISOString(),
      readings: {}
    };

    // Read each register
    for (const [key, register] of Object.entries(device.registers)) {
      try {
        let value;

        switch (register.type) {
          case 'uint16':
            const uint16Result = await client.readHoldingRegisters(register.address, 1);
            value = uint16Result.data[0] / register.scale;
            break;

          case 'int16':
            const int16Result = await client.readHoldingRegisters(register.address, 1);
            value = (int16Result.data[0] > 32767 ? int16Result.data[0] - 65536 : int16Result.data[0]) / register.scale;
            break;

          case 'uint32':
            const uint32Result = await client.readHoldingRegisters(register.address, 2);
            value = ((uint32Result.data[0] << 16) + uint32Result.data[1]) / register.scale;
            break;

          case 'int32':
            const int32Result = await client.readHoldingRegisters(register.address, 2);
            const rawValue = (int32Result.data[0] << 16) + int32Result.data[1];
            value = (rawValue > 2147483647 ? rawValue - 4294967296 : rawValue) / register.scale;
            break;

          default:
            value = 0;
        }

        data.readings[key] = {
          value,
          unit: register.unit
        };

      } catch (error) {
        console.error(`Error reading ${key} from ${deviceId}:`, error.message);
        data.readings[key] = {
          value: null,
          error: error.message
        };
      }
    }

    return data;
  }

  /**
   * Read data from all devices
   */
  async readAllDevices() {
    const results = [];

    for (const device of this.devices) {
      try {
        const data = await this.readDevice(device.id);
        results.push({
          sensorId: device.id,
          data: {
            ...data.readings,
            type: device.type,
            deviceName: device.name,
            timestamp: data.timestamp
          }
        });
      } catch (error) {
        console.error(`Error reading ${device.id}:`, error.message);

        // Return error reading
        results.push({
          sensorId: device.id,
          data: {
            error: error.message,
            type: device.type,
            deviceName: device.name,
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    return results;
  }

  /**
   * Generate mock data for testing
   */
  generateMockData(device) {
    const data = {
      deviceId: device.id,
      deviceName: device.name,
      type: device.type,
      timestamp: new Date().toISOString(),
      readings: {}
    };

    if (device.type === 'inverter') {
      data.readings = {
        power: { value: 3500 + Math.random() * 1000, unit: 'W' },
        voltage: { value: 380 + Math.random() * 20, unit: 'V' },
        current: { value: 8 + Math.random() * 2, unit: 'A' },
        temperature: { value: 35 + Math.random() * 10, unit: '°C' },
        dailyEnergy: { value: 25 + Math.random() * 5, unit: 'kWh' }
      };
    } else if (device.type === 'battery') {
      const baseSOC = 100 - (Date.now() % 100000) / 1000; // Simulate discharge
      data.readings = {
        soc: { value: Math.max(15, Math.min(100, baseSOC)), unit: '%' },
        voltage: { value: 48 + Math.random() * 4, unit: 'V' },
        current: { value: -5 + Math.random() * 10, unit: 'A' },
        temperature: { value: 25 + Math.random() * 5, unit: '°C' },
        power: { value: -200 + Math.random() * 400, unit: 'W' },
        status: { value: 1, unit: '' } // 1 = normal, 2 = charging, 3 = discharging
      };
    }

    return data;
  }

  /**
   * Close all connections
   */
  async close() {
    for (const [deviceId, client] of this.clients.entries()) {
      try {
        await client.close();
        console.log(`✅ Closed connection to ${deviceId}`);
      } catch (error) {
        console.error(`Error closing ${deviceId}:`, error.message);
      }
    }

    this.clients.clear();
  }
}
