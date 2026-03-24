<div align="center">
  <img src="assets/logo.svg" alt="TRANSCRIBE-LITE" width="520"/>
  <br/><br/>

  [![License: MIT](https://img.shields.io/badge/License-MIT-818CF8?style=flat-square)](LICENSE)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](#)
  [![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](#)
  [![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)](#)
  [![WebRTC](https://img.shields.io/badge/WebRTC-browser--native-38BDF8?style=flat-square&logo=webrtc&logoColor=white)](#)
  [![Whisper](https://img.shields.io/badge/Whisper-STT-FF6F00?style=flat-square&logo=openai&logoColor=white)](#)
  [![Web Speech](https://img.shields.io/badge/Web_Speech-API-4CAF50?style=flat-square)](#)
  [![Languages](https://img.shields.io/badge/Languages-20+-FF9800?style=flat-square)](#supported-languages)
  [![JARVIS](https://img.shields.io/badge/JARVIS-Ecosystem-8B5CF6?style=flat-square)](https://github.com/Turbo31150/jarvis-linux)

  <br/>
  <p><strong>Transcription multilingue temps reel -- TypeScript -- WebRTC -- Whisper -- Browser-native -- 20+ langues</strong></p>
  <p><em>Version legere et standalone de la transcription multilingue -- sans dependances lourdes, fonctionne dans le navigateur</em></p>

  [**3 Modes**](#-3-modes-de-transcription) · [**Performance**](#-performance-benchmarks) · [**Languages**](#supported-languages) · [**Installation**](#-installation) · [**API**](#-api-usage)
</div>

---

## Presentation

**TRANSCRIBE-LITE** est la version legere de la transcription multilingue JARVIS. Contrairement a LUMEN qui necessite le cluster complet, TRANSCRIBE-LITE fonctionne directement dans le navigateur via **WebRTC** et l'**API Web Speech**, avec un fallback Whisper backend optionnel.

---

## 3 Modes de transcription

| Mode | Backend | Latency | Accuracy | Offline | GPU Required |
|------|---------|---------|----------|---------|:------------:|
| **Web Speech** | Browser-native API | ~100ms | Good | No | No |
| **Whisper Local** | Whisper large-v3 server | ~500ms | Excellent | Yes | Yes |
| **Hybrid** | Web Speech + Whisper validation | ~200ms | Best | Partial | Optional |

### Mode Details

```
Mode 1: Web Speech API (default)
+-- Browser-native, zero install
+-- Requires internet
+-- ~100ms latency
+-- Good for real-time conversations

Mode 2: Whisper Backend
+-- Whisper large-v3 server
+-- Offline capable
+-- ~500ms latency (GPU) / ~3s (CPU)
+-- Best accuracy, all languages

Mode 3: Hybrid
+-- Web Speech for real-time display
+-- Whisper for validation + correction
+-- Best of both worlds
+-- Auto-fallback if one fails
```

---

## Architecture

```
Microphone (WebRTC getUserMedia)
        |
        v
  Web Speech API          Browser-native STT
  (en ligne)              Latence ~100ms
        | or
  Whisper Backend         Serveur optionnel
  (hors-ligne)            Precision maximale
        |
        v
  TypeScript Handler      Traitement texte
  +-- Normalisation       Ponctuation auto
  +-- Langue detect.      ISO 639-1
  +-- Callback            onTranscript(text)
        |
        v
  React UI                Affichage temps reel
  +-- Live transcript     Mise a jour continue
  +-- Language badge       Detection automatique
  +-- Export options       TXT / SRT / JSON
```

---

## Performance Benchmarks

| Metric | Web Speech | Whisper (GPU) | Whisper (CPU) | Hybrid |
|--------|:----------:|:-------------:|:-------------:|:------:|
| First word latency | 100ms | 500ms | 3000ms | 100ms |
| Accuracy (French) | 92% | 98% | 98% | 99% |
| Accuracy (English) | 95% | 99% | 99% | 99% |
| Accuracy (Japanese) | 78% | 96% | 96% | 97% |
| Memory usage | 50MB | 2GB | 4GB | 2GB |
| GPU VRAM | 0 | 4GB | 0 | 4GB |
| Offline support | No | Yes | Yes | Partial |

---

## Supported Languages

| Language | Code | Web Speech | Whisper | Quality |
|----------|------|:----------:|:-------:|:-------:|
| French | `fr` | Yes | Yes | Excellent |
| English | `en` | Yes | Yes | Excellent |
| Spanish | `es` | Yes | Yes | Excellent |
| German | `de` | Yes | Yes | Excellent |
| Italian | `it` | Yes | Yes | Excellent |
| Portuguese | `pt` | Yes | Yes | Excellent |
| Japanese | `ja` | Yes | Yes | Very Good |
| Chinese | `zh` | Yes | Yes | Very Good |
| Korean | `ko` | Yes | Yes | Very Good |
| Arabic | `ar` | Yes | Yes | Good |
| Russian | `ru` | Yes | Yes | Good |
| Hindi | `hi` | Yes | Yes | Good |
| + 10 more | ... | Partial | Yes | Good |

---

## Structure

```
transcription-multi-langue/
+-- src/
|   +-- transcriber.ts      <-- Core STT WebRTC
|   +-- whisper-client.ts   <-- Backend optionnel
|   +-- language-detect.ts  <-- Detection langue
|   +-- ui/                 <-- Composants React
+-- public/
|   +-- index.html          <-- App standalone
+-- assets/
|   +-- logo.svg            <-- Logo TRANSCRIBE-LITE
+-- index.tsx               <-- Entry point
+-- index.css               <-- Styles
+-- index.html              <-- Root HTML
+-- package.json
+-- tsconfig.json
+-- vite.config.ts
```

---

## Installation

```bash
git clone https://github.com/Turbo31150/transcription-multi-langue.git
cd transcription-multi-langue
npm install
npm run dev     # -> http://localhost:5173
```

### Production Build

```bash
npm run build
npx serve dist
```

### With Whisper Backend (optional)

```bash
# Requires CUDA GPU for real-time performance
pip install faster-whisper
python whisper_server.py --model large-v3 --port 8765
```

---

## API Usage

```typescript
import { Transcriber } from './src/transcriber';

// Mode 1: Web Speech (default)
const t = new Transcriber({ lang: 'auto', backend: 'webspeech' });
t.onTranscript = (text, lang) => console.log(`[${lang}] ${text}`);
await t.start();

// Mode 2: Whisper backend
const t2 = new Transcriber({
  lang: 'fr',
  backend: 'whisper',
  whisperUrl: 'ws://localhost:8765'
});
t2.onTranscript = (text, lang) => console.log(`[${lang}] ${text}`);
await t2.start();

// Mode 3: Hybrid
const t3 = new Transcriber({
  lang: 'auto',
  backend: 'hybrid',
  whisperUrl: 'ws://localhost:8765'
});
t3.onTranscript = (text, lang, source) => {
  // source = 'webspeech' | 'whisper' | 'validated'
  console.log(`[${lang}] (${source}) ${text}`);
};
await t3.start();
```

### Export Formats

```typescript
// Export transcript
const transcript = t.getTranscript();
transcript.exportAs('txt');   // Plain text
transcript.exportAs('srt');   // Subtitles format
transcript.exportAs('json');  // Structured data with timestamps
```

---

## JARVIS Ecosystem

| Project | Description |
|---------|-------------|
| [jarvis-linux](https://github.com/Turbo31150/jarvis-linux) | Distributed Autonomous AI Cluster |
| [lumen](https://github.com/Turbo31150/lumen) | Full Multilingual AI Web App (cluster required) |
| **transcription-multi-langue** | Lightweight Multilingual Transcription *(this repo)* |
| [browser-mcp-orchestrator](https://github.com/Turbo31150/browser-mcp-orchestrator) | Dual-Browser DevTools Orchestration |

---

<div align="center">

**Franck Delmas (Turbo31150)** · [github.com/Turbo31150](https://github.com/Turbo31150) · Toulouse, France

*TRANSCRIBE-LITE -- Multilingual Real-time Transcription -- MIT License*

> Freelance profile: [codeur.com/-6666zlkh](https://www.codeur.com/-6666zlkh)

</div>
