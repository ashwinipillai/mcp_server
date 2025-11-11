import express from 'express';
import { spawn } from 'child_process';

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const mcp = spawn('npx', ['-y', '@modelcontextprotocol/server-memory']);
  
  let output = '';
  
  mcp.stdin.write(JSON.stringify(req.body) + '\n');
  mcp.stdin.end();

  mcp.stdout.on('data', (data) => {
    output += data.toString();
  });
  
  mcp.on('close', () => {
    try {
      const lines = output.trim().split('\n').filter(line => line.trim());
      const result = JSON.parse(lines[lines.length - 1]);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse MCP response' });
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'Memory MCP for VAPI' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Memory MCP running on port ${PORT}`);
});