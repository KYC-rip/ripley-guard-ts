import express from 'express';
import { ripleyGuardExpress } from '../express';

const app = express();

// Configure Guard
const xmr402Gate = ripleyGuardExpress({
  nodeRpcUrl: 'http://127.0.0.1:18081/json_rpc', // Your Monero Node RPC URL
  walletAddress: '8B...', // Your Monero Subaddress
  amountPiconero: 5000000000, // 0.005 XMR
  serverSecret: 'cyberpunk_black_cat_override_code' // Your Secret Key
});

// Apply the middleware
app.get('/api/secret-data', xmr402Gate, (req, res) => {
  res.json({
    status: 'ACCESS_GRANTED',
    data: 'Welcome to the underground, Agent.'
  });
});

app.listen(3000, () => console.log('Ripley Server running on port 3000'));