# SolarGridX IoT Gateway

Off-grid solar site monitoring gateway with intelligent operational modes and automatic data recovery.

## Features

- **Three Operational Modes:**
  - 🟢 **Normal**: Real-time cloud sync (5s transmission interval)
  - 🟡 **Low Power**: Reduced frequency to conserve energy (60s interval)
  - 🔴 **Offline**: Local caching with automatic re-upload on recovery

- **Data Sources:**
  - Modbus TCP/RTU (inverters, batteries, sensors)
  - MQTT publish/subscribe
  - REST API endpoints

- **Automatic Mode Switching:**
  - Battery level monitoring
  - Network connectivity detection
  - Configurable thresholds

- **Data Resilience:**
  - Local SQLite caching during offline periods
  - Automatic re-upload when connection restored
  - No data loss even during extended outages

## Quick Start

### Installation

```bash
cd iot-gateway
npm install
```

### Configuration

1. Copy `.env.example` to `.env`
2. Update your Supabase credentials
3. Configure MQTT broker (default: HiveMQ public broker)
4. Set your site ID and organization ID

```env
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-supabase-service-key
SITE_ID=your-site-id
ORGANIZATION_ID=your-org-id
MOCK_MODBUS=true  # Set to false for real Modbus devices
```

### Run Gateway

```bash
npm start
```

### Run Test Client

Simulate an off-grid site sending data:

```bash
npm test
```

The test client will simulate:
1. Normal operation (30s)
2. Low power mode transition (30s)
3. Offline mode with local caching (30s)
4. Recovery and data sync (30s)

## API Endpoints

### Health Check
```bash
GET /health
```

### Data Ingestion
```bash
POST /api/ingest
Content-Type: application/json

{
  "siteId": "site-123",
  "sensorId": "sensor-456",
  "data": {
    "power": 3500,
    "voltage": 380,
    "temperature": 42
  },
  "timestamp": "2025-11-12T10:30:00Z"
}
```

### Heartbeat
```bash
POST /api/heartbeat
Content-Type: application/json

{
  "siteId": "site-123",
  "powerMode": "normal",
  "batteryLevel": 85,
  "networkType": "4g",
  "signalStrength": 75
}
```

### Cache Status
```bash
GET /api/cache/status
```

### Manual Sync
```bash
POST /api/sync
```

### Set Mode (Testing)
```bash
POST /api/mode
Content-Type: application/json

{
  "mode": "offline"
}
```

## MQTT Topics

### Subscribe (Gateway listens to):
- `site/{siteId}/data` - Sensor data
- `site/{siteId}/command` - Remote commands
- `site/{siteId}/config` - Configuration updates

### Publish (Gateway sends):
- `site/{siteId}/sensor/{sensorId}` - Real-time readings
- `site/{siteId}/mode` - Mode changes
- `site/{siteId}/alerts` - System alerts

## Operational Modes

### Normal Mode
- Transmission: Every 5 seconds
- Heartbeat: Every 5 minutes
- Full real-time cloud sync
- Triggered when: Battery > 30%

### Low Power Mode
- Transmission: Every 60 seconds
- Heartbeat: Every 10 minutes
- Reduced transmission frequency
- Triggered when: 15% < Battery ≤ 30%

### Offline Mode
- No cloud transmission
- Local SQLite caching
- Automatic sync attempts every 5 minutes
- Triggered when: Battery ≤ 15% OR network unavailable

## Architecture

```
┌─────────────────┐
│  Modbus Devices │ (Inverters, Batteries)
└────────┬────────┘
         │
┌────────▼────────┐
│ Modbus Reader   │
└────────┬────────┘
         │
    ┌────▼─────┐      ┌──────────────┐
    │ Gateway  │◄────►│ MQTT Broker  │
    │Controller│      └──────────────┘
    └────┬─────┘
         │
    ┌────▼──────┐     ┌──────────────┐
    │  SQLite   │     │   Supabase   │
    │  (Cache)  │     │   (Cloud)    │
    └───────────┘     └──────────────┘
```

## Production Deployment

### Raspberry Pi / Edge Device

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and install
git clone <repo-url>
cd iot-gateway
npm install --production

# Run as systemd service
sudo cp iot-gateway.service /etc/systemd/system/
sudo systemctl enable iot-gateway
sudo systemctl start iot-gateway
```

### Docker

```bash
docker build -t solargridx-gateway .
docker run -d \
  --name iot-gateway \
  --env-file .env \
  -p 3001:3001 \
  --restart unless-stopped \
  solargridx-gateway
```

## Monitoring

View logs:
```bash
# Development
npm run dev

# Production
journalctl -u iot-gateway -f
```

Check status:
```bash
curl http://localhost:3001/health
```

## Troubleshooting

### Gateway won't connect to Supabase
- Verify `SUPABASE_URL` and `SUPABASE_KEY` in `.env`
- Check network connectivity
- Gateway will automatically cache data locally

### MQTT connection fails
- Check `MQTT_BROKER` URL
- Verify firewall allows port 1883
- Try public broker: `mqtt://broker.hivemq.com`

### Modbus connection issues
- Set `MOCK_MODBUS=true` for testing without real devices
- Verify IP addresses and port numbers
- Check Modbus unit IDs

## License

MIT
