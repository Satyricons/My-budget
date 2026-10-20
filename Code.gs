
## 📄 Файл: `apps-script/Code.gs`

```javascript
/*====================================================================================================================================*
  ImportJSON by Brad Jasper and Trevor Lohrbeer
  ====================================================================================================================================
  Version:      1.5.0
  Project Page: https://github.com/bradjasper/ImportJSON
  Copyright:    (c) 2017-2019 by Brad Jasper
                (c) 2012-2017 by Trevor Lohrbeer
  License:      GNU General Public License, version 3 (GPL-3.0) 
                http://www.opensource.org/licenses/gpl-3.0.html
  ------------------------------------------------------------------------------------------------------------------------------------
  A library for importing JSON feeds into Google spreadsheets.
 *====================================================================================================================================*/

function ImportJSON(url, query, parseOptions) {
  return ImportJSONAdvanced(url, null, query, parseOptions, includeXPath_, defaultTransform_);
}

function ImportJSONViaPost(url, payload, fetchOptions, query, parseOptions) {
  var postOptions = parseToObject_(fetchOptions);
  
  if (postOptions["method"] == null) postOptions["method"] = "POST";
  if (postOptions["payload"] == null) postOptions["payload"] = payload;
  if (postOptions["contentType"] == null) postOptions["contentType"] = "application/x-www-form-urlencoded";

  convertToBool_(postOptions, "validateHttpsCertificates");
  convertToBool_(postOptions, "useIntranet");
  convertToBool_(postOptions, "followRedirects");
  convertToBool_(postOptions, "muteHttpExceptions");
  
  return ImportJSONAdvanced(url, postOptions, query, parseOptions, includeXPath_, defaultTransform_);
}

function ImportJSONFromSheet(sheetName, query, options) {
  var object = getDataFromNamedSheet_(sheetName);
  return parseJSONObject_(object, query, options, includeXPath_, defaultTransform_);
}

function ImportJSONAdvanced(url, fetchOptions, query, parseOptions, includeFunc, transformFunc) {
  var jsondata = UrlFetchApp.fetch(url, fetchOptions);
  var object   = JSON.parse(jsondata.getContentText());
  return parseJSONObject_(object, query, parseOptions, includeFunc, transformFunc);
}

function ImportJSONBasicAuth(url, username, password, query, parseOptions) {
  var encodedAuthInformation = Utilities.base64Encode(username + ":" + password);
  var header = {headers: {Authorization: "Basic " + encodedAuthInformation}};
  return ImportJSONAdvanced(url, header, query, parseOptions, includeXPath_, defaultTransform_);
}

function URLEncode(value) {
  return encodeURIComponent(value.toString());  
}

function parseJSONObject_(object, query, options, includeFunc, transformFunc) {
  var headers = new Array();
  var data    = new Array();
  
  if (query && !Array.isArray(query) && query.toString().indexOf(",") != -1) {
    query = query.toString().split(",");
  }

  if (hasOption_(options, "allHeaders") && Array.isArray(query)) {
    for (var i = 0; i < query.length; i++) {
      headers[query[i]] = Object.keys(headers).length;
    }
  }
  
  if (options) options = options.toString().split(",");
    
  parseData_(headers, data, "", {rowIndex: 1}, object, query, options, includeFunc);
  parseHeaders_(headers, data);
  transformData_(data, options, transformFunc);
  
  return hasOption_(options, "noHeaders") ? (data.length > 1 ? data.slice(1) : new Array()) : data;
}

function parseData_(headers, data, path, state, value, query, options, includeFunc) {
  var dataInserted = false;

  if (Array.isArray(value) && isObjectArray_(value)) {
    for (var i = 0; i < value.length; i++) {
      if (parseData_(headers, data, path, state, value[i], query, options, includeFunc)) {
        dataInserted = true;
        if (data[state.rowIndex]) state.rowIndex++;
      }
    }
  } else if (isObject_(value)) {
    for (key in value) {
      if (parseData_(headers, data, path + "/" + key, state, value[key], query, options, includeFunc)) {
        dataInserted = true; 
      }
    }
  } else if (!includeFunc || includeFunc(query, path, options)) {
    if (Array.isArray(value)) value = value.join(); 
    if (!data[state.rowIndex]) data[state.rowIndex] = new Array();
    if (!headers[path] && headers[path] != 0) headers[path] = Object.keys(headers).length;
    data[state.rowIndex][headers[path]] = value;
    dataInserted = true;
  }
  
  return dataInserted;
}

function parseHeaders_(headers, data) {
  data[0] = new Array();
  for (key in headers) {
    data[0][headers[key]] = key;
  }
}

function transformData_(data, options, transformFunc) {
  for (var i = 0; i < data.length; i++) {
    for (var j = 0; j < data[0].length; j++) {
      transformFunc(data, i, j, options);
    }
  }
}

function isObject_(test) {
  return Object.prototype.toString.call(test) === '[object Object]';
}

function isObjectArray_(test) {
  for (var i = 0; i < test.length; i++) {
    if (isObject_(test[i])) return true; 
  }  
  return false;
}

function includeXPath_(query, path, options) {
  if (!query) return true; 
  else if (Array.isArray(query)) {
    for (var i = 0; i < query.length; i++) {
      if (applyXPathRule_(query[i], path, options)) return true; 
    }  
  } else return applyXPathRule_(query, path, options);
  
  return false; 
};

function applyXPathRule_(rule, path, options) {
  return path.indexOf(rule) == 0; 
}

function defaultTransform_(data, row, column, options) {
  if (data[row][column] == null) {
    if (row < 2 || hasOption_(options, "noInherit")) data[row][column] = "";
    else data[row][column] = data[row-1][column];
  } 

  if (!hasOption_(options, "rawHeaders") && row == 0) {
    if (column == 0 && data[row].length > 1) removeCommonPrefixes_(data, row);  
    data[row][column] = toTitleCase_(data[row][column].toString().replace(/[\/\_]/g, " "));
  }
  
  if (!hasOption_(options, "noTruncate") && data[row][column]) {
    data[row][column] = data[row][column].toString().substr(0, 256);
  }

  if (hasOption_(options, "debugLocation")) {
    data[row][column] = "[" + row + "," + column + "]" + data[row][column];
  }
}

function removeCommonPrefixes_(data, row) {
  var matchIndex = data[row][0].length;
  for (var i = 1; i < data[row].length; i++) {
    matchIndex = findEqualityEndpoint_(data[row][i-1], data[row][i], matchIndex);
    if (matchIndex == 0) return;
  }
  for (var i = 0; i < data[row].length; i++) {
    data[row][i] = data[row][i].substring(matchIndex, data[row][i].length);
  }
}

function findEqualityEndpoint_(string1, string2, stopAt) {
  if (!string1 || !string2) return -1; 
  var maxEndpoint = Math.min(stopAt, string1.length, string2.length);
  for (var i = 0; i < maxEndpoint; i++) {
    if (string1.charAt(i) != string2.charAt(i)) return i;
  }
  return maxEndpoint;
}

function toTitleCase_(text) {
  if (text == null) return null;
  return text.replace(/\w\S*/g, function(word) { return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase(); });
}

function hasOption_(options, option) {
  return options && options.indexOf(option) >= 0;
}

function parseToObject_(text) {
  var map = new Object();
  var entries = (text != null && text.trim().length > 0) ? text.toString().split(",") : new Array();
  for (var i = 0; i < entries.length; i++) addToMap_(map, entries[i]);  
  return map;
}

function addToMap_(map, entry) {
  var equalsIndex = entry.indexOf("=");  
  var key = (equalsIndex != -1) ? entry.substring(0, equalsIndex) : entry;
  var value = (key.length + 1 < entry.length) ? entry.substring(key.length + 1) : "";
  map[key.trim()] = value;
}

function toBool_(value) {
  return value == null ? false : (value.toString().toLowerCase() == "true" ? true : false);
}

function convertToBool_(map, key) {
  if (map[key] != null) map[key] = toBool_(map[key]);
}

function getDataFromNamedSheet_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var source = ss.getSheetByName(sheetName);
  var jsonRange = source.getRange(1,1,source.getLastRow());
  var jsonValues = jsonRange.getValues();
  var jsonText = "";
  for (var row in jsonValues) {
    for (var col in jsonValues[row]) jsonText +=jsonValues[row][col];
  }
  Logger.log(jsonText);
  return JSON.parse(jsonText);
}

/* ============================================================
   ВЕБ-ПРИЛОЖЕНИЕ: doGet
   ============================================================ */

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Лист1') || ss.getActiveSheet();

    if (!sheet) throw new Error('Лист не найден');

    Logger.log('=== doGet ===');
    Logger.log('params.action: ' + params.action);
    Logger.log('params.amount: ' + params.amount);

    if (params.action === 'addTransaction') {
      Logger.log('>>> Добавление новой транзакции');

      const data = sheet.getDataRange().getValues();
      let headerRow = -1;

      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
          if (String(data[i][j] || '').trim() === 'Транзакции') {
            headerRow = i + 1;
            Logger.log('Найдена строка "Транзакции" в строке ' + headerRow + ', колонке ' + j);
            break;
          }
        }
        if (headerRow !== -1) break;
      }

      if (headerRow === -1) {
        Logger.log('❌ Строка "Транзакции" не найдена!');
        throw new Error('Не найдена строка "Транзакции"');
      }

      let maxId = 0;
      let lastRow = headerRow;

      for (let i = headerRow; i < data.length; i++) {
        const id = parseInt(data[i][0]);
        if (!isNaN(id) && id > maxId) {
          maxId = id;
          lastRow = i + 1;
        }
      }

      const amount = parseFloat(params.amount) || 0;
      const newId = maxId + 1;

      const now = new Date();
      const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      const newRow = lastRow + 1;
      sheet.getRange(newRow, 1).setValue(newId);
      sheet.getRange(newRow, 2).setValue(formattedDate);
      sheet.getRange(newRow, 3).setValue(amount);

      Logger.log('✅ Добавлено: ID=' + newId + ', row=' + newRow + ', amount=' + amount);

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          message: 'Транзакция добавлена',
          id: newId,
          row: newRow,
          amount: amount,
          date: formattedDate
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log('>>> Обычное чтение данных');
    const data = sheet.getDataRange().getValues();

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: data,
        sheetName: sheet.getName(),
        totalRows: data.length,
        totalCols: data[0] ? data[0].length : 0
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('❌ Ошибка: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ============================================================
   ВЕБ-ПРИЛОЖЕНИЕ: doPost
   ============================================================ */

function doPost(e) {
  try {
    let params;
    
    if (e.postData && e.postData.type === 'application/json') {
      params = JSON.parse(e.postData.contents);
    } else {
      params = e.parameter || {};
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(params.sheetName || 'Лист1');

    if (!sheet) throw new Error('Лист не найден');

    if (params.action === 'addTransaction') {
      const data = sheet.getDataRange().getValues();
      let headerRow = -1;

      for (let i = 0; i < data.length; i++) {
        for (let j = 0; j < data[i].length; j++) {
          if (String(data[i][j] || '').trim() === 'Транзакции') {
            headerRow = i + 1;
            break;
          }
        }
        if (headerRow !== -1) break;
      }

      if (headerRow === -1) throw new Error('Не найдена строка "Транзакции"');

      let maxId = 0;
      let lastRow = headerRow;

      for (let i = headerRow; i < data.length; i++) {
        const id = parseInt(data[i][0]);
        if (!isNaN(id) && id > maxId) {
          maxId = id;
          lastRow = i + 1;
        }
      }

      const amount = parseFloat(params.amount) || 0;
      const newId = maxId + 1;

      const now = new Date();
      const formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

      const newRow = lastRow + 1;
      sheet.getRange(newRow, 1).setValue(newId);
      sheet.getRange(newRow, 2).setValue(formattedDate);
      sheet.getRange(newRow, 3).setValue(amount);

      return ContentService
        .createTextOutput(JSON.stringify({
          success: true,
          message: 'Транзакция добавлена',
          id: newId,
          row: newRow,
          amount: amount,
          date: formattedDate
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    throw new Error('Неизвестное действие: ' + params.action);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}