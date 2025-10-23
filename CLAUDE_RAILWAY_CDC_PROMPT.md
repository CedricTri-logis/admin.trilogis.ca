# QuickBooks CDC Sync Worker - Railway Deployment Prompt

## Objective
Create a standalone Node.js service on Railway that handles QuickBooks CDC (Change Data Capture) synchronization. This service will be called by the Next.js application (hosted on Vercel) and will handle long-running sync operations without timeout constraints.

## Why Railway?

The Next.js app on Vercel has timeout limitations:
- Vercel Hobby: 10 seconds max
- Vercel Pro: 60 seconds max
- CDC sync takes 240-300 seconds

Railway allows:
- ✅ Long-running processes (no timeouts)
- ✅ WebSocket and SSE support
- ✅ Persistent connections
- ✅ Full Node.js environment

## Project Context

### Reference Implementation
**Working Terminal Script**: `/Users/cedriclajoie/Project/cs50/DockerFile copy/scripts/quickbooks/Import/sync-cdc-incremental.js`

This 1264-line script demonstrates:
- ✅ Proper CDC API usage (single API call for all entities)
- ✅ Progress logging with emojis (📊, ✅, ❌, ⚠️, 🔍)
- ✅ Verify mode (compares QuickBooks counts vs Database counts)
- ✅ Entity preparation for all types
- ✅ Proper error handling
- ✅ Token refresh logic

### Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **QuickBooks**: OAuth 2.0 with automatic token refresh
- **Communication**: Server-Sent Events (SSE)
- **Deployment**: Railway

## Service Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│  Next.js on Vercel  │         │  Railway CDC Worker  │
│                     │         │                      │
│  User clicks        │  HTTP   │  Express.js Server   │
│  "Start Sync"  ────────POST──→  /api/sync/start     │
│                     │         │                      │
│  Opens SSE     ←────────SSE────  /api/sync/stream   │
│  connection         │         │                      │
│                     │         │  • Fetch CDC data    │
│  Receives real-time │         │  • Process entities  │
│  progress updates   │         │  • Update database   │
│                     │         │  • Verify counts     │
└─────────────────────┘         └──────────────────────┘
                                         │
                                         ▼
                                ┌────────────────┐
                                │  Supabase DB   │
                                │  qb_* tables   │
                                └────────────────┘
```

## Implementation Requirements

### 1. Create Express.js Server

**File**: `server.js`

```javascript
const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')

const app = express()
const PORT = process.env.PORT || 3001

// CORS - allow requests from Vercel app
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}))

app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'quickbooks-cdc-sync' })
})

// Start sync endpoint
app.post('/api/sync/start', async (req, res) => {
  // Validate request
  // Create sync job
  // Return job ID
})

// SSE stream endpoint
app.get('/api/sync/stream/:jobId', (req, res) => {
  // Set SSE headers
  // Stream progress updates
})

app.listen(PORT, () => {
  console.log(`🚀 CDC Sync Worker running on port ${PORT}`)
})
```

### 2. Implement CDC Sync Logic

**File**: `sync/cdc-sync.js`

Based on the reference script, implement:

```javascript
class CDCSyncWorker {
  constructor(realmId, jobId, verify = false) {
    this.realmId = realmId
    this.jobId = jobId
    this.verify = verify
    this.supabase = createSupabaseClient()
    this.entityTypes = [
      'CompanyInfo', 'Customer', 'Vendor', 'Account',
      'Class', 'Department', 'Item', 'Employee',
      'Invoice', 'Bill', 'Payment', 'BillPayment',
      'CreditMemo', 'Deposit', 'JournalEntry', 'Purchase',
      'SalesReceipt', 'TimeActivity', 'Transfer', 'VendorCredit'
    ]
  }

