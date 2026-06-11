const { ipcRenderer } = require('electron')

// ── State ──────────────────────────────────────────────────────────────────
let data = { tasks: [], streak: 0, lastDate: null, totalCompleted: 0 }
let idleTimer = null
let sadTimer  = null
const IDLE_MS = 5 * 60 * 1000   // 5 minutes
const SAD_MS  = 60 * 60 * 1000  // 1 hour of unfinished tasks

// ── DOM refs ───────────────────────────────────────────────────────────────
const mocha      = document.getElementById('mocha')
const moodLabel  = document.getElementById('mood-label')
const mouthPath  = document.getElementById('mouth-path')
const pupilL     = document.getElementById('pupil-left')
const pupilR     = document.getElementById('pupil-right')
const glossL1    = document.getElementById('gloss-left-1')
const glossR1    = document.getElementById('gloss-right-1')
const glossL2    = document.getElementById('gloss-left-2')
const glossR2    = document.getElementById('gloss-right-2')
const particles  = document.getElementById('particles')
const taskPanel  = document.getElementById('task-panel')
const taskInput  = document.getElementById('task-input')
const taskList   = document.getElementById('task-list')
const emptyState = document.getElementById('empty-state')
const streakEl   = document.getElementById('streak-display')
const xpEl       = document.getElementById('xp-display')

// ── Moods ──────────────────────────────────────────────────────────────────
const MOODS = {
  happy:   { label: '✨ yay!!',    mouth: 'M 91 136 Q 100 147 109 136', pupils: { dx: 2, dy: 0 } },
  content: { label: '🌸 cozy~',  mouth: 'M 93 136 Q 100 143 107 136', pupils: { dx: 0, dy: 0 } },
  idle:    { label: '💤 sleepy…', mouth: 'M 95 138 Q 100 141 105 138', pupils: { dx: 0, dy: 5 } },
  sad:     { label: '🌧️ sad…',   mouth: 'M 93 142 Q 100 135 107 142', pupils: { dx: 0, dy: 1 } },
}

function setMood(mood) {
  const m = MOODS[mood] || MOODS.content
  mocha.className = mood === 'idle' ? 'idle' : mood === 'happy' ? 'happy' : ''
  mouthPath.setAttribute('d', m.mouth)
  pupilL.setAttribute('cx', String(74 + m.pupils.dx))
  pupilL.setAttribute('cy', String(105 + m.pupils.dy))
  pupilR.setAttribute('cx', String(126 + m.pupils.dx))
  pupilR.setAttribute('cy', String(105 + m.pupils.dy))
  document.getElementById('tears').setAttribute('opacity', mood === 'sad' ? '1' : '0')
  document.getElementById('latte').setAttribute('opacity', mood === 'happy' ? '1' : '0')
  moodLabel.textContent = m.label
  moodLabel.classList.add('visible')
  setTimeout(() => moodLabel.classList.remove('visible'), 2500)
}

function recalcMood() {
  const total   = data.tasks.length
  const done    = data.tasks.filter(t => t.done).length
  const pending = total - done

  // clear sad timer if nothing pending
  if (pending === 0) {
    clearTimeout(sadTimer)
    sadTimer = null
  }

  if (total === 0)       { setMood('content'); return }
  if (done === total)    { setMood('happy');   return }

  // tasks exist but not all done — start sad timer if not already running
  if (pending > 0 && !sadTimer) {
    sadTimer = setTimeout(() => {
      sadTimer = null
      recalcMood()
    }, SAD_MS)
  }

  // only show sad if timer has already fired (sadTimer was cleared by timeout)
  const shouldBeSad = pending > 0 && !sadTimer && done < total
  if (shouldBeSad)       setMood('sad')
  else if (done / total >= 0.8) setMood('happy')
  else                   setMood('content')
}

