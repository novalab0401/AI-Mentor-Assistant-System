import { feedbackStandard } from "@/server/content";

export async function GET() {
  return Response.json(feedbackStandard);
}
