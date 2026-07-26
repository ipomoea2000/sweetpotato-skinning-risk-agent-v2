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
