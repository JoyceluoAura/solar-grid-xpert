# 🚀 SolarGridX Hackathon Demo - Quick Start

## ⚡ 5-Minute Setup

### 1. Apply Database Migration (30 seconds)

```bash
# Open Supabase Dashboard: https://supabase.com/dashboard
# Go to SQL Editor
# Copy and run: supabase/migrations/20251112000001_multi_tenant_organizations.sql
```

### 2. Install Dependencies (2 minutes)

```bash
# Frontend
npm install

# IoT Gateway
cd iot-gateway
npm install
cd ..
```

### 3. Configure Environment (1 minute)

```bash
# IoT Gateway - Edit iot-gateway/.env
cd iot-gateway
cp .env.example .env
# Update SITE_ID after creating a site in the app
cd ..
```

### 4. Start Everything (1 minute)

**Terminal 1 - Frontend:**
```bash
npm run dev
# Open: http://localhost:8080
```

**Terminal 2 - IoT Gateway:**
```bash
cd iot-gateway
npm start
# Running on: http://localhost:3001
```

**Terminal 3 - Test Simulation:**
```bash
cd iot-gateway
npm test
# Watch the magic happen! ✨
```

## 🎬 Demo Script (5 minutes)

### Scene 1: Multi-Tenant Setup (1 min)
1. **Sign up** at http://localhost:8080
2. Go to **Organizations** page
3. Click **Create Organization**
   - Name: "Demo Solar Corp"
   - Watch it appear with "Free" tier badge

### Scene 2: Create Off-Grid Site (1 min)
1. Go to **Dashboard** or **Add Site**
2. Create site:
   - Name: "Remote Mining Site Alpha"
   - Location: "Desert Valley, Nevada"
   - Capacity: 100 kWp
3. Copy the Site ID from URL or Supabase

### Scene 3: Connect IoT Gateway (30 sec)
1. Edit `iot-gateway/.env`:
   ```bash
   SITE_ID=<paste-your-site-id>
   ```
2. Start gateway: `npm start`
3. Confirm "✅ Gateway controller initialized"

### Scene 4: Watch Real-Time Magic (2.5 min)
1. Open **Real-Time Monitor** page
2. Run test client: `npm test`
3. Watch the status changes:

   **0-30s: 🟢 Normal Operation**
   - Green badge, battery 85-95%
   - Data streaming every 5 seconds
   - Readings appear in table

   **30-60s: 🟡 Low Power Mode**
   - Yellow badge, battery drops to 25-30%
   - Alert: "Site entering low power mode"
   - Reduced transmission frequency

   **60-90s: 🔴 Offline Mode**
   - Red badge, battery critical <15%
   - Alert: "Site going offline"
   - Data cached locally (see console logs)
   - Last seen timestamp increases

   **90-120s: ✅ Recovery**
   - Green badge returns
   - Alert: "Site recovered"
   - Watch cached data upload (10 records)
   - Real-time monitoring resumes

## 🎯 Key Demo Points

### 1. Multi-Tenancy ✨
- Show Organizations page
- Create second organization
- Invite team member (shows UI)
- Role-based permissions

### 2. IoT Gateway Intelligence 🧠
- **Automatic mode switching** based on battery
- **No data loss** during outages
- **Automatic recovery** and data sync
- **Real-time alerts** for status changes

### 3. Three Operational Modes 🔄
```
Normal Mode → Low Power → Offline → Recovery
   ↓              ↓           ↓          ↓
5s sync       60s sync    SQLite     Re-upload
Battery>30%   15-30%      cache      Auto-sync
```

### 4. Data Resilience 💪
- Local SQLite caching
- Automatic re-upload on recovery
- Heartbeat monitoring (30min timeout)
- Connection quality tracking

### 5. Real-Time Updates 📡
- Live sensor readings
- Alert notifications
- Status badges update automatically
- Battery level progress bars

## 📊 Architecture Highlight