  async run() {
    try {
      await this.updateJobStatus('in_progress')

      // Get auth token
      const token = await this.getAuthToken()
      if (!token) throw new Error('No active QuickBooks connection')

      // Get last sync checkpoint
      const changedSince = await this.getLastSyncCheckpoint()

      // Emit progress
      this.emit('progress', { message: '📊 Fetching changes from QuickBooks...', entity: null })

      // Make CDC API call (single request for all entities)
      const cdcData = await this.fetchCDCData(token, changedSince)

      // Process each entity type
      const stats = { created: 0, updated: 0, deleted: 0, errors: 0 }

      for (const entityType of this.entityTypes) {
        const entities = this.extractEntities(cdcData, entityType)

        if (entities.length > 0) {
          this.emit('progress', {
            message: `Processing ${entities.length} ${entityType} changes`,
            entity: entityType,
            count: entities.length,
            emoji: '📊'
          })

          const result = await this.processEntities(entities, entityType)
          stats.created += result.created
          stats.updated += result.updated
          stats.deleted += result.deleted
          stats.errors += result.errors

          this.emit('progress', {
            message: `✅ ${entityType} complete`,
            entity: entityType,
            count: entities.length,
            emoji: '✅'
          })
        }
      }

      // Verification mode
      if (this.verify) {
        this.emit('progress', { message: '🔍 Verifying entity counts...', emoji: '🔍' })
        const verificationResults = await this.verifyEntityCounts(token)
        this.emit('verification', verificationResults)
      }

      // Complete
      await this.updateJobStatus('completed', stats)
      this.emit('complete', { stats })

    } catch (error) {
      await this.updateJobStatus('failed', null, error.message)
      this.emit('error', { message: error.message })
    }
  }

  async fetchCDCData(token, changedSince) {
    const baseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com'

    const entities = this.entityTypes.join(',')
    const url = `${baseUrl}/v3/company/${this.realmId}/cdc?entities=${entities}&changedSince=${changedSince}`

    // Use makeQBRequest for automatic token refresh
    return await this.makeQBRequest('GET', url, token)
  }

  async processEntities(entities, entityType) {
    const tableName = this.getTableName(entityType)
    const stats = { created: 0, updated: 0, deleted: 0, errors: 0 }

    for (const entity of entities) {
      try {
        if (entity.status === 'Deleted') {
          // Soft delete
          await this.supabase
            .from(tableName)
            .update({ is_deleted: true })
            .eq('realm_id', this.realmId)
            .eq('qb_id', entity.Id)

          stats.deleted++
        } else {
          // Prepare and upsert
          const data = this.prepareEntityData(entity, entityType)

          await this.supabase
            .from(tableName)
            .upsert(data, { onConflict: 'realm_id,qb_id' })

          stats.created++ // CDC doesn't distinguish create vs update
        }
      } catch (err) {
        console.error(`Error processing ${entityType}:`, err.message)
        stats.errors++
      }
    }

    return stats
  }

  async verifyEntityCounts(token) {
    const results = []

    for (const entityType of this.entityTypes) {
      try {
        // Query QuickBooks
        const qbCount = await this.getQuickBooksCount(entityType, token)

        // Query Database
        const tableName = this.getTableName(entityType)
        const { count: dbCount } = await this.supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('realm_id', this.realmId)
          .eq('is_deleted', false)

        results.push({
          entity: entityType,
          qbCount,
          dbCount,
          match: qbCount === dbCount,
          emoji: qbCount === dbCount ? '✅' : '❌'
        })
      } catch (err) {
        console.error(`Verification error for ${entityType}:`, err.message)
      }
    }

    return results
  }

  emit(event, data) {
    // Store event in sync_events table for SSE retrieval
    this.supabase.from('qb_sync_events').insert({
      job_id: this.jobId,
      event_type: event,
      event_data: data,
      created_at: new Date().toISOString()
    })
  }
}
```

### 3. Entity Preparation Functions

Copy all entity preparers from the reference script (`sync-cdc-incremental.js` lines 205-900):

**File**: `sync/entity-preparers.js`

```javascript
function prepareCustomerData(entity, realmId) {
  return {
    realm_id: realmId,
    qb_id: entity.Id,
    display_name: entity.DisplayName || 'Unknown',
    given_name: entity.GivenName || null,
    family_name: entity.FamilyName || null,
    company_name: entity.CompanyName || null,
    primary_email_addr: entity.PrimaryEmailAddr?.Address || null,
    primary_phone: entity.PrimaryPhone?.FreeFormNumber || null,
    mobile_phone: entity.MobilePhone?.FreeFormNumber || null,
    billing_addr: entity.BillAddr || null,
    shipping_addr: entity.ShipAddr || null,
    notes: entity.Notes || null,
    taxable: entity.Taxable ?? true,
    balance: parseFloat(entity.Balance || '0'),
    parent_ref: entity.ParentRef || null,
    parent_qb_id: entity.ParentRef?.value || null,
    is_job: entity.Job || false,
    fully_qualified_name: entity.FullyQualifiedName || entity.DisplayName,
    level: entity.Level || 0,
    is_active: entity.Active !== false,
    is_deleted: false,
    sync_token: entity.SyncToken,
    created_at: entity.MetaData?.CreateTime || new Date().toISOString(),
    updated_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString()
  }
}

