# Sweetpotato Skin Prediction & Validation Platform v2

A clean mobile-first research codebase integrating:

- phone GPS location
- NOAA NCEI historical observations
- NWS forecast
- seven-variable composite skinning-risk engine
- Low / Medium / High prediction
- probability-like class memberships
- transparent risk drivers
- Harvest Optimization Agent
- standardized visual skinning assessment
- optional estimated skinning percentage
- conditional rapid periderm assessment
- Google Sheets data storage
- Google Drive photo storage
- collaborative research dashboard

## Files at repository root

- `app/`
- `public/`
- `package.json`
- `tsconfig.json`
- `GoogleAppsScript_Code.gs`
- `README.md`

## Google setup

1. Upload `Sweetpotato_Skin_Prediction_Validation_Database_v2.xlsx` to Google Drive.
2. Open it with Google Sheets.
3. Create a Google Drive folder for photos.
4. Open **Extensions → Apps Script** from the Google Sheet.
5. Replace the starter code with `GoogleAppsScript_Code.gs`.
6. Enter:
   - the Google Sheet ID
   - the Google Drive folder ID
   - a long shared secret
7. Deploy as a web app:
   - Execute as: Me
   - Access: Anyone
8. Copy the web app URL ending in `/exec`.

## Vercel environment variables

Add:

- `NOAA_CDO_TOKEN`
- `GOOGLE_APPS_SCRIPT_URL`
- `APP_SHARED_SECRET`

The shared secret must exactly match the value in Apps Script.

## Model status

The composite risk index is provisional. It uses:

- soil moisture: 20%
- cumulative GDD: 20%
- irrigation cutoff: 15%
- vine-removal interval: 15%
- soil texture: 10%
- recent night temperature: 10%
- recent 7-day rainfall: 10%

Observed skinning class is required for validation. Quantitative skinning,
rapid stain, lignified tissue, continuity, and images are optional research data.


## Version 2.2 mobile input fix

- Replaced the numeric irrigation-cutoff field with a native mobile dropdown.
- Replaced the numeric vine-removal field with a native mobile dropdown.
- Prevents the leading-zero behavior where entering 4 could display as 04.
- Includes exact day choices from 0 through 21 and a "More than 21 days" option.


## Version 2.3 multi-region update

- Neutral collaborative branding retained.
- Added production region: Louisiana, Mississippi, California, or Other.
- Expanded soil textures: Sand, Loamy sand, Sandy loam, Loam, Silt loam, Clay loam, Clay, Organic/Peat, and Other.
- Added Vermillion cultivar.
- Added manual latitude/longitude entry as a fallback when browser geolocation is blocked or unavailable.
- Added a CIMIS weather button using active CIMIS Station 206, Denair II.
- Added weather-source and station displays.
- Added `CIMIS_APP_KEY` as a new Vercel environment variable.

### Google Sheet columns to add

To preserve the new metadata without replacing the existing workbook, append:

- `Production_Region` to the end of the `Samples` header row.
- `Weather_Source`, `CIMIS_Station_ID`, and `CIMIS_Station_Name` to the end of the `Predictions` header row.

The existing Apps Script reads headers dynamically, so no Apps Script code change is required after those columns are added.
