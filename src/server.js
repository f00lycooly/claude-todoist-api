// src/server.js - Enhanced for GitHub deployment with reverse proxy support
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15,
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',
  defaultProjectName: process.env.DEFAULT_PROJECT_NAME || 'Inbox',
  defaultPriority: parseInt(process.env.DEFAULT_PRIORITY) || 2,
  defaultMainTaskPrefix: process.env.DEFAULT_MAIN_TASK_PREFIX || 'Claude Actions',
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
  trustedProxies: process.env.TRUSTED_PROXIES || '',
  version: process.env.npm_package_version || '1.0.0',
  // Add default Todoist token support
  todoistApiToken: process.env.TODOIST_API_TOKEN || null
};

const getValidToken = (requestToken) => {
  // Use token from request if provided, otherwise use environment token
  const token = requestToken || config.todoistApiToken;
  
  if (!token) {
    throw new Error('Todoist API token is required. Provide in request body or set TODOIST_API_TOKEN environment variable.');
  }
  
  return token;
};

// Date parsing helper function
const parseDueDate = (dateInput) => {
  if (!dateInput) return null;
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Normalize input
  const input = dateInput.toLowerCase().trim();
  
  // Handle relative dates
  if (input === 'today') {
    return today.toISOString().split('T')[0];
  }
  
  if (input === 'tomorrow') {
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Handle "in X days"
  const inDaysMatch = input.match(/in (\d+) days?/);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1]);
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);
    return futureDate.toISOString().split('T')[0];
  }
  
  // Handle "this week" (Friday)
  if (input.includes('this week') || input.includes('end of week')) {
    const friday = new Date(today);
    friday.setDate(today.getDate() + (5 - today.getDay()));
    return friday.toISOString().split('T')[0];
  }
  
  // Handle "next week" (next Monday)
  if (input.includes('next week')) {
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (8 - today.getDay()));
    return nextMonday.toISOString().split('T')[0];
  }
  
  // Handle day names
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayMatch = dayNames.find(day => input.includes(day));
  if (dayMatch) {
    const targetDay = dayNames.indexOf(dayMatch);
    const currentDay = today.getDay();
    let daysToAdd = targetDay - currentDay;
    
    // If the day has passed this week, get next week's occurrence
    if (daysToAdd <= 0) {
      daysToAdd += 7;
    }
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToAdd);
    return targetDate.toISOString().split('T')[0];
  }
  
  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  
  // Try to parse other date formats
  try {
    const parsed = new Date(dateInput);
    if (!isNaN(parsed)) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore parsing errors
  }
  
  return null;
};

// Priority validation helper
const validatePriority = (priority) => {
  if (!priority) return 3; // Default normal priority
  
  const p = parseInt(priority);
  if (p >= 1 && p <= 4) {
    return p;
  }
  
  return 3; // Default to normal if invalid
};

// Labels parsing helper
const parseLabels = (labels) => {
  if (!labels) return [];
  
  if (Array.isArray(labels)) {
    return labels.filter(label => typeof label === 'string' && label.trim().length > 0);
  }
  
  if (typeof labels === 'string') {
    return labels.split(',').map(l => l.trim()).filter(l => l.length > 0);
  }
  
  return [];
};

// Trust proxy setup for reverse proxy deployments
if (config.trustedProxies) {
  const proxies = config.trustedProxies.split(',').map(p => p.trim());
  app.set('trust proxy', proxies);
} else if (config.nodeEnv === 'production') {
  app.set('trust proxy', 1); // Trust first proxy in production
}

