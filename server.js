import express from 'express';
import { spawn } from 'child_process';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 REQUEST FROM VAPI:');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  const mcp = spawn('npx', ['-y', '@modelcontextprotocol/server-memory']);

  let output = '';
  let errorOutput = '';

  // Send request to MCP server
  mcp.stdin.write(JSON.stringify(req.body) + '\n');
  mcp.stdin.end();

  mcp.stdout.on('data', (data) => {
    output += data.toString();
  });

  mcp.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  mcp.on('close', (code) => {
    if (errorOutput) {
      console.log('⚠️  STDERR:', errorOutput);
    }

    try {
      const lines = output.trim().split('\n').filter(line => line.trim());
      const result = JSON.parse(lines[lines.length - 1]);

      console.log('📤 RESPONSE TO VAPI:');
      console.log(JSON.stringify(result, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      res.json(result);
    } catch (e) {
      console.log('❌ PARSE ERROR:', e.message);
      console.log('Raw output:', output);
      res.status(500).json({ error: 'Failed to parse MCP response' });
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'Memory MCP for VAPI' });
});

app.get('/logs', (req, res) => {
  res.send(`
    <html>
      <head><title>MCP Logs</title></head>
      <body>
        <h1>Check your server logs in Render dashboard</h1>
        <p>Go to: Render Dashboard → Your Service → Logs</p>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Memory MCP running on port ${PORT}`);
  console.log(`📊 View logs in your Render dashboard`);
});