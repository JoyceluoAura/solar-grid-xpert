/**
 * Test Client - Simulates an off-grid solar site sending data
 * Use this to test the IoT Gateway
 */

import mqtt from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com';
const SITE_ID = process.env.SITE_ID || 'test-site-001';

console.log('🧪 Starting IoT Gateway Test Client...');
console.log(`📡 MQTT Broker: ${MQTT_BROKER}`);
console.log(`🏭 Site ID: ${SITE_ID}\n`);

// Connect to MQTT
const client = mqtt.connect(MQTT_BROKER, {
  clientId: `test_client_${Date.now()}`,
  clean: true
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker\n');

  // Simulate normal operation
  simulateNormalOperation();

  // After 30 seconds, simulate low power mode
  setTimeout(() => {
    console.log('\n⚠️  SIMULATING LOW POWER MODE\n');
    simulateLowPowerMode();
  }, 30000);

  // After 60 seconds, simulate offline mode
  setTimeout(() => {
    console.log('\n❌ SIMULATING OFFLINE MODE\n');
    simulateOfflineMode();
  }, 60000);

  // After 90 seconds, simulate recovery
  setTimeout(() => {
    console.log('\n✅ SIMULATING RECOVERY\n');
    simulateRecovery();
  }, 90000);

  // Cleanup after 120 seconds
  setTimeout(() => {
    console.log('\n🛑 Test complete, disconnecting...');
    client.end();
    process.exit(0);
  }, 120000);
});

client.on('error', (error) => {
  console.error('❌ MQTT error:', error);
});

/**
 * Simulate normal operation - High frequency data
 */
function simulateNormalOperation() {
  const interval = setInterval(() => {
    // Inverter data
    const inverterData = {
      sensorId: 'inverter-1',
      timestamp: new Date().toISOString(),
      power: 3500 + Math.random() * 500,
      voltage: 380 + Math.random() * 20,
      current: 9 + Math.random() * 1,
      temperature: 40 + Math.random() * 5,
      dailyEnergy: 25.5 + Math.random() * 2
    };

    client.publish(`site/${SITE_ID}/data`, JSON.stringify(inverterData));
    console.log(`📤 [NORMAL] Inverter: ${inverterData.power.toFixed(0)}W, ${inverterData.temperature.toFixed(1)}°C`);

    // Battery data
    const batteryData = {
      sensorId: 'battery-1',
      timestamp: new Date().toISOString(),
      soc: 85 + Math.random() * 10,
      voltage: 50 + Math.random() * 2,
      current: -5 + Math.random() * 10,
      temperature: 28 + Math.random() * 3,
      power: 250 + Math.random() * 100
    };

    client.publish(`site/${SITE_ID}/data`, JSON.stringify(batteryData));
    console.log(`📤 [NORMAL] Battery: ${batteryData.soc.toFixed(1)}% SOC, ${batteryData.power.toFixed(0)}W\n`);

  }, 5000); // Every 5 seconds

  // Save interval for cleanup
  global.normalInterval = interval;
}

/**
 * Simulate low power mode - Reduced frequency
 */
function simulateLowPowerMode() {
  // Clear normal operation
  if (global.normalInterval) {
    clearInterval(global.normalInterval);
  }

  const interval = setInterval(() => {
    const batteryData = {
      sensorId: 'battery-1',
      timestamp: new Date().toISOString(),
      soc: 25 + Math.random() * 5, // Low battery
      voltage: 47 + Math.random() * 2,
      current: -2 + Math.random() * 1,
      temperature: 30 + Math.random() * 2,
      power: 100 + Math.random() * 50
    };

    client.publish(`site/${SITE_ID}/data`, JSON.stringify(batteryData));
    console.log(`📤 [LOW POWER] Battery: ${batteryData.soc.toFixed(1)}% SOC ⚠️\n`);

  }, 15000); // Every 15 seconds (reduced frequency)

  global.lowPowerInterval = interval;

  // Send alert
  const alert = {
    severity: 'warning',
    message: 'Site entering low power mode - Battery at 25%',
    timestamp: new Date().toISOString()
  };
  client.publish(`site/${SITE_ID}/alerts`, JSON.stringify(alert));
}

/**
 * Simulate offline mode - No data transmission
 */
function simulateOfflineMode() {
  // Clear low power operation
  if (global.lowPowerInterval) {
    clearInterval(global.lowPowerInterval);
  }

  console.log('📴 Site is now offline - Caching data locally\n');

  // Send critical alert before going offline
  const alert = {
    severity: 'critical',
    message: 'Site going offline - Battery critically low at 10%',
    timestamp: new Date().toISOString()
  };
  client.publish(`site/${SITE_ID}/alerts`, JSON.stringify(alert));

  // Simulate local caching (logged but not sent)
  const interval = setInterval(() => {
    const cachedData = {
      sensorId: 'battery-1',
      timestamp: new Date().toISOString(),
      soc: 10 + Math.random() * 5,
      status: 'offline - cached locally'
    };

    console.log(`💾 [OFFLINE] Data cached locally: Battery ${cachedData.soc.toFixed(1)}%`);
  }, 10000);

  global.offlineInterval = interval;
}

/**
 * Simulate recovery - Back online with data sync
 */
function simulateRecovery() {
  // Clear offline mode
  if (global.offlineInterval) {
    clearInterval(global.offlineInterval);
  }

  console.log('✅ Site back online - Syncing cached data\n');

  // Send recovery alert
  const alert = {
    severity: 'info',
    message: 'Site recovered - Back to normal operation',
    timestamp: new Date().toISOString()
  };
  client.publish(`site/${SITE_ID}/alerts`, JSON.stringify(alert));

  // Simulate uploading cached data
  let uploadCount = 0;
  const uploadInterval = setInterval(() => {
    const cachedData = {
      sensorId: 'battery-1',
      timestamp: new Date(Date.now() - (10 - uploadCount) * 60000).toISOString(), // Historical data
      soc: 15 + uploadCount * 5,
      voltage: 48 + Math.random() * 2,
      cached: true
    };

    client.publish(`site/${SITE_ID}/data`, JSON.stringify(cachedData));
    console.log(`📤 [RECOVERY] Uploading cached data ${uploadCount + 1}/10`);

    uploadCount++;
    if (uploadCount >= 10) {
      clearInterval(uploadInterval);
      console.log('✅ All cached data uploaded!\n');

      // Resume normal operation
      simulateNormalOperation();
    }
  }, 1000); // Upload quickly
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test client...');
  client.end();
  process.exit(0);
});
