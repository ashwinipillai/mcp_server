import express from 'express';

const app = express();
app.use(express.json());

// Storage for demo
const memory = {
  users: [],
  preferences: [],
  tasks: []
};

// Log everything for learning
function logRequest(label, data) {
  console.log('\n' + '='.repeat(60));
  console.log(`📍 ${label}`);
  console.log('='.repeat(60));
  console.log(JSON.stringify(data, null, 2));
  console.log('='.repeat(60) + '\n');
}

app.post('/mcp', async (req, res) => {
  logRequest('INCOMING REQUEST FROM VAPI', {
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

    // Initialize handshake
    if (method === 'initialize') {
      result = {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "vapi-learning-mcp",
          version: "1.0.0"
        }
      };

      logRequest('INITIALIZE RESPONSE', result);
      return res.json({ jsonrpc, id, result });
    }

    // Tool discovery - THIS IS WHERE VAPI LEARNS ABOUT YOUR TOOLS
    if (method === 'tools/list') {
      result = {
        tools: [
          {
            name: "save_user_profile",
            description: "Save a user's profile information. Use when user shares personal details like name, age, location, or interests.",
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
            description: "Store a user preference or setting. Use for things like favorite color, preferred language, notification settings, etc.",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "The preference name (e.g., 'favorite_color', 'language')"
                },
                value: {
                  type: "string",
                  description: "The preference value"
                },
                category: {
                  type: "string",
                  enum: ["personal", "system", "notification"],
                  description: "Category of the preference"
                }
              },
              required: ["key", "value"]
            }
          },
          {
            name: "create_task",
            description: "Create a task or reminder. Use when user wants to remember to do something.",
            inputSchema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Brief task title"
                },
                description: {
                  type: "string",
                  description: "Detailed task description"
                },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high", "urgent"],
                  description: "Task priority level"
                },
                due_date: {
                  type: "string",
                  description: "When the task is due (natural language like 'tomorrow' or '2024-12-25')"
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Tags to categorize the task"
                }
              },
              required: ["title"]
            }
          },
          {
            name: "search_memory",
            description: "Search stored information by keyword. Use when user asks 'what do you know about...?' or 'what did I tell you about...?'",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search term or question"
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

      logRequest('TOOLS LIST RESPONSE', result);
      return res.json({ jsonrpc, id, result });
    }

    // Tool invocation - THIS IS WHERE VAPI CALLS YOUR TOOL WITH PARAMETERS
    if (method === 'tools/call') {
      const { name, arguments: args } = params;

      logRequest('TOOL CALL - PARAMETERS EXTRACTED BY LLM', {
        toolName: name,
        extractedArguments: args,
        note: 'These parameters were extracted from natural language by the LLM'
      });

      let responseText;

      switch (name) {
        case 'save_user_profile':
          memory.users.push({
            ...args,
            savedAt: new Date().toISOString()
          });

          responseText = JSON.stringify({
            success: true,
            message: `Profile saved for ${args.name}`,
            extractedParameters: {
              required: { name: args.name },
              optional: {
                age: args.age || 'not provided',
                email: args.email || 'not provided',
                location: args.location || 'not provided',
                interests: args.interests || []
              }
            }
          }, null, 2);
          break;

        case 'set_preference':
          memory.preferences.push({
            ...args,
            savedAt: new Date().toISOString()
          });

          responseText = JSON.stringify({
            success: true,
            message: `Preference '${args.key}' set to '${args.value}'`,
            extractedParameters: {
              key: args.key,
              value: args.value,
              category: args.category || 'not specified (default will apply)'
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
            message: `Task created: "${args.title}"`,
            taskId: task.id,
            extractedParameters: {
              required: { title: args.title },
              optional: {
                description: args.description || 'no description',
                priority: args.priority || 'not set',
                due_date: args.due_date || 'no due date',
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
            success: true,
            query: args.query,
            searchType: searchType,
            resultsFound: results.length,
            results: results
          }, null, 2);
          break;

        default:
          responseText = `Unknown tool: ${name}`;
      }

      result = {
        content: [
          {
            type: "text",
            text: responseText
          }
        ]
      };

      logRequest('TOOL RESPONSE BACK TO VAPI', result);
      return res.json({ jsonrpc, id, result });
    }

    // Unknown method
    return res.status(400).json({
      jsonrpc,
      id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    });

  } catch (error) {
    console.error('❌ ERROR:', error);
    return res.status(500).json({
      jsonrpc,
      id,
      error: {
        code: -32603,
        message: error.message
      }
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'VAPI Learning MCP',
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
  console.log(`🚀 VAPI Learning MCP Server on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💾 View memory: http://localhost:${PORT}/memory`);
});