// Logging setup with structured JSON logging
const createLogger = () => {
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const writeLog = (level, message, meta = {}) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      pid: process.pid,
      hostname: require('os').hostname(),
      ...meta
    };
    
    const logLine = JSON.stringify(logEntry);
    console.log(logLine);
    
    if (config.nodeEnv === 'production') {
      const logFile = level === 'error' ? 'error.log' : 'app.log';
      fs.appendFileSync(path.join(logDir, logFile), logLine + '\n');
    }
  };
  
  return {
    info: (message, meta = {}) => writeLog('info', message, meta),
    error: (message, error = {}, meta = {}) => writeLog('error', message, {
      error: error.message || error,
      stack: error.stack,
      ...meta
    }),
    warn: (message, meta = {}) => writeLog('warn', message, meta),
    debug: (message, meta = {}) => {
      if (config.logLevel === 'debug') {
        writeLog('debug', message, meta);
      }
    }
  };
};

const logger = createLogger();

// CORS configuration with environment-based origins
const corsOptions = {
  origin: (origin, callback) => {
    if (config.corsOrigin === '*') {
      callback(null, true);
    } else {
      const allowedOrigins = config.corsOrigin.split(',').map(o => o.trim());
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  if (config.nodeEnv === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

// Enhanced rate limiting with proxy support
const limiter = rateLimit({
  windowMs: config.rateLimitWindow * 60 * 1000,
  max: config.rateLimitMax,
  message: {
    error: 'Too many requests',
    retryAfter: config.rateLimitWindow * 60,
    limit: config.rateLimitMax,
    window: config.rateLimitWindow
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy, otherwise use IP
    return req.ip || req.connection.remoteAddress;
  },
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: config.rateLimitWindow * 60,
      message: `Rate limit exceeded. Try again in ${config.rateLimitWindow} minutes.`
    });
  }
});

app.use(limiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length') || 0
    });
    
    originalSend.call(this, data);
  };
  
  next();
});

// Todoist API configuration
const TODOIST_API_BASE = 'https://api.todoist.com/rest/v2';