// ── Particles ──────────────────────────────────────────────────────────────
const SPARKS = ['✨', '🌸', '💖', '⭐', '🎉']
function spawnParticles(count = 5) {
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const p = document.createElement('div')
      p.className = 'particle'
      p.textContent = SPARKS[Math.floor(Math.random() * SPARKS.length)]
      p.style.left = (30 + Math.random() * 140) + 'px'
      p.style.top  = (60 + Math.random() * 80)  + 'px'
      particles.appendChild(p)
      setTimeout(() => p.remove(), 1300)
    }, i * 120)
  }
}

// ── Streak ─────────────────────────────────────────────────────────────────
function updateStreak() {
  const today = new Date().toDateString()
  if (data.lastDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toDateString()
    data.streak = data.lastDate === yesterday ? data.streak + 1 : 1
    data.lastDate = today
  }
}

function renderStats() {
  const fire = data.streak >= 3 ? '🔥' : '📅'
  streakEl.textContent = `${fire} ${data.streak} day streak`
  xpEl.textContent = `✨ ${data.totalCompleted} pts`
}

// ── Tasks ──────────────────────────────────────────────────────────────────
function renderTasks() {
  taskList.innerHTML = ''
  const pending = data.tasks.filter(t => !t.done)
  const done    = data.tasks.filter(t =>  t.done)
  const ordered = [...pending, ...done]

  ordered.forEach(task => {
    const li = document.createElement('li')
    if (task.done) li.classList.add('done')

    const cb = document.createElement('input')
    cb.type = 'checkbox'
    cb.checked = task.done
    cb.addEventListener('change', () => toggleTask(task.id))

    const span = document.createElement('span')
    span.className = 'task-text'
    span.textContent = task.text
    span.addEventListener('click', () => toggleTask(task.id))

    const del = document.createElement('button')
    del.className = 'delete-btn'
    del.textContent = '×'
    del.addEventListener('click', () => deleteTask(task.id))

    li.appendChild(cb)
    li.appendChild(span)
    li.appendChild(del)
    taskList.appendChild(li)
  })

  emptyState.classList.toggle('visible', data.tasks.length === 0)
  recalcMood()
  renderStats()
}

function addTask(text) {
  if (!text.trim()) return
  data.tasks.push({ id: Date.now(), text: text.trim(), done: false })
  save()
  renderTasks()
  resetIdle()
}

function toggleTask(id) {
  const task = data.tasks.find(t => t.id === id)
  if (!task) return
  task.done = !task.done

  if (task.done) {
    data.totalCompleted++
    updateStreak()
    spawnParticles(6)
    mocha.classList.add('celebrating')
    setTimeout(() => mocha.classList.remove('celebrating'), 2200)
  }

  save()
  renderTasks()
  resetIdle()
}

function deleteTask(id) {
  data.tasks = data.tasks.filter(t => t.id !== id)
  clearTimeout(sadTimer)
  sadTimer = null
  save()
  renderTasks()
}

// ── Idle detection ─────────────────────────────────────────────────────────
function resetIdle() {
  clearTimeout(idleTimer)
  if (mocha.className === 'idle') {
    mocha.className = ''
    recalcMood()
  }
  idleTimer = setTimeout(() => setMood('idle'), IDLE_MS)
}

document.addEventListener('mousemove', resetIdle)
document.addEventListener('keydown',   resetIdle)

// ── Eyes follow mouse ──────────────────────────────────────────────────────
document.addEventListener('mousemove', e => {
  const rect = mocha.getBoundingClientRect()
  const cx = rect.left + rect.width  / 2
  const cy = rect.top  + rect.height / 2
  const dx = (e.clientX - cx) / rect.width
  const dy = (e.clientY - cy) / rect.height
  const MAX = 3

  const mood = MOODS[mocha.className] || MOODS.content
  const baseY = 98 + (mood.pupils?.dy ?? 0)

  const lx = Math.round(74  + dx * MAX)
  const rx = Math.round(126 + dx * MAX)
  const ly = Math.round(baseY + dy * MAX)

  pupilL.setAttribute('cx', String(lx))
  pupilL.setAttribute('cy', String(ly))
  pupilR.setAttribute('cx', String(rx))
  pupilR.setAttribute('cy', String(ly))

  // highlights offset from pupil centre: +8/-10 for large, +13/-4 for small
  glossL1.setAttribute('cx', String(lx + 8))
  glossL1.setAttribute('cy', String(ly - 10))
  glossR1.setAttribute('cx', String(rx + 8))
  glossR1.setAttribute('cy', String(ly - 10))
  glossL2.setAttribute('cx', String(lx + 13))
  glossL2.setAttribute('cy', String(ly - 4))
  glossR2.setAttribute('cx', String(rx + 13))
  glossR2.setAttribute('cy', String(ly - 4))
})

