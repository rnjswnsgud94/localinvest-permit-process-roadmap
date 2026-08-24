import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchElisOrdinanceRecords,
  parseElisOrdinanceListHtml,
  resetElisClientMemoryStateForTests,
} from "@/lib/regions/elis-client.server";

const mujuTarget = {
  name: "무주군",
  level: "MUNICIPALITY" as const,
  listUrl:
    "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=52&sggCd=730",
};

describe("ELIS current-ordinance client", () => {
  beforeEach(() => resetElisClientMemoryStateForTests());

  it("parses the official popup identifiers into exact detail links", () => {
    const html = `
      <table><tbody><tr>
        <td><a href="#" onclick="lawPopup('','','','52730129348001','006')">무주군 하수도 사용 조례</a></td>
        <td>2025-03-12</td>
      </tr></tbody></table>`;

    expect(parseElisOrdinanceListHtml(html, mujuTarget)).toEqual([
      expect.objectContaining({
        name: "무주군 하수도 사용 조례",
        amendmentDate: "2025-03-12",
        url:
          "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=52730129348001&histNo=006",
      }),
    ]);
  });

  it("takes the title and identifiers from the same popup anchor and decodes ELIS entities", () => {
    const html = `
      <table><tbody><tr>
        <td><a href="#" onclick="lawPopup('법령','건축법','')">건축법</a></td>
        <td><a class="a-link" href="#" onclick="lawPopup('','','','52730124297007','008')">
          무주군 폐기물관리 및 수수료 부과&middot;징수에 관한 조례
        </a></td>
        <td>2024.07.01</td>
      </tr></tbody></table>`;

    expect(parseElisOrdinanceListHtml(html, mujuTarget)).toEqual([
      expect.objectContaining({
        name: "무주군 폐기물관리 및 수수료 부과·징수에 관한 조례",
        amendmentDate: "2024-07-01",
        url:
          "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=52730124297007&histNo=008",
      }),
    ]);
  });

  it("does not mix reviewed fallback records into a successful live catalogue", async () => {
    const html = `
      <table><tbody><tr>
        <td><a href="#" onclick="lawPopup('','','','52730199999999','001')">무주군 임시 조례</a></td>
        <td>2026-08-21</td>
      </tr></tbody></table>`;
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html;charset=UTF-8" },
      }),
    );

    const result = await fetchElisOrdinanceRecords(
      mujuTarget,
      "전북특별자치도",
      { fetchImpl, now: new Date("2026-08-21T02:00:00.000Z") },
    );

    expect(result.mode).toBe("LIVE");
    expect(result.records.map((record) => record.name)).toEqual(["무주군 임시 조례"]);
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("uses the reviewed Muju detail records when ELIS is temporarily unavailable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await fetchElisOrdinanceRecords(
      mujuTarget,
      "전북특별자치도",
      { fetchImpl, timeoutMs: 10 },
    );

    expect(result.mode).toBe("REVIEWED");
    expect(result.records).toContainEqual(
      expect.objectContaining({
        name: "무주군 하수도 사용 조례",
        url:
          "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=52730129348001&histNo=006",
      }),
    );
  });

  it("uses the reviewed Daejeon detail records when the deployed worker cannot reach ELIS", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("worker subrequest blocked"));
    const result = await fetchElisOrdinanceRecords(
      {
        name: "중구",
        level: "MUNICIPALITY",
        listUrl:
          "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=30&sggCd=140",
      },
      "대전광역시",
      { fetchImpl, timeoutMs: 10 },
    );

    expect(result.mode).toBe("REVIEWED");
    expect(result.records).toContainEqual(
      expect.objectContaining({
        name: "대전광역시 중구 도시계획 조례",
        url:
          "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=30140113255015&histNo=008",
      }),
    );
  });

  it("uses reviewed capital-region details with the current ELIS jurisdiction code", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("worker subrequest blocked"));
    const result = await fetchElisOrdinanceRecords(
      {
        name: "고양시",
        level: "MUNICIPALITY",
        listUrl:
          "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=41&sggCd=470",
      },
      "경기도",
      { fetchImpl, timeoutMs: 10 },
    );

    expect(result.mode).toBe("REVIEWED");
    expect(result.records).toContainEqual(expect.objectContaining({
      name: "고양시 도시계획 조례",
      url: "https://www.elis.go.kr/alrpop/alrDtlsPop?alrNo=41470113223006&histNo=044",
    }));
  });

  it("rejects non-canonical ELIS list URLs before issuing a request", async () => {
    const fetchImpl = vi.fn();

    await expect(
      fetchElisOrdinanceRecords(
        {
          ...mujuTarget,
          listUrl:
            "https://www.elis.go.kr:444/alrpop/locgovAlrPopup?ctpvCd=52&sggCd=730",
        },
        "전북특별자치도",
        { fetchImpl },
      ),
    ).rejects.toThrow("허용되지 않은 ELIS 조회 주소");
    await expect(
      fetchElisOrdinanceRecords(
        {
          ...mujuTarget,
          listUrl:
            "https://www.elis.go.kr/alrpop/locgovAlrPopup?ctpvCd=52&sggCd=730&next=https://example.com",
        },
        "전북특별자치도",
        { fetchImpl },
      ),
    ).rejects.toThrow("허용되지 않은 ELIS 조회 주소");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
