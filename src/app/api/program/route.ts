import { program } from "@/server/content";

export async function GET() {
  return Response.json(program);
}
