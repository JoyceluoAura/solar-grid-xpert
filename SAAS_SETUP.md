# SolarGridX v2.0 - Multi-Tenant SaaS Setup Guide

## 🚀 Project Overview

SolarGridX v2.0 is a production-ready multi-tenant SaaS platform for monitoring off-grid solar installations. It features intelligent operational modes that ensure continuous data visibility even during power outages or network connectivity issues.

### Key Features

#### 🏢 Multi-Tenant Architecture
- Organizations with team management
- Role-based access control (Owner, Admin, Manager, Viewer)
- Subscription tiers (Free, Starter, Professional, Enterprise)
- Site limits based on subscription

#### 📡 IoT Gateway with Three Operational Modes
1. **Normal Mode** (🟢 Online)
   - Real-time cloud sync every 5 seconds
   - Full data transmission
   - Battery > 30%

2. **Low Power Mode** (🟡 Warning)
   - Reduced transmission frequency (60s)
   - Power conservation
   - 15% < Battery ≤ 30%

3. **Offline Mode** (🔴 Offline)
   - Local SQLite caching
   - Automatic data re-upload on recovery
   - Battery ≤ 15% OR network unavailable

#### 🔌 Data Sources
- **Modbus TCP/RTU**: Inverters, batteries, sensors
- **MQTT**: Real-time pub/sub messaging
- **REST API**: HTTP endpoints for data ingestion

## 📋 Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase account (free tier works)
- MQTT broker access (HiveMQ public broker works for testing)

### 1. Apply Database Migrations

```bash
# Navigate to project root
cd solar-grid-xpert

# If using Supabase CLI
supabase db push

# OR manually apply migrations in Supabase dashboard:
# 1. Go to https://supabase.com/dashboard
# 2. Select your project
# 3. Navigate to SQL Editor
# 4. Run the migration file: supabase/migrations/20251112000001_multi_tenant_organizations.sql
```

### 2. Set Up Environment Variables

```bash
# Frontend (.env in root)
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

```bash
# IoT Gateway (iot-gateway/.env)
SUPABASE_URL=your-supabase-url
SUPABASE_KEY=your-service-role-key  # Important: Use service role key for backend
SITE_ID=demo-site-001
MQTT_BROKER=mqtt://broker.hivemq.com
MOCK_MODBUS=true
```

### 3. Install Dependencies

```bash
# Frontend
npm install

# IoT Gateway
cd iot-gateway
npm install
cd ..
```

### 4. Run the Application

**Terminal 1 - Frontend:**
```bash
npm run dev
```

**Terminal 2 - IoT Gateway:**
```bash
cd iot-gateway
npm start
```

**Terminal 3 - Test Client (Optional):**
```bash
cd iot-gateway
npm test
```

## 🗂️ Project Structure

```
solar-grid-xpert/
├── src/                          # Frontend React application
│   ├── pages/
│   │   ├── Organizations.tsx     # Organization management
│   │   ├── RealTimeMonitor.tsx   # Real-time site monitoring
│   │   ├── Dashboard.tsx         # Main dashboard
│   │   └── ...
│   ├── components/               # Reusable components
│   └── contexts/                 # React contexts (Auth, etc.)
│
├── iot-gateway/                  # IoT Gateway Service
│   ├── src/
│   │   ├── index.js             # Main server
│   │   ├── gateway-controller.js # Orchestrates operational modes
│   │   ├── database-manager.js  # SQLite cache + Supabase sync
│   │   ├── mqtt-client.js       # MQTT pub/sub
│   │   ├── modbus-reader.js     # Modbus device communication
│   │   ├── heartbeat-monitor.js # Heartbeat monitoring
│   │   └── test-client.js       # Test/simulation client
│   ├── data/                    # SQLite cache database
│   └── package.json
│
└── supabase/
    ├── config.toml
    └── migrations/
        └── 20251112000001_multi_tenant_organizations.sql
```

## 🗄️ Database Schema

### Core Tables

#### `organizations`
- Multi-tenant organization records
- Subscription tiers and limits
- Billing information

#### `organization_members`
- Links users to organizations
- Role-based permissions
- Invitation system

#### `sites`
- Solar installation sites
- Connection status (online/low_power/offline)
- Power mode and battery level
- Organization-scoped

#### `sensors`
- IoT sensors and devices
- Type (inverter, battery, thermal, etc.)
- Protocol (MQTT, Modbus, HTTP)
- Organization and site association

#### `sensor_readings`
- Time-series sensor data
- Value, unit, timestamp
- Metadata for extensibility

#### `site_heartbeats`
- Regular heartbeat signals
- Power mode tracking
- Network quality metrics

#### `cached_sensor_data`
- Tracks data cached during offline periods
- Upload status

#### `alerts`
- System alerts and notifications
- Severity levels
- Resolution tracking

## 🔌 IoT Gateway API

### Endpoints

#### Health Check
```bash
GET http://localhost:3001/health

Response:
{
  "status": "operational",
  "timestamp": "2025-11-12T10:30:00Z",
  "mode": "normal",
  "battery_level": 85,
  "mqtt_connected": true,
  "is_online": true,
  "cache_stats": {
    "pending_readings": 0,
    "total_readings": 1250
  }
}
```

#### Data Ingestion
```bash
POST http://localhost:3001/api/ingest
Content-Type: application/json

{
  "siteId": "site-123",
  "sensorId": "inverter-1",
  "data": {
    "power": 3500,
    "voltage": 380,
    "temperature": 42
  },
  "timestamp": "2025-11-12T10:30:00Z"
}
```

#### Heartbeat
```bash
POST http://localhost:3001/api/heartbeat

