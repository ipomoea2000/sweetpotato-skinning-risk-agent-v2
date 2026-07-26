"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type RiskClass = "Low" | "Medium" | "High";
type SoilMoisture = "Wet" | "Adequate" | "Slightly dry" | "Dry";
type SoilTexture = "Sandy" | "Sandy loam" | "Silt loam" | "Other";
type Handling = "Gentle" | "Typical" | "Aggressive";
type WeatherRow = { date:string; tmaxF?:number; tminF?:number; prcpIn?:number };
type ForecastPeriod = {
  name:string;
  startTime:string;
  temperature:number;
  temperatureUnit:string;
  probabilityOfPrecipitation:number;
  shortForecast:string;
};
type Dashboard = {
  samples:number;
  predictions:number;
  validations:number;
  paired:number;
  accuracy:number|null;
  images:number;
};

const institutions = [
  "LSU AgCenter",
  "Mississippi State University",
  "UC Davis",
  "Grower collaborator",
  "Other"
];

const varieties = [
  "Averre",
  "Bayou Belle",
  "Beauregard",
  "Bellevue",
  "Murasaki",
  "Orleans",
  "Other"
];

const dayOptions = Array.from({length:22},(_,index)=>index);

const clamp = (value:number,min:number,max:number) =>
  Math.min(max, Math.max(min,value));

const iso = (date:Date) => date.toISOString().slice(0,10);

function classFromIndex(index:number):RiskClass {
  return index < 33.333 ? "Low" : index < 66.667 ? "Medium" : "High";
}

function probabilityMembership(index:number) {
  const centers = [15,50,85];
  const sigma = 18;
  const kernels = centers.map(center =>
    Math.exp(-Math.pow(index-center,2)/(2*Math.pow(sigma,2)))
  );
  const total = kernels.reduce((sum,value)=>sum+value,0);
  return {
    low:kernels[0]/total,
    medium:kernels[1]/total,
    high:kernels[2]/total
  };
}

function summariseWeather(rows:WeatherRow[]) {
  let gdd=0;
  let rainfall=0;
  for(const row of rows){
    if(typeof row.tmaxF==="number" && typeof row.tminF==="number"){
      gdd += Math.max(0, ((row.tmaxF+row.tminF)/2)-60);
    }
    if(typeof row.prcpIn==="number") rainfall += Math.max(0,row.prcpIn);
  }
  const last7=rows.slice(-7);
  const last14=rows.slice(-14);
  const rain7=last7.reduce((sum,row)=>sum+(row.prcpIn||0),0);
  const rain14=last14.reduce((sum,row)=>sum+(row.prcpIn||0),0);
  const nightTemps=last7
    .filter(row=>typeof row.tminF==="number")
    .map(row=>row.tminF as number);
  const meanNight=nightTemps.length
    ? nightTemps.reduce((sum,value)=>sum+value,0)/nightTemps.length
    : 0;

  return {
    gdd:Math.round(gdd),
    rainfall:Math.round(rainfall*100)/100,
    rain7:Math.round(rain7*100)/100,
    rain14:Math.round(rain14*100)/100,
    meanNight:Math.round(meanNight*10)/10
  };
}

function scoreState(value:string, map:Record<string,number>) {
  return map[value] ?? 50;
}