// ── Random idle animations ─────────────────────────────────────────────────
const earL = document.getElementById('ear-left')
const earR = document.getElementById('ear-right')

function idleEarTwitch() {
  earL.classList.add('ear-twitch-left')
  setTimeout(() => earL.classList.remove('ear-twitch-left'), 800)
  setTimeout(() => {
    earR.classList.add('ear-twitch-right')
    setTimeout(() => earR.classList.remove('ear-twitch-right'), 800)
  }, 250)
}

function idleHeadTilt() {
  mocha.classList.add('head-tilt')
  setTimeout(() => mocha.classList.remove('head-tilt'), 2100)
}

function idleLookAround() {
  const steps = [
    { dx: -4, dy: 0 }, { dx: -4, dy: 0 },
    { dx:  4, dy: 0 }, { dx:  4, dy: 0 },
    { dx:  0, dy: 0 }
  ]
  steps.forEach(({ dx, dy }, i) => {
    setTimeout(() => {
      pupilL.setAttribute('cx', String(74  + dx))
      pupilL.setAttribute('cy', String(98  + dy))
      pupilR.setAttribute('cx', String(126 + dx))
      pupilR.setAttribute('cy', String(98  + dy))
      glossL1.setAttribute('cx', String(82  + dx))
      glossL1.setAttribute('cy', String(88  + dy))
      glossR1.setAttribute('cx', String(134 + dx))
      glossR1.setAttribute('cy', String(88  + dy))
      glossL2.setAttribute('cx', String(87  + dx))
      glossL2.setAttribute('cy', String(94  + dy))
      glossR2.setAttribute('cx', String(139 + dx))
      glossR2.setAttribute('cy', String(94  + dy))
    }, i * 400)
  })
}

function idleDoubleBlink() {
  const eyelids = document.querySelectorAll('.eyelid')
  eyelids.forEach(e => {
    e.classList.remove('double-blink')
    void e.offsetWidth
    e.classList.add('double-blink')
    setTimeout(() => e.classList.remove('double-blink'), 650)
  })
}

function isNight() {
  const h = new Date().getHours()
  return h >= 22 || h < 6
}

function idleSleepyEyes() {
  const eyelids = document.querySelectorAll('.eyelid')
  eyelids.forEach(e => {
    e.classList.remove('sleepy')
    void e.offsetWidth // force reflow to restart animation
    e.classList.add('sleepy')
    setTimeout(() => e.classList.remove('sleepy'), 2600)
  })
}

function idleYawn() {
  const yawnPath = 'M 88 136 Q 100 158 112 136'
  const normalPath = MOODS[mocha.className]?.mouth || MOODS.content.mouth
  // open wide
  mouthPath.setAttribute('d', yawnPath)
  // hold open, then close
  setTimeout(() => mouthPath.setAttribute('d', normalPath), 1800)
  // sleepy eyes during yawn
  setTimeout(() => idleSleepyEyes(), 200)
}

const IDLE_ANIMS = [idleEarTwitch, idleHeadTilt, idleLookAround, idleDoubleBlink]
const NIGHT_ANIMS = [idleYawn, idleSleepyEyes]

