import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const lat = q.get("lat");
  const lon = q.get("lon");
  if (!lat || !lon) {
    return NextResponse.json({ error: "lat and lon are required." }, { status: 400 });
  }

  const headers = {
    "User-Agent": "LSU-Sweetpotato-Decision-Platform/0.2 (research prototype)",
    "Accept": "application/geo+json"
  };

  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers, cache: "no-store" });
    const pointJson = await pointRes.json();
    if (!pointRes.ok) {
      return NextResponse.json({ error: "NWS point lookup failed.", detail: pointJson }, { status: 502 });
    }

    const forecastUrl = pointJson.properties?.forecast;
    if (!forecastUrl) {
      return NextResponse.json({ error: "NWS forecast URL was not returned." }, { status: 502 });
    }

    const forecastRes = await fetch(forecastUrl, { headers, cache: "no-store" });
    const forecastJson = await forecastRes.json();
    if (!forecastRes.ok) {
      return NextResponse.json({ error: "NWS forecast request failed.", detail: forecastJson }, { status: 502 });
    }

    const periods = (forecastJson.properties?.periods || []).slice(0,14).map((p:any)=>({
      name: p.name,
      startTime: p.startTime,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value ?? 0,
      shortForecast: p.shortForecast
    }));

    return NextResponse.json({
      source: "NOAA National Weather Service API",
      updated: forecastJson.properties?.updated,
      periods
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to retrieve NWS forecast.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 }
    );
  }
}
