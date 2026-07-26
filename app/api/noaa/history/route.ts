import { NextRequest, NextResponse } from "next/server";

type CdoStation = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  datacoverage?: number;
};

type CdoDatum = {
  date: string;
  datatype: "TMAX" | "TMIN" | "PRCP";
  station: string;
  value: number;
};

const distanceKm = (lat1:number, lon1:number, lat2:number, lon2:number) => {
  const r = 6371;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2-lat1) * Math.PI / 180;
  const dl = (lon2-lon1) * Math.PI / 180;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*r*Math.asin(Math.sqrt(a));
};

export async function GET(request: NextRequest) {
  const token = process.env.NOAA_CDO_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "NOAA_CDO_TOKEN is not configured.", code: "MISSING_NOAA_TOKEN" },
      { status: 503 }
    );
  }

  const q = request.nextUrl.searchParams;
  const lat = Number(q.get("lat"));
  const lon = Number(q.get("lon"));
  const start = q.get("start");
  const end = q.get("end");

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !start || !end) {
    return NextResponse.json({ error: "lat, lon, start, and end are required." }, { status: 400 });
  }

  const extent = `${lat-0.75},${lon-0.75},${lat+0.75},${lon+0.75}`;
  const stationUrl = new URL("https://www.ncei.noaa.gov/cdo-web/api/v2/stations");
  stationUrl.searchParams.set("datasetid", "GHCND");
  stationUrl.searchParams.set("datatypeid", "TMAX,TMIN,PRCP");
  stationUrl.searchParams.set("extent", extent);
  stationUrl.searchParams.set("startdate", start);
  stationUrl.searchParams.set("enddate", end);
  stationUrl.searchParams.set("limit", "100");
  stationUrl.searchParams.set("sortfield", "datacoverage");
  stationUrl.searchParams.set("sortorder", "desc");

  try {
    const stationRes = await fetch(stationUrl, {
      headers: { token, "User-Agent": "LSU-Sweetpotato-Decision-Platform/0.2" },
      cache: "no-store"
    });
    const stationJson = await stationRes.json();
    if (!stationRes.ok) {
      return NextResponse.json({ error: "NOAA station lookup failed.", detail: stationJson }, { status: 502 });
    }

    const stations: CdoStation[] = stationJson.results || [];
    if (!stations.length) {
      return NextResponse.json({ error: "No NOAA GHCN-Daily station was found near this location." }, { status: 404 });
    }

    stations.sort((a,b) => {
      const coverage = (b.datacoverage || 0) - (a.datacoverage || 0);
      if (Math.abs(coverage) > 0.05) return coverage;
      return distanceKm(lat,lon,a.latitude,a.longitude)-distanceKm(lat,lon,b.latitude,b.longitude);
    });
    const station = stations[0];

    const dataUrl = new URL("https://www.ncei.noaa.gov/cdo-web/api/v2/data");
    dataUrl.searchParams.set("datasetid", "GHCND");
    dataUrl.searchParams.set("stationid", station.id);
    dataUrl.searchParams.set("datatypeid", "TMAX,TMIN,PRCP");
    dataUrl.searchParams.set("startdate", start);
    dataUrl.searchParams.set("enddate", end);
    dataUrl.searchParams.set("units", "standard");
    dataUrl.searchParams.set("limit", "1000");
    dataUrl.searchParams.set("includemetadata", "false");

    const dataRes = await fetch(dataUrl, {
      headers: { token, "User-Agent": "LSU-Sweetpotato-Decision-Platform/0.2" },
      cache: "no-store"
    });
    const dataJson = await dataRes.json();
    if (!dataRes.ok) {
      return NextResponse.json({ error: "NOAA daily-data request failed.", detail: dataJson }, { status: 502 });
    }

    const byDate = new Map<string, {date:string;tmaxF?:number;tminF?:number;prcpIn?:number}>();
    for (const datum of (dataJson.results || []) as CdoDatum[]) {
      const date = datum.date.slice(0,10);
      const row = byDate.get(date) || { date };
      if (datum.datatype === "TMAX") row.tmaxF = datum.value;
      if (datum.datatype === "TMIN") row.tminF = datum.value;
      if (datum.datatype === "PRCP") row.prcpIn = datum.value;
      byDate.set(date,row);
    }

    const rows = [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date));
    return NextResponse.json({
      source: "NOAA NCEI Climate Data Online, GHCN-Daily",
      station: {
        id: station.id,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        distanceKm: Math.round(distanceKm(lat,lon,station.latitude,station.longitude)*10)/10,
        datacoverage: station.datacoverage
      },
      rows
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to retrieve NOAA historical weather.", detail: error instanceof Error ? error.message : "Unknown error" },
      { status: 502 }
    );
  }
}
