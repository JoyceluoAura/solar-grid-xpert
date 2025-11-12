/**
 * MQTT Client - Handles MQTT communication for real-time data
 */

import mqtt from 'mqtt';

export class MQTTClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.messageHandler = null;

    this.brokerUrl = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com';
    this.username = process.env.MQTT_USERNAME;
    this.password = process.env.MQTT_PASSWORD;
    this.siteId = process.env.SITE_ID || 'demo-site';
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const options = {
        clientId: `solargridx_gateway_${this.siteId}_${Date.now()}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      };

      if (this.username && this.password) {
        options.username = this.username;
        options.password = this.password;
      }

      try {
        this.client = mqtt.connect(this.brokerUrl, options);

        this.client.on('connect', () => {
          this.connected = true;
          console.log(`✅ MQTT connected to ${this.brokerUrl}`);

          // Subscribe to site topics
          this.client.subscribe([
            `site/${this.siteId}/data`,
            `site/${this.siteId}/command`,
            `site/${this.siteId}/config`,
            `site/+/data` // Subscribe to all sites for demo
          ], (err) => {
            if (err) {
              console.error('MQTT subscription error:', err);
            } else {
              console.log('✅ MQTT subscribed to site topics');
            }
          });

          resolve();
        });

        this.client.on('error', (error) => {
          console.error('MQTT error:', error);
          this.connected = false;
          reject(error);
        });

        this.client.on('offline', () => {
          console.log('⚠️  MQTT offline');
          this.connected = false;
        });

        this.client.on('reconnect', () => {
          console.log('🔄 MQTT reconnecting...');
        });

        this.client.on('message', (topic, message) => {
          if (this.messageHandler) {
            this.messageHandler(topic, message);
          }
        });

      } catch (error) {
        console.error('MQTT connection error:', error);
        reject(error);
      }
    });
  }

  /**
   * Set message handler callback
   */
  onMessage(callback) {
    this.messageHandler = callback;
  }

  /**
   * Publish data to MQTT topic
   */
  publish(topic, data) {
    if (!this.connected || !this.client) {
      console.log('⚠️  MQTT not connected, cannot publish');
      return false;
    }

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);

      this.client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) {
          console.error('MQTT publish error:', err);
        }
      });

      return true;
    } catch (error) {
      console.error('MQTT publish error:', error);
      return false;
    }
  }

  /**
   * Subscribe to additional topics
   */
  subscribe(topics) {
    if (!this.connected || !this.client) {
      console.log('⚠️  MQTT not connected, cannot subscribe');
      return false;
    }

    const topicArray = Array.isArray(topics) ? topics : [topics];

    this.client.subscribe(topicArray, { qos: 1 }, (err) => {
      if (err) {
        console.error('MQTT subscription error:', err);
      } else {
        console.log(`✅ Subscribed to: ${topicArray.join(', ')}`);
      }
    });

    return true;
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected && this.client && this.client.connected;
  }

  /**
   * Disconnect from broker
   */
  async disconnect() {
    if (this.client) {
      return new Promise((resolve) => {
        this.client.end(false, () => {
          this.connected = false;
          console.log('✅ MQTT disconnected');
          resolve();
        });
      });
    }
  }
}
