import express from 'express';

const app = express();
app.use(express.json());

// Storage
const memory = {
  users: [],
  preferences: [],
  tasks: []
};

function logRequest(label, data) {
  console.log('\n' + '='.repeat(60));
  console.log(`📍 ${label}`);
  console.log('='.repeat(60));
  console.log(JSON.stringify(data, null, 2));
  console.log('='.repeat(60) + '\n');
}

// SSE endpoint - VAPI connects here first
app.get('/sse', (req, res) => {
  console.log('📡 SSE connection initiated by VAPI');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send endpoint info
  res.write('event: endpoint\n');
  res.write(`data: ${req.protocol}://${req.get('host')}/message\n\n`);

  console.log('✅ SSE connection established');
});

// Message endpoint - VAPI sends JSON-RPC requests here
app.post('/message', async (req, res) => {
  logRequest('REQUEST FROM VAPI', {
    method: req.body.method,
    params: req.body.params,
    headers: {
      'x-call-id': req.headers['x-call-id'],
      'x-chat-id': req.headers['x-chat-id']
    }
  });

  const { jsonrpc = "2.0", id, method, params = {} } = req.body;

  try {
    let result;

    // Initialize
    if (method === 'initialize') {
      result = {
        protocolVersion: "2024-11-05",  // SSE version
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "vapi-learning-mcp-sse",
          version: "1.0.0"
        }
      };

      logRequest('INITIALIZE RESPONSE', result);
      return res.json({ jsonrpc, id, result });
    }

    // Tool discovery
    if (method === 'tools/list') {
      result = {
        tools: [
          {
            name: "save_user_profile",
            description: "Save user profile information. Extract name, age, location, email, and interests from natural language.",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "User's full name"
                },
                age: {
                  type: "number",
                  description: "User's age in years"
                },
                email: {
                  type: "string",
                  description: "User's email address (optional)"
                },
                location: {
                  type: "string",
                  description: "User's city or country"
                },
                interests: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of hobbies or interests"
                }
              },
              required: ["name"]
            }
          },
          {
            name: "set_preference",
            description: "Store a user preference. Use for settings like favorite color, language, etc.",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Preference name (e.g., 'favorite_color')"
                },
                value: {
                  type: "string",
                  description: "Preference value"
                },
                category: {
                  type: "string",
                  enum: ["personal", "system", "notification"],
                  description: "Category type"
                }
              },
              required: ["key", "value"]
            }
          },
          {
            name: "create_task",
            description: "Create a task or reminder",
            inputSchema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Task title"
                },
                description: {
                  type: "string",
                  description: "Detailed description"
                },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high", "urgent"],
                  description: "Priority level"
                },
                due_date: {
                  type: "string",
                  description: "Due date (natural language)"
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Task tags"
                }
              },
              required: ["title"]
            }
          },
          {
            name: "search_memory",
            description: "Search stored information",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query"
                },
                type: {
                  type: "string",
                  enum: ["all", "users", "preferences", "tasks"],
                  description: "Type of data to search"
                }
              },
              required: ["query"]
            }
          }
        ]
      };

      logRequest('TOOLS LIST (VAPI discovers these)', result);
      return res.json({ jsonrpc, id, result });
    }

    // Tool invocation
    if (method === 'tools/call') {
      const { name, arguments: args } = params;

      logRequest('TOOL CALL - LLM EXTRACTED PARAMETERS', {
        toolName: name,
        extractedArguments: args
      });

      let responseText;

      switch (name) {
        case 'save_user_profile':
          memory.users.push({ ...args, savedAt: new Date().toISOString() });
          responseText = JSON.stringify({
            success: true,
            message: `✅ Profile saved for ${args.name}`,
            parameters: {
              required_extracted: { name: args.name },
              optional_extracted: {
                age: args.age || 'not provided',
                email: args.email || 'not provided',
                location: args.location || 'not provided',
                interests: args.interests || []
              }
            }
          }, null, 2);
          break;

        case 'set_preference':
          memory.preferences.push({ ...args, savedAt: new Date().toISOString() });
          responseText = JSON.stringify({
            success: true,
            message: `✅ ${args.key} = ${args.value}`,
            parameters: {
              key: args.key,
              value: args.value,
              category: args.category || 'default'
            }
          }, null, 2);
          break;

        case 'create_task':
          const task = {
            id: memory.tasks.length + 1,
            ...args,
            createdAt: new Date().toISOString()
          };
          memory.tasks.push(task);
          responseText = JSON.stringify({
            success: true,
            message: `✅ Task created: "${args.title}"`,
            taskId: task.id,
            parameters: {
              required: { title: args.title },
              optional: {
                description: args.description || 'none',
                priority: args.priority || 'not set',
                due_date: args.due_date || 'no deadline',
                tags: args.tags || []
              }
            }
          }, null, 2);
          break;

        case 'search_memory':
          const searchType = args.type || 'all';
          const query = args.query.toLowerCase();
          let results = [];

          if (searchType === 'all' || searchType === 'users') {
            results.push(...memory.users.filter(u =>
              JSON.stringify(u).toLowerCase().includes(query)
            ));
          }
          if (searchType === 'all' || searchType === 'preferences') {
            results.push(...memory.preferences.filter(p =>
              JSON.stringify(p).toLowerCase().includes(query)
            ));
          }
          if (searchType === 'all' || searchType === 'tasks') {
            results.push(...memory.tasks.filter(t =>
              JSON.stringify(t).toLowerCase().includes(query)
            ));
          }

          responseText = JSON.stringify({
            query: args.query,
            type: searchType,
            found: results.length,
            results: results
          }, null, 2);
          break;

        default:
          responseText = `Unknown tool: ${name}`;
      }

      result = {
        content: [{ type: "text", text: responseText }]
      };

      logRequest('RESPONSE TO VAPI', result);
      return res.json({ jsonrpc, id, result });
    }

    return res.status(400).json({
      jsonrpc,
      id,
      error: { code: -32601, message: `Method not found: ${method}` }
    });

  } catch (error) {
    console.error('❌ ERROR:', error);
    return res.status(500).json({
      jsonrpc,
      id,
      error: { code: -32603, message: error.message }
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    protocol: 'SSE (Legacy)',
    note: 'VAPI currently uses SSE transport',
    stats: {
      users: memory.users.length,
      preferences: memory.preferences.length,
      tasks: memory.tasks.length
    }
  });
});

app.get('/memory', (req, res) => {
  res.json(memory);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 VAPI MCP Server (SSE Protocol) on port ${PORT}`);
  console.log(`📡 SSE endpoint: /sse`);
  console.log(`📨 Message endpoint: /message`);
  console.log(`📊 Health: /health`);
});