```
┌─────────────────────────────────────────┐
│         React Frontend (Vite)           │
│  - Organizations                        │
│  - Real-Time Monitor                    │
│  - Multi-tenant Dashboard               │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│           Supabase Backend              │
│  - PostgreSQL + RLS                     │
│  - Real-time Subscriptions              │
│  - Multi-tenant Data Isolation          │
└───────────────┬─────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│        IoT Gateway (Node.js)            │
│  ┌────────────────────────────────┐    │
│  │  Gateway Controller            │    │
│  │  - Mode: Normal/Low/Offline    │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌──────────┐  ┌──────────────────┐   │
│  │  SQLite  │  │  Database Mgr    │   │
│  │  Cache   │◄─┤  - Cloud Sync    │   │
│  └──────────┘  └──────────────────┘   │
│                                         │
│  ┌──────────┐  ┌──────────────────┐   │
│  │   MQTT   │  │  Modbus Reader   │   │
│  │  Client  │  │  (Inverters)     │   │
│  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────┘
                │
                ▼
    ┌───────────────────────┐
    │  IoT Devices          │
    │  - Inverters          │
    │  - Batteries          │
    │  - Sensors            │
    └───────────────────────┘
```

## 🎤 Talking Points

### Problem Statement
"Off-grid solar sites lose power and network connectivity. How do we ensure continuous monitoring and prevent data loss during outages?"

### Solution
"SolarGridX intelligently adapts to power availability:
- **Normal mode** when power is abundant
- **Low power mode** to extend battery life
- **Offline mode** with local caching
- **Automatic recovery** and data sync"

### Innovation
"Unlike traditional monitoring systems that go dark during outages, our IoT Gateway:
1. Detects power/network issues automatically
2. Switches to conservation mode
3. Caches data locally
4. Recovers and syncs when connection returns
All without human intervention!"

### Business Value
"For solar O&M companies managing 100+ remote sites:
- Zero data loss during outages
- Reduced site visit costs
- Predictive maintenance alerts
- Multi-tenant SaaS platform
- Subscription revenue model"

## 💡 Demo Tips

1. **Pre-load data**: Run test client before demo for immediate visuals
2. **Multiple browsers**: Show multi-tenancy with different organizations
3. **Live coding**: Edit SITE_ID in .env to show configuration
4. **Mobile view**: Responsive design works on phones
5. **Error handling**: Disconnect MQTT to show offline mode

## 🐛 Quick Fixes

### Gateway won't start?
```bash
cd iot-gateway
rm -rf node_modules
npm install
npm start
```

### No data showing?
- Check SITE_ID matches actual site
- Verify Supabase URL in both .env files
- Check browser console for errors

### Frontend build error?
```bash
rm -rf node_modules
npm install
npm run dev
```

## 📸 Screenshots to Capture

1. Organizations page with multiple orgs
2. Real-Time Monitor showing 🟢 Online
3. Real-Time Monitor showing 🟡 Low Power
4. Real-Time Monitor showing 🔴 Offline
5. Gateway console logs showing mode switches
6. Alerts panel with status notifications
7. Sensor readings table updating live
8. Battery level progress bar changing

## 🏆 Winning Points

- ✅ Solves real industry problem (off-grid monitoring)
- ✅ Intelligent automation (mode switching)
- ✅ Data resilience (no loss during outages)
- ✅ Multi-tenant SaaS ready
- ✅ Production-ready architecture
- ✅ Comprehensive documentation
- ✅ Live demo with simulated scenarios
- ✅ Scalable to thousands of sites

## 📝 Judges' Questions - Prep Answers

**Q: How does it handle long outages?**
A: SQLite cache stores unlimited data. On recovery, uploads in batches of 100 records to avoid overwhelming the system.

**Q: What about security?**
A: Row-Level Security (RLS) in Supabase ensures complete data isolation. Users can only access their organization's data.

**Q: Can it scale?**
A: Yes! Multi-tenant architecture, connection pooling, and gateway service can run on any edge device (Raspberry Pi, Industrial PC).

**Q: Real-world deployment?**
A: Gateway runs on-site (Raspberry Pi), connects via 4G/5G/LoRa/Satellite. Frontend on Vercel CDN. Database on Supabase (managed PostgreSQL).

**Q: What makes this different?**
A: Three operational modes with automatic switching. Traditional systems just go offline and lose data. We cache and auto-recover.

## 🚀 Next Steps Pitch

"What we built in 5 hours for this hackathon is just the beginning:
- **Phase 2**: Stripe billing, email/SMS alerts
- **Phase 3**: AI-powered forecasting and anomaly detection
- **Phase 4**: Mobile app, white-label capabilities
- **Go-to-market**: 100+ pilot sites lined up"

---

**Break a leg! 🎭 This demo will blow their minds! 🤯**