function scheduleIdleAnim() {
  const delay = 20000 + Math.random() * 20000 // 20–40s
  setTimeout(() => {
    const isBusy = mocha.classList.contains('celebrating') || mocha.classList.contains('petting')
    if (!isBusy) {
      const pool = isNight()
        ? [...IDLE_ANIMS, ...NIGHT_ANIMS, ...NIGHT_ANIMS] // weight night anims higher at night
        : IDLE_ANIMS
      pool[Math.floor(Math.random() * pool.length)]()
    }
    scheduleIdleAnim()
  }, delay)
}

// ── Click vs long-press (pet) ──────────────────────────────────────────────
let expanded    = false
let pressTimer  = null
let didPet      = false
let petInterval = null
const PET_HEARTS = ['💗', '💕', '🩷', '✨', '💖']

function startPetting() {
  didPet = true
  mocha.classList.add('petting')
  setMood('happy')
  spawnHearts()
  petInterval = setInterval(spawnHearts, 800)
}

function stopPetting() {
  mocha.classList.remove('petting')
  clearInterval(petInterval)
  petInterval = null
  recalcMood()
}

function spawnHearts() {
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      const p = document.createElement('div')
      p.className = 'particle'
      p.textContent = PET_HEARTS[Math.floor(Math.random() * PET_HEARTS.length)]
      p.style.left = (20 + Math.random() * 110) + 'px'
      p.style.top  = (20 + Math.random() * 80)  + 'px'
      particles.appendChild(p)
      setTimeout(() => p.remove(), 1300)
    }, i * 100)
  }
}

mocha.addEventListener('mousedown', () => {
  didPet = false
  pressTimer = setTimeout(() => startPetting(), 400)
})

mocha.addEventListener('mouseup', () => {
  clearTimeout(pressTimer)
  if (didPet) {
    stopPetting()
  } else {
    expanded = !expanded
    taskPanel.classList.toggle('hidden', !expanded)
    ipcRenderer.send(expanded ? 'expand' : 'collapse')
  }
})

mocha.addEventListener('mouseleave', () => {
  if (didPet) stopPetting()
  clearTimeout(pressTimer)
})

// ── Input ──────────────────────────────────────────────────────────────────
document.getElementById('add-btn').addEventListener('click', () => {
  addTask(taskInput.value)
  taskInput.value = ''
})

taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    addTask(taskInput.value)
    taskInput.value = ''
  }
})

// ── Pomodoro ───────────────────────────────────────────────────────────────
const POMO_WORK  = 25 * 60
const POMO_BREAK =  5 * 60

let pomoSeconds  = POMO_WORK
let pomoRunning  = false
let pomoInterval = null
let pomoIsBreak  = false

const pomoEl     = document.getElementById('pomodoro')
const pomoTime   = document.getElementById('pomo-time')
const pomoStatus = document.getElementById('pomo-status')
const pomoToggle = document.getElementById('pomo-toggle')

