import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { Sidebar } from "@/components/Sidebar";
import { currentViewer } from "@/server/viewer";
import "./globals.css";

const noto = Noto_Sans_KR({
  variable: "--font-noto",
  weight: ["300", "400", "500", "600"],
  subsets: ["latin"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nova Lab",
  description: "STEM 진로 탐험대 강사 수업 준비와 모의수업 피드백",
  robots: { index: false, follow: false }, // 내부 도구라 검색에 나오지 않게 한다
};

// 페이지들이 세션 저장소를 매 요청 읽는다.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const viewer = await currentViewer();
  return (
    <html lang="ko" className={noto.variable}>
      <body className="flex min-h-screen">
        <Sidebar viewer={viewer && { name: viewer.name, role: viewer.role, local: viewer.local }} />
        <main className="min-w-0 flex-1 px-12 pb-20 pt-12">
          <div className="mx-auto max-w-[1120px]">{children}</div>
        </main>
      </body>
    </html>
  );
}