function prepareInvoiceData(entity, realmId) {
  return {
    realm_id: realmId,
    qb_id: entity.Id,
    doc_number: entity.DocNumber || null,
    txn_date: entity.TxnDate,
    due_date: entity.DueDate || null,
    customer_ref: entity.CustomerRef || null,
    customer_qb_id: entity.CustomerRef?.value || '0',
    customer_name: entity.CustomerRef?.name || null,
    bill_addr: entity.BillAddr || null,
    ship_addr: entity.ShipAddr || null,
    class_ref: entity.ClassRef || null,
    total_amt: parseFloat(entity.TotalAmt || '0'),
    balance: parseFloat(entity.Balance || '0'),
    deposit: parseFloat(entity.Deposit || '0'),
    customer_memo: entity.CustomerMemo?.value || null,
    private_note: entity.PrivateNote || null,
    line_items: entity.Line || null,
    linked_txn: entity.LinkedTxn || null,
    raw_data: entity,
    is_deleted: false,
    sync_token: entity.SyncToken,
    created_at: entity.MetaData?.CreateTime || new Date().toISOString(),
    updated_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString()
  }
}

// Add all other preparers from reference script...

const ENTITY_PREPARERS = {
  Customer: prepareCustomerData,
  Vendor: prepareVendorData,
  Invoice: prepareInvoiceData,
  Payment: preparePaymentData,
  CompanyInfo: prepareCompanyData,
  Account: prepareAccountData,
  Bill: prepareBillData,
  Class: prepareClassData,
  Department: prepareDepartmentData,
  Item: prepareItemData,
  Employee: prepareEmployeeData,
  // Add all 20+ entity types...
}

module.exports = { ENTITY_PREPARERS, prepareEntityData }
```

### 4. QuickBooks Token Management

**File**: `sync/qb-auth.js`

```javascript
const axios = require('axios')

async function getAuthToken(realmId, supabase) {
  const { data, error } = await supabase
    .from('qb_auth_tokens')
    .select('*')
    .eq('realm_id', realmId)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    throw new Error('No active QuickBooks connection')
  }

  return data
}

async function makeQBRequest(method, url, token, supabase, data = null, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios({
        method,
        url,
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        data
      })

      return response.data

    } catch (error) {
      // If 401 Unauthorized, refresh token and retry
      if (error.response?.status === 401 && attempt < retries - 1) {
        console.log(`[makeQBRequest] 401 error, refreshing token (attempt ${attempt + 1}/${retries})`)

        const refreshedToken = await refreshToken(token, supabase)
        if (!refreshedToken) {
          throw new Error('Failed to refresh token')
        }

        token.access_token = refreshedToken.access_token
        continue
      }

      throw error
    }
  }
}

