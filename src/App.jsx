import { useCallback, useEffect, useRef, useState } from 'react'

const FILTERS = [
  { id: 'original', name: 'Original' },
  { id: 'vintage', name: 'Vintage' },
  { id: 'mono', name: 'B&W' },
  { id: 'golden', name: 'Golden hour' },
  { id: 'blue', name: 'Blue hour' },
]
const FRAMES = [
  { id: 'film', name: 'Film' },
  { id: 'polaroid', name: 'Polaroid' },
  { id: 'kraft', name: 'Kraft paper' },
  { id: 'none', name: 'No frame' },
]

function applyFilter(imageData, filter) {
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2]
    if (filter === 'mono') {
      const y = 0.299 * r + 0.587 * g + 0.114 * b
      r = g = b = y * 1.06
    } else if (filter === 'vintage') {
      const nr = 0.393 * r + 0.769 * g + 0.189 * b
      const ng = 0.349 * r + 0.686 * g + 0.168 * b
      const nb = 0.272 * r + 0.534 * g + 0.131 * b
      r = nr * 0.92 + r * 0.08
      g = ng * 0.92 + g * 0.08
      b = nb * 0.92 + b * 0.08
    } else if (filter === 'golden') {
      r = r * 1.08 + 10
      g = g * 1.015 + 3
      b = b * 0.88 - 2
    } else if (filter === 'blue') {
      r = r * 0.88 - 2
      g = g * 1.01 + 2
      b = b * 1.12 + 9
    }
    data[i] = Math.max(0, Math.min(255, r))
    data[i + 1] = Math.max(0, Math.min(255, g))
    data[i + 2] = Math.max(0, Math.min(255, b))
  }
  return imageData
}

function filterImageData(source, filter) {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(source, 0, 0)
  if (filter !== 'original') {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    ctx.putImageData(applyFilter(pixels, filter), 0, 0)
  }
  return canvas.toDataURL('image/jpeg', 0.94)
}

function fitCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  ctx.drawImage(image, (image.width - sourceWidth) / 2, (image.height - sourceHeight) / 2, sourceWidth, sourceHeight, x, y, width, height)
}

