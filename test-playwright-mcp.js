/**
 * Test script for Playwright MCP Server
 * This demonstrates how the MCP server can control browsers and capture console logs
 */

console.log('🎭 Playwright MCP Server Test');
console.log('================================\n');

console.log('📋 Available Tools:');
console.log('1. open_browser - Open a new browser session');
console.log('2. navigate - Navigate to a URL');
console.log('3. get_console_logs - Get console logs from the page');
console.log('4. get_network_logs - Get network request logs');
console.log('5. click - Click an element');
console.log('6. type - Type text into a field');
console.log('7. screenshot - Take a screenshot');
console.log('8. evaluate - Execute JavaScript in the page');
console.log('9. wait - Wait for elements or conditions');
console.log('10. get_page_info - Get current page information');
console.log('11. close_browser - Close the browser\n');

console.log('📝 Example Usage Workflow:');
console.log('------------------------------');
console.log('1. Open browser:');
console.log('   Tool: open_browser');
console.log('   Args: { "headless": false, "url": "http://localhost:9002" }\n');

console.log('2. Wait for page to load:');
console.log('   Tool: wait');
console.log('   Args: { "timeout": 2000 }\n');

console.log('3. Get console logs:');
console.log('   Tool: get_console_logs');
console.log('   Args: { "type": "all", "limit": 50 }\n');

console.log('4. Check for errors:');
console.log('   Tool: get_console_logs');
console.log('   Args: { "type": "error", "limit": 20 }\n');

console.log('5. Monitor network requests:');
console.log('   Tool: get_network_logs');
console.log('   Args: { "filter": "api", "limit": 30 }\n');

console.log('6. Interact with the page:');
console.log('   Tool: click');
console.log('   Args: { "selector": "button[aria-label=\'Menu\']" }\n');

console.log('7. Execute custom JavaScript:');
console.log('   Tool: evaluate');
console.log('   Args: { "script": "document.querySelectorAll(\'button\').length" }\n');

console.log('8. Take a screenshot:');
console.log('   Tool: screenshot');
console.log('   Args: { "fullPage": true }\n');

console.log('🎯 Key Features:');
console.log('----------------');
console.log('✅ Captures all console.log, console.error, console.warn messages');
console.log('✅ Tracks network requests and responses');
console.log('✅ Records page errors and exceptions');
console.log('✅ Supports multiple browser sessions');
console.log('✅ Can run headless or with visible browser');
console.log('✅ Video recording capabilities');
console.log('✅ Full page automation support\n');

console.log('🔍 Debugging Your App:');
console.log('----------------------');
console.log('1. Open your app in the browser');
console.log('2. Navigate to problematic pages');
console.log('3. Get console logs to see JavaScript errors');
console.log('4. Check network logs for failed API calls');
console.log('5. Take screenshots of issues');
console.log('6. Execute diagnostic JavaScript\n');

console.log('💡 Pro Tips:');
console.log('------------');
console.log('• Use headless: false to see what\'s happening');
console.log('• Clear console logs periodically with clear: true');
console.log('• Filter network logs by API endpoints');
console.log('• Use evaluate to check DOM state');
console.log('• Record videos for complex debugging sessions\n');

console.log('🚀 To use in Claude Code:');
console.log('-------------------------');
console.log('1. The MCP server is already configured');
console.log('2. Just ask: "Open a browser and check the console logs on my app"');
console.log('3. Or: "Navigate to the map page and look for JavaScript errors"');
console.log('4. Or: "Check what API calls are failing on the share dialog"\n');

console.log('✨ The Playwright MCP server is ready to use!');
console.log('   It will help debug your app by reading console logs,');
console.log('   monitoring network requests, and automating browser interactions.\n');