import { NextRequest, NextResponse } from "next/server";

type CimisValue = { Value?: string };
type CimisRecord = {
  Date?: string;
  Station?: string;
  DayAirTmpMax?: CimisValue;
  DayAirTmpMin?: CimisValue;
  DayPrecip?: CimisValue;
};
type CimisProvider = {
  Name?: string;
  Type?: string;
  Records?: CimisRecord[];
};

function numberOrUndefined(value?: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const appKey = process.env.CIMIS_APP_KEY;
  if (!appKey) {
    return NextResponse.json(
      { error: "CIMIS_APP_KEY is not configured in Vercel." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const station = searchParams.get("station") || "206";

  if (!start || !end) {
    return NextResponse.json(
      { error: "Missing required start and end dates." },
      { status: 400 }
    );
  }

  const url = new URL("https://et.water.ca.gov/api/data");
  url.searchParams.set("appKey", appKey);
  url.searchParams.set("targets", station);
  url.searchParams.set("startDate", start);
  url.searchParams.set("endDate", end);
  url.searchParams.set(
    "dataItems",
    "day-air-tmp-max,day-air-tmp-min,day-precip"
  );
  url.searchParams.set("unitOfMeasure", "E");

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const text = await response.text();

    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "CIMIS returned a non-JSON response.", detail: text.slice(0, 300) },
        { status: 502 }
      );
    }

    if (!response.ok) {
      const message =
        data?.Data?.Providers?.[0]?.Errors?.[0]?.Message ||
        data?.Message ||
        "CIMIS request failed.";
      return NextResponse.json({ error: message, detail: data }, { status: response.status });
    }

    const providers: CimisProvider[] = data?.Data?.Providers || [];
    const provider = providers.find(item => item.Type === "station") || providers[0];
    const records = provider?.Records || [];

    const rows = records.map(record => ({
      date: record.Date || "",
      tmaxF: numberOrUndefined(record.DayAirTmpMax?.Value),
      tminF: numberOrUndefined(record.DayAirTmpMin?.Value),
      prcpIn: numberOrUndefined(record.DayPrecip?.Value)
    })).filter(row => row.date);

    return NextResponse.json({
      source: "CIMIS",
      station: {
        id: station,
        name: station === "206" ? "Denair II" : `CIMIS Station ${station}`,
        distanceKm: null
      },
      rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CIMIS request failed." },
      { status: 502 }
    );
  }
}
