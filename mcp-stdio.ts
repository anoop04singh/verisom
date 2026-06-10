import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createVerisomMcpServer } from "./lib/mcp-server";

async function main() {
  const server = createVerisomMcpServer({
    allowEnvPrivateKey: true,
    transportMode: "stdio"
  });
  const transport = new StdioServerTransport();

  await server.connect(transport);
  console.error("VeriSom MCP stdio server running.");
}

main().catch((error) => {
  console.error("VeriSom MCP stdio server failed:", error);
  process.exit(1);
});