async function refreshToken(token, supabase) {
  try {
    const response = await axios.post('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refresh_token
      }), {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    // Update token in database
    await supabase
      .from('qb_auth_tokens')
      .update({
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        token_expires_at: new Date(Date.now() + response.data.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', token.id)

    return {
      ...token,
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token
    }

  } catch (error) {
    console.error('[refreshToken] Failed:', error.message)
    return null
  }
}

module.exports = { getAuthToken, makeQBRequest, refreshToken }
```

### 5. Server-Sent Events Implementation

**File**: `server.js` (SSE endpoint)

```javascript
// Store active SSE connections
const sseConnections = new Map()

app.get('/api/sync/stream/:jobId', async (req, res) => {
  const { jobId } = req.params

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', jobId })}\n\n`)

  // Store connection
  sseConnections.set(jobId, res)

  // Query sync events from database and stream to client
  const supabase = createSupabaseClient()

  // Poll for new events every 500ms
  const interval = setInterval(async () => {
    const { data: events } = await supabase
      .from('qb_sync_events')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })

    for (const event of events || []) {
      res.write(`data: ${JSON.stringify({
        type: event.event_type,
        ...event.event_data
      })}\n\n`)

      // Mark event as sent
      await supabase
        .from('qb_sync_events')
        .delete()
        .eq('id', event.id)
    }

    // Check if job is complete
    const { data: job } = await supabase
      .from('qb_sync_jobs')
      .select('status')
      .eq('id', jobId)
      .single()

    if (job?.status === 'completed' || job?.status === 'failed') {
      clearInterval(interval)
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
      res.end()
      sseConnections.delete(jobId)
    }
  }, 500)

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(interval)
    sseConnections.delete(jobId)
  })
})
```

## Database Schema

### Required Tables in Supabase

All tables already exist in the `quickbooks` schema. You need to add two new tables for job tracking:

```sql
-- Sync jobs table
CREATE TABLE quickbooks.qb_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  verify boolean DEFAULT false,
  started_at timestamptz,
  completed_at timestamptz,
  stats jsonb,
  error_message text,
  created_at timestamptz DEFAULT NOW()
);

-- Sync events table (for SSE)
CREATE TABLE quickbooks.qb_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES quickbooks.qb_sync_jobs(id),
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX idx_sync_events_job_id ON quickbooks.qb_sync_events(job_id, created_at);
```

## Environment Variables

Create `.env` file for Railway:

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# QuickBooks
QUICKBOOKS_CLIENT_ID=your-client-id
QUICKBOOKS_CLIENT_SECRET=your-client-secret
QUICKBOOKS_ENVIRONMENT=sandbox  # or 'production'

# CORS
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:3000

# Server
PORT=3001
NODE_ENV=production
```

## Package.json

