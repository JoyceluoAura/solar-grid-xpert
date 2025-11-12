#!/usr/bin/env node

/**
 * SolarGridX IoT Gateway Service
 * Handles off-grid solar site monitoring with three operational modes:
 * 1. Normal Operation - Real-time cloud sync
 * 2. Low Power Mode - Reduced transmission frequency
 * 3. Offline Mode - Local caching with auto re-upload
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GatewayController } from './gateway-controller.js';
import { DatabaseManager } from './database-manager.js';
import { MQTTClient } from './mqtt-client.js';
import { HeartbeatMonitor } from './heartbeat-monitor.js';
import { ModbusReader } from './modbus-reader.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const dbManager = new DatabaseManager();
const mqttClient = new MQTTClient();
const heartbeatMonitor = new HeartbeatMonitor();
const modbusReader = new ModbusReader();
const gatewayController = new GatewayController({
  dbManager,
  mqttClient,
  heartbeatMonitor,
  modbusReader
});

// Health check endpoint
app.get('/health', (req, res) => {
  const status = gatewayController.getStatus();
  res.json({
    status: 'operational',
    timestamp: new Date().toISOString(),
    ...status
  });
});

// Data ingestion endpoint (REST API)
app.post('/api/ingest', async (req, res) => {
  try {
    const { siteId, sensorId, data, timestamp } = req.body;

    if (!siteId || !sensorId || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await gatewayController.ingestData({
      siteId,
      sensorId,
      data,
      timestamp: timestamp || new Date().toISOString()
    });

    res.json({ success: true, message: 'Data ingested successfully' });
  } catch (error) {
    console.error('Ingestion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Heartbeat endpoint
app.post('/api/heartbeat', async (req, res) => {
  try {
    const { siteId, powerMode, batteryLevel, networkType, signalStrength } = req.body;

    await gatewayController.recordHeartbeat({
      siteId,
      powerMode,
      batteryLevel,
      networkType,
      signalStrength
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get cached data count
app.get('/api/cache/status', async (req, res) => {
  try {
    const stats = await dbManager.getCacheStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual sync trigger
app.post('/api/sync', async (req, res) => {
  try {
    const result = await gatewayController.syncCachedData();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get operational mode
app.get('/api/mode', (req, res) => {
  res.json({ mode: gatewayController.currentMode });
});

// Set operational mode (for testing)
app.post('/api/mode', (req, res) => {
  const { mode } = req.body;
  if (!['normal', 'low_power', 'offline'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode' });
  }
  gatewayController.setMode(mode);
  res.json({ success: true, mode });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 IoT Gateway started on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    // Initialize all services
    await gatewayController.initialize();
    console.log('✅ Gateway controller initialized');

    // Start data collection
    await gatewayController.startDataCollection();
    console.log('✅ Data collection started');

    // Start heartbeat monitoring
    heartbeatMonitor.start();
    console.log('✅ Heartbeat monitoring active');

    console.log('\n📊 Gateway Status:');
    console.log(`   Mode: ${gatewayController.currentMode}`);
    console.log(`   MQTT: ${mqttClient.isConnected() ? 'Connected' : 'Disconnected'}`);
    console.log(`   Database: Ready`);

  } catch (error) {
    console.error('❌ Initialization error:', error);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gateway...');
  await gatewayController.shutdown();
  await mqttClient.disconnect();
  heartbeatMonitor.stop();
  dbManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gateway...');
  await gatewayController.shutdown();
  process.exit(0);
});

export default app;
