import { rubric } from "@/server/content";

export async function GET() {
  return Response.json(rubric);
}
