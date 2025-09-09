// app/api/[transport]/route.ts
import { createMcpHandler } from "mcp-handler";
import { sayHello, helloTool } from "@/lib/hello";

const handler = createMcpHandler(
  (server) => {
    server.tool(
      helloTool.name,
      helloTool.description,
      helloTool.schema,
      async ({ name }) => {
        // Use the shared hello logic
        const result = sayHello(name);
        return {
          content: [result],
        };
      }
    );
  },
  {
    // Optional server options
  },
  {
    // No Redis config - disable Redis requirement
    basePath: "/api", // this needs to match where the [transport] is located.
    maxDuration: 60,
    verboseLogs: true,
  }
);
export { handler as GET, handler as POST };