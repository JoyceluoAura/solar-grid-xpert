/**
 * Gateway Controller - Orchestrates operational modes and data flow
 */

import cron from 'node-cron';

export class GatewayController {
  constructor({ dbManager, mqttClient, heartbeatMonitor, modbusReader }) {
    this.dbManager = dbManager;
    this.mqttClient = mqttClient;
    this.heartbeatMonitor = heartbeatMonitor;
    this.modbusReader = modbusReader;

    this.currentMode = 'normal'; // normal, low_power, offline
    this.siteId = process.env.SITE_ID;
    this.organizationId = process.env.ORGANIZATION_ID;

    this.transmissionInterval = null;
    this.heartbeatInterval = null;
    this.syncInterval = null;

    // Configuration
    this.config = {
      normal: {
        transmitFrequency: 5000, // 5 seconds
        heartbeatFrequency: 300000, // 5 minutes
      },
      low_power: {
        transmitFrequency: 60000, // 1 minute
        heartbeatFrequency: 600000, // 10 minutes
      },
      offline: {
        saveLocally: true,
        attemptSync: true,
        syncInterval: 300000, // 5 minutes
      }
    };

    this.batteryLevel = 100;
    this.networkQuality = 'good';
  }

  async initialize() {
    await this.dbManager.initialize();

    // Connect to MQTT broker
    await this.mqttClient.connect();

    // Set up MQTT message handler
    this.mqttClient.onMessage((topic, message) => {
      this.handleMQTTMessage(topic, message);
    });

    // Attempt initial sync of cached data
    await this.attemptSync();

    console.log('✅ Gateway controller initialized');
  }

  /**
   * Start data collection from sensors
   */
  async startDataCollection() {
    // Set up periodic data collection based on current mode
    this.updateTransmissionSchedule();

    // Start heartbeat
    this.startHeartbeat();

    // Start sync attempts (for offline mode)
    this.startSyncAttempts();

    console.log(`📡 Data collection started in ${this.currentMode} mode`);
  }

  /**
   * Update transmission schedule based on operational mode
   */
  updateTransmissionSchedule() {
    // Clear existing interval
    if (this.transmissionInterval) {
      clearInterval(this.transmissionInterval);
    }

    if (this.currentMode === 'offline') {
      console.log('📴 Offline mode: Data will be cached locally');
      return;
    }

    const frequency = this.config[this.currentMode].transmitFrequency;

    this.transmissionInterval = setInterval(async () => {
      await this.collectAndTransmitData();
    }, frequency);

    console.log(`⏱️  Transmission interval set to ${frequency}ms`);
  }

  /**
   * Collect data from sensors and transmit
   */
  async collectAndTransmitData() {
    try {
      // Read from Modbus devices (inverters, batteries)
      const modbusData = await this.modbusReader.readAllDevices();

      // Process each reading
      for (const reading of modbusData) {
        await this.ingestData({
          siteId: this.siteId,
          sensorId: reading.sensorId,
          data: reading.data,
          timestamp: new Date().toISOString()
        });
      }

      // Update battery level for mode switching
      const batteryReading = modbusData.find(r => r.data.type === 'battery');
      if (batteryReading) {
        this.batteryLevel = batteryReading.data.soc || 100;
        this.checkPowerMode();
      }

    } catch (error) {
      console.error('Data collection error:', error);
    }
  }

  /**
   * Ingest data - handles routing based on operational mode
   */
  async ingestData({ siteId, sensorId, data, timestamp }) {
    const reading = {
      siteId,
      sensorId,
      data,
      timestamp
    };

    switch (this.currentMode) {
      case 'normal':
        // Try to send to cloud, fallback to cache
        const sent = await this.dbManager.sendToCloud(siteId, sensorId, data, timestamp);
        if (!sent) {
          console.log('☁️  Cloud unavailable, caching locally...');
          this.dbManager.saveLocal(siteId, sensorId, data, timestamp);
          this.checkOnlineStatus();
        }
        break;

      case 'low_power':
        // Send to cloud but less frequently (handled by transmission schedule)
        const sentLowPower = await this.dbManager.sendToCloud(siteId, sensorId, data, timestamp);
        if (!sentLowPower) {
          this.dbManager.saveLocal(siteId, sensorId, data, timestamp);
        }
        break;

      case 'offline':
        // Save locally only
        this.dbManager.saveLocal(siteId, sensorId, data, timestamp);
        break;
    }

    // Publish to MQTT for local monitoring
    this.mqttClient.publish(`site/${siteId}/sensor/${sensorId}`, data);
  }

