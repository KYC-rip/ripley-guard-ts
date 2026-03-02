import { Hono } from 'hono';
import { ripleyGuardHono } from '../hono';

const app = new Hono();

// Load Ripley Guard
const xmr402Gate = ripleyGuardHono({
  nodeRpcUrl: 'http://127.0.0.1:18081/json_rpc', // Your Monero Node RPC URL
  walletAddress: '8A1b2c3d4e5f6g7h...', // Your Monero Subaddress
  amountPiconero: 5000000000, // 0.005 XMR
  serverSecret: 'dev_override_code' // Your Secret Key
});

app.get('/', (c) => c.text('Ripley Server Online. Try GET /api/classified'));

// Protect this route
app.get('/api/classified', xmr402Gate, (c) => {
  return c.json({
    status: 'ACCESS_GRANTED',
    data: 'The rabbit hole goes deeper, Agent.'
  });
});

export default app;