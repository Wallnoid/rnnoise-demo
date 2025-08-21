
import './App.css'

import { NoiseSuppressorWorklet_Name } from "@timephy/rnnoise-wasm"
import NoiseSuppressorWorklet from "@timephy/rnnoise-wasm/NoiseSuppressorWorklet?worker&url"


function App() {
  let audioContext: AudioContext | null = null
  let mediaStream: MediaStream | null = null
  // let destinationRaw: MediaStreamAudioDestinationNode | null = null
  // let destinationProcessed: MediaStreamAudioDestinationNode | null = null
  // let recorderRaw: MediaRecorder | null = null
  // let recorderProcessed: MediaRecorder | null = null
  // let rawChunks: Blob[] = []
  // let processedChunks: Blob[] = []
  // let recordingStartTime: number | null = null
  const mediaConstraints: MediaStreamConstraints = {
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000
    } as MediaTrackConstraints
  }

  async function start() {
    try {
      if (audioContext) {
        stop()
      }
      audioContext = new AudioContext({ sampleRate: 48000 })
      await audioContext.audioWorklet.addModule(NoiseSuppressorWorklet)

      // Crear nodo del supresor de ruido (mono explícito)
      const noiseSuppressionNode = new AudioWorkletNode(
        audioContext,
        NoiseSuppressorWorklet_Name,
        {
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        }
      )

      // Pedir micrófono al usuario
      mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
      const source = audioContext.createMediaStreamSource(mediaStream)

      // Conectar: micrófono → supresor → duplicar a estéreo → parlantes
      const merger = audioContext.createChannelMerger(2)
      source.connect(noiseSuppressionNode)
      noiseSuppressionNode.connect(merger, 0, 0)
      noiseSuppressionNode.connect(merger, 0, 1)
      merger.connect(audioContext.destination)

      //// Preparar destinos para grabación
      // destinationRaw = audioContext.createMediaStreamDestination()
      // destinationProcessed = audioContext.createMediaStreamDestination()
      // // Grabar crudo desde la fuente (mono)
      // source.connect(destinationRaw)
      // // Grabar procesado directamente desde el nodo (mono)
      // noiseSuppressionNode.connect(destinationProcessed)

      // // Iniciar grabadores
      // startRecorders()

      console.log("RNNoise demo corriendo 🚀", {
        sampleRate: audioContext.sampleRate
      })
    } catch (error) {
      console.error("Error iniciando con supresión de ruido", error)
    }
  }

  async function startWithoutNoiseSuppression() {
    try {
      if (audioContext) {
        stop()
      }
      audioContext = new AudioContext({ sampleRate: 48000 })

      // Pedir micrófono al usuario
      mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
      const source = audioContext.createMediaStreamSource(mediaStream)

      // Conectar directamente: micrófono → parlantes (sin supresión de ruido)
      source.connect(audioContext.destination)

      // Para poder guardar también el audio procesado, procesamos en paralelo (no se enruta a parlantes)
      await audioContext.audioWorklet.addModule(NoiseSuppressorWorklet)
      const noiseSuppressionNode = new AudioWorkletNode(
        audioContext,
        NoiseSuppressorWorklet_Name,
        {
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        }
      )
      const merger = audioContext.createChannelMerger(2)
      source.connect(noiseSuppressionNode)
      noiseSuppressionNode.connect(merger, 0, 0)
      noiseSuppressionNode.connect(merger, 0, 1)

      // // Preparar destinos para grabación
      // destinationRaw = audioContext.createMediaStreamDestination()
      // destinationProcessed = audioContext.createMediaStreamDestination()
      // source.connect(destinationRaw)
      // merger.connect(destinationProcessed)

      // // Iniciar grabadores
      // startRecorders()

      console.log("Audio sin supresión de ruido corriendo 🔊", {
        sampleRate: audioContext.sampleRate
      })
    } catch (error) {
      console.error("Error iniciando sin supresión de ruido", error)
    }
  }

  // function startRecorders() {
  //   if (!destinationRaw || !destinationProcessed) return
  //   const mime = (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))
  //     ? 'audio/webm;codecs=opus'
  //     : undefined

  //   rawChunks = []
  //   processedChunks = []
  //   recordingStartTime = Date.now()

  //   recorderRaw = new MediaRecorder(destinationRaw.stream, mime ? { mimeType: mime } as MediaRecorderOptions : undefined)
  //   recorderProcessed = new MediaRecorder(destinationProcessed.stream, mime ? { mimeType: mime } as MediaRecorderOptions : undefined)

  //   recorderRaw.ondataavailable = (e: BlobEvent) => {
  //     if (e.data && e.data.size > 0) rawChunks.push(e.data)
  //   }
  //   recorderProcessed.ondataavailable = (e: BlobEvent) => {
  //     if (e.data && e.data.size > 0) processedChunks.push(e.data)
  //   }

  //   // Usar timeslice para forzar vaciado periódico de buffers
  //   const sliceMs = 1000
  //   recorderRaw.start(sliceMs)
  //   recorderProcessed.start(sliceMs)
  // }

  // async function stopAndSaveRecordings() {
  //   type DownloadResult = { blob: Blob, filename: string } | null
  //   const started = Boolean(recorderRaw || recorderProcessed)
  //   if (!started) return

  //   const buildResult = (type: 'raw' | 'rnnoise'): DownloadResult => {
  //     const chunks = type === 'raw' ? rawChunks : processedChunks
  //     if (!chunks.length) return null
  //     const blob = new Blob(chunks, { type: 'audio/webm' })
  //     const ts = recordingStartTime ? new Date(recordingStartTime).toISOString().replace(/[:.]/g, '-') : Date.now().toString()
  //     const filename = type === 'raw' ? `audio_raw-${ts}.webm` : `audio_rnnoise-${ts}.webm`
  //     return { blob, filename }
  //   }

  //   const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

  //   let rawPromise: Promise<DownloadResult> | null = null
  //   let processedPromise: Promise<DownloadResult> | null = null

  //   if (recorderRaw) {
  //     rawPromise = new Promise<DownloadResult>(resolve => {
  //       recorderRaw!.onstop = () => resolve(buildResult('raw'))
  //     })
  //     try { recorderRaw.requestData() } catch (err) { console.warn('requestData RAW falló', err) }
  //     if (recorderRaw.state !== 'inactive') recorderRaw.stop()
  //   }
  //   if (recorderProcessed) {
  //     processedPromise = new Promise<DownloadResult>(resolve => {
  //       recorderProcessed!.onstop = () => resolve(buildResult('rnnoise'))
  //     })
  //     try { recorderProcessed.requestData() } catch (err) { console.warn('requestData RNNOISE falló', err) }
  //     if (recorderProcessed.state !== 'inactive') recorderProcessed.stop()
  //   }

  //   recorderRaw = null
  //   recorderProcessed = null

  //   const promises: Array<Promise<DownloadResult>> = []
  //   if (rawPromise) promises.push(rawPromise)
  //   if (processedPromise) promises.push(processedPromise)
  //   const results = await Promise.all(promises)

  //   for (const res of results) {
  //     if (!res) continue
  //     const url = URL.createObjectURL(res.blob)
  //     const a = document.createElement('a')
  //     a.href = url
  //     a.download = res.filename
  //     document.body.appendChild(a)
  //     a.click()
  //     a.remove()
  //     URL.revokeObjectURL(url)
  //     await delay(1200)
  //   }
  // }

  function stop() {
    // Detener y guardar grabaciones si existen
    // try { stopAndSaveRecordings() } catch (e) { console.error(e) }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      mediaStream = null
    }
    if (audioContext) {
      audioContext.close()
      audioContext = null
    }
    console.log("Audio detenido 🛑")
  }

  return (
    <>
      <h1>RNNoise Demo</h1>

      <div>
        <button onClick={start}>Start con Supresión de Ruido</button>
        <button onClick={startWithoutNoiseSuppression}>Start sin Supresión de Ruido</button>
        <button onClick={stop}>Stop</button>
      </div>
    </>
  )
}

export default App
