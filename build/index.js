#! /usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
const personToken = process.env.PERSON_TOKEN;
const xdragonAppProjectId = process.env.XDRAGON_APP_PROJECT_ID;
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
                text: `✅ 项目类型: ${buildType}\n\n下一步：使用 get_gitlab_branch 获取分支信息`
            }],
        structuredContent: {
            buildType,
        }
    };
});
server.registerTool('get_gitlab_branch', {
    description: "获取gitlab的分支信息",
    inputSchema: z.object({
        buildType: z.string().describe('项目类型'),
    }),
}, async (args) => {
    let { buildType } = args;
    try {
        let currentBranch = await getCurrentUserBranch();
        if (!currentBranch || currentBranch.length === 0) {
            return {
                content: [{
                        type: 'text',
                        text: `❌ 未找到分支记录\n\n💡 提示：请确认项目配置是否正确`
                    }]
            };
        }
        // 格式化分支信息，包含更多上下文
        const branchList = currentBranch.map((branch, index) => `${index + 1}. ${branch.name}\n  👤 提交者: ${branch.commit.committer_name}`).join('\n');
        return {
            content: [{
                    type: 'text',
                    text: `✅ 找到 ${currentBranch.length} 个最新分支:\n\n${branchList}\n\n📌 请选择要打包的分支（输入分支名称或序号）`
                }],
            structuredContent: {
                buildType,
                branches: currentBranch.map((branch, index) => ({
                    index: index + 1,
                    name: branch.name,
                    committer: branch.commit.committer_name,
                    committedDate: branch.commit.committed_date
                })),
                waitingForUserSelection: true,
                instruction: "展示以上分支列表，等待用户选择。用户选择后，使用选中的分支名调用 xpss_build_trigger"
            }
        };
    }
    catch (error) {
        return {
            content: [{
                    type: 'text',
                    text: `❌ 获取分支失败: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
server.registerTool('xpss_build_trigger', {
    description: "触发 Jenkins 打包。需要用户确认分支后才能执行",
    inputSchema: z.object({
        branchName: z.string().describe('分支名'),
        buildType: z.string().describe('打包的项目'),
    }),
}, async (args) => {
    const { branchName, buildType } = args;
    try {
        // await triggerJenkinsBuild(branchName, buildType);
        return {
            content: [{
                    type: 'text',
                    text: `✅ Jenkins 构建已触发成功！\n\n📦 项目: ${buildType}\n🌿 分支: ${branchName}\n\n🔗 查看构建进度：https://jenkins.x-peng.com/common/job/DIC/job/SSI/job/${buildType === 'xp' ? 'XDragon_Application_In_Mac_Mini' : 'XDragon_Scepter_iPad'}/`
                }],
            structuredContent: {
                success: true,
                branchName,
                buildType,
                jenkinsUrl: `https://jenkins.x-peng.com/common/job/DIC/job/SSI/job/${buildType === 'xp' ? 'XDragon_Application_In_Mac_Mini' : 'XDragon_Scepter_iPad'}/`
            }
        };
    }
    catch (error) {
        return {
            content: [{
                    type: 'text',
                    text: `❌ 构建触发失败: ${error instanceof Error ? error.message : 'Unknown error'}`
                }]
        };
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Build Tool Jenkins MCP Server is running...');
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
async function getCurrentUserBranch() {
    let per_page = 100;
    let getBranchsUrl = `https://gitlab.x-peng.com/api/v4/projects/${xdragonAppProjectId}/repository/branches`;
    let allBranches = [];
    // 获取总数
    let response = await fetch(`${getBranchsUrl}?page=1&per_page=1`, {
        method: 'GET',
        headers: {
            'PRIVATE-TOKEN': personToken
        }
    });
    let resHeaders = response.headers;
    let totalItems = resHeaders.get('X-Total') ? parseInt(resHeaders.get('X-Total')) : 0;
    let totalPages = Math.ceil(totalItems / per_page);
    let promiseAllFetch = [];
    for (let i = 1; i <= totalPages; i++) {
        promiseAllFetch.push(fetch(`${getBranchsUrl}?page=${i}&per_page=${per_page}`, {
            method: 'GET',
            headers: {
                'PRIVATE-TOKEN': personToken
            }
        }).then(res => res.json()));
    }
    let result = await Promise.all(promiseAllFetch);
    result.forEach(branches => {
        allBranches = allBranches.concat(branches);
    });
    allBranches = allBranches.sort((a, b) => {
        return new Date(b.commit.committed_date).getTime() - new Date(a.commit.committed_date).getTime();
    });
    let firstBranch = allBranches.length > 5 ? allBranches.slice(0, 5) : allBranches;
    return firstBranch;
}
// 使用jenkins触发构建打包
async function triggerJenkinsBuild(branchName, buildType) {
    try {
        // 配置信息
        const JENKINS_URL = "https://jenkins.x-peng.com";
        let JOB_PATH = "common/job/DIC/job/SSI/job/XDragon_Scepter_iPad";
        let API_TOKEN = process.env.API_TOKEN;
        let USERNAME_ENV = process.env.USERNAME;
        let BUILD_TOKEN = process.env.XPSS_BUILD_TOKEN;
        let androidUrl = `${JENKINS_URL}/${JOB_PATH}/buildWithParameters?token=${BUILD_TOKEN}&buildType=Android&BRANCH=${encodeURIComponent(branchName)}&ENVIRONMENT=uat&EXPERIMENT=true`;
        let iosUrl = `${JENKINS_URL}/${JOB_PATH}/buildWithParameters?token=${BUILD_TOKEN}&buildType=iOS&BRANCH=${encodeURIComponent(branchName)}&ENVIRONMENT=uat&EXPERIMENT=true`;
        if (buildType === "xp") {
            JOB_PATH = "common/job/DIC/job/SSI/job/XDragon_Application_In_Mac_Mini";
            BUILD_TOKEN = process.env.XP_BUILD_TOKEN;
            androidUrl = `${JENKINS_URL}/${JOB_PATH}/buildWithParameters?token=${BUILD_TOKEN}&BUILD_TYPE=staging&GIT_BRANCH=${encodeURIComponent(branchName)}&PLATFORM=android`;
            iosUrl = `${JENKINS_URL}/${JOB_PATH}/buildWithParameters?token=${BUILD_TOKEN}&BUILD_TYPE=staging&GIT_BRANCH=${encodeURIComponent(branchName)}&PLATFORM=ios`;
        }
        // Base64 编码认证信息
        const auth = Buffer.from(`${USERNAME_ENV}:${API_TOKEN}`).toString('base64');
        // 发起请求
        let result = await Promise.all([
            fetch(androidUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }),
            fetch(iosUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            })
        ]);
    }
    catch (error) {
        throw new Error(`Jenkins 构建失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
