import type { Metadata } from "next";
import "./globals.css";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "지역투자 인허가 로드맵",
  description: "전국 제조시설·AI 데이터센터 투자조건에 따른 인허가 절차, 적용 특례, 진행 순서와 소요기간을 확인하는 도구",
  openGraph: {
    title: "지역투자 인허가 로드맵",
    description: "사업 조건별 인허가 절차, 업종별 특례, 선후행 순서, 소요기간과 법령 근거를 확인합니다.",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "지역투자 인허가 절차 흐름을 표현한 대시보드 이미지" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "지역투자 인허가 로드맵",
    description: "전국 제조시설·AI 데이터센터 투자에 필요한 절차, 특례와 소요기간을 확인합니다.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
