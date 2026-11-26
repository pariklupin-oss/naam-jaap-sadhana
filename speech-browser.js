(() => {
"use strict";
const button = byId("speech");
const menu = byId("mantra");
const customButton = byId("saveMantra");
let modelPromise, session, busy = false;

function loadModel() {
  if (modelPromise) return modelPromise;
  modelPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./speech/vosk.js";
    script.onload = () => window.Vosk.createModel(new URL("./speech/hindi.tar.gz", location.href).href, -1).then(resolve, reject);
    script.onerror = reject;
    document.head.append(script);
  }).catch(error => { modelPromise = null; throw error; });
  return modelPromise;
}

function grammar(mantra, phrase) {
  const phraseText = phrase.join(" ");
  const options = new Set([mantra, phraseText, ...phrase, "[unk]"]);
  if (phrase.length <= 32) options.add(Array(3).fill(phraseText).join(" "));
  if (phrase.length <= 12) options.add(Array(8).fill(phraseText).join(" "));
  if (phraseText === "सीता राम") {
    options.add("सीताराम");
    options.add(Array(8).fill("सीताराम").join(" "));
    options.add("सीताराम सीता राम सीताराम सीता राम");
  }
  if (phraseText === "राम राम") {
    options.add("रामराम");
    options.add("रामराम रामराम रामराम रामराम");
    options.add("राम रामराम राम");
  }
  return JSON.stringify([...options]);
}

function release(current) {
  if (current.processor) {
    current.processor.onaudioprocess = null;
    current.processor.disconnect();
  }
  current.source?.disconnect();
  current.stream?.getTracks().forEach(track => track.stop());
  current.context?.close().catch(() => {});
}

function unlock() {
  busy = false;
  button.disabled = false;
  button.textContent = "ऑफलाइन वॉइस गिनती";
  menu.disabled = false;
  customButton.disabled = false;
}

function stop() {
  const current = session;
  if (!current) return;
  session = null;
  release(current);
  current.recognizer.retrieveFinalResult();
  setTimeout(() => current.recognizer.remove(), 1000);
  unlock();
  voiceStatus("वॉइस गिनती बंद है।");
}

button.onclick = async () => {
  if (session) { stop(); return; }
  if (busy) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
    voiceStatus("माइक उपलब्ध नहीं है। ऐप का HTTPS लिंक सामान्य ब्राउज़र में खोलें।");
    return;
  }
  const selected = state.mantra;
  const phrase = voiceWords(selected);
  if (!phrase.length) return;
  busy = true;
  button.disabled = true;
  menu.disabled = true;
  customButton.disabled = true;
  voiceStatus("पहली बार हिंदी मॉडल तैयार हो रहा है। लगभग 43 MB डाउनलोड हो सकते हैं।");
  const current = {};
  try {
    current.context = new AudioContext();
    await current.context.resume();
    const model = await loadModel();
    voiceStatus("हिंदी मॉडल तैयार है। ब्राउज़र पूछे तो माइक की अनुमति दें।");
    current.stream = await navigator.mediaDevices.getUserMedia({audio:{channelCount:1}});
    current.recognizer = new model.KaldiRecognizer(current.context.sampleRate, grammar(selected, phrase));
    current.source = current.context.createMediaStreamSource(current.stream);
    current.processor = current.context.createScriptProcessor(2048, 1, 1);
    let tail = [];
    current.recognizer.on("result", event => {
      if (state.mantra !== selected) return;
      let count = 0;
      const tokens = voiceWords((event.result?.text || "").replace(/\[unk\]/g, " अस्पष्ट "));
      for (const token of tokens) {
        tail.push(token);
        if (tail.length > phrase.length) tail.shift();
        if (tail.length === phrase.length && tail.every((v,i) => v === phrase[i])) {
          count++; tail = [];
        }
      }
      if (count) change(count);
    });
    current.processor.onaudioprocess = event => {
      if (session === current) current.recognizer.acceptWaveform(event.inputBuffer);
    };
    current.source.connect(current.processor);
    current.processor.connect(current.context.destination);
    session = current;
    button.disabled = false;
    button.textContent = "वॉइस गिनती रोकें";
    voiceStatus("हिंदी पहचान इसी फ़ोन पर चल रही है।");
  } catch (error) {
    release(current);
    current.recognizer?.remove();
    unlock();
    voiceStatus(error?.name === "NotAllowedError" ? "ब्राउज़र में माइक की अनुमति दें।" : "हिंदी मॉडल या माइक शुरू नहीं हो सका। फिर कोशिश करें।");
  }
};
window.addEventListener("pagehide", stop);
})();
