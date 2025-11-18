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

    const commands = parseCommands(rest);
    if (commands.length === 0) {
      console.log("ℹ️ No commands found in rest.");
    } else {
      console.log(`📝 Found ${commands.length} command(s):`, commands.map(c => c.type).join("; "));
    }

    commands.forEach(cmd => {
      switch (cmd.type) {
        case "HEADING":
          setHeading(cmd.words, selectedPlane, updatePlaneInfo);
          break;
        case "SPEED":
          setSpeed(cmd.words, selectedPlane, updatePlaneInfo);
          break;
        case "LEVEL":
        case "ALTITUDE":
          setAltitude(cmd.words, selectedPlane, updatePlaneInfo, cmd.type);
          break;
        default:
          console.log("⚙️ Unknown command type:", cmd.type);
      }
    });
  };

  recognition.onerror = (event) => {
    //console.warn("Speech recognition error:", event.error); uncoment then
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


function parseCommands(restText) {
  const commandKeys = ["HEADING", "SPEED", "LEVEL", "ALTITUDE"];
  const words = restText.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const commands = [];

  //console.log("🧩 parseCommands(): входные слова →", words);

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toUpperCase();

    if (commandKeys.includes(word)) {
      const type = word;
      const commandWords = [];
      i++;

      // Собираем все слова до следующего ключевого слова
      while (i < words.length && !commandKeys.includes(words[i].toUpperCase())) {
        commandWords.push(words[i]);
        i++;
      }
      i--; // откатываем, чтобы не пропустить следующий ключ
      commands.push({ type, words: commandWords });
    }
  }

  console.log("🔍 Найдено команд →", commands);
  return commands;
}

function setHeading(words, selectedPlane, updatePlaneInfo) {
  if (!selectedPlane) return;
  const heading = convertWordsToDigits(words) % 360;
  if (heading !== null && heading >= 0 && heading < 360) {
    selectedPlane.setAngle = heading;
    updatePlaneInfo(selectedPlane);
    console.log(`✅ HEADING ${heading}° for ${selectedPlane.callsign}`);
  } else console.warn("⚠️ Invalid heading:", heading);
}

function setAltitude(words, selectedPlane, updatePlaneInfo, type) {

  const types = {
    LEVEL: { max: 660, factor: 100, unit: "FL" },
    ALTITUDE: { max: 6000, factor: 1, unit: "feet" }
  };

  const cfg = types[type];
  if (!cfg) return console.warn("⚠️ Unknown altitude type:", type);

  const altitude = convertWordsToDigits(words);
  if (altitude !== null && altitude >= 0 && altitude < cfg.max) {
    selectedPlane.targetAltitude = altitude * cfg.factor;
    updatePlaneInfo(selectedPlane);
    console.log(`✅ Set ${cfg.unit} ${altitude} for ${selectedPlane.callsign}`);
  } else {
    console.warn("⚠️ Invalid altitude:", altitude);
  }
}

function setSpeed(words, selectedPlane, updatePlaneInfo) {

  if (!selectedPlane) return;
  const speed = convertWordsToDigits(words);
  if (speed !== null && speed >= globals.MIN_SPEED_KPH && speed < globals.MAX_SPEED_KPH) {
    selectedPlane.targetSpeed = speed;
    updatePlaneInfo(selectedPlane);
    console.log(`✅ SPEED ${speed} km/h for ${selectedPlane.callsign}`);
  } else console.warn("⚠️ Invalid speed:", speed);
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