'use server'

import { sayHello as sayHelloCore, helloTool } from "@/lib/hello"

// Server action that uses the shared hello logic
export async function sayHello(name?: string) {
  try {
    const result = sayHelloCore(name)

    return {
      success: true,
      result: {
        content: [result]
      }
    }
  } catch (error) {
    return {
      success: false,
      error: {
        code: -32602,
        message: error instanceof Error ? error.message : 'Invalid parameters'
      }
    }
  }
}

export async function listTools() {
  return {
    success: true,
    result: {
      tools: [
        {
          name: helloTool.name,
          description: helloTool.description,
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name to greet (optional, defaults to "World")',
                default: 'World'
              }
            },
            required: []
          }
        }
      ]
    }
  }
}