{
  "siteId": "site-123",
  "powerMode": "normal",
  "batteryLevel": 85,
  "networkType": "4g",
  "signalStrength": 75
}
```

#### Cache Status
```bash
GET http://localhost:3001/api/cache/status
```

#### Manual Sync
```bash
POST http://localhost:3001/api/sync
```

#### Set Mode (Testing)
```bash
POST http://localhost:3001/api/mode

{
  "mode": "offline"  // normal | low_power | offline
}
```

### MQTT Topics

**Subscribe (Gateway listens):**
- `site/{siteId}/data` - Incoming sensor data
- `site/{siteId}/command` - Remote commands
- `site/{siteId}/config` - Configuration updates

**Publish (Gateway sends):**
- `site/{siteId}/sensor/{sensorId}` - Real-time readings
- `site/{siteId}/mode` - Mode change notifications
- `site/{siteId}/alerts` - System alerts

## 🧪 Testing the System

### 1. Create an Organization

1. Start the frontend: `npm run dev`
2. Navigate to http://localhost:8080
3. Sign up / Sign in
4. Go to **Organizations** page
5. Click **Create Organization**
6. Enter name: "Demo Solar Company"

### 2. Create a Site

1. Go to **Dashboard** or **Add Site**
2. Create a new site with:
   - Name: "Demo Off-Grid Site"
   - Location: "Remote Mining Area"
   - Capacity: 100 kWp

### 3. Start IoT Gateway

```bash
cd iot-gateway

# Edit .env to set SITE_ID to your created site's ID
# (You can find it in Supabase dashboard or frontend)

npm start
```

### 4. Run Test Client

```bash
cd iot-gateway
npm test
```

The test client will simulate:
- 30s of normal operation
- 30s of low power mode transition
- 30s of offline mode with caching
- 30s of recovery with data sync

### 5. Monitor in Real-Time

1. Open **Real-Time Monitor** page
2. Select your site
3. Watch as status changes:
   - 🟢 Online → 🟡 Low Power → 🔴 Offline → 🟢 Online
4. View sensor readings as they arrive
5. See alerts generated during mode transitions

## 🚀 Production Deployment

### Frontend (Vercel)

```bash
# Connect to GitHub
git push origin main

# Deploy on Vercel
vercel --prod

# Set environment variables in Vercel dashboard:
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

### IoT Gateway (Raspberry Pi / Edge Device)

```bash
# On Raspberry Pi
git clone <your-repo>
cd solar-grid-xpert/iot-gateway

# Install dependencies
npm install --production

# Create .env with production credentials
nano .env

# Run as systemd service
sudo cp iot-gateway.service /etc/systemd/system/
sudo systemctl enable iot-gateway
sudo systemctl start iot-gateway

# Check status
sudo systemctl status iot-gateway

# View logs
journalctl -u iot-gateway -f
```

### Docker Deployment

```dockerfile
# Dockerfile for IoT Gateway
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t solargridx-gateway ./iot-gateway
docker run -d \
  --name iot-gateway \
  --env-file ./iot-gateway/.env \
  -p 3001:3001 \
  --restart unless-stopped \
  solargridx-gateway
```

## 🔒 Security Considerations

### Row-Level Security (RLS)
- All tables have RLS policies enabled
- Users can only access data from their organizations
- Role-based permissions enforced at database level

### API Security
- Service role key should NEVER be exposed to frontend
- Use anon/public key in frontend
- Backend services use service role key
- Implement rate limiting in production

### MQTT Security
- Use TLS for production (mqtts://)
- Implement authentication (username/password)
- Use unique client IDs per gateway
- Consider certificate-based auth

## 📊 Monitoring & Observability

### Logs
```bash
# Frontend (Vite)
npm run dev  # Console output

# IoT Gateway
npm start    # Console output

# Production
journalctl -u iot-gateway -f
```

### Metrics to Track
- Site uptime percentage
- Data transmission success rate
- Cache size and upload latency
- Battery level trends
- Alert frequency by severity

### Supabase Dashboard
- Monitor database performance
- View real-time connections
- Check storage usage
- Analyze query performance

## 🐛 Troubleshooting

### Gateway Won't Start
```bash
# Check Node version
node --version  # Should be 18+

# Check dependencies
cd iot-gateway
npm install

# Check environment variables
cat .env

# Check Supabase connection
curl https://your-project.supabase.co/rest/v1/
```

### No Data Appearing
1. Check gateway is running: `curl http://localhost:3001/health`
2. Verify SITE_ID matches actual site in database
3. Check Supabase credentials (use service role key for gateway)
4. Review gateway logs for errors
5. Test MQTT connection: Try public broker first

### Frontend Build Errors
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Check TypeScript errors
npx tsc --noEmit

# Build
npm run build
```

### MQTT Connection Issues
- Try HiveMQ public broker: `mqtt://broker.hivemq.com`
- Check firewall rules (port 1883)
- Enable MQTT logging in gateway

## 📚 Next Steps

### Phase 2 Features (Future Enhancements)
- [ ] Stripe integration for subscriptions
- [ ] Email notifications for alerts
- [ ] WhatsApp/SMS integration
- [ ] Advanced analytics and forecasting
- [ ] Mobile app (React Native)
- [ ] API documentation with Swagger
- [ ] WebSocket real-time updates
- [ ] Multi-language support
- [ ] White-label capabilities

### Scaling Considerations
- [ ] Redis for caching
- [ ] PostgreSQL connection pooling
- [ ] CDN for static assets
- [ ] Load balancing for gateways
- [ ] TimescaleDB for time-series optimization
- [ ] Message queue (RabbitMQ/Kafka)

## 📝 License

MIT

## 🤝 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/your-org/solar-grid-xpert/issues)
- Email: support@solargridx.com
- Documentation: [View docs](https://docs.solargridx.com)

---

**Built for hackathons. Ready for production. 🚀**
