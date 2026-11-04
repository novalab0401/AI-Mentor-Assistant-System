// 페이지(서버 컴포넌트)용 로그인 확인. proxy가 먼저 막지만, 데이터를 읽는 곳에서 한 번 더 확인한다.
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { viewerFrom, type Viewer } from "./auth";

export async function currentViewer(): Promise<Viewer | null> {
  return viewerFrom(await headers());
}

export async function requirePageViewer(): Promise<Viewer> {
  const v = await currentViewer();
  if (!v) redirect("/login");
  return v;
}

export async function requireAdminPage(): Promise<Viewer> {
  const v = await requirePageViewer();
  if (v.role !== "admin") notFound();
  return v;
}