export default function Page(){
  const today=new Date();
  const planted=new Date(today);
  planted.setDate(planted.getDate()-100);

  const [sampleId,setSampleId]=useState(`SKIN-${Date.now().toString().slice(-7)}`);
  const [institution,setInstitution]=useState("LSU AgCenter");
  const [fieldType,setFieldType]=useState("Research field");
  const [fieldName,setFieldName]=useState("");
  const [lat,setLat]=useState<number|null>(null);
  const [lon,setLon]=useState<number|null>(null);
  const [variety,setVariety]=useState("Beauregard");
  const [otherVariety,setOtherVariety]=useState("");
  const [plantingDate,setPlantingDate]=useState(iso(planted));
  const [samplingDate,setSamplingDate]=useState(iso(today));
  const [soilTexture,setSoilTexture]=useState<SoilTexture>("Silt loam");
  const [soilMoisture,setSoilMoisture]=useState<SoilMoisture>("Adequate");
  const [irrigationCutoff,setIrrigationCutoff]=useState(5);
  const [vineRemoval,setVineRemoval]=useState(0);
  const [handling,setHandling]=useState<Handling>("Typical");
  const [forecastRainManual,setForecastRainManual]=useState(0);

  const [weatherRows,setWeatherRows]=useState<WeatherRow[]>([]);
  const [forecast,setForecast]=useState<ForecastPeriod[]>([]);
  const [station,setStation]=useState<any>(null);
  const [status,setStatus]=useState("Capture location, then load NOAA weather.");
  const [loading,setLoading]=useState(false);

  const [observedClass,setObservedClass]=useState<RiskClass|null>(null);
  const [estimatedSkinning,setEstimatedSkinning]=useState("");
  const [rapidStain,setRapidStain]=useState(false);
  const [assessmentType,setAssessmentType]=useState("Phloroglucinol rapid stain");
  const [lignifiedPct,setLignifiedPct]=useState("");
  const [continuity,setContinuity]=useState(3);
  const [rootCount,setRootCount]=useState("");
  const [surfaceDefects,setSurfaceDefects]=useState("Absent");
  const [fieldNotes,setFieldNotes]=useState("");
  const [labNotes,setLabNotes]=useState("");
  const [photo,setPhoto]=useState<File|null>(null);
  const [photoType,setPhotoType]=useState("Field skinning");
  const [photoCaption,setPhotoCaption]=useState("");

  const [dashboard,setDashboard]=useState<Dashboard|null>(null);
  const [harvestDelay,setHarvestDelay]=useState(0);

  const dap=Math.max(0,Math.round(
    (new Date(samplingDate+"T12:00:00").getTime()-
     new Date(plantingDate+"T12:00:00").getTime())/86400000
  ));

  const weather=useMemo(()=>summariseWeather(weatherRows),[weatherRows]);
  const fallbackGdd=Math.round(dap*18.5);
  const gdd=weatherRows.length ? weather.gdd : fallbackGdd;

  const riskModel=useMemo(()=>{
    const moistureScore=scoreState(soilMoisture,{
      "Wet":100,"Adequate":75,"Slightly dry":35,"Dry":10
    });
    const textureScore=scoreState(soilTexture,{
      "Sandy":10,"Sandy loam":40,"Silt loam":75,"Other":90
    });
    const nightClass=weather.meanNight===0
      ? "60–70°F"
      : weather.meanNight<60 ? "<60°F" : weather.meanNight<=70 ? "60–70°F" : ">70°F";
    const nightScore=scoreState(nightClass,{
      "<60°F":100,"60–70°F":50,">70°F":10
    });
    const cutoffClass=irrigationCutoff<=4
      ? "0–4 days" : irrigationCutoff<=10 ? "5–10 days" : ">10 days";
    const cutoffScore=scoreState(cutoffClass,{
      "0–4 days":100,"5–10 days":50,">10 days":10
    });
    const rainClass=weather.rain7>1
      ? ">1.0 in" : weather.rain7>=0.5 ? "0.5–1.0 in" : "<0.5 in";
    const rainScore=scoreState(rainClass,{
      ">1.0 in":100,"0.5–1.0 in":50,"<0.5 in":10
    });
    const vineClass=vineRemoval<=4
      ? "0–4 days" : vineRemoval<=7 ? "5–7 days" : ">7 days";
    const vineScore=scoreState(vineClass,{
      "0–4 days":100,"5–7 days":50,">7 days":10
    });
    const gddClass=gdd<1500
      ? "<1500" : gdd<1800 ? "1500–1799" : gdd<2000 ? "1800–1999" : "≥2000";
    const gddScore=scoreState(gddClass,{
      "<1500":100,"1500–1799":65,"1800–1999":30,"≥2000":5
    });

    const index=
      moistureScore*0.20+
      textureScore*0.10+
      nightScore*0.10+
      cutoffScore*0.15+
      rainScore*0.10+
      vineScore*0.15+
      gddScore*0.20;

    const contributions=[
      {label:`Soil moisture: ${soilMoisture}`,score:moistureScore*0.20},
      {label:`Soil texture: ${soilTexture}`,score:textureScore*0.10},
      {label:`Recent night temperature: ${nightClass}`,score:nightScore*0.10},
      {label:`Irrigation cutoff: ${cutoffClass}`,score:cutoffScore*0.15},
      {label:`Rainfall, previous 7 days: ${rainClass}`,score:rainScore*0.10},
      {label:`Vine removal: ${vineClass}`,score:vineScore*0.15},
      {label:`Cumulative GDD: ${gddClass}`,score:gddScore*0.20}
    ].sort((a,b)=>b.score-a.score);

    return {
      index:Math.round(index*10)/10,
      riskClass:classFromIndex(index),
      probabilities:probabilityMembership(index),
      drivers:contributions.slice(0,3).map(item=>item.label),
      classes:{nightClass,cutoffClass,rainClass,vineClass,gddClass}
    };
  },[
    soilMoisture,soilTexture,weather.meanNight,weather.rain7,
    irrigationCutoff,vineRemoval,gdd
  ]);

  const maxForecastPop=forecast.length
    ? Math.max(...forecast.map(period=>period.probabilityOfPrecipitation||0))
    : 0;

  const harvestScenarios=useMemo(()=>{
    return [0,3,7,10].map(days=>{
      const projectedGdd=gdd+Math.round(days*18.5);
      const projectedCutoff=irrigationCutoff+days;
      const projectedVine=vineRemoval+days;

      const projectedGddScore=projectedGdd<1500?100:
        projectedGdd<1800?65:projectedGdd<2000?30:5;
      const projectedCutoffScore=projectedCutoff<=4?100:
        projectedCutoff<=10?50:10;
      const projectedVineScore=projectedVine<=4?100:
        projectedVine<=7?50:10;

      let projectedIndex=riskModel.index;
      projectedIndex += (projectedGddScore-
        scoreState(riskModel.classes.gddClass,{
          "<1500":100,"1500–1799":65,"1800–1999":30,"≥2000":5
        }))*0.20;
      projectedIndex += (projectedCutoffScore-
        scoreState(riskModel.classes.cutoffClass,{
          "0–4 days":100,"5–10 days":50,">10 days":10
        }))*0.15;
      projectedIndex += (projectedVineScore-
        scoreState(riskModel.classes.vineClass,{
          "0–4 days":100,"5–7 days":50,">7 days":10
        }))*0.15;

      const relevantForecast=forecast.slice(0,Math.max(1,days*2));
      const weatherRisk=relevantForecast.length
        ? Math.max(...relevantForecast.map(period=>period.probabilityOfPrecipitation||0))
        : maxForecastPop;

      projectedIndex += weatherRisk>=70?12:weatherRisk>=50?8:weatherRisk>=30?4:0;
      projectedIndex=clamp(projectedIndex,0,100);

      const maturityScore=clamp(projectedGdd/2000,0,1)*40;
      const skinScore=(100-projectedIndex)*0.40;
      const weatherScore=(100-weatherRisk)*0.20;
      const optimization=Math.round(clamp(maturityScore+skinScore+weatherScore,0,100));

      const date=new Date(samplingDate+"T12:00:00");
      date.setDate(date.getDate()+days);

      return {
        days,
        date:iso(date),
        projectedGdd,
        projectedIndex:Math.round(projectedIndex),
        projectedClass:classFromIndex(projectedIndex),
        weatherRisk,
        optimization,
        label:days===0?"Harvest now":`Wait ${days} days`
      };
    });
  },[
    gdd,irrigationCutoff,vineRemoval,riskModel,forecast,maxForecastPop,samplingDate
  ]);

  const bestScenario=harvestScenarios.reduce(
    (best,current)=>current.optimization>best.optimization?current:best,
    harvestScenarios[0]
  );
  const selectedScenario=harvestScenarios.find(item=>item.days===harvestDelay)
    || harvestScenarios[0];

  function useCurrentLocation(){
    if(!navigator.geolocation){
      setStatus("Location is not supported by this browser.");
      return;
    }
    setStatus("Requesting current location…");
    navigator.geolocation.getCurrentPosition(
      position=>{
        setLat(Number(position.coords.latitude.toFixed(5)));
        setLon(Number(position.coords.longitude.toFixed(5)));
        setStatus("Current location captured. Load NOAA weather.");
      },
      error=>setStatus(`Location unavailable: ${error.message}`),
      {enableHighAccuracy:true,timeout:15000,maximumAge:60000}
    );
  }

  async function loadNoaa(){
    if(lat===null || lon===null){
      setStatus("Capture the field location first.");
      return;
    }
    setLoading(true);
    setStatus("Loading NOAA observations and NWS forecast…");
    try{
      const historyQuery=new URLSearchParams({
        lat:String(lat),lon:String(lon),start:plantingDate,end:samplingDate
      });
      const [historyResponse,forecastResponse]=await Promise.all([
        fetch(`/api/noaa/history?${historyQuery}`),
        fetch(`/api/noaa/forecast?lat=${lat}&lon=${lon}`)
      ]);
      const history=await historyResponse.json();
      const forecastData=await forecastResponse.json();
      if(!historyResponse.ok){
        throw new Error(history.error || "NOAA historical weather request failed.");
      }
      setWeatherRows(history.rows || []);
      setStation(history.station);
      if(forecastResponse.ok){
        setForecast(forecastData.periods || []);
      }
      setStatus(
        `Loaded ${history.rows?.length || 0} daily records from `+
        `${history.station?.name || "the selected NOAA station"}.`
      );
    }catch(error){
      setStatus(error instanceof Error?error.message:"NOAA load failed.");
    }finally{
      setLoading(false);
    }
  }

  async function databasePost(action:string,record:any){
    setStatus("Saving to the shared research database…");
    const response=await fetch("/api/database",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action,record})
    });
    const data=await response.json();
    if(!response.ok){
      throw new Error(data.error || "Database save failed.");
    }
    setStatus(`${action} saved successfully.`);
    refreshDashboard();
    return data;
  }

  async function saveSampleAndPrediction(){
    try{
      await databasePost("saveSampleAndPrediction",{
        sample:{
          Sample_ID:sampleId,
          Created_Timestamp:new Date().toISOString(),
          Collaborating_Institution:institution,
          Field_Type:fieldType,
          Field_Name:fieldName,
          Latitude:lat??"",
          Longitude:lon??"",
          Variety:variety,
          Other_Variety:variety==="Other"?otherVariety:"",
          Planting_Date:plantingDate,
          Sampling_Date:samplingDate,
          DAP:dap,
          Soil_Texture:soilTexture,
          Observer:"",
          Contact_Email:"",
          Record_Status:"Prediction saved",
          Notes:""
        },
        prediction:{
          Prediction_ID:`PRED-${Date.now()}`,
          Sample_ID:sampleId,
          Prediction_Timestamp:new Date().toISOString(),
          Model_Version:"v2.2-composite",
          NOAA_Station_ID:station?.id||"",
          NOAA_Station_Name:station?.name||"",
          NOAA_Station_Distance_km:station?.distanceKm||"",
          Cumulative_GDD_Base60F:gdd,
          Cumulative_Rain_in:weather.rainfall,
          Rain_7D_in:weather.rain7,
          Rain_14D_in:weather.rain14,
          Mean_Night_Temp_7D_F:weather.meanNight,
          Soil_Moisture:soilMoisture,
          Days_Since_Irrigation_Cutoff:irrigationCutoff,
          Days_Since_Vine_Removal:vineRemoval,
          Forecast_Rain_Probability_pct:maxForecastPop,
          Forecast_Rain_Manual_in:forecastRainManual,
          Composite_Risk_Index:riskModel.index,
          Predicted_Risk_Class:riskModel.riskClass,
          P_Low:riskModel.probabilities.low,
          P_Medium:riskModel.probabilities.medium,
          P_High:riskModel.probabilities.high,
          Dominant_Drivers:riskModel.drivers.join("; "),
          Recommended_Harvest_Delay_Days:bestScenario.days,
          Recommended_Harvest_Date:bestScenario.date,
          Harvest_Optimization_Score:bestScenario.optimization,
          Prediction_Locked:true,
          Prediction_Notes:""
        }
      });
    }catch(error){
      setStatus(error instanceof Error?error.message:"Prediction save failed.");
    }
  }

  async function saveValidation(){
    if(!observedClass){
      setStatus("Select Low, Medium, or High observed skinning first.");
      return;
    }
    try{
      await databasePost("saveValidation",{
        Validation_ID:`VAL-${Date.now()}`,
        Sample_ID:sampleId,
        Validation_Timestamp:new Date().toISOString(),
        Observer:"",
        Observed_Skinning_Class:observedClass,
        Estimated_Skinning_pct:estimatedSkinning,
        Rapid_Stain_Performed:rapidStain?"Yes":"No",
        Assessment_Type:rapidStain?assessmentType:"Not performed",
        Lignified_Tissue_pct:rapidStain?lignifiedPct:"",
        Periderm_Continuity_1_to_5:rapidStain?continuity:"",
        Root_Count:rootCount,
        Root_Size_Class:"",
        Harvest_Handling:handling,
        Surface_Defects:surfaceDefects,
        Field_Notes:fieldNotes,
        Laboratory_Notes:labNotes,
        Validation_Complete:true
      });
    }catch(error){
      setStatus(error instanceof Error?error.message:"Validation save failed.");
    }
  }

  async function uploadPhoto(){
    if(!photo){
      setStatus("Select or take a photo first.");
      return;
    }
    try{
      const base64=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result).split(",")[1]);
        reader.onerror=()=>reject(new Error("The selected photo could not be read."));
        reader.readAsDataURL(photo);
      });
      await databasePost("uploadPhoto",{
        Image_ID:`IMG-${Date.now()}`,
        Sample_ID:sampleId,
        Image_Type:photoType,
        File_Name:photo.name,
        Mime_Type:photo.type,
        Base64_Data:base64,
        Uploaded_By:institution,
        Caption:photoCaption,
        Notes:""
      });
    }catch(error){
      setStatus(error instanceof Error?error.message:"Photo upload failed.");
    }
  }

  async function refreshDashboard(){
    try{
      const response=await fetch("/api/database");
      const data=await response.json();
      if(response.ok && data.dashboard){
        setDashboard(data.dashboard);
      }
    }catch{}
  }

  useEffect(()=>{ refreshDashboard(); },[]);

  return <main className="page">
    <header className="hero">
      <div>
        <p className="eyebrow">Collaborative Research Platform</p>
        <h1>Sweetpotato Skin Prediction & Validation Platform</h1>
        <p className="subtitle">
          Preharvest risk prediction, harvest optimization, standardized field
          assessment, and collaborative model validation.
        </p>
      </div>
      <span className="badge">VERSION 2.2 • MOBILE INPUT FIX</span>
    </header>

    <section className="network">
      <div><span>Samples</span><strong>{dashboard?.samples??"—"}</strong></div>
      <div><span>Predictions</span><strong>{dashboard?.predictions??"—"}</strong></div>
      <div><span>Validations</span><strong>{dashboard?.validations??"—"}</strong></div>
      <div><span>Paired records</span><strong>{dashboard?.paired??"—"}</strong></div>
      <div><span>Class accuracy</span><strong>{dashboard?.accuracy!=null?`${Math.round(dashboard.accuracy*100)}%`:"—"}</strong></div>
      <div><span>Images</span><strong>{dashboard?.images??"—"}</strong></div>
    </section>

    <section className="panel">
      <div className="section-title">
        <div><span>1</span><h2>Sample and field setup</h2></div>
        <small>Required before prediction</small>
      </div>

      <div className="grid three">
        <label>Sample ID
          <input value={sampleId} onChange={event=>setSampleId(event.target.value)}/>
        </label>
        <label>Collaborating institution
          <select value={institution} onChange={event=>setInstitution(event.target.value)}>
            {institutions.map(item=><option key={item}>{item}</option>)}
          </select>
        </label>
        <label>Location type
          <select value={fieldType} onChange={event=>setFieldType(event.target.value)}>
            <option>Research field</option>
            <option>Grower field</option>
          </select>
        </label>
        <label>Field name
          <input value={fieldName} onChange={event=>setFieldName(event.target.value)}
            placeholder="Optional field or farm name"/>
        </label>
        <label>Variety
          <select value={variety} onChange={event=>setVariety(event.target.value)}>
            {varieties.map(item=><option key={item}>{item}</option>)}
          </select>
        </label>
        {variety==="Other" && <label>Other variety
          <input value={otherVariety} onChange={event=>setOtherVariety(event.target.value)}/>
        </label>}
        <label>When did you plant?
          <input type="date" value={plantingDate}
            onChange={event=>setPlantingDate(event.target.value)}/>
        </label>
        <label>Sampling date
          <input type="date" value={samplingDate}
            onChange={event=>setSamplingDate(event.target.value)}/>
        </label>
        <label>Soil texture
          <select value={soilTexture}
            onChange={event=>setSoilTexture(event.target.value as SoilTexture)}>
            <option>Sandy</option><option>Sandy loam</option>
            <option>Silt loam</option><option>Other</option>
          </select>
        </label>
      </div>

      <div className="location-bar">
        <button onClick={useCurrentLocation}>📍 Use Current Location</button>
        <span>{lat===null?"Location not captured":`${lat}, ${lon}`}</span>
        <span>{dap} DAP</span>
      </div>

      <div className="grid four">
        <label>Soil moisture
          <select value={soilMoisture}
            onChange={event=>setSoilMoisture(event.target.value as SoilMoisture)}>
            <option>Wet</option><option>Adequate</option>
            <option>Slightly dry</option><option>Dry</option>
          </select>
        </label>
        <label>Days since irrigation cutoff
          <select value={irrigationCutoff}
            onChange={event=>setIrrigationCutoff(Number(event.target.value))}>
            {dayOptions.map(day=><option key={day} value={day}>
              {day===0?"0 days":day===1?"1 day":`${day} days`}
            </option>)}
            <option value={30}>More than 21 days</option>
          </select>
        </label>
        <label>Days since vine removal
          <select value={vineRemoval}
            onChange={event=>setVineRemoval(Number(event.target.value))}>
            {dayOptions.map(day=><option key={day} value={day}>
              {day===0?"0 days":day===1?"1 day":`${day} days`}
            </option>)}
            <option value={30}>More than 21 days</option>
          </select>
        </label>
        <label>Expected harvest handling
          <select value={handling}
            onChange={event=>setHandling(event.target.value as Handling)}>
            <option>Gentle</option><option>Typical</option><option>Aggressive</option>
          </select>
        </label>
      </div>

      <div className="actions">
        <button onClick={loadNoaa} disabled={loading}>
          {loading?"Loading NOAA…":"Load NOAA weather"}
        </button>
        <button className="secondary" onClick={saveSampleAndPrediction}>
          Save Prediction
        </button>
      </div>
      <p className="status">{status}</p>
    </section>

    <section className="weather-strip">
      <div><span>Crop age</span><strong>{dap} DAP</strong></div>
      <div><span>Cumulative GDD</span><strong>{gdd}</strong></div>
      <div><span>Rain, 7 days</span><strong>{weather.rain7.toFixed(2)} in</strong></div>
      <div><span>Mean night temp</span><strong>{weather.meanNight||"—"}°F</strong></div>
      <div><span>NWS rain probability</span><strong>{maxForecastPop}%</strong></div>
      <div><span>NOAA station</span><strong>{station?.name||"Not loaded"}</strong></div>
    </section>

    <section className="two-column">
      <div className={`risk-card ${riskModel.riskClass.toLowerCase()}`}>
        <p>Predicted preharvest skinning risk</p>
        <div className="risk-value">{riskModel.riskClass}</div>
        <div className="index-row">
          <span>Composite index</span>
          <strong>{riskModel.index}/100</strong>
        </div>
        <div className="probability-row">
          <span>Low {Math.round(riskModel.probabilities.low*100)}%</span>
          <span>Medium {Math.round(riskModel.probabilities.medium*100)}%</span>
          <span>High {Math.round(riskModel.probabilities.high*100)}%</span>
        </div>
      </div>

      <div className="panel">
        <h2>Why this prediction?</h2>
        <ul>{riskModel.drivers.map(driver=><li key={driver}>{driver}</li>)}</ul>
        <p className="model-note">
          The seven-variable composite index remains provisional and will be
          recalibrated as observations accumulate.
        </p>
      </div>
    </section>

    <section className="two-column">
      <div className="panel harvest-agent">
        <h2>Harvest Optimization Agent</h2>
        <p className="recommendation">
          Recommended option: <strong>{bestScenario.label}</strong> on{" "}
          <strong>{bestScenario.date}</strong>.
        </p>
        <label>Explore harvest timing: <strong>{harvestDelay===0?"Today":`+${harvestDelay} days`}</strong>
          <input type="range" min="0" max="10" step="1" value={harvestDelay}
            onChange={event=>setHarvestDelay(Number(event.target.value))}/>
        </label>

        <div className="optimization-score">
          <span>Optimization score</span>
          <strong>{selectedScenario.optimization}/100</strong>
        </div>

        <div className="scenario-cards">
          <div><span>Projected date</span><strong>{selectedScenario.date}</strong></div>
          <div><span>Projected GDD</span><strong>{selectedScenario.projectedGdd}</strong></div>
          <div><span>Skinning risk</span><strong>{selectedScenario.projectedClass}</strong></div>
          <div><span>Weather risk</span><strong>{selectedScenario.weatherRisk}%</strong></div>
        </div>

        <div className="scenario-table">
          <div className="scenario-head">
            <span>Option</span><span>GDD</span><span>Risk</span><span>Weather</span><span>Score</span>
          </div>
          {harvestScenarios.map(item=><button key={item.days}
            className={item.days===bestScenario.days?"recommended":""}
            onClick={()=>setHarvestDelay(item.days)}>
            <span>{item.label}</span><span>{item.projectedGdd}</span>
            <span>{item.projectedClass}</span><span>{item.weatherRisk}%</span>
            <strong>{item.optimization}</strong>
          </button>)}
        </div>
      </div>

      <div className="panel">
        <h2>Sampling recommendations</h2>
        <ol>
          <li>Save the prediction before evaluating harvested roots.</li>
          <li>Use roots representative of the field and intended harvest conditions.</li>
          <li>Record handling conditions and pre-existing surface defects.</li>
          <li>Use the visual skinning index for the required field outcome.</li>
          <li>Pair field observations with rapid periderm measurements when possible.</li>
        </ol>
      </div>
    </section>

    <section className="panel">
      <div className="section-title">
        <div><span>2</span><h2>Observed skinning outcome</h2></div>
        <small>Tap the closest visual category</small>
      </div>

      <div className="visual-index">
        <Image src="/skinning-index.png" alt="Low, medium, and high sweetpotato skinning reference"
          width={1648} height={928} priority/>
      </div>

      <div className="choice-grid">
        {(["Low","Medium","High"] as RiskClass[]).map(choice=>
          <button key={choice}
            className={`${choice.toLowerCase()} ${observedClass===choice?"selected":""}`}
            onClick={()=>setObservedClass(choice)}>
            <strong>{choice}</strong>
            <span>{choice==="Low"
              ?"One or two isolated superficial areas."
              :choice==="Medium"
                ?"Several distinct patches over a moderate area."
                :"Numerous or extensive patches over much of the surface."}</span>
          </button>
        )}
      </div>

      <label className="optional-field">
        Estimated skinning percentage (optional)
        <input type="number" min="0" max="100" value={estimatedSkinning}
          onChange={event=>setEstimatedSkinning(event.target.value)}
          placeholder="0–100"/>
      </label>
    </section>

    <section className="two-column">
      <div className="panel">
        <h2>Rapid periderm assessment</h2>
        <label className="switch-row">
          <input type="checkbox" checked={rapidStain}
            onChange={event=>setRapidStain(event.target.checked)}/>
          <span>Rapid stain or image assessment performed</span>
        </label>

        {rapidStain && <div className="grid two">
          <label>Assessment type
            <select value={assessmentType}
              onChange={event=>setAssessmentType(event.target.value)}>
              <option>Phloroglucinol rapid stain</option>
              <option>Image analysis</option>
              <option>Visual periderm assessment</option>
              <option>Other</option>
            </select>
          </label>
          <label>Lignified tissue (%)
            <input type="number" min="0" max="100" value={lignifiedPct}
              onChange={event=>setLignifiedPct(event.target.value)}/>
          </label>
          <label>Periderm continuity (1–5)
            <input type="range" min="1" max="5" value={continuity}
              onChange={event=>setContinuity(Number(event.target.value))}/>
            <strong>{continuity}/5</strong>
          </label>
          <label>Number of roots assessed
            <input type="number" min="1" value={rootCount}
              onChange={event=>setRootCount(event.target.value)}/>
          </label>
        </div>}

        <label>Surface defects
          <select value={surfaceDefects}
            onChange={event=>setSurfaceDefects(event.target.value)}>
            <option>Absent</option><option>Present</option><option>Uncertain</option>
          </select>
        </label>
        <label>Field notes
          <textarea rows={4} value={fieldNotes}
            onChange={event=>setFieldNotes(event.target.value)}/>
        </label>
        <label>Laboratory notes
          <textarea rows={4} value={labNotes}
            onChange={event=>setLabNotes(event.target.value)}/>
        </label>
        <button onClick={saveValidation}>Save Validation</button>
      </div>

      <div className="panel">
        <h2>Photo documentation</h2>
        <label>Photo type
          <select value={photoType} onChange={event=>setPhotoType(event.target.value)}>
            <option>Field skinning</option>
            <option>Whole root</option>
            <option>Rapid stain</option>
            <option>Cross section</option>
            <option>Other</option>
          </select>
        </label>
        <label className="photo-box">
          <span>Take or select a photo</span>
          <input type="file" accept="image/*" capture="environment"
            onChange={event=>setPhoto(event.target.files?.[0]||null)}/>
        </label>
        <label>Caption
          <input value={photoCaption}
            onChange={event=>setPhotoCaption(event.target.value)}
            placeholder="Describe the root, treatment, or stain"/>
        </label>
        <button onClick={uploadPhoto}>Upload Photo to Google Drive</button>
        <p className="model-note">
          Use smaller images during initial testing. The file will be linked to
          the current Sample ID.
        </p>
      </div>
    </section>

    <footer>
      <h2>Research validation disclaimer</h2>
      <p>
        This collaborative platform is intended for prospective research validation.
        Composite risk weights, probability memberships, GDD thresholds, and harvest
        optimization scores are provisional. Save predictions before observing field
        outcomes. The platform is not a stand-alone commercial harvest recommendation.
      </p>
    </footer>
  </main>;
}
