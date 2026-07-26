const SPREADSHEET_ID = "PASTE_GOOGLE_SHEET_ID_HERE";
const DRIVE_FOLDER_ID = "PASTE_GOOGLE_DRIVE_FOLDER_ID_HERE";
const SHARED_SECRET = "PASTE_A_LONG_RANDOM_SHARED_SECRET_HERE";

function json_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  if (e.parameter.secret !== SHARED_SECRET) {
    return json_({ ok:false, error:"Unauthorized" });
  }
  if (e.parameter.action === "dashboard") {
    return json_({ ok:true, dashboard:getDashboard_() });
  }
  return json_({ ok:true, message:"Skin prediction and validation database endpoint" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || "{}");
    if (data.secret !== SHARED_SECRET) {
      return json_({ ok:false, error:"Unauthorized" });
    }

    if (data.action === "saveSampleAndPrediction") {
      appendByHeaders_("Samples", data.record.sample);
      appendByHeaders_("Predictions", data.record.prediction);
      return json_({ ok:true, message:"Sample and prediction saved." });
    }

    if (data.action === "saveValidation") {
      appendByHeaders_("Validation", data.record);
      return json_({ ok:true, message:"Validation saved." });
    }

    if (data.action === "uploadPhoto") {
      return json_(uploadPhoto_(data.record));
    }

    return json_({ ok:false, error:"Unknown action" });
  } catch (error) {
    return json_({ ok:false, error:String(error) });
  }
}

function appendByHeaders_(sheetName, record) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error("Missing sheet: " + sheetName);
  }

  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  const row = headers.map(header =>
    record[header] !== undefined ? record[header] : ""
  );

  sheet.appendRow(row);
  return sheet.getLastRow();
}

function uploadPhoto_(record) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const bytes = Utilities.base64Decode(record.Base64_Data);
  const blob = Utilities.newBlob(
    bytes,
    record.Mime_Type || "image/jpeg",
    record.File_Name || "photo.jpg"
  );

  const file = folder.createFile(blob);
  file.setDescription(record.Caption || "");

  appendByHeaders_("Images", {
    Image_ID: record.Image_ID,
    Sample_ID: record.Sample_ID,
    Upload_Timestamp: new Date(),
    Image_Type: record.Image_Type,
    Google_Drive_URL: file.getUrl(),
    Google_Drive_File_ID: file.getId(),
    File_Name: record.File_Name,
    Uploaded_By: record.Uploaded_By,
    Caption: record.Caption,
    Notes: record.Notes
  });

  return {
    ok:true,
    message:"Photo uploaded.",
    url:file.getUrl(),
    fileId:file.getId()
  };
}

function getRows_(sheetName) {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    return { headers:[], rows:[] };
  }

  const values = sheet.getDataRange().getValues();
  return { headers:values[0], rows:values.slice(1) };
}

function getDashboard_() {
  const samples = getRows_("Samples");
  const predictions = getRows_("Predictions");
  const validations = getRows_("Validation");
  const images = getRows_("Images");

  const sampleIdIndex = samples.headers.indexOf("Sample_ID");
  const predictionSampleIndex = predictions.headers.indexOf("Sample_ID");
  const validationSampleIndex = validations.headers.indexOf("Sample_ID");
  const predictedClassIndex = predictions.headers.indexOf("Predicted_Risk_Class");
  const observedClassIndex = validations.headers.indexOf("Observed_Skinning_Class");

  const sampleRows = samples.rows.filter(row => row[sampleIdIndex]);
  const predictionRows = predictions.rows.filter(row => row[predictionSampleIndex]);
  const validationRows = validations.rows.filter(row => row[validationSampleIndex]);
  const imageRows = images.rows.filter(row => row[images.headers.indexOf("Sample_ID")]);

  const validationMap = {};
  validationRows.forEach(row => {
    validationMap[String(row[validationSampleIndex])] = row;
  });

  let paired = 0;
  let matches = 0;

  predictionRows.forEach(row => {
    const sampleId = String(row[predictionSampleIndex]);
    const validation = validationMap[sampleId];
    if (!validation) return;

    paired++;
    const predicted = String(row[predictedClassIndex]);
    const observed = String(validation[observedClassIndex]);
    if (predicted && observed && predicted === observed) matches++;
  });

  return {
    samples:sampleRows.length,
    predictions:predictionRows.length,
    validations:validationRows.length,
    paired,
    accuracy:paired ? matches/paired : null,
    images:imageRows.length
  };
}