class TodoistExporter {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.headers = {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      'User-Agent': `claude-todoist-api/${config.version}`
    };
  }

  async validateToken() {
    try {
      const response = await axios.get(`${TODOIST_API_BASE}/projects`, {
        headers: this.headers,
        timeout: config.healthCheckTimeout
      });
      return { valid: true, projects: response.data };
    } catch (error) {
      logger.error('Token validation failed', error);
      return { 
        valid: false, 
        error: error.response?.data?.error || error.message 
      };
    }
  }

  async getProjects() {
    try {
      const response = await axios.get(`${TODOIST_API_BASE}/projects`, {
        headers: this.headers,
        timeout: config.healthCheckTimeout
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch projects', error);
      throw new Error(`Failed to fetch projects: ${error.response?.data?.error || error.message}`);
    }
  }

  async createTask(taskData) {
    try {
      const response = await axios.post(`${TODOIST_API_BASE}/tasks`, taskData, {
        headers: this.headers,
        timeout: config.healthCheckTimeout
      });
      return response.data;
    } catch (error) {
      logger.error('Failed to create task', { taskData, error: error.message });
      throw new Error(`Failed to create task: ${error.response?.data?.error || error.message}`);
    }
  }

  extractActions(text) {
    const actionPatterns = [
      // Bullet points and dashes
      /(?:^|\n)\s*[-*•]\s*(.+?)(?=\n|$)/gm,
      // Numbered lists
      /(?:^|\n)\s*\d+\.\s*(.+?)(?=\n|$)/gm,
      // Explicit action keywords
      /(?:^|\n)\s*(?:TODO|Action|Task|Step)\s*:?\s*(.+?)(?=\n|$)/gmi,
      // Recommendation phrases
      /(?:^|\n)\s*(?:You should|I recommend|Next step|Please|Consider|Make sure to|Don't forget to)\s+(.+?)(?=\n|$)/gmi,
      // Action verbs at start of lines
      /(?:^|\n)\s*(?:Create|Build|Setup|Configure|Install|Update|Review|Analyze|Implement|Add|Remove|Fix|Test|Deploy|Write|Design|Plan|Research|Contact|Schedule|Book|Buy|Order|Call|Email|Send|Upload|Download|Backup|Delete|Archive|Organize|Clean|Prepare|Check|Verify|Validate|Monitor|Track|Document|Record|Report|Submit|Approve|Reject|Complete|Finish|Start|Begin|Launch|Stop|Pause|Resume|Cancel|Postpone|Reschedule)\s+(.+?)(?=\n|$)/gmi
    ];

    let actions = new Set();
    
    actionPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const action = (match[1] || match[2] || '').trim();
        if (action.length > 3 && action.length < 500) {
          const cleanAction = action
            .replace(/^(that|to|and|or|but)\s+/i, '')
            .replace(/[.!?]+$/, '')
            .trim();
          
          if (cleanAction.length > 3) {
            actions.add(cleanAction);
          }
        }
      }
    });

    // Fallback: extract sentences with action verbs if no patterns match
    if (actions.size === 0) {
      const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 5);
      sentences.forEach(sentence => {
        const trimmed = sentence.trim();
        if (/^(create|make|build|setup|install|configure|update|review|analyze|implement|add|remove|fix|test|deploy|write|design|plan|research|contact|schedule|book|buy|order|call|email|send)/i.test(trimmed)) {
          if (trimmed.length < 500) {
            actions.add(trimmed);
          }
        }
      });
    }

    return Array.from(actions);
  }

  async exportToTodoist(options) {
    const {
      text,
      mainTaskTitle,
      projectId,
      priority = config.defaultPriority,
      dueDate,
      labels = [],
      autoExtract = true,
      manualActions = []
    } = options;

    let actions = [];
    if (autoExtract && text) {
      actions = this.extractActions(text);
    }
    if (manualActions && manualActions.length > 0) {
      actions = [...actions, ...manualActions];
    }

    if (actions.length === 0) {
      throw new Error('No actions found to export');
    }

    logger.info('Starting export', {
      actionsCount: actions.length,
      projectId,
      priority,
      mainTaskTitle
    });

    // Create main task
    const mainTaskData = {
      content: mainTaskTitle || `${config.defaultMainTaskPrefix} - ${new Date().toLocaleDateString()}`,
      project_id: projectId,
      priority: priority
    };

    if (dueDate) {
      mainTaskData.due_date = dueDate;
    }

    if (labels && labels.length > 0) {
      mainTaskData.labels = labels;
    }

    const mainTask = await this.createTask(mainTaskData);
    logger.info('Main task created', { taskId: mainTask.id, content: mainTask.content });

    // Create subtasks with rate limiting
    const subtasks = [];
    const failures = [];

    for (let i = 0; i < actions.length; i++) {
      try {
        const subtaskData = {
          content: actions[i],
          project_id: projectId,
          parent_id: mainTask.id,
          priority: priority
        };

        const subtask = await this.createTask(subtaskData);
        subtasks.push(subtask);
        
        // Small delay to avoid API rate limiting
        if (i < actions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error('Failed to create subtask', { action: actions[i], error: error.message });
        failures.push({
          action: actions[i],
          error: error.message
        });
      }
    }

    const result = {
      mainTask,
      subtasks,
      failures,
      summary: {
        totalActions: actions.length,
        successful: subtasks.length,
        failed: failures.length
      }
    };

    logger.info('Export completed', result.summary);
    return result;
  }
}

// API Routes

// Enhanced health check with comprehensive system info
app.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: config.version,
    environment: config.nodeEnv,
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    config: {
      rateLimitWindow: config.rateLimitWindow,
      rateLimitMax: config.rateLimitMax,
      defaultProjectName: config.defaultProjectName,
      defaultPriority: config.defaultPriority,
      trustedProxies: !!config.trustedProxies
    }
  };
  
  res.json(healthData);
});

