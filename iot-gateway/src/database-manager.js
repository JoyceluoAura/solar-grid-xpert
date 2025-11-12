/**
 * Database Manager - Handles local SQLite caching and Supabase sync
 */

import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseManager {
  constructor() {
    this.localDb = null;
    this.supabase = null;
    this.isOnline = true;
  }

  async initialize() {
    // Initialize local SQLite database for offline caching
    const dbPath = path.join(__dirname, '..', 'data', 'cache.db');
    this.localDb = new Database(dbPath);

    // Create tables for local caching
    this.localDb.exec(`
      CREATE TABLE IF NOT EXISTS cached_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        sensor_id TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        uploaded BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS cached_heartbeats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id TEXT NOT NULL,
        power_mode TEXT NOT NULL,
        battery_level REAL,
        network_type TEXT,
        signal_strength REAL,
        timestamp TEXT NOT NULL,
        uploaded BOOLEAN DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_uploaded ON cached_readings(uploaded);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON cached_readings(timestamp);
      CREATE INDEX IF NOT EXISTS idx_heartbeat_uploaded ON cached_heartbeats(uploaded);
    `);

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Supabase client initialized');
    } else {
      console.warn('⚠️  Supabase credentials not found, running in offline-only mode');
    }

    console.log('✅ Local database initialized');
  }

  /**
   * Save data locally (for offline mode)
   */
  saveLocal(siteId, sensorId, data, timestamp) {
    try {
      const stmt = this.localDb.prepare(`
        INSERT INTO cached_readings (site_id, sensor_id, data, timestamp)
        VALUES (?, ?, ?, ?)
      `);

      const dataJson = JSON.stringify(data);
      stmt.run(siteId, sensorId, dataJson, timestamp);

      console.log(`💾 Data cached locally - Sensor: ${sensorId}`);
      return true;
    } catch (error) {
      console.error('Error saving to local cache:', error);
      return false;
    }
  }

  /**
   * Save heartbeat locally
   */
  saveHeartbeatLocal(siteId, powerMode, batteryLevel, networkType, signalStrength) {
    try {
      const stmt = this.localDb.prepare(`
        INSERT INTO cached_heartbeats (site_id, power_mode, battery_level, network_type, signal_strength, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(siteId, powerMode, batteryLevel, networkType, signalStrength, new Date().toISOString());
      return true;
    } catch (error) {
      console.error('Error saving heartbeat locally:', error);
      return false;
    }
  }

  /**
   * Send data to cloud (Supabase)
   */
  async sendToCloud(siteId, sensorId, data, timestamp) {
    if (!this.supabase) {
      console.log('⚠️  No cloud connection configured');
      return false;
    }

    try {
      // Insert sensor reading
      const { error } = await this.supabase
        .from('sensor_readings')
        .insert({
          sensor_id: sensorId,
          value: data.value || 0,
          unit: data.unit || 'unknown',
          timestamp: timestamp,
          metadata: data
        });

      if (error) {
        console.error('Cloud upload error:', error);
        return false;
      }

      console.log(`☁️  Data uploaded to cloud - Sensor: ${sensorId}`);
      return true;
    } catch (error) {
      console.error('Cloud connection error:', error);
      this.isOnline = false;
      return false;
    }
  }

  /**
   * Upload cached data to cloud (recovery after offline period)
   */
  async uploadCachedData() {
    if (!this.supabase) {
      console.log('⚠️  Cannot upload: No cloud connection');
      return { success: false, message: 'No cloud connection' };
    }

    try {
      // Get unuploaded readings
      const readings = this.localDb
        .prepare('SELECT * FROM cached_readings WHERE uploaded = 0 ORDER BY timestamp ASC LIMIT 100')
        .all();

      if (readings.length === 0) {
        console.log('✅ No cached data to upload');
        return { success: true, uploaded: 0 };
      }

      console.log(`📤 Uploading ${readings.length} cached readings...`);

      let successCount = 0;
      const updateStmt = this.localDb.prepare('UPDATE cached_readings SET uploaded = 1 WHERE id = ?');

      for (const reading of readings) {
        const data = JSON.parse(reading.data);

        const { error } = await this.supabase
          .from('sensor_readings')
          .insert({
            sensor_id: reading.sensor_id,
            value: data.value || 0,
            unit: data.unit || 'unknown',
            timestamp: reading.timestamp,
            metadata: data
          });

        if (!error) {
          updateStmt.run(reading.id);
          successCount++;
        } else {
          console.error(`Failed to upload reading ${reading.id}:`, error);
        }
      }

      console.log(`✅ Successfully uploaded ${successCount}/${readings.length} readings`);

      // Upload cached heartbeats
      const heartbeats = this.localDb
        .prepare('SELECT * FROM cached_heartbeats WHERE uploaded = 0 ORDER BY timestamp ASC LIMIT 50')
        .all();

      if (heartbeats.length > 0) {
        console.log(`📤 Uploading ${heartbeats.length} cached heartbeats...`);

        const updateHbStmt = this.localDb.prepare('UPDATE cached_heartbeats SET uploaded = 1 WHERE id = ?');

        for (const hb of heartbeats) {
          const { error } = await this.supabase
            .from('site_heartbeats')
            .insert({
              site_id: hb.site_id,
              power_mode: hb.power_mode,
              battery_level: hb.battery_level,
              network_type: hb.network_type,
              signal_strength: hb.signal_strength,
              received_at: hb.timestamp
            });

          if (!error) {
            updateHbStmt.run(hb.id);
          }
        }
      }

      this.isOnline = true;
      return { success: true, uploaded: successCount };
    } catch (error) {
      console.error('Upload error:', error);
      this.isOnline = false;
      return { success: false, error: error.message };
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const pendingReadings = this.localDb
      .prepare('SELECT COUNT(*) as count FROM cached_readings WHERE uploaded = 0')
      .get();

    const totalReadings = this.localDb
      .prepare('SELECT COUNT(*) as count FROM cached_readings')
      .get();

    const pendingHeartbeats = this.localDb
      .prepare('SELECT COUNT(*) as count FROM cached_heartbeats WHERE uploaded = 0')
      .get();

    const oldestPending = this.localDb
      .prepare('SELECT timestamp FROM cached_readings WHERE uploaded = 0 ORDER BY timestamp ASC LIMIT 1')
      .get();

    return {
      pending_readings: pendingReadings.count,
      total_readings: totalReadings.count,
      pending_heartbeats: pendingHeartbeats.count,
      oldest_pending: oldestPending?.timestamp || null,
      is_online: this.isOnline
    };
  }

  /**
   * Clean old uploaded data (keep last 7 days)
   */
  cleanOldData() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const result = this.localDb
      .prepare('DELETE FROM cached_readings WHERE uploaded = 1 AND timestamp < ?')
      .run(sevenDaysAgo);

    const hbResult = this.localDb
      .prepare('DELETE FROM cached_heartbeats WHERE uploaded = 1 AND timestamp < ?')
      .run(sevenDaysAgo);

    console.log(`🗑️  Cleaned ${result.changes + hbResult.changes} old records`);
  }

  /**
   * Update site status in cloud
   */
  async updateSiteStatus(siteId, status, metadata = {}) {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('sites')
        .update({
          connection_status: status,
          last_heartbeat_at: new Date().toISOString(),
          ...metadata
        })
        .eq('id', siteId);

      return !error;
    } catch (error) {
      console.error('Error updating site status:', error);
      return false;
    }
  }

  close() {
    if (this.localDb) {
      this.localDb.close();
      console.log('✅ Local database closed');
    }
  }
}
