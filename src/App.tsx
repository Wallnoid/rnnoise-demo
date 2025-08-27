
import './App.css'

import { useRef } from 'react'
import { NoiseSuppressorWorklet_Name } from "@timephy/rnnoise-wasm"
import NoiseSuppressorWorklet from "@timephy/rnnoise-wasm/NoiseSuppressorWorklet?worker&url"


function App() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rnnoiseNodeRef = useRef<AudioWorkletNode | null>(null)
  const processedMergerRef = useRef<ChannelMergerNode | null>(null)
  const workletLoadedRef = useRef<boolean>(false)

  const mediaConstraints: MediaStreamConstraints = {
    audio: {
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000
    } as MediaTrackConstraints
  }

  async function ensureAudioContext(): Promise<AudioContext> {
    let ac = audioContextRef.current
    if (!ac) {
      ac = new AudioContext({ sampleRate: 48000 })
      audioContextRef.current = ac
    }
    if (ac.state === 'suspended') {
      try { await ac.resume() } catch (err) { console.warn('AudioContext.resume falló', err) }
    }
    return ac
  }

  async function ensureMediaStream(): Promise<MediaStream> {
    let stream = mediaStreamRef.current
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
      mediaStreamRef.current = stream
    }
    return stream
  }

  async function ensureGraph() {
    const ac = await ensureAudioContext()
    const stream = await ensureMediaStream()

    if (!sourceNodeRef.current) {
      sourceNodeRef.current = ac.createMediaStreamSource(stream)
    }

    if (!workletLoadedRef.current) {
      await ac.audioWorklet.addModule(NoiseSuppressorWorklet)
      workletLoadedRef.current = true
    }

    if (!rnnoiseNodeRef.current) {
      rnnoiseNodeRef.current = new AudioWorkletNode(
        ac,
        NoiseSuppressorWorklet_Name,
        {
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers'
        }
      )
    }

    if (!processedMergerRef.current) {
      processedMergerRef.current = ac.createChannelMerger(2)
    }

    // No conectamos aquí; las conexiones se realizan al elegir el modo.
  }

  async function start() {
    try {
      await ensureGraph()
      const ac = audioContextRef.current!
      const source = sourceNodeRef.current!
      const rnnoise = rnnoiseNodeRef.current!
      const merger = processedMergerRef.current!

      // Desconectar cualquier ruta previa
      const safeDisconnect = (node: AudioNode | null, label: string) => {
        if (!node) return
        try { node.disconnect() } catch (err) { console.warn(`disconnect ${label} falló`, err) }
      }
      safeDisconnect(source, 'source')
      safeDisconnect(rnnoise, 'rnnoise')
      safeDisconnect(merger, 'merger')

      // Ruta PROCESADA únicamente: source -> rnnoise -> merger(L/R) -> destination
      source.connect(rnnoise)
      rnnoise.connect(merger, 0, 0)
      rnnoise.connect(merger, 0, 1)
      merger.connect(ac.destination)

      console.log("RNNoise demo corriendo 🚀", { sampleRate: ac.sampleRate })
    } catch (error) {
      console.error("Error iniciando con supresión de ruido", error)
    }
  }

  async function startWithoutNoiseSuppression() {
    try {
      await ensureGraph()
      const ac = audioContextRef.current!
      const source = sourceNodeRef.current!
      const rnnoise = rnnoiseNodeRef.current!
      const merger = processedMergerRef.current!

      // Desconectar cualquier ruta previa
      const safeDisconnect = (node: AudioNode | null, label: string) => {
        if (!node) return
        try { node.disconnect() } catch (err) { console.warn(`disconnect ${label} falló`, err) }
      }
      safeDisconnect(source, 'source')
      safeDisconnect(rnnoise, 'rnnoise')
      safeDisconnect(merger, 'merger')

      // Ruta RAW únicamente: source -> destination
      source.connect(ac.destination)

      console.log("Audio sin supresión de ruido corriendo 🔊", { sampleRate: ac.sampleRate })
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

  async function stop() {
    // Detener y guardar grabaciones si existen
    // try { stopAndSaveRecordings() } catch (e) { console.error(e) }
    const ac = audioContextRef.current
    const stream = mediaStreamRef.current

    try {
      // Desconectar rutas activas
      const safeDisconnect = (node: AudioNode | null, label: string) => {
        if (!node) return
        try { node.disconnect() } catch (err) { console.warn(`disconnect ${label} falló`, err) }
      }
      safeDisconnect(sourceNodeRef.current, 'source')
      safeDisconnect(rnnoiseNodeRef.current, 'rnnoise')
      safeDisconnect(processedMergerRef.current, 'merger')
    } catch (err) {
      console.warn('Error al silenciar rutas', err)
    }

    if (stream) {
      try { stream.getTracks().forEach(track => track.stop()) } catch (err) { console.warn('Detener tracks falló', err) }
      mediaStreamRef.current = null
    }

    if (ac) {
      try { await ac.close() } catch (err) { console.warn('AudioContext.close falló', err) }
      audioContextRef.current = null
    }

    // Limpiar referencias de nodos
    sourceNodeRef.current = null
    rnnoiseNodeRef.current = null
    processedMergerRef.current = null
    workletLoadedRef.current = false

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
