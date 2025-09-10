import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config();
// Global state
const sessions = new Map();
let currentSessionId = null;
// MCP Server setup
const server = new Server({
    name: 'mcp-playwright-browser',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
// Helper functions
function generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}
async function createBrowserSession(headless = false) {
    const browser = await chromium.launch({
        headless,
        args: ['--disable-blink-features=AutomationControlled'],
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    const page = await context.newPage();
    const sessionId = generateSessionId();
    const consoleLogs = [];
    const networkLogs = [];
    // Set up console log capture
    page.on('console', (msg) => {
        const log = {
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date(),
            location: msg.location().url,
            args: msg.args().map(arg => {
                try {
                    return arg.jsonValue();
                }
                catch {
                    return arg.toString();
                }
            }),
        };
        consoleLogs.push(log);
        // Keep only last 1000 logs
        if (consoleLogs.length > 1000) {
            consoleLogs.shift();
        }
    });
    // Set up network log capture
    page.on('request', request => {
        networkLogs.push({
            method: request.method(),
            url: request.url(),
            timestamp: new Date(),
        });
    });
    page.on('response', response => {
        const log = networkLogs.find(l => l.url === response.url() && !l.status);
        if (log) {
            log.status = response.status();
            log.responseTime = Date.now() - log.timestamp.getTime();
        }
    });
    page.on('requestfailed', request => {
        const log = networkLogs.find(l => l.url === request.url() && !l.status);
        if (log) {
            log.error = request.failure()?.errorText;
        }
    });
    // Set up error handling
    page.on('pageerror', error => {
        consoleLogs.push({
            type: 'error',
            text: error.message,
            timestamp: new Date(),
            args: [error.stack],
        });
    });
    const session = {
        id: sessionId,
        browser,
        context,
        page,
        consoleLogs,
        networkLogs,
        isRecording: false,
    };
    sessions.set(sessionId, session);
    currentSessionId = sessionId;
    return session;
}
// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'open_browser',
            description: 'Open a new browser session',
            inputSchema: {
                type: 'object',
                properties: {
                    headless: {
                        type: 'boolean',
                        description: 'Run browser in headless mode (default: false)'
                    },
                    url: {
                        type: 'string',
                        description: 'Initial URL to navigate to (optional)'
                    },
                },
            },
        },
        {
            name: 'navigate',
            description: 'Navigate to a URL in the current browser session',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL to navigate to' },
                    waitUntil: {
                        type: 'string',
                        enum: ['load', 'domcontentloaded', 'networkidle'],
                        description: 'When to consider navigation complete',
                    },
                },
                required: ['url'],
            },
        },
        {
            name: 'get_console_logs',
            description: 'Get console logs from the current page',
            inputSchema: {
                type: 'object',
                properties: {
                    type: {
                        type: 'string',
                        enum: ['all', 'log', 'error', 'warning', 'info'],
                        description: 'Filter logs by type (default: all)',
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of logs to return (default: 100)',
                    },
                    clear: {
                        type: 'boolean',
                        description: 'Clear logs after reading (default: false)',
                    },
                },
            },
        },
        {
            name: 'get_network_logs',
            description: 'Get network request logs from the current page',
            inputSchema: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'number',
                        description: 'Maximum number of logs to return (default: 100)',
                    },
                    filter: {
                        type: 'string',
                        description: 'Filter URLs by pattern (regex supported)',
                    },
                },
            },
        },
        {
            name: 'click',
            description: 'Click an element on the page',
            inputSchema: {
                type: 'object',
                properties: {
                    selector: { type: 'string', description: 'CSS selector or text to click' },
                    clickCount: { type: 'number', description: 'Number of clicks (default: 1)' },
                },
                required: ['selector'],
            },
        },
        {
            name: 'type',
            description: 'Type text into an input field',
            inputSchema: {
                type: 'object',
                properties: {
                    selector: { type: 'string', description: 'CSS selector of the input' },
                    text: { type: 'string', description: 'Text to type' },
                    delay: { type: 'number', description: 'Delay between keystrokes in ms' },
                },
                required: ['selector', 'text'],
            },
        },
        {
            name: 'screenshot',
            description: 'Take a screenshot of the current page',
            inputSchema: {
                type: 'object',
                properties: {
                    fullPage: { type: 'boolean', description: 'Capture full page (default: false)' },
                    selector: { type: 'string', description: 'Capture specific element' },
                },
            },
        },
        {
            name: 'evaluate',
            description: 'Execute JavaScript in the page context',
            inputSchema: {
                type: 'object',
                properties: {
                    script: { type: 'string', description: 'JavaScript code to execute' },
                },
                required: ['script'],
            },
        },
        {
            name: 'wait',
            description: 'Wait for a condition',
            inputSchema: {
                type: 'object',
                properties: {
                    selector: { type: 'string', description: 'Wait for selector to appear' },
                    timeout: { type: 'number', description: 'Timeout in milliseconds' },
                    state: {
                        type: 'string',
                        enum: ['attached', 'detached', 'visible', 'hidden'],
                        description: 'State to wait for',
                    },
                },
            },
        },
        {
            name: 'get_page_info',
            description: 'Get current page information',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        },
        {
            name: 'close_browser',
            description: 'Close the current browser session',
            inputSchema: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'Session ID to close (optional, uses current if not provided)' },
                },
            },
        },
        {
            name: 'list_sessions',
            description: 'List all active browser sessions',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        },
        {
            name: 'switch_session',
            description: 'Switch to a different browser session',
            inputSchema: {
                type: 'object',
                properties: {
                    sessionId: { type: 'string', description: 'Session ID to switch to' },
                },
                required: ['sessionId'],
            },
        },
        {
            name: 'record_video',
            description: 'Start or stop video recording',
            inputSchema: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['start', 'stop'],
                        description: 'Start or stop recording',
                    },
                    path: { type: 'string', description: 'Path to save video (for start action)' },
                },
                required: ['action'],
            },
        },
    ],
}));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case 'open_browser': {
                const params = args;
                const session = await createBrowserSession(params.headless ?? false);
                if (params.url) {
                    await session.page.goto(params.url, { waitUntil: 'domcontentloaded' });
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                sessionId: session.id,
                                message: `Browser opened${params.url ? ` at ${params.url}` : ''}`,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'navigate': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session. Use open_browser first.');
                }
                const session = sessions.get(currentSessionId);
                const params = args;
                await session.page.goto(params.url, {
                    waitUntil: params.waitUntil || 'domcontentloaded',
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                url: params.url,
                                title: await session.page.title(),
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'get_console_logs': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session');
                }
                const session = sessions.get(currentSessionId);
                const params = args;
                const type = params.type || 'all';
                const limit = params.limit || 100;
                let logs = session.consoleLogs;
                // Filter by type
                if (type !== 'all') {
                    logs = logs.filter(log => log.type === type);
                }
                // Get latest logs
                const result = logs.slice(-limit);
                // Clear if requested
                if (params.clear) {
                    session.consoleLogs = [];
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                count: result.length,
                                logs: result.map(log => ({
                                    type: log.type,
                                    text: log.text,
                                    timestamp: log.timestamp.toISOString(),
                                    location: log.location,
                                })),
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'get_network_logs': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session');
                }
                const session = sessions.get(currentSessionId);
                const params = args;
                const limit = params.limit || 100;
                let logs = session.networkLogs;
                // Filter by pattern
                if (params.filter) {
                    const regex = new RegExp(params.filter);
                    logs = logs.filter(log => regex.test(log.url));
                }
                // Get latest logs
                const result = logs.slice(-limit);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                count: result.length,
                                logs: result,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'click': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session');
                }
                const session = sessions.get(currentSessionId);
                const params = args;
                await session.page.click(params.selector, {
                    clickCount: params.clickCount || 1,
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                message: `Clicked on ${params.selector}`,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'type': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session');
                }
                const session = sessions.get(currentSessionId);
                const params = args;
                await session.page.fill(params.selector, params.text);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                message: `Typed text into ${params.selector}`,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'screenshot': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session');
                }
                const session = sessions.get(currentSessionId);
                const params = args;
                const options = {
                    fullPage: params.fullPage || false,
                };
                const screenshot = params.selector
                    ? await session.page.locator(params.selector).screenshot()
                    : await session.page.screenshot(options);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                message: 'Screenshot captured',
                                base64: screenshot.toString('base64').substring(0, 100) + '...',
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'evaluate': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session');
                }
                const session = sessions.get(currentSessionId);
                const params = args;
                const result = await session.page.evaluate(params.script);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                result,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'wait': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session');
                }
                const session = sessions.get(currentSessionId);
                const params = args;
                if (params.selector) {
                    await session.page.waitForSelector(params.selector, {
                        timeout: params.timeout || 30000,
                        state: params.state || 'visible',
                    });
                }
                else {
                    await session.page.waitForTimeout(params.timeout || 1000);
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                message: params.selector
                                    ? `Waited for ${params.selector}`
                                    : `Waited ${params.timeout}ms`,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'get_page_info': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session');
                }
                const session = sessions.get(currentSessionId);
                const info = {
                    url: session.page.url(),
                    title: await session.page.title(),
                    viewport: session.page.viewportSize(),
                    consoleLogs: session.consoleLogs.length,
                    networkLogs: session.networkLogs.length,
                };
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                ...info,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'close_browser': {
                const sessionId = args.sessionId || currentSessionId;
                if (!sessionId || !sessions.has(sessionId)) {
                    throw new Error('No session to close');
                }
                const session = sessions.get(sessionId);
                await session.browser.close();
                sessions.delete(sessionId);
                if (currentSessionId === sessionId) {
                    currentSessionId = sessions.size > 0
                        ? Array.from(sessions.keys())[0]
                        : null;
                }
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                message: 'Browser closed',
                                remainingSessions: sessions.size,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'list_sessions': {
                const sessionList = Array.from(sessions.entries()).map(([id, session]) => ({
                    id,
                    current: id === currentSessionId,
                    url: session.page.url(),
                    consoleLogs: session.consoleLogs.length,
                    networkLogs: session.networkLogs.length,
                }));
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                sessions: sessionList,
                                currentSessionId,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'switch_session': {
                const params = args;
                if (!sessions.has(params.sessionId)) {
                    throw new Error(`Session ${params.sessionId} not found`);
                }
                currentSessionId = params.sessionId;
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                success: true,
                                message: `Switched to session ${params.sessionId}`,
                            }, null, 2),
                        },
                    ],
                };
            }
            case 'record_video': {
                if (!currentSessionId || !sessions.has(currentSessionId)) {
                    throw new Error('No active browser session');
                }
                const session = sessions.get(currentSessionId);
                const params = args;
                if (params.action === 'start') {
                    if (session.isRecording) {
                        throw new Error('Already recording');
                    }
                    // Close current context and create new one with video recording
                    const oldPage = session.page;
                    await session.context.close();
                    session.context = await session.browser.newContext({
                        recordVideo: {
                            dir: params.path || './videos',
                            size: { width: 1280, height: 720 },
                        },
                    });
                    session.page = await session.context.newPage();
                    session.isRecording = true;
                    // Restore URL
                    await session.page.goto(oldPage.url());
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    message: 'Video recording started',
                                }, null, 2),
                            },
                        ],
                    };
                }
                else {
                    if (!session.isRecording) {
                        throw new Error('Not recording');
                    }
                    await session.context.close();
                    session.isRecording = false;
                    // Recreate context without recording
                    session.context = await session.browser.newContext();
                    session.page = await session.context.newPage();
                    return {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify({
                                    success: true,
                                    message: 'Video recording stopped',
                                }, null, 2),
                            },
                        ],
                    };
                }
            }
            default:
                throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
        }
    }
    catch (error) {
        throw new McpError(ErrorCode.InternalError, error.message || 'An error occurred');
    }
});
// Cleanup on exit
process.on('SIGINT', async () => {
    for (const session of sessions.values()) {
        await session.browser.close();
    }
    process.exit(0);
});
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Playwright Browser Server running on stdio');
}
main().catch((error) => {
    console.error('Server error:', error);
    process.exit(1);
});