// System info endpoint
app.get('/info', (req, res) => {
  res.json({
    name: 'Claude to Todoist API',
    version: config.version,
    description: 'RESTful API for exporting Claude chat actions to Todoist',
    environment: config.nodeEnv,
    node_version: process.version,
    features: [
      'Smart action extraction',
      'Todoist integration',
      'Date parsing',
      'Priority levels',
      'Project routing',
      'Rate limiting',
      'Health monitoring',
      'Docker support',
      'Reverse proxy ready',
      'Structured logging'
    ],
    endpoints: {
      'GET /health': 'Health check',
      'GET /info': 'System information',
      'GET /projects-list': 'Available projects list',
      'POST /validate-token': 'Validate Todoist token',
      'POST /projects': 'Get user projects',
      'POST /extract-actions': 'Extract actions from text',
      'POST /export': 'Full export with options',
      'GET /quick-export': 'Clickable link export',
      'POST /quick-export': 'Enhanced quick export'
    },
    github: 'https://github.com/f00lycooly/claude-todoist-api',
    documentation: 'https://github.com/f00lycooly/claude-todoist-api/blob/main/docs/api-reference.md'
  });
});

// Add endpoint to get available projects (for Claude to reference)
app.get('/projects-list', async (req, res) => {
  try {
    if (!config.todoistApiToken) {
      return res.status(500).json({ 
        success: false,
        error: 'Server not configured with Todoist token' 
      });
    }

    const exporter = new TodoistExporter(config.todoistApiToken);
    const projects = await exporter.getProjects();
    
    res.json({
      success: true,
      projects: projects.map(p => ({
        id: p.id,
        name: p.name,
        isInbox: p.is_inbox_project || false
      }))
    });

  } catch (error) {
    logger.error('Failed to get projects list', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

app.post('/validate-token', async (req, res) => {
  try {
    let token;
    
    try {
      token = getValidToken(req.body.token);
    } catch (error) {
      return res.status(400).json({ 
        success: false,
        error: error.message
      });
    }

    const exporter = new TodoistExporter(token);
    const validation = await exporter.validateToken();
    
    if (validation.valid) {
      logger.info('Token validation successful', { 
        projectCount: validation.projects.length,
        ip: req.ip,
        tokenSource: req.body.token ? 'request' : 'environment'
      });
      res.json({
        success: true,
        valid: true,
        projectCount: validation.projects.length,
        projects: validation.projects,
        tokenSource: req.body.token ? 'request' : 'environment'
      });
    } else {
      logger.warn('Token validation failed', { 
        error: validation.error,
        ip: req.ip 
      });
      res.status(401).json({
        success: false,
        valid: false,
        error: validation.error
      });
    }
  } catch (error) {
    logger.error('Token validation error', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
});

// Get user's projects
app.post('/projects', async (req, res) => {
  try {
    let token;
    
    try {
      token = getValidToken(req.body.token);
    } catch (error) {
      return res.status(400).json({ 
        success: false,
        error: error.message
      });
    }

    const exporter = new TodoistExporter(token);
    const projects = await exporter.getProjects();
    
    logger.info('Projects retrieved', { 
      count: projects.length,
      ip: req.ip,
      tokenSource: req.body.token ? 'request' : 'environment'
    });
    
    res.json({ 
      success: true,
      projects 
    });
  } catch (error) {
    logger.error('Failed to get projects', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Extract actions from text (preview endpoint)
app.post('/extract-actions', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        success: false,
        error: 'Text is required' 
      });
    }

    const exporter = new TodoistExporter('dummy');
    const actions = exporter.extractActions(text);
    
    logger.info('Actions extracted', { 
      count: actions.length,
      ip: req.ip 
    });
    
    res.json({
      success: true,
      actions,
      count: actions.length,
      preview: actions.slice(0, 5) // Show first 5 for preview
    });
  } catch (error) {
    logger.error('Action extraction failed', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to extract actions' 
    });
  }
});

// Main export endpoint
app.post('/export', async (req, res) => {
  try {
    const {
      token: requestToken,
      text,
      mainTaskTitle,
      projectId,
      priority,
      dueDate,
      labels,
      autoExtract,
      manualActions
    } = req.body;

    let token;
    
    try {
      token = getValidToken(requestToken);
    } catch (error) {
      return res.status(400).json({ 
        success: false,
        error: error.message
      });
    }

    if (!projectId) {
      return res.status(400).json({ 
        success: false,
        error: 'Project ID is required' 
      });
    }

    if (!text && (!manualActions || manualActions.length === 0)) {
      return res.status(400).json({ 
        success: false,
        error: 'Either text or manual actions are required' 
      });
    }

    const exporter = new TodoistExporter(token);
    const result = await exporter.exportToTodoist({
      text,
      mainTaskTitle,
      projectId,
      priority,
      dueDate,
      labels,
      autoExtract,
      manualActions
    });

    res.json({
      success: true,
      result,
      message: `Successfully created main task with ${result.summary.successful} subtasks`,
      mainTaskId: result.mainTask.id,
      subtaskCount: result.summary.successful,
      failures: result.failures,
      tokenSource: requestToken ? 'request' : 'environment'
    });

  } catch (error) {
    logger.error('Export failed', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Enhanced POST quick-export endpoint
app.post('/quick-export', async (req, res) => {
  try {
    const { 
      token: requestToken, 
      text, 
      projectName = config.defaultProjectName,
      mainTaskTitle,
      priority,
      dueDate,
      labels
    } = req.body;

    let token;
    
    try {
      token = getValidToken(requestToken);
    } catch (error) {
      return res.status(400).json({ 
        success: false,
        error: error.message
      });
    }

    if (!text) {
      return res.status(400).json({ 
        success: false,
        error: 'Text is required' 
      });
    }

    const exporter = new TodoistExporter(token);
    
    // Get projects and find the specified one
    const projects = await exporter.getProjects();
    const project = projects.find(p => 
      p.name.toLowerCase() === projectName.toLowerCase() || 
      (projectName === 'Inbox' && p.is_inbox_project)
    );

    if (!project) {
      return res.status(400).json({ 
        success: false,
        error: `Project "${projectName}" not found. Available projects: ${projects.map(p => p.name).join(', ')}` 
      });
    }

    // Parse enhanced parameters
    const parsedDueDate = parseDueDate(dueDate);
    const validatedPriority = validatePriority(priority);
    const parsedLabels = parseLabels(labels);

    const result = await exporter.exportToTodoist({
      text,
      projectId: project.id,
      mainTaskTitle: mainTaskTitle || `${config.defaultMainTaskPrefix} - ${new Date().toLocaleDateString()}`,
      priority: validatedPriority,
      dueDate: parsedDueDate,
      labels: parsedLabels,
      autoExtract: true
    });

    res.json({
      success: true,
      mainTaskId: result.mainTask.id,
      subtaskCount: result.summary.successful,
      projectName: project.name,
      priority: validatedPriority,
      dueDate: parsedDueDate,
      labels: parsedLabels,
      message: `Exported to ${project.name}: 1 main task with ${result.summary.successful} subtasks`,
      failures: result.failures,
      tokenSource: requestToken ? 'request' : 'environment'
    });

  } catch (error) {
    logger.error('Quick export failed', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Enhanced GET quick-export endpoint for clickable links
app.get('/quick-export', async (req, res) => {
  try {
    if (!req.query.data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing data parameter' 
      });
    }

    const data = JSON.parse(decodeURIComponent(req.query.data));
    
    const { 
      text, 
      projectName = config.defaultProjectName, 
      mainTaskTitle,
      priority,
      dueDate,
      labels
    } = data;

    if (!text) {
      return res.status(400).json({ 
        success: false,
        error: 'Text is required' 
      });
    }

    if (!config.todoistApiToken) {
      return res.status(500).json({ 
        success: false,
        error: 'Server not configured with Todoist token' 
      });
    }

    const exporter = new TodoistExporter(config.todoistApiToken);
    
    const projects = await exporter.getProjects();
    const project = projects.find(p => 
      p.name.toLowerCase() === projectName.toLowerCase() || 
      (projectName === 'Inbox' && p.is_inbox_project)
    );

    if (!project) {
      return res.status(400).json({ 
        success: false,
        error: `Project "${projectName}" not found` 
      });
    }

    // Parse enhanced parameters
    const parsedDueDate = parseDueDate(dueDate);
    const validatedPriority = validatePriority(priority);
    const parsedLabels = parseLabels(labels);

    const result = await exporter.exportToTodoist({
      text,
      projectId: project.id,
      mainTaskTitle: mainTaskTitle || `${config.defaultMainTaskPrefix} - ${new Date().toLocaleDateString()}`,
      priority: validatedPriority,
      dueDate: parsedDueDate,
      labels: parsedLabels,
      autoExtract: true
    });

    // Enhanced success page with more details
    const priorityEmoji = ['🔴', '🟡', '🟢', '🔵'][validatedPriority - 1];
    const dueDateText = parsedDueDate ? `Due: ${parsedDueDate}` : 'No due date';
    const labelsText = parsedLabels.length > 0 ? `Labels: ${parsedLabels.join(', ')}` : '';

    res.send(`
      <html>
        <head>
          <title>Export Success</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f8f9fa;
              color: #333;
            }
            .container { 
              max-width: 500px; 
              margin: 0 auto; 
              background: white; 
              padding: 40px; 
              border-radius: 12px; 
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .success { color: #28a745; font-size: 2em; margin-bottom: 20px; }
            .task-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; }
            .links { margin-top: 30px; }
            .links a { 
              display: inline-block; 
              margin: 0 10px; 
              padding: 12px 24px; 
              background: #007bff; 
              color: white; 
              text-decoration: none; 
              border-radius: 6px;
              transition: background-color 0.2s;
            }
            .links a:hover { background: #0056b3; }
            .links a.secondary { background: #6c757d; }
            .links a.secondary:hover { background: #545b62; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅ Export Successful!</div>
            
            <div class="task-info">
              <strong>Main Task:</strong> ${result.mainTask.content}<br>
              <strong>Project:</strong> ${project.name}<br>
              <strong>Subtasks:</strong> ${result.summary.successful}<br>
              <strong>Priority:</strong> ${priorityEmoji} Level ${validatedPriority}<br>
              <strong>${dueDateText}</strong><br>
              ${labelsText ? `<strong>${labelsText}</strong>` : ''}
            </div>
            
            <div class="links">
              <a href="https://todoist.com" target="_blank">📱 Open Todoist</a>
              <a href="javascript:window.close()" class="secondary">✖️ Close</a>
            </div>
          </div>
        </body>
      </html>
    `);

  } catch (error) {
    logger.error('GET quick export failed', error);
    res.status(500).send(`
      <html>
        <head><title>Export Failed</title></head>
        <body style="font-family: Arial; text-align: center; padding: 50px;">
          <h1>❌ Export Failed</h1>
          <p>Error: ${error.message}</p>
          <p><a href="javascript:history.back()">Go Back</a></p>
        </body>
      </html>
    `);
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', error);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('404 - Endpoint not found', { 
    url: req.url, 
    method: req.method,
    ip: req.ip 
  });
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'GET /info', 
      'GET /projects-list',
      'POST /validate-token',
      'POST /projects',
      'POST /extract-actions',
      'POST /export',
      'GET /quick-export',
      'POST /quick-export'
    ]
  });
});

// Declare server variable
let server;

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('Claude to Todoist API service started', {
      port: config.port,
      environment: config.nodeEnv,
      version: config.version,
      healthCheck: `http://localhost:${config.port}/health`,
      info: `http://localhost:${config.port}/info`,
      trustedProxies: config.trustedProxies || 'none',
      corsOrigin: config.corsOrigin
    });
  });

  // Handle server errors
  server.on('error', (error) => {
    logger.error('Server error', error);
    process.exit(1);
  });

  // Graceful shutdown
  const gracefulShutdown = (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    if (server) {
      server.close(() => {
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Export the app for testing
module.exports = app;