  /**
   * Record heartbeat
   */
  async recordHeartbeat({ siteId, powerMode, batteryLevel, networkType, signalStrength }) {
    const heartbeat = {
      siteId: siteId || this.siteId,
      powerMode: powerMode || this.currentMode,
      batteryLevel: batteryLevel || this.batteryLevel,
      networkType: networkType || this.networkQuality,
      signalStrength: signalStrength || 0
    };

    // Try to send to cloud
    if (this.currentMode !== 'offline') {
      try {
        const { error } = await this.dbManager.supabase
          .from('site_heartbeats')
          .insert({
            site_id: heartbeat.siteId,
            power_mode: heartbeat.powerMode,
            battery_level: heartbeat.batteryLevel,
            network_type: heartbeat.networkType,
            signal_strength: heartbeat.signalStrength,
            received_at: new Date().toISOString()
          });

        if (!error) {
          // Update site status
          await this.dbManager.updateSiteStatus(heartbeat.siteId, 'online', {
            power_mode: heartbeat.powerMode,
            battery_level: heartbeat.batteryLevel
          });

          console.log(`💓 Heartbeat sent - Mode: ${heartbeat.powerMode}, Battery: ${heartbeat.batteryLevel}%`);
          return;
        }
      } catch (error) {
        console.error('Heartbeat send error:', error);
      }
    }

    // Cache locally if offline or cloud unavailable
    this.dbManager.saveHeartbeatLocal(
      heartbeat.siteId,
      heartbeat.powerMode,
      heartbeat.batteryLevel,
      heartbeat.networkType,
      heartbeat.signalStrength
    );
  }

  /**
   * Start heartbeat transmission
   */
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    const frequency = this.config[this.currentMode]?.heartbeatFrequency || 300000;

    this.heartbeatInterval = setInterval(async () => {
      await this.recordHeartbeat({
        siteId: this.siteId,
        powerMode: this.currentMode,
        batteryLevel: this.batteryLevel
      });
    }, frequency);

    // Send initial heartbeat
    this.recordHeartbeat({
      siteId: this.siteId,
      powerMode: this.currentMode,
      batteryLevel: this.batteryLevel
    });

