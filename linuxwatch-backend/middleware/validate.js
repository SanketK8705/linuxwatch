const { z } = require('zod');

const username = z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_.-]+$/);
const password = z.string().min(6).max(128);
const ip = z.string().trim().max(45).optional().nullable();
const shortText = z.string().trim().max(100).optional().nullable();
const logText = z.string().trim().max(8000).optional().nullable();

const schemas = {
  register: z.object({
    body: z.object({
      username,
      password,
    }),
  }),

  login: z.object({
    body: z.object({
      username,
      password,
    }),
  }),

  createEvent: z.object({
    body: z.object({
      event_type: z.string().trim().min(1).max(50),
      source_ip: ip,
      username: shortText,
      raw_log: logText,
      port: z.coerce.number().int().min(0).max(65535).optional().nullable(),
      sudo_command: z.string().trim().max(500).optional().nullable(),
      malware_type: z.string().trim().max(50).optional().nullable(),
      clicked: z.boolean().optional(),
    }),
  }),

  listEvents: z.object({
    query: z.object({
      event_type: z.string().trim().max(50).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
    }),
  }),

  listAlerts: z.object({
    query: z.object({
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
    }),
  }),

  patchAlert: z.object({
    params: z.object({
      id: z.coerce.number().int().positive(),
    }),
    body: z.object({
      status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
    }),
  }),

  patchUserRole: z.object({
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: z.object({ role: z.enum(['admin', 'user']) }),
  }),

  aiSummarize: z.object({
    body: z.object({
      limit: z.coerce.number().int().min(1).max(200).optional(),
      source_ip: ip,
      hours: z.coerce.number().min(1).max(168).optional(),
    }),
  }),

  aiAsk: z.object({
    body: z.object({
      question: z.string().trim().min(1).max(1000),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      source_ip: ip,
      hours: z.coerce.number().min(1).max(168).optional(),
    }),
  }),
};

function validate(schemaName) {
  const schema = schemas[schemaName];
  if (!schema) throw new Error(`Unknown schema: ${schemaName}`);

  return (req, res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    if (parsed.data.body) req.body = parsed.data.body;
    if (parsed.data.query) req.query = parsed.data.query;
    if (parsed.data.params) req.params = parsed.data.params;
    next();
  };
}

module.exports = { validate, schemas };