```json
{
  "name": "quickbooks-cdc-sync-worker",
  "version": "1.0.0",
  "description": "QuickBooks CDC sync worker for Railway",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "@supabase/supabase-js": "^2.39.0",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Railway Deployment

### Using Railway MCP

1. **Create Railway Project**:
```bash
# Railway MCP will create a new project
railway-create-project "quickbooks-cdc-sync"
```

2. **Set Environment Variables**:
```bash
railway-set-env SUPABASE_URL "https://..."
railway-set-env SUPABASE_SERVICE_ROLE_KEY "..."
railway-set-env QUICKBOOKS_CLIENT_ID "..."
railway-set-env QUICKBOOKS_CLIENT_SECRET "..."
railway-set-env QUICKBOOKS_ENVIRONMENT "sandbox"
railway-set-env ALLOWED_ORIGINS "https://your-vercel-app.vercel.app"
```

3. **Deploy**:
```bash
railway-deploy
```

4. **Get Service URL**:
```bash
railway-get-url
# Returns: https://quickbooks-cdc-sync-production.up.railway.app
```

## Integration with Next.js App (Vercel)

### 1. Add Railway URL to Vercel Environment Variables

```env
NEXT_PUBLIC_CDC_SYNC_URL=https://quickbooks-cdc-sync-production.up.railway.app
```

### 2. Create Frontend Component

**File**: `src/app/(landlord)/integration/quickbooks/cdc-sync/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function CDCSyncPage() {
  const [syncing, setSyncing] = useState(false)
  const [verify, setVerify] = useState(true)
  const [progress, setProgress] = useState<string[]>([])
  const [stats, setStats] = useState<any>(null)
  const [verification, setVerification] = useState<any[]>([])

  const startSync = async () => {
    setSyncing(true)
    setProgress([])
    setStats(null)
    setVerification([])

    const realmId = '9130348651845276' // Get from your auth system

    try {
      // Start sync job
      const response = await fetch(`${process.env.NEXT_PUBLIC_CDC_SYNC_URL}/api/sync/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ realmId, verify })
      })

      const { jobId } = await response.json()

      // Open SSE connection
      const eventSource = new EventSource(
        `${process.env.NEXT_PUBLIC_CDC_SYNC_URL}/api/sync/stream/${jobId}`
      )

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'progress') {
          setProgress(prev => [...prev, `${data.emoji || '📊'} ${data.message}`])
        } else if (data.type === 'stats') {
          setStats(data.stats)
        } else if (data.type === 'verification') {
          setVerification(data)
        } else if (data.type === 'complete') {
          setSyncing(false)
          eventSource.close()
        } else if (data.type === 'error') {
          setProgress(prev => [...prev, `❌ Error: ${data.message}`])
          setSyncing(false)
          eventSource.close()
        }
      }

      eventSource.onerror = () => {
        setSyncing(false)
        eventSource.close()
      }

    } catch (error) {
      setSyncing(false)
      console.error('Sync failed:', error)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">QuickBooks CDC Sync</h1>

      <div className="mb-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={verify}
            onChange={(e) => setVerify(e.target.checked)}
          />
          Verify counts after sync
        </label>
      </div>

      <Button
        onClick={startSync}
        disabled={syncing}
      >
        {syncing ? 'Syncing...' : 'Start CDC Sync'}
      </Button>

      {progress.length > 0 && (
        <div className="mt-6 bg-gray-100 p-4 rounded font-mono text-sm">
          {progress.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}

      {stats && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-2">Sync Stats</h2>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-100 p-4 rounded">
              <div className="text-2xl font-bold">{stats.created}</div>
              <div className="text-sm">Created/Updated</div>
            </div>
            <div className="bg-red-100 p-4 rounded">
              <div className="text-2xl font-bold">{stats.deleted}</div>
              <div className="text-sm">Deleted</div>
            </div>
            <div className="bg-yellow-100 p-4 rounded">
              <div className="text-2xl font-bold">{stats.errors}</div>
              <div className="text-sm">Errors</div>
            </div>
          </div>
        </div>
      )}

      {verification.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-bold mb-2">Verification Results</h2>
          <table className="w-full">
            <thead>
              <tr>
                <th>Entity</th>
                <th>QuickBooks</th>
                <th>Database</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {verification.map((row, i) => (
                <tr key={i}>
                  <td>{row.entity}</td>
                  <td>{row.qbCount}</td>
                  <td>{row.dbCount}</td>
                  <td>
                    <Badge variant={row.match ? 'success' : 'destructive'}>
                      {row.emoji} {row.match ? 'Match' : 'Mismatch'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

## Testing

### Local Testing

1. **Start Railway worker locally**:
```bash
npm install
npm run dev
```

2. **Test health endpoint**:
```bash
curl http://localhost:3001/health
```

3. **Test sync**:
```bash
curl -X POST http://localhost:3001/api/sync/start \
  -H 'Content-Type: application/json' \
  -d '{"realmId": "9130348651845276", "verify": true}'
```

4. **Open SSE stream**:
```bash
curl -N http://localhost:3001/api/sync/stream/{jobId}
```

### Production Testing

After Railway deployment:

```bash
curl -X POST https://your-railway-app.up.railway.app/api/sync/start \
  -H 'Content-Type: application/json' \
  -d '{"realmId": "9130348651845276", "verify": true}'
```

## Success Criteria

✅ Sync completes without timeout (can run 240-300 seconds)
✅ Real-time progress updates via SSE
✅ Verify mode shows accurate QB vs DB comparisons
✅ Automatic token refresh works seamlessly
✅ All entity types process correctly
✅ No errors for entities with preparers
✅ Gracefully skips entities without preparers
✅ UI shows clear status with emoji indicators
✅ All synced data matches QuickBooks exactly

## What NOT to Do

❌ **DO NOT** use the buggy CDC implementation in `src/app/api/quickbooks/sync/cdc/`
❌ **DO NOT** use dynamic imports - they cause function resolution issues
❌ **DO NOT** use axios directly - always use makeQBRequest for token refresh
❌ **DO NOT** sync entities without preparers - check first
❌ **DO NOT** forget to handle 401 token refresh errors
❌ **DO NOT** deploy to Vercel - use Railway to avoid timeouts

---

**Start fresh. Build it right. Deploy on Railway.**
