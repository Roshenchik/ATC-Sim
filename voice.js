import { globals } from './globals.js'; // planes, selectedPlane, updatePlaneInfo

const planes = globals.planes;
let selectedPlane = globals.selectedPlane;
const updatePlaneInfo = globals.updatePlaneInfo;

// =======================
// === VOICE CONTROL ====
// =======================

if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
  console.warn("Speech Recognition API not supported in this browser.");
} else {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = 'en-US'; // Позывные читаются по-английски
  recognition.continuous = true;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim().toUpperCase().replace(/\s+/g, '');
    console.log("🎤 Heard:", transcript);

    // Ищем похожий позывной
    for (const plane of planes) {
      if (transcript.includes(plane.callsign)) {
        selectPlaneByVoice(plane);
        break;
      }
    }
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
  };

  recognition.onend = () => {
    // перезапуск для постоянного прослушивания
    recognition.start();
  };

  // запуск прослушивания
  recognition.start();
}

function selectPlaneByVoice(plane) {
  planes.forEach(p => p.selected = false);
  plane.selected = true;
  selectedPlane = plane;
  updatePlaneInfo(plane);
  console.log(`🎯 Selected via voice: ${plane.callsign}`);
}
