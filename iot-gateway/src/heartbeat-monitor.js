/**
 * Heartbeat Monitor - Monitors site connectivity and health
 */

export class HeartbeatMonitor {
  constructor() {
    this.interval = null;
    this.lastHeartbeat = new Date();
    this.missedHeartbeats = 0;
    this.maxMissedHeartbeats = 3;

    this.heartbeatInterval = parseInt(process.env.HEARTBEAT_INTERVAL || 300000); // 5 minutes
    this.offlineThreshold = parseInt(process.env.OFFLINE_THRESHOLD || 1800000); // 30 minutes
  }

  /**
   * Start monitoring
   */
  start() {
    console.log('💓 Heartbeat monitor started');

    this.interval = setInterval(() => {
      this.checkHeartbeat();
    }, this.heartbeatInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('💓 Heartbeat monitor stopped');
    }
  }

  /**
   * Record a heartbeat
   */
  recordHeartbeat() {
    this.lastHeartbeat = new Date();
    this.missedHeartbeats = 0;
  }

  /**
   * Check if heartbeat is within threshold
   */
  checkHeartbeat() {
    const now = new Date();
    const timeSinceLastHeartbeat = now - this.lastHeartbeat;

    if (timeSinceLastHeartbeat > this.offlineThreshold) {
      this.missedHeartbeats++;
      console.log(`⚠️  Missed heartbeat #${this.missedHeartbeats} - Last seen: ${Math.floor(timeSinceLastHeartbeat / 1000 / 60)} minutes ago`);

      if (this.missedHeartbeats >= this.maxMissedHeartbeats) {
        console.log('❌ Site marked as OFFLINE - No heartbeat for 30+ minutes');
        // Trigger offline event
        this.onOffline && this.onOffline();
      }
    }
  }

  /**
   * Get status
   */
  getStatus() {
    const now = new Date();
    const timeSinceLastHeartbeat = now - this.lastHeartbeat;
    const isOnline = timeSinceLastHeartbeat < this.offlineThreshold;

    return {
      is_online: isOnline,
      last_heartbeat: this.lastHeartbeat.toISOString(),
      time_since_heartbeat_ms: timeSinceLastHeartbeat,
      missed_heartbeats: this.missedHeartbeats
    };
  }

  /**
   * Set offline callback
   */
  onOffline(callback) {
    this.onOfflineCallback = callback;
  }
}
