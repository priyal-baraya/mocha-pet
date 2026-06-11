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
  earL.classList.add('ear-twitch')
  setTimeout(() => earL.classList.remove('ear-twitch'), 900)
  setTimeout(() => {
    earR.classList.add('ear-twitch')
    setTimeout(() => earR.classList.remove('ear-twitch'), 900)
  }, 200)
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
  const blink = () => {
    eyelids.forEach(e => e.style.transform = 'scaleY(1)')
    setTimeout(() => eyelids.forEach(e => e.style.transform = 'scaleY(0)'), 120)
  }
  blink()
  setTimeout(blink, 350)
}

const IDLE_ANIMS = [idleEarTwitch, idleHeadTilt, idleLookAround, idleDoubleBlink]

function scheduleIdleAnim() {
  const delay = 20000 + Math.random() * 20000 // 20–40s
  setTimeout(() => {
    const isBusy = mocha.classList.contains('celebrating') || mocha.classList.contains('petting')
    if (!isBusy) {
      IDLE_ANIMS[Math.floor(Math.random() * IDLE_ANIMS.length)]()
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

// ── Close button ───────────────────────────────────────────────────────────
document.getElementById('close-btn').addEventListener('click', () => {
  ipcRenderer.send('quit')
})

// ── Persist ────────────────────────────────────────────────────────────────
async function save() {
  await ipcRenderer.invoke('save-data', data)
}

// ── Boot ───────────────────────────────────────────────────────────────────
;(async () => {
  data = await ipcRenderer.invoke('load-data')
  renderTasks()
  resetIdle()
  scheduleIdleAnim()
  // Greet on open
  setTimeout(() => setMood('happy'), 600)
  setTimeout(() => spawnParticles(4), 800)
})()
