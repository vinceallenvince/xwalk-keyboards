export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ service: "xwalk-keyboards", status: "ok" });
}
