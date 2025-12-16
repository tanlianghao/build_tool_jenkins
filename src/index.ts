#! /usr/bin/env node

// 飞书触发打包 -> MCP Server 获取项目最新提交五个分支 -> 调用飞书发送消息API到群聊中，提供该用户选择 -> 选择分支后，调用 Jenkins API 触发打包
// 自研MCP server需要发布才行在agent上使用

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { type BranchResult } from './type.js';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const server = new McpServer({
  name: 'build_tool_jenkins',
  version: '0.0.1',
}, {
  capabilities: {
    tools: {}
  }
});

server.registerTool('build_init', {
  description: "初始化打包流程。识别用户想要打包的项目（xp 或 xpss）。如果用户提到 'xpss' 则打包 xpss，否则打包 xp",
  inputSchema: z.object({
    projectType: z.enum(['xp', 'xpss']).optional().describe('项目类型（AI 从用户输入中推断）')
  })
}, async ({ projectType }) => {
  const buildType = projectType || 'xp';
  return {
    content: [{
      type: 'text',
      text: `✅ 项目类型: ${buildType}\n\n下一步：使用 get_user_context 获取 Git 配置信息`
    }],
    structuredContent: {
      buildType
    }
  };
})


async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Build Tool Jenkins MCP Server is running...');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
})