export default function App() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const timersRef = useRef([])
  const captureLockRef = useRef(false)
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [photos, setPhotos] = useState([])
  const [slots, setSlots] = useState(4)
  const [filter, setFilter] = useState('vintage')
  const [frame, setFrame] = useState('film')
  const [caption, setCaption] = useState('A LITTLE MOMENT, FOREVER.')
  const [countdown, setCountdown] = useState(null)
  const [shooting, setShooting] = useState(false)
  const [facing, setFacing] = useState('user')
  const [timerSeconds, setTimerSeconds] = useState(3)
  const [autoSequence, setAutoSequence] = useState(true)
  const [flash, setFlash] = useState(false)
  const [cameraChoices, setCameraChoices] = useState(1)
  const [notice, setNotice] = useState('')
  const [downloadType, setDownloadType] = useState('png')
  const [confirmReset, setConfirmReset] = useState(false)
  const [mirrorSaved, setMirrorSaved] = useState(true)

  const clearTimers = useCallback(function () {
    timersRef.current.forEach(function (timer) { window.clearTimeout(timer) })
    timersRef.current = []
    captureLockRef.current = false
    setCountdown(null)
    setShooting(false)
  }, [])

  const later = useCallback(function (fn, ms) {
    const id = window.setTimeout(function () {
      timersRef.current = timersRef.current.filter(function (timer) { return timer !== id })
      fn()
    }, ms)
    timersRef.current.push(id)
    return id
  }, [])

  const stopCamera = useCallback(function () {
    clearTimers()
    if (streamRef.current) streamRef.current.getTracks().forEach(function (track) { track.stop() })
    streamRef.current = null
    setCameraOn(false)
  }, [clearTimers])

  const startCamera = useCallback(async function (mode) {
    const selectedMode = mode || facing
    setCameraError('')
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Camera access needs HTTPS or localhost. Open this site in Safari or Chrome, not inside a social app.')
      return
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(function (track) { track.stop() })
    streamRef.current = null
    setCameraOn(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: selectedMode }, width: { ideal: 1280 }, height: { ideal: 960 } }
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Camera preview is not ready.')
      video.srcObject = stream
      video.muted = true
      video.playsInline = true
      setCameraOn(true)
      await new Promise(function (resolve, reject) {
        if (video.readyState >= 2) {
          resolve()
          return
        }
        const onReady = function () {
          cleanup()
          resolve()
        }
        const onError = function () {
          cleanup()
          reject(new Error('The camera preview could not load.'))
        }
        const cleanup = function () {
          video.removeEventListener('loadedmetadata', onReady)
          video.removeEventListener('error', onError)
        }
        video.addEventListener('loadedmetadata', onReady, { once: true })
        video.addEventListener('error', onError, { once: true })
        if (video.readyState >= 1 && video.videoWidth) {
          cleanup()
          resolve()
        }
      })
      await video.play()
      setFacing(selectedMode)
      setCameraError('')
      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setCameraChoices(devices.filter(function (device) { return device.kind === 'videoinput' }).length)
      }
    } catch (error) {
      if (streamRef.current) streamRef.current.getTracks().forEach(function (track) { track.stop() })
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
      setCameraOn(false)
      const name = error && error.name
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Allow camera access in your browser’s site settings, then tap Retry.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setCameraError('No camera was found on this device. Connect a camera and try again.')
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setCameraError('Your camera may be in use by another app. Close other camera apps and retry.')
      } else {
        setCameraError('We could not start the camera. Try Safari or Chrome, check camera permission, and retry.')
      }
    }
  }, [facing])

  useEffect(function () {
    return function () {
      timersRef.current.forEach(function (timer) { window.clearTimeout(timer) })
      if (streamRef.current) streamRef.current.getTracks().forEach(function (track) { track.stop() })
    }
  }, [])

  useEffect(function () {
    if (cameraOn && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(function () {})
    }
  }, [cameraOn])

  const captureOne = useCallback(function () {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight || !streamRef.current) return false
    const canvas = document.createElement('canvas')
    const ratio = 4 / 3
    canvas.width = 960
    canvas.height = 720
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const sourceRatio = video.videoWidth / video.videoHeight
    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight
    if (sourceRatio > ratio) {
      sw = video.videoHeight * ratio
      sx = (video.videoWidth - sw) / 2
    } else {
      sh = video.videoWidth / ratio
      sy = (video.videoHeight - sh) / 2
    }
    if (facing === 'user' && mirrorSaved) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const rawCanvas = document.createElement('canvas')
    rawCanvas.width = canvas.width
    rawCanvas.height = canvas.height
    rawCanvas.getContext('2d').drawImage(canvas, 0, 0)
    const src = filterImageData(rawCanvas, filter)
    const photo = { id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8), src: src, rawSrc: rawCanvas.toDataURL('image/jpeg', 0.94) }
    setPhotos(function (current) {
      if (current.length >= slots) return current
      return current.concat(photo)
    })
    setFlash(true)
    later(function () { setFlash(false) }, 140)
    return true
  }, [facing, filter, later, mirrorSaved, slots])

  const runSequence = useCallback(function (remaining) {
    if (!streamRef.current || captureLockRef.current) return
    if (remaining <= 0) {
      captureLockRef.current = false
      setShooting(false)
      setCountdown(null)
      return
    }
    setCountdown(timerSeconds)
    const tick = function (value) {
      if (!streamRef.current) {
        clearTimers()
        return
      }
      if (value > 1) {
        setCountdown(value - 1)
        later(function () { tick(value - 1) }, 1000)
      } else {
        setCountdown('SMILE!')
        later(function () {
          if (!streamRef.current) {
            clearTimers()
            return
          }
          const photoTaken = captureOne()
          setCountdown(null)
          if (!photoTaken) {
            captureLockRef.current = false
            setShooting(false)
            return
          }
          const nextRemaining = remaining - 1
          if (autoSequence && nextRemaining > 0) {
            later(function () { runSequence(nextRemaining) }, 950)
          } else {
            captureLockRef.current = false
            setShooting(false)
          }
        }, 380)
      }
    }
    later(function () { tick(timerSeconds) }, 1000)
  }, [autoSequence, captureOne, clearTimers, later, timerSeconds])

  const startCapture = function () {
    if (!cameraOn || captureLockRef.current || photos.length >= slots) return
    captureLockRef.current = true
    setShooting(true)
    runSequence(autoSequence ? slots - photos.length : 1)
  }

  const cancelCapture = function () {
    clearTimers()
    setNotice('Countdown cancelled. Your existing photos are safe.')
  }

  const removePhoto = function (id) {
    setPhotos(function (current) { return current.filter(function (photo) { return photo.id !== id }) })
    setNotice('Photo removed. You can take another one.')
  }

  const retakePhoto = function (id) {
    const targetIndex = photos.findIndex(function (photo) { return photo.id === id })
    if (targetIndex < 0 || !cameraOn || captureLockRef.current) {
      setNotice('Turn on the camera to retake this photo.')
      return
    }
    captureLockRef.current = true
    setShooting(true)
    setCountdown(timerSeconds)
    const tick = function (value) {
      if (!streamRef.current) { clearTimers(); return }
      if (value > 1) {
        setCountdown(value - 1)
        later(function () { tick(value - 1) }, 1000)
      } else {
        setCountdown('SMILE!')
        later(function () {
          const video = videoRef.current
          if (!video || !video.videoWidth) { clearTimers(); return }
          const canvas = document.createElement('canvas')
          canvas.width = 960; canvas.height = 720
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          const ratio = 4 / 3, sourceRatio = video.videoWidth / video.videoHeight
          let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight
          if (sourceRatio > ratio) { sw = video.videoHeight * ratio; sx = (video.videoWidth - sw) / 2 }
          else { sh = video.videoWidth / ratio; sy = (video.videoHeight - sh) / 2 }
          if (facing === 'user' && mirrorSaved) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1) }
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
          const src = filterImageData(canvas, filter)
          setPhotos(function (current) { return current.map(function (photo, index) { return index === targetIndex ? { id: photo.id, src: src, rawSrc: canvas.toDataURL('image/jpeg', 0.94) } : photo }) })
          setFlash(true)
          later(function () { setFlash(false) }, 140)
          setCountdown(null); setShooting(false); captureLockRef.current = false
        }, 380)
      }
    }
    later(function () { tick(timerSeconds) }, 1000)
  }

  const resetPhotos = function () {
    clearTimers()
    setPhotos([])
    setConfirmReset(false)
    setNotice('Fresh roll, fresh memories.')
  }

  const chooseSlots = function (count) {
    if (count < photos.length) {
      setNotice('Remove a photo first if you want a shorter strip. Your photos were not deleted.')
      return
    }
    setSlots(count)
  }

  const downloadStrip = function (type) {
    if (!photos.length) return
    const width = 720
    const pad = frame === 'polaroid' ? 28 : frame === 'none' ? 0 : 34
    const gap = 12
    const photoWidth = width - pad * 2
    const photoHeight = Math.round(photoWidth * 3 / 4)
    const captionHeight = caption.trim() ? 74 : 20
    const height = pad * 2 + photos.length * photoHeight + (photos.length - 1) * gap + captionHeight
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    const backgrounds = { film: '#25231e', polaroid: '#f5f0e5', kraft: '#c3a57e', none: '#25231e' }
    ctx.fillStyle = backgrounds[frame]
    ctx.fillRect(0, 0, width, height)
    const drawPhoto = function (index) {
      if (index >= photos.length) {
        if (caption.trim()) {
          ctx.fillStyle = frame === 'film' || frame === 'none' ? '#e8dfc9' : '#37312a'
          ctx.textAlign = 'center'
          ctx.font = '500 18px monospace'
          ctx.fillText(caption.trim().slice(0, 48), width / 2, height - 30, width - 30)
        }
        if (frame === 'film') {
          ctx.fillStyle = '#e8dfc9'
          ctx.textAlign = 'center'
          ctx.font = '10px monospace'
          ctx.fillText('AFTERGLOW  •  400 ISO  •  ' + new Date().toLocaleDateString(), width / 2, height - 8, width - 30)
        }
        const link = document.createElement('a')
        link.download = 'afterglow-photobooth.' + type
        link.href = canvas.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95)
        link.click()
        setNotice('Your strip is ready to keep.')
        return
      }
      const photo = photos[index]
      const img = new Image()
      img.onload = function () {
        const y = pad + index * (photoHeight + gap)
        ctx.drawImage(img, pad, y, photoWidth, photoHeight)
        if (frame === 'film') {
          ctx.fillStyle = '#e8dfc9'
          const hole = 6, step = 32
          for (let dot = 0; dot < Math.ceil(photoHeight / step); dot++) {
            const cy = y + 12 + dot * step
            ctx.fillRect(8, cy, hole, 12)
            ctx.fillRect(width - 14, cy, hole, 12)
          }
        }
        drawPhoto(index + 1)
      }
      img.onerror = function () { setNotice('One photo could not be prepared. Please try downloading again.') }
      img.src = photo.src
    }
    drawPhoto(0)
  }

  const shareStrip = async function () {
    if (!navigator.share || !navigator.canShare) {
      setNotice('Sharing is not supported in this browser. Use Download instead.')
      return
    }
    const type = downloadType === 'jpeg' ? 'image/jpeg' : 'image/png'
    const canvas = document.createElement('canvas')
    const width = 720, pad = frame === 'none' ? 0 : 30, gap = 12, photoWidth = width - pad * 2
    const photoHeight = Math.round(photoWidth * 3 / 4)
    canvas.width = width; canvas.height = pad * 2 + photos.length * photoHeight + Math.max(0, photos.length - 1) * gap + 70
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = frame === 'polaroid' ? '#f5f0e5' : frame === 'kraft' ? '#c3a57e' : '#25231e'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    let index = 0
    const drawNext = function () {
      if (index >= photos.length) {
        ctx.fillStyle = frame === 'polaroid' || frame === 'kraft' ? '#37312a' : '#e8dfc9'
        ctx.textAlign = 'center'; ctx.font = '500 18px monospace'
        ctx.fillText(caption.trim(), width / 2, canvas.height - 25, width - 30)
        canvas.toBlob(async function (blob) {
          if (!blob) return
          const file = new File([blob], 'afterglow-photobooth.' + (downloadType === 'jpeg' ? 'jpg' : 'png'), { type: type })
          try {
            if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'My Afterglow photo strip' })
            else setNotice('Sharing this image is not supported here. Use Download instead.')
          } catch (error) { if (error.name !== 'AbortError') setNotice('Could not open the share sheet. Try Download instead.') }
        }, type)
        return
      }
      const img = new Image()
      img.onload = function () {
        ctx.drawImage(img, pad, pad + index * (photoHeight + gap), photoWidth, photoHeight)
        index++; drawNext()
      }
      img.src = photos[index].src
    }
    drawNext()
  }

  const scrollToBooth = function (start) {
    document.getElementById('booth')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    if (start && !cameraOn) later(function () { startCamera() }, 350)
  }

  const allSlotsFilled = photos.length >= slots

  return (
    <div className="app-shell" id="top">
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <a href="#top" className="brand" aria-label="Afterglow home"><span className="brand-mark">a.</span><span>AFTERGLOW <small>ANALOG PHOTO CLUB</small></span></a>
        <nav><a href="#booth">THE BOOTH</a><a href="#about">OUR PROMISE</a></nav>
        <button className="top-cta" onClick={function () { scrollToBooth(true) }}>OPEN THE BOOTH <span>↗</span></button>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span>✳</span> YOUR MOMENT, YOUR LITTLE TIME CAPSULE</p>
            <h1>Keep the<br /><em>good</em> stuff.</h1>
            <p className="hero-description">The flash. The blur. The moment right before everyone says cheese. Make a tiny time capsule, one frame at a time.</p>
            <button className="primary-button" onClick={function () { scrollToBooth(true) }}>START TAKING PHOTOS <span>↗</span></button>
            <p className="privacy-note">♡ Your photos never leave this device.</p>
          </div>
          <div className="hero-art" aria-label="A sample retro photo strip">
            <div className="hero-strip-sample"><div className="sample-photo sample-a"><span>✳</span></div><div className="sample-photo sample-b"><span>☼</span></div><div className="sample-photo sample-c"><span>✦</span></div><div className="sample-strip-caption">KEEP THE GOOD STUFF · 2026</div></div>
            <div className="sun-stamp">MADE OF<br />MOMENTS <span>✳</span></div>
            <div className="scribble-note">little things<br />last forever <span>↙</span></div>
          </div>
          <div className="hero-bottom"><span>MADE OF MOMENTS</span><span>NO ACCOUNT. NO UPLOADS.</span><span>↓ MAKE YOUR STRIP</span></div>
        </section>

        <section className="booth-section" id="booth">
          <div className="section-heading"><div><p className="eyebrow">✳ YOUR VERY OWN LITTLE PHOTO STUDIO</p><h2>Come on in<span>.</span></h2></div><p className="section-note">Find the light. Gather your people.<br />The best photos are never planned.</p></div>
          <div className="booth-layout">
            <div className="camera-card">
              <div className="card-topline"><span><i className={cameraOn ? 'status-dot live' : 'status-dot'} /> {cameraOn ? 'CAMERA IS READY' : 'CAMERA STANDBY'}</span><span>YOUR PHOTOS STAY ON THIS DEVICE</span></div>
              <div className="viewfinder">
                <video ref={videoRef} autoPlay playsInline muted className={'live-video ' + (facing === 'user' ? 'mirror' : '')} style={{ display: cameraOn ? 'block' : 'none', filter: filter === 'mono' ? 'grayscale(1) contrast(1.08)' : filter === 'vintage' ? 'sepia(.38) contrast(.92) saturate(.82)' : filter === 'golden' ? 'sepia(.22) saturate(1.35) hue-rotate(-8deg) brightness(1.04)' : filter === 'blue' ? 'saturate(.8) hue-rotate(160deg) contrast(1.04)' : 'none' }} />
                {!cameraOn && <div className="camera-placeholder"><div className="placeholder-camera">◎</div><p>YOUR NEXT FAVORITE PHOTO<br />STARTS RIGHT HERE.</p><span>ALLOW CAMERA ACCESS TO BEGIN</span></div>}
                <div className="viewfinder-corners"><i/><i/><i/><i/></div><div className="viewfinder-label">AFTERGLOW / LIVE VIEW</div><div className="viewfinder-counter">{String(photos.length).padStart(2, '0')} <span>/ {String(slots).padStart(2, '0')}</span></div>
                {flash && <div className="capture-flash" aria-hidden="true" />}
                {countdown !== null && <div className="countdown-overlay" aria-live="assertive" aria-atomic="true">{typeof countdown === 'number' ? countdown : <span className="smile-text">{countdown}</span>}<button className="cancel-countdown" onClick={cancelCapture}>CANCEL</button></div>}
              </div>
              {cameraError && <div className="error-message" role="alert"><p>{cameraError}</p><button onClick={function () { startCamera(facing) }}>RETRY CAMERA</button><small>Tip: if this page is inside Instagram or Messenger, open it in Safari or Chrome.</small></div>}
              <div className="camera-actions">
                {!cameraOn ? <button className="primary-button camera-start" onClick={function () { startCamera() }}>◎ &nbsp; TURN ON CAMERA</button> : <button className="primary-button shutter-button" onClick={startCapture} disabled={shooting || allSlotsFilled}><span className="shutter-icon">●</span>{allSlotsFilled ? 'YOUR STRIP IS READY' : shooting ? 'GET READY…' : autoSequence ? 'START PHOTO SEQUENCE' : 'TAKE A PHOTO'}</button>}
                {cameraOn && cameraChoices > 1 && <button className="icon-button" title="Switch camera" aria-label="Switch camera" onClick={function () { startCamera(facing === 'user' ? 'environment' : 'user') }}>⇄</button>}
                {cameraOn && <button className="text-button" onClick={stopCamera}>TURN OFF</button>}
              </div>
              <div className="capture-options"><label>COUNTDOWN<select value={timerSeconds} onChange={function (e) { setTimerSeconds(Number(e.target.value)) }}><option value="3">3 seconds</option><option value="5">5 seconds</option><option value="10">10 seconds</option></select></label><label className="toggle-option"><input type="checkbox" checked={autoSequence} onChange={function (e) { setAutoSequence(e.target.checked) }} /> Auto-take remaining photos</label></div>
              <div className="camera-hint"><span>✳</span> TIP: YOU CAN RETAKE OR REMOVE ANY PHOTO BELOW.</div>
              {notice && <p className="notice-message" role="status">{notice}</p>}
            </div>

            <aside className="control-panel">
              <div className="panel-header"><span>MAKE IT YOURS</span><span className="panel-number">{photos.length} / {slots}</span></div>
              <div className="control-group"><div className="control-title"><span>PHOTO STRIP</span><span>CHOOSE A SIZE</span></div><div className="choice-row">{[2, 3, 4].map(function (count) { return <button key={count} aria-pressed={slots === count} className={slots === count ? 'choice active' : 'choice'} onClick={function () { chooseSlots(count) }}>{count} photos</button> })}</div></div>
              <div className="control-group"><div className="control-title"><span>FILM MOOD</span><span>CHOOSE YOUR TONE</span></div><div className="filter-grid">{FILTERS.map(function (item) { return <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? 'filter-choice active' : 'filter-choice'} onClick={function () { setFilter(item.id) }}><span className={'filter-swatch swatch-' + item.id}><span>Ag</span></span><span>{item.name}</span></button> })}</div></div>
              <div className="control-group"><div className="control-title"><span>FRAME STYLE</span><span>MAKE IT YOURS</span></div><div className="frame-options">{FRAMES.map(function (item) { return <button key={item.id} aria-pressed={frame === item.id} className={frame === item.id ? 'frame-choice active' : 'frame-choice'} onClick={function () { setFrame(item.id) }}><span className={'frame-swatch frame-' + item.id}><i/><i/><i/></span><span>{item.name}</span></button> })}</div></div>
              <div className="control-group caption-group"><label className="control-title" htmlFor="caption"><span>YOUR CAPTION</span><span>OPTIONAL</span></label><input id="caption" value={caption} maxLength={48} onChange={function (e) { setCaption(e.target.value) }} placeholder="A little moment, forever." /></div>
              <div className="control-group mirror-control"><label><input type="checkbox" checked={mirrorSaved} onChange={function (e) { setMirrorSaved(e.target.checked) }} /> Save selfies mirrored</label></div>
              <div className="strip-progress"><div className="progress-copy"><span>YOUR PHOTOS</span><span>{photos.length} OF {slots}</span></div><div className="progress-track"><span style={{ width: Math.min(100, photos.length / slots * 100) + '%' }}/></div></div>
              <button className="reset-button" onClick={function () { setConfirmReset(true) }}>↺ &nbsp; START A FRESH ROLL</button>
              {confirmReset && <div className="confirm-reset"><p>Clear all {photos.length} photos and start over?</p><button onClick={resetPhotos}>YES, START OVER</button><button onClick={function () { setConfirmReset(false) }}>KEEP MY PHOTOS</button></div>}
            </aside>
          </div>

          <div className="result-section" id="keepsake">
            <div className="result-heading"><div><p className="eyebrow">✳ THE LITTLE THINGS, DEVELOPED</p><h3>{allSlotsFilled ? 'Your strip is ready' : 'Your keepsake'}<span>.</span></h3></div><span className="result-count">{photos.length} / {slots} PHOTOS</span></div>
            <div className="result-layout">
              <div className="strip-stage"><div className="photo-strip frame-preview" data-frame={frame}>
                {photos.length === 0 ? <div className="empty-strip"><span>✳</span><p>YOUR MEMORIES<br />WILL LIVE HERE</p><small>TAKE YOUR FIRST PHOTO TO BEGIN</small></div> : photos.map(function (photo, index) { return <div className="strip-photo" key={photo.id}><img src={photo.src} alt={'Photobooth photo ' + (index + 1)} /><span className="photo-index">{String(index + 1).padStart(2, '0')}</span><div className="photo-tools"><button aria-label={'Retake photo ' + (index + 1)} title="Retake this photo" disabled={!cameraOn || shooting} onClick={function () { retakePhoto(photo.id) }}>↻</button><button aria-label={'Delete photo ' + (index + 1)} title="Delete this photo" onClick={function () { removePhoto(photo.id) }}>×</button></div></div> })}{photos.length > 0 && <div className="strip-caption">{caption}</div>}
              </div></div>
              <div className="download-card"><span className="download-icon">↘</span><p className="eyebrow">A MEMORY TO KEEP</p><h4>{allSlotsFilled ? 'A little piece of today.' : 'Ready when you are.'}</h4><p className="download-description">Your photos stay in this browser. Retake or remove a frame any time before saving your strip.</p>
                <button className="primary-button download-button" disabled={!photos.length} onClick={function () { downloadStrip(downloadType) }}>DOWNLOAD YOUR STRIP <span>↓</span></button>
                <button className="format-link" onClick={function () { setDownloadType(downloadType === 'png' ? 'jpeg' : 'png') }}>Format: {downloadType.toUpperCase()} · change</button>
                {typeof navigator !== 'undefined' && navigator.share && <button className="secondary-button" disabled={!photos.length} onClick={shareStrip}>SHARE / SAVE TO PHOTOS ↗</button>}
                <small>MADE WITH A LITTLE NOSTALGIA. STORED ON YOUR DEVICE.</small>
              </div>
            </div>
          </div>
        </section>
        <section className="closing-note" id="about"><span className="closing-star">✳</span><p>Some days deserve<br /><em>to be kept.</em></p><span className="closing-small">YOUR PHOTOS NEVER LEAVE THIS DEVICE.</span></section>
      </main>
      <footer className="footer"><a href="#top" className="brand"><span className="brand-mark">a.</span><span>AFTERGLOW <small>ANALOG PHOTO CLUB</small></span></a><span>MADE OF MOMENTS, KEPT FOREVER.</span><a href="#top">BACK TO THE TOP ↑</a></footer>
    </div>
  )
}

function dataUrlToImage(src) {
  const image = new Image()
  image.src = src
  return image
}