function pomoFormat(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${m}:${sec}`
}

function pomoRender() {
  pomoTime.textContent = pomoFormat(pomoSeconds)
}

function pomoTick() {
  if (pomoSeconds > 0) {
    pomoSeconds--
    pomoRender()
  } else {
    clearInterval(pomoInterval)
    pomoRunning = false
    pomoToggle.textContent = '▶'
    pomoToggle.classList.remove('running')

    if (!pomoIsBreak) {
      // work session done — celebrate
      pomoIsBreak = true
      pomoSeconds = POMO_BREAK
      pomoEl.classList.add('break')
      pomoStatus.textContent = '☕ Break'
      spawnParticles(6)
      mocha.classList.add('celebrating')
      setTimeout(() => mocha.classList.remove('celebrating'), 2200)
    } else {
      // break done — back to work
      pomoIsBreak = false
      pomoSeconds = POMO_WORK
      pomoEl.classList.remove('break')
      pomoStatus.textContent = '🍅 Focus'
    }
    pomoRender()
  }
}

// click time to edit duration (only when stopped)
const pomoEdit = document.getElementById('pomo-edit')

pomoTime.addEventListener('click', () => {
  if (pomoRunning) return
  pomoEdit.value = Math.floor(pomoSeconds / 60) || Math.floor(POMO_WORK / 60)
  pomoTime.style.display = 'none'
  pomoEdit.style.display = 'block'
  pomoEdit.focus()
  pomoEdit.select()
})

function commitPomoEdit() {
  const mins = Math.max(1, Math.min(99, parseInt(pomoEdit.value) || 25))
  pomoSeconds = mins * 60
  pomoIsBreak = false
  pomoEl.classList.remove('break')
  pomoStatus.textContent = '🍅 Focus'
  pomoEdit.style.display = 'none'
  pomoTime.style.display = 'block'
  pomoRender()
}

pomoEdit.addEventListener('blur', commitPomoEdit)
pomoEdit.addEventListener('keydown', e => {
  if (e.key === 'Enter') pomoEdit.blur()
  if (e.key === 'Escape') {
    pomoEdit.style.display = 'none'
    pomoTime.style.display = 'block'
  }
})

pomoToggle.addEventListener('click', () => {
  if (pomoRunning) {
    clearInterval(pomoInterval)
    pomoRunning = false
    pomoToggle.textContent = '▶'
    pomoToggle.classList.remove('running')
  } else {
    pomoInterval = setInterval(pomoTick, 1000)
    pomoRunning = true
    pomoToggle.textContent = '⏸'
    pomoToggle.classList.add('running')
  }
})

document.getElementById('pomo-reset').addEventListener('click', () => {
  clearInterval(pomoInterval)
  pomoRunning  = false
  pomoIsBreak  = false
  pomoSeconds  = POMO_WORK
  pomoEl.classList.remove('break')
  pomoStatus.textContent = '🍅 Focus'
  pomoToggle.textContent = '▶'
  pomoToggle.classList.remove('running')
  pomoRender()
})

// ── Panel footer ───────────────────────────────────────────────────────────
let alwaysOnTop = true

document.getElementById('ctx-top').addEventListener('click', () => {
  alwaysOnTop = !alwaysOnTop
  ipcRenderer.send('set-on-top', alwaysOnTop)
  document.getElementById('ctx-top').textContent =
    `📌 Always on top: ${alwaysOnTop ? 'on' : 'off'}`
})

document.getElementById('ctx-reset').addEventListener('click', () => {
  data.tasks = []
  clearTimeout(sadTimer)
  sadTimer = null
  save()
  renderTasks()
})

document.getElementById('ctx-close').addEventListener('click', () => {
  ipcRenderer.send('quit')
})

// ── Persist ────────────────────────────────────────────────────────────────
async function save() {
  await ipcRenderer.invoke('save-data', data)
}

// ── Startup greeting ───────────────────────────────────────────────────────
const speechBubble = document.getElementById('speech-bubble')

function showGreeting() {
  const h = new Date().getHours()
  const pending = data.tasks.filter(t => !t.done).length
  const done    = data.tasks.filter(t =>  t.done).length

  let msg
  if (h >= 5 && h < 12) {
    msg = pending > 0 ? `good morning! ${pending} task${pending > 1 ? 's' : ''} left ☀️`
                      : 'good morning! ready to focus? ☀️'
  } else if (h >= 12 && h < 17) {
    msg = pending > 0 ? `hey! still ${pending} to go 💪`
                      : done > 0 ? 'crushing it today! 🌸' : 'good afternoon~ 🌸'
  } else if (h >= 17 && h < 21) {
    msg = pending > 0 ? `almost done! ${pending} left 🌙` : 'great work today! 🌙'
  } else {
    msg = 'still up? let\'s get cozy 🌛'
  }

  speechBubble.textContent = msg
  speechBubble.classList.add('visible')
  setTimeout(() => speechBubble.classList.remove('visible'), 4000)
}

// ── Boot ───────────────────────────────────────────────────────────────────
;(async () => {
  data = await ipcRenderer.invoke('load-data')
  renderTasks()
  resetIdle()
  scheduleIdleAnim()
  setTimeout(() => setMood('happy'), 600)
  setTimeout(() => { spawnParticles(4); showGreeting() }, 800)
})()
