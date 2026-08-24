import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchElisOrdinanceRecords } from "@/lib/regions/elis-client.server";
import {
  matchOrdinancesToCategories,
} from "@/lib/regions/ordinance-resolution";
import {
  getElisJurisdictionTargets,
  getOfficialLocalOrdinanceLinks,
} from "@/lib/regions/local-ordinances";

const requestSchema = z.object({
  province: z.string().trim().min(2).max(20),
  city: z.string().trim().max(20).default(""),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = requestSchema.safeParse({
    province: url.searchParams.get("province") ?? "",
    city: url.searchParams.get("city") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "시·도 또는 시·군·구 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const links = getOfficialLocalOrdinanceLinks(
    parsed.data.province,
    parsed.data.city,
  );
  if (!links.province) {
    return NextResponse.json(
      { error: "지원하는 관할지역을 확인하지 못했습니다." },
      { status: 404 },
    );
  }

  const targets = getElisJurisdictionTargets(
    parsed.data.province,
    parsed.data.city,
  );

  try {
    const lookups = await Promise.all(
      targets.map((target) =>
        Promise.resolve()
          .then(() =>
            fetchElisOrdinanceRecords(target, links.province!.name),
          )
          .catch(() => null),
      ),
    );
    const fulfilled = lookups.filter(
      (
        lookup,
      ): lookup is Awaited<ReturnType<typeof fetchElisOrdinanceRecords>> =>
        lookup !== null && lookup.records.length > 0,
    );
    if (!fulfilled.length) {
      throw new Error("ELIS 현행 자치법규를 조회하지 못했습니다.");
    }
    const records = fulfilled.flatMap((lookup) => lookup.records);
    const liveCount = fulfilled.filter((lookup) => lookup.mode === "LIVE").length;
    const mode =
      liveCount === targets.length
        ? "LIVE"
        : liveCount > 0
          ? "PARTIAL"
          : "SNAPSHOT";

    return NextResponse.json(
      {
        jurisdiction: {
          province: parsed.data.province,
          city: parsed.data.city || null,
        },
        checkedAt:
          fulfilled
            .map((lookup) => lookup.checkedAt)
            .sort()
            .at(0) ?? new Date().toISOString(),
        source: "행정안전부 자치법규정보시스템(ELIS)",
        mode,
        categories: matchOrdinancesToCategories(records),
      },
      {
        headers: {
          "Cache-Control":
            "public, max-age=900, s-maxage=21600, stale-while-revalidate=86400",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "행정안전부 ELIS의 현행 자치법규를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.",
      },
      { status: 502 },
    );
  }
}