    console.log(`💓 Heartbeat started (${frequency}ms interval)`);
  }

  /**
   * Start periodic sync attempts for cached data
   */
  startSyncAttempts() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      await this.attemptSync();
    }, this.config.offline.syncInterval);
  }

  /**
   * Attempt to sync cached data
   */
  async attemptSync() {
    if (this.currentMode === 'offline') {
      console.log('🔄 Attempting to sync cached data...');
    }

    const result = await this.dbManager.uploadCachedData();

    if (result.success && result.uploaded > 0) {
      console.log(`✅ Sync successful: ${result.uploaded} records uploaded`);

      // If we successfully synced, we might be back online
      if (this.currentMode === 'offline') {
        this.setMode('normal');
      }
    }

    return result;
  }

  /**
   * Check power mode based on battery level
   */
  checkPowerMode() {
    const lowPowerThreshold = parseFloat(process.env.LOW_POWER_THRESHOLD || 30);
    const criticalThreshold = parseFloat(process.env.CRITICAL_POWER_THRESHOLD || 15);

    if (this.batteryLevel < criticalThreshold) {
      if (this.currentMode !== 'offline') {
        console.log(`⚠️  Critical battery level: ${this.batteryLevel}% - Switching to OFFLINE mode`);
        this.setMode('offline');

        // Send alert before going offline
        this.sendAlert('critical', `Site entering offline mode - Battery: ${this.batteryLevel}%`);
      }
    } else if (this.batteryLevel < lowPowerThreshold) {
      if (this.currentMode === 'normal') {
        console.log(`⚠️  Low battery level: ${this.batteryLevel}% - Switching to LOW POWER mode`);
        this.setMode('low_power');
        this.sendAlert('warning', `Site in low power mode - Battery: ${this.batteryLevel}%`);
      }
    } else {
      if (this.currentMode !== 'normal') {
        console.log(`✅ Battery recovered: ${this.batteryLevel}% - Switching to NORMAL mode`);
        this.setMode('normal');
        this.sendAlert('info', `Site back to normal operation - Battery: ${this.batteryLevel}%`);
      }
    }
  }

  /**
   * Check online status
   */
  async checkOnlineStatus() {
    // If we can't reach cloud, switch to offline mode
    if (!this.dbManager.isOnline && this.currentMode !== 'offline') {
      console.log('🔌 Network unavailable - Switching to OFFLINE mode');
      this.setMode('offline');
    }
  }

  /**
   * Set operational mode
   */
  setMode(mode) {
    if (this.currentMode === mode) return;

    const oldMode = this.currentMode;
    this.currentMode = mode;

    console.log(`🔄 Mode changed: ${oldMode} → ${mode}`);

    // Update transmission schedule
    this.updateTransmissionSchedule();

    // Update heartbeat frequency
    this.startHeartbeat();

    // Publish mode change via MQTT
    this.mqttClient.publish(`site/${this.siteId}/mode`, { mode, timestamp: new Date().toISOString() });
  }

  /**
   * Send alert
   */
  async sendAlert(severity, message) {
    try {
      if (this.dbManager.supabase) {
        await this.dbManager.supabase.from('alerts').insert({
          site_id: this.siteId,
          alert_type: 'power_mode',
          severity,
          message,
          is_resolved: false
        });
      }

      // Publish alert via MQTT
      this.mqttClient.publish(`site/${this.siteId}/alerts`, { severity, message });

      console.log(`🚨 Alert sent: [${severity}] ${message}`);
    } catch (error) {
      console.error('Error sending alert:', error);
    }
  }

  /**
   * Handle incoming MQTT messages
   */
  handleMQTTMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());

      // Parse topic to extract site and sensor info
      const parts = topic.split('/');

      if (parts[0] === 'site' && parts[2] === 'data') {
        // Incoming sensor data via MQTT
        this.ingestData({
          siteId: parts[1],
          sensorId: data.sensorId || 'mqtt-sensor',
          data: data,
          timestamp: data.timestamp || new Date().toISOString()
        });
      } else if (parts[2] === 'command') {
        // Command received
        this.handleCommand(data);
      }
    } catch (error) {
      console.error('Error handling MQTT message:', error);
    }
  }

  /**
   * Handle commands (e.g., mode changes, config updates)
   */
  handleCommand(command) {
    console.log('📨 Command received:', command);

    switch (command.type) {
      case 'set_mode':
        this.setMode(command.mode);
        break;
      case 'sync_now':
        this.attemptSync();
        break;
      case 'reboot':
        console.log('🔄 Reboot command received');
        process.exit(0);
        break;
      default:
        console.log('Unknown command:', command.type);
    }
  }

  /**
   * Sync cached data manually
   */
  async syncCachedData() {
    return await this.attemptSync();
  }

  /**
   * Get controller status
   */
  getStatus() {
    const cacheStats = this.dbManager.getCacheStats();

    return {
      mode: this.currentMode,
      battery_level: this.batteryLevel,
      site_id: this.siteId,
      mqtt_connected: this.mqttClient.isConnected(),
      is_online: this.dbManager.isOnline,
      cache_stats: cacheStats,
      config: this.config[this.currentMode]
    };
  }

  /**
   * Shutdown gracefully
   */
  async shutdown() {
    console.log('🛑 Shutting down gateway controller...');

    // Stop all intervals
    if (this.transmissionInterval) clearInterval(this.transmissionInterval);
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.syncInterval) clearInterval(this.syncInterval);

    // Final sync attempt
    await this.attemptSync();

    // Send offline status
    await this.dbManager.updateSiteStatus(this.siteId, 'offline');

    console.log('✅ Gateway controller shutdown complete');
  }
}
