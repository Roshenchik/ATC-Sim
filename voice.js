import { globals } from './globals.js'; // planes, selectedPlane, updatePlaneInfo

const planes = globals.planes;
let selectedPlane = globals.selectedPlane;
const updatePlaneInfo = globals.updatePlaneInfo;

  const natoMap = {
    ALFA: "A", ALPHA: "A",
    BRAVO: "B",
    CHARLIE: "C", CHARLY: "C",
    DELTA: "D",
    ECHO: "E",
    FOXTROT: "F", FOX: "F",
    GOLF: "G",
    HOTEL: "H",
    INDIA: "I",
    JULIET: "J", JULIETT: "J",
    KILO: "K",
    LIMA: "L",
    MIKE: "M",
    NOVEMBER: "N",
    OSCAR: "O",
    PAPA: "P",
    QUEBEC: "Q", QUEBECK: "Q", QUEBIC: "Q",
    ROMEO: "R",
    SIERRA: "S",
    TANGO: "T",
    UNIFORM: "U",
    VICTOR: "V",
    WHISKEY: "W", WHISKY: "W",
    XRAY: "X", "X-RAY": "X", X_RAY: "X",
    YANKEE: "Y",
    ZULU: "Z",
  };
  const numMap = {
    ZERO: "0", ONE: "1", TWO: "2", THREE: "3", FOUR: "4",
    FIVE: "5", SIX: "6", SEVEN: "7", EIGHT: "8", NINE: "9",
    NINER: "9"
  };

  import { callsignAliasesJoined } from './callsignAliases.js';


// =======================
// === VOICE CONTROL ====
// =======================

if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
  console.warn("Speech Recognition API not supported in this browser.");
} else {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = 'en-US';
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const raw = event.results[event.results.length - 1][0].transcript.trim().toUpperCase();
    console.log("🎤 Heard:", raw);

    let workingText = raw;

    const { callsign, rest } = extractCallsign(workingText);
    console.log("📡 Parsed callsign:", callsign, "| Rest:", rest);

    if (!callsign) return;

    // Ищем совпадение с позывным в списке самолётов
    const plane = planes.find(p => p.callsign === callsign);
    if (plane) {
      selectPlaneByVoice(plane);
      console.log(`🎯 Selected via voice: ${plane.callsign}`);
    } else {
      console.warn(`No plane found with callsign: ${callsign}`);
    }

    setHeading(rest, selectedPlane, updatePlaneInfo);
    setAltitude(rest, selectedPlane, updatePlaneInfo);
    setSpeed(rest, selectedPlane, updatePlaneInfo);
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
  };

  recognition.onend = () => {
    recognition.start(); // автоперезапуск
  };

  recognition.start();
}

// =======================
// === SELECT PLANE ====
// =======================
function selectPlaneByVoice(plane) {
  planes.forEach(p => p.selected = false);
  plane.selected = true;
  globals.selectedPlane = plane;
  selectedPlane = plane;
  if (updatePlaneInfo) updatePlaneInfo(plane);
}

// =======================
// === PARSE CALLSIGN ===
// =======================
function extractCallsign(text) {
  if (!text) return { callsign: "", rest: "" };

  const words = text.trim().toUpperCase().split(/\s+/);

  let airlineLetters = "";
  let flightNumbers = "";
  let i = 0;

  // === собираем буквы (включая нато) до первой цифры ===
  while (i < words.length && (natoMap[words[i]] || /^[A-Z]+$/.test(words[i]))) {
    airlineLetters += natoMap[words[i]] || words[i];
    i++;
    if (i < words.length && (numMap[words[i]] || /\d/.test(words[i]))) break;
  }
  airlineLetters = callsignAliasesJoined[airlineLetters] || airlineLetters; // заменяем на алиас, если есть

  // === собираем цифры ===
  while (i < words.length && (numMap[words[i]] || /\d/.test(words[i]))) {
    flightNumbers += numMap[words[i]] || words[i];
    i++;
  }

  const callsign = airlineLetters + flightNumbers;
  const rest = words.slice(i).join(" ");

  return { callsign, rest };
}

function setHeading(comandText, selectedPlane, updatePlaneInfo) {
    if (selectedPlane && comandText.includes("HEADING")) {
    const headingPart = comandText.split("HEADING")[1].trim().split(/\s+/);
    
    const newHeading = convertWordsToDigits(headingPart);
    if (newHeading === null) { console.warn("No heading digits found"); return; }

    if (newHeading >= 0 && newHeading < 360) {
      selectedPlane.setAngle = newHeading;
      updatePlaneInfo(selectedPlane);
      console.log(`✅ Set heading ${newHeading}° for ${selectedPlane.callsign}`);
    } else {
      console.warn("⚠️ Invalid heading:", newHeading);
    }
  }
}

function setAltitude(comandText, selectedPlane, updatePlaneInfo) {
    if (selectedPlane && comandText.includes("LEVEL")) {
    const altitudePart = comandText.split("LEVEL")[1].trim().split(/\s+/);
    
    const newFL = convertWordsToDigits(altitudePart);
    if (newFL === null) { console.warn("No altitudes digits found"); return; }

    if (newFL >= 0 && newFL < 660) {
      selectedPlane.targetAltitude = newFL * 100;
      updatePlaneInfo(selectedPlane);
      console.log(`✅ Set FL ${newFL} for ${selectedPlane.callsign}`);
    } else {
      console.warn("⚠️ Invalid FL:", newFL);
    }
  }

    if (selectedPlane && comandText.includes("ALTITUDE")) {
    const altitudePart = comandText.split("ALTITUDE")[1].trim().split(/\s+/);
    
    const newAltitude = convertWordsToDigits(altitudePart);
    if (newAltitude === null) { console.warn("No altitudes digits found"); return; }

    if (newAltitude >= 0 && newAltitude < 6000) {
      selectedPlane.targetAltitude = newAltitude;
      updatePlaneInfo(selectedPlane);
      console.log(`✅ Set altitude ${newAltitude} for ${selectedPlane.callsign}`);
    } else {
      console.warn("⚠️ Invalid altitude:", newAltitude);
    }
  }
}

function setSpeed(comandText, selectedPlane, updatePlaneInfo) {
    if (selectedPlane && comandText.includes("SPEED")) {
    const speedPart = comandText.split("SPEED")[1].trim().split(/\s+/);
    
    const newSpeed = convertWordsToDigits(speedPart);
    if (newSpeed === null) { console.warn("No speed digits found"); return; }

    if (newSpeed >= globals.MIN_SPEED_KPH && newSpeed < globals.MAX_SPEED_KPH) {
      selectedPlane.targetSpeed = newSpeed;
      updatePlaneInfo(selectedPlane);
      console.log(`✅ Set speed ${newSpeed} km/h for ${selectedPlane.callsign}`);
    } else {
      console.warn("⚠️ Invalid speed:", newSpeed);
    }
  }
}

function convertWordsToDigits(wordsArray) {
  if (!Array.isArray(wordsArray)) return null;
  let result = "";
  for (const word of wordsArray) {
     word.replace(/[.,]/g, ""); // удаляем запятые и точки

    if (numMap[word]) {
      result += numMap[word]; // NATO слово → цифра
    } 
    else if (/^\d+$/.test(word)) {
      result += word; // чисто цифровое слово → добавляем как есть
    }
    else if (/^\d+[.,]?$/.test(word)) {
      result += word.replace(/[.,]/g, ""); // например "180," или "180." → "180"
    }
  }
  if (result.length === 0) return null;
  return parseInt(result, 10);
}