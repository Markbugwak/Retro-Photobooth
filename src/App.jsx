import { useCallback, useEffect, useRef, useState } from 'react'

const FILTERS = [
  { id: 'original', name: 'Original', css: 'none' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(.38) contrast(.92) saturate(.82)' },
  { id: 'mono', name: 'B&W', css: 'grayscale(1) contrast(1.08)' },
  { id: 'golden', name: 'Golden hour', css: 'sepia(.22) saturate(1.35) hue-rotate(-8deg) brightness(1.04)' },
  { id: 'blue', name: 'Blue hour', css: 'saturate(.8) hue-rotate(12deg) contrast(1.04)' },
]
const FRAMES = [
  { id: 'film', name: 'Film', className: 'frame-film' },
  { id: 'polaroid', name: 'Polaroid', className: 'frame-polaroid' },
  { id: 'kraft', name: 'Kraft', className: 'frame-kraft' },
  { id: 'none', name: 'No frame', className: 'frame-none' },
]
const SLOT_COUNTS = [2, 3, 4]

export default function App() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
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
  const [downloadType, setDownloadType] = useState('png')
  const [activeTab, setActiveTab] = useState('booth')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [])

  const startCamera = useCallback(async (mode = facing) => {
    setCameraError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access needs a secure connection (HTTPS or localhost).')
      return
    }
    stopCamera()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCameraOn(true)
    } catch {
      setCameraError('We could not open your camera. Allow camera permission in your browser and try again.')
    }
  }, [facing, stopCamera])

  useEffect(() => () => streamRef.current?.getTracks().forEach(track => track.stop()), [])

  useEffect(() => {
    if (cameraOn && videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraOn])

  const takePhoto = () => {
    if (!cameraOn || shooting || photos.length >= slots || !videoRef.current) return
    setShooting(true)
    let count = 3
    setCountdown(count)
    const timer = () => {
      count -= 1
      if (count > 0) {
        setCountdown(count)
        window.setTimeout(timer, 900)
      } else {
        setCountdown('SMILE!')
        window.setTimeout(() => {
          const video = videoRef.current
          if (video?.videoWidth && video?.videoHeight) {
            const canvas = document.createElement('canvas')
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d')
            if (facing === 'user') {
              ctx.translate(canvas.width, 0)
              ctx.scale(-1, 1)
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            setPhotos(old => [...old, { id: crypto.randomUUID?.() ?? String(Date.now()), src: canvas.toDataURL('image/jpeg', .94) }])
          }
          setCountdown(null)
          setShooting(false)
        }, 450)
      }
    }
    window.setTimeout(timer, 900)
  }

  const resetPhotos = () => { setPhotos([]); setCountdown(null); setShooting(false) }
  const activeFilter = FILTERS.find(item => item.id === filter) || FILTERS[0]
  const activeFrame = FRAMES.find(item => item.id === frame) || FRAMES[0]
  const allSlotsFilled = photos.length >= slots

  const exportStrip = (type = downloadType) => {
    if (!photos.length) return
    const width = 640
    const padding = frame === 'polaroid' ? 36 : frame === 'none' ? 0 : 22
    const gap = 14
    const photoHeight = 390
    const captionSpace = caption.trim() ? 80 : 24
    const height = padding * 2 + photos.length * photoHeight + (photos.length - 1) * gap + captionSpace
    const canvas = canvasRef.current || document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    const backgrounds = { film: '#26241f', polaroid: '#f5f0e5', kraft: '#c3a57e', none: '#ffffff' }
    ctx.fillStyle = backgrounds[frame]
    ctx.fillRect(0, 0, width, height)
    let loaded = 0
    const images = photos.map(photo => {
      const img = new Image()
      img.src = photo.src
      img.onload = () => {
        loaded += 1
        if (loaded === photos.length) draw()
      }
      return img
    })
    const draw = () => {
      const cssFilter = activeFilter.css
      const innerWidth = width - padding * 2
      images.forEach((img, index) => {
        const y = padding + index * (photoHeight + gap)
        ctx.save()
        ctx.filter = cssFilter
        const scale = Math.max(innerWidth / img.width, photoHeight / img.height)
        const sw = innerWidth / scale, sh = photoHeight / scale
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, padding, y, innerWidth, photoHeight)
        ctx.restore()
        if (frame === 'film') {
          ctx.fillStyle = '#e8dfc9'
          for (let dot = 0; dot < 7; dot++) {
            ctx.beginPath(); ctx.arc(9, y + 16 + dot * 48, 3.2, 0, Math.PI * 2); ctx.fill()
            ctx.beginPath(); ctx.arc(width - 9, y + 16 + dot * 48, 3.2, 0, Math.PI * 2); ctx.fill()
          }
        }
      })
      if (caption.trim()) {
        ctx.fillStyle = frame === 'film' ? '#e8dfc9' : '#37312a'
        ctx.textAlign = 'center'
        ctx.font = '600 18px Georgia, serif'
        ctx.fillText(caption.trim().slice(0, 48), width / 2, height - 34, width - 36)
      }
      const link = document.createElement('a')
      link.download = `afterglow-photobooth.${type}`
      link.href = canvas.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/png', .95)
      link.click()
    }
  }

  const scrollToBooth = () => {
    setActiveTab('booth')
    document.getElementById('booth')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <a href="#top" className="brand" aria-label="Afterglow home"><span className="brand-mark">a.</span><span>AFTERGLOW <small>ANALOG PHOTO CLUB</small></span></a>
        <nav><a href="#story">THE STORY</a><a href="#booth">THE BOOTH</a><span className="open-status"><i /> YOUR MOMENT AWAITS</span></nav>
        <button className="top-cta" onClick={scrollToBooth}>MAKE A MEMORY <span>↗</span></button>
      </header>

      <main id="top">
        <section className="hero" id="story">
          <div className="hero-copy">
            <p className="eyebrow"><span>✳</span> A LITTLE LESS PERFECT. A LITTLE MORE REAL.</p>
            <h1>Keep the<br /><em>good</em> stuff.</h1>
            <p className="hero-description">The flash. The blur. The moment right before everyone says cheese. Make a tiny time capsule, one frame at a time.</p>
            <button className="primary-button" onClick={scrollToBooth}>STEP INTO THE BOOTH <span>↗</span></button>
            <div className="hero-footnote"><span className="hand-drawn">✳</span><span>NO ACCOUNT. NO UPLOADS.<br />JUST YOU & THE CAMERA.</span></div>
          </div>
          <div className="hero-art">
            <div className="sun-stamp">MADE OF<br />MOMENTS <span>✳</span></div>
            <div className="hero-photo">
              <div className="photo-sample sample-one"><span className="sample-label">ROLL NO. 024</span><div className="sample-sun" /><div className="sample-horizon" /><div className="sample-person person-one" /><div className="sample-person person-two" /></div>
              <div className="sample-caption">SOMEWHERE IN SUMMER</div>
              <div className="film-edge"><span>✳</span><span>24</span><span>AGFA</span><span>✳</span><span>24</span></div>
            </div>
            <div className="scribble-note">little things<br />last forever <span>↙</span></div>
            <div className="star star-one">✳</div><div className="star star-two">✴</div>
          </div>
          <div className="hero-bottom"><span>01 / THE ART OF BEING HERE</span><span>SHOT WITH FEELING, NOT PERFECTION</span><span>SCROLL TO BEGIN ↓</span></div>
        </section>

        <section className="manifesto">
          <span className="manifesto-mark">“</span>
          <p>Life moves fast.<br /><em>Let’s make it stay</em> a little.</p>
          <span className="manifesto-side">A NOTE FROM THE AFTERGLOW CLUB — EST. RIGHT NOW</span>
        </section>

        <section className="booth-section" id="booth">
          <div className="section-heading">
            <div><p className="eyebrow">✳ YOUR VERY OWN LITTLE PHOTO STUDIO</p><h2>Come on in<span>.</span></h2></div>
            <p className="section-note">Find the light. Gather your people.<br />The best photos are never planned.</p>
          </div>
          <div className="booth-layout">
            <div className="camera-card">
              <div className="card-topline"><span><i className={cameraOn ? 'status-dot live' : 'status-dot'} /> {cameraOn ? 'CAMERA IS READY' : 'CAMERA STANDBY'}</span><span>AG-024 / 35MM</span></div>
              <div className="viewfinder">
                <video ref={videoRef} autoPlay playsInline muted className={`live-video ${facing === 'user' ? 'mirror' : ''}`} style={{ filter: activeFilter.css, display: cameraOn ? 'block' : 'none' }} />
                {!cameraOn && <div className="camera-placeholder"><div className="placeholder-camera">◎</div><p>YOUR NEXT FAVORITE PHOTO<br />STARTS RIGHT HERE.</p><span>ALLOW CAMERA ACCESS TO BEGIN</span></div>}
                <div className="viewfinder-corners"><i/><i/><i/><i/></div>
                <div className="viewfinder-label">AFTERGLOW / LIVE VIEW</div>
                <div className="viewfinder-counter">{String(photos.length).padStart(2, '0')} <span>/ {String(slots).padStart(2, '0')}</span></div>
                {countdown !== null && <div className="countdown-overlay">{typeof countdown === 'number' ? countdown : <span className="smile-text">{countdown}</span>}</div>}
              </div>
              {cameraError && <p className="error-message" role="alert">{cameraError}</p>}
              <div className="camera-actions">
                {!cameraOn ? <button className="primary-button camera-start" onClick={() => startCamera()}> <span>◎</span> TURN ON CAMERA </button> : <button className="primary-button shutter-button" onClick={takePhoto} disabled={shooting || allSlotsFilled}><span className="shutter-icon">●</span>{allSlotsFilled ? 'STRIP IS FULL' : shooting ? 'GET READY…' : 'TAKE A PHOTO'}</button>}
                <button className="icon-button" title="Switch camera" aria-label="Switch camera" onClick={() => { const next = facing === 'user' ? 'environment' : 'user'; setFacing(next); if (cameraOn) startCamera(next) }}>⇄</button>
                {cameraOn && <button className="text-button" onClick={stopCamera}>TURN OFF</button>}
              </div>
              <div className="camera-hint"><span>✳</span> TIP: TAKE YOUR TIME. GOOD THINGS DEVELOP SLOWLY.</div>
            </div>

            <aside className="control-panel">
              <div className="panel-header"><span>YOUR CONTACT SHEET</span><span className="panel-number">01—04</span></div>
              <div className="control-group">
                <div className="control-title"><span>01 / PHOTO STRIP</span><span>{slots} FRAMES</span></div>
                <div className="choice-row">
                  {SLOT_COUNTS.map(count => <button key={count} className={slots === count ? 'choice active' : 'choice'} onClick={() => { setSlots(count); setPhotos(old => old.slice(0, count)) }}>{count} CUT</button>)}
                </div>
              </div>
              <div className="control-group">
                <div className="control-title"><span>02 / FILM MOOD</span><span>CHOOSE YOUR TONE</span></div>
                <div className="filter-grid">
                  {FILTERS.map(item => <button key={item.id} className={filter === item.id ? 'filter-choice active' : 'filter-choice'} onClick={() => setFilter(item.id)}><span className={`filter-swatch swatch-${item.id}`}><span>Ag</span></span><span>{item.name}</span></button>)}
                </div>
              </div>
              <div className="control-group">
                <div className="control-title"><span>03 / THE BORDER</span><span>MAKE IT YOURS</span></div>
                <div className="frame-options">
                  {FRAMES.map(item => <button key={item.id} className={frame === item.id ? 'frame-choice active' : 'frame-choice'} onClick={() => setFrame(item.id)}><span className={`frame-swatch ${item.className}`}><i/><i/><i/></span><span>{item.name}</span></button>)}
                </div>
              </div>
              <div className="control-group caption-group">
                <label className="control-title" htmlFor="caption"><span>04 / A LITTLE NOTE</span><span>OPTIONAL</span></label>
                <input id="caption" value={caption} maxLength={48} onChange={e => setCaption(e.target.value)} placeholder="A little moment, forever." />
              </div>
              <div className="strip-progress"><div className="progress-copy"><span>YOUR ROLL</span><span>{photos.length} OF {slots} CAPTURED</span></div><div className="progress-track"><span style={{ width: `${Math.min(100, photos.length / slots * 100)}%` }}/></div></div>
              <button className="reset-button" onClick={resetPhotos}>↺ &nbsp; START A FRESH ROLL</button>
            </aside>
          </div>

          <div className="result-section">
            <div className="result-heading"><div><p className="eyebrow">✳ THE LITTLE THINGS, DEVELOPED</p><h3>Your keepsake<span>.</span></h3></div><span className="result-count">{photos.length.toString().padStart(2, '0')} / {slots.toString().padStart(2, '0')} FRAMES</span></div>
            <div className="result-layout">
              <div className="strip-stage">
                <div className="strip-decoration">AFTERGLOW<br />PHOTO CLUB<br /><span>✳ EST. TODAY ✳</span></div>
                <div className={`photo-strip ${activeFrame.className}`}>
                  {photos.length === 0 ? <div className="empty-strip"><span>✳</span><p>YOUR MEMORIES<br />WILL LIVE HERE</p><small>TAKE YOUR FIRST PHOTO TO BEGIN</small></div> : photos.map((photo, index) => <div className="strip-photo" key={photo.id}><img src={photo.src} alt={`Photobooth frame ${index + 1}`} style={{ filter: activeFilter.css }} /><span className="photo-index">{String(index + 1).padStart(2, '0')}</span></div>)}
                  {photos.length > 0 && caption.trim() && <div className="strip-caption">{caption}</div>}
                </div>
                <div className="strip-stamp">KEEP<br />THIS<br />CLOSE <span>♥</span></div>
              </div>
              <div className="download-card">
                <span className="download-icon">↘</span><p className="eyebrow">A MEMORY TO KEEP</p><h4>Ready when<br />you are.</h4><p className="download-description">Your photos stay right here in your browser. When it feels right, take your little piece of today with you.</p>
                <label className="download-format">FILE FORMAT<select value={downloadType} onChange={e => setDownloadType(e.target.value)}><option value="png">PNG — best quality</option><option value="jpeg">JPEG — smaller file</option></select></label>
                <button className="primary-button download-button" disabled={!photos.length} onClick={() => exportStrip(downloadType)}>DOWNLOAD YOUR STRIP <span>↓</span></button>
                <button className="secondary-button" disabled={!photos.length} onClick={resetPhotos}>TAKE ANOTHER ROLL ↗</button>
                <small>MADE WITH A LITTLE NOSTALGIA. STORED ON YOUR DEVICE.</small>
              </div>
            </div>
          </div>
        </section>
        <section className="closing-note"><span className="closing-star">✳</span><p>Some days deserve<br /><em>to be kept.</em></p><span className="closing-small">THANK YOU FOR STOPPING BY THE AFTERGLOW CLUB.</span></section>
      </main>
      <footer className="footer"><a href="#top" className="brand"><span className="brand-mark">a.</span><span>AFTERGLOW <small>ANALOG PHOTO CLUB</small></span></a><span>MADE OF MOMENTS, KEPT FOREVER.</span><a href="#top">BACK TO THE TOP ↑</a></footer>
      <canvas ref={canvasRef} className="hidden-canvas" aria-hidden="true" />
    </div>
  )
}