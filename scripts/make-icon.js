const { Resvg } = require('@resvg/resvg-js')
const pngToIco = require('png-to-ico')
const fs        = require('fs')
const path      = require('path')

const svg = `<svg viewBox="0 0 200 210" xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="200" height="210" fill="none"/>
  <ellipse id="ear-left"  cx="55"  cy="68" rx="24" ry="22" fill="#9e8e80"/>
  <ellipse id="ear-right" cx="145" cy="68" rx="24" ry="22" fill="#9e8e80"/>
  <ellipse cx="55"  cy="69" rx="14" ry="13" fill="#c8a898"/>
  <ellipse cx="145" cy="69" rx="14" ry="13" fill="#c8a898"/>
  <ellipse cx="100" cy="178" rx="46" ry="36" fill="#a89880"/>
  <ellipse cx="100" cy="108" rx="76" ry="58" fill="#b8a898"/>
  <ellipse cx="100" cy="114" rx="56" ry="44" fill="#d0bfaf" opacity="0.5"/>
  <ellipse cx="100" cy="178" rx="30" ry="22" fill="#d0c0ae" opacity="0.55"/>
  <circle cx="74"  cy="98" r="21" fill="#0d0808"/>
  <circle cx="126" cy="98" r="21" fill="#0d0808"/>
  <circle cx="82"  cy="88" r="8"  fill="white" opacity="0.92"/>
  <circle cx="134" cy="88" r="8"  fill="white" opacity="0.92"/>
  <circle cx="87"  cy="94" r="4"  fill="white" opacity="0.5"/>
  <circle cx="139" cy="94" r="4"  fill="white" opacity="0.5"/>
  <ellipse cx="100" cy="128" rx="4" ry="3" fill="#7a5050"/>
  <path d="M 93 136 Q 100 143 107 136" stroke="#7a5050" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <ellipse cx="63"  cy="122" rx="14" ry="8" fill="#c07868" opacity="0.2"/>
  <ellipse cx="137" cy="122" rx="14" ry="8" fill="#c07868" opacity="0.2"/>
  <ellipse cx="68"  cy="190" rx="18" ry="11" fill="#a89880"/>
  <ellipse cx="132" cy="190" rx="18" ry="11" fill="#a89880"/>
  <circle cx="60"  cy="195" r="4" fill="#9a8070"/>
  <circle cx="68"  cy="197" r="4" fill="#9a8070"/>
  <circle cx="76"  cy="195" r="4" fill="#9a8070"/>
  <circle cx="124" cy="195" r="4" fill="#9a8070"/>
  <circle cx="132" cy="197" r="4" fill="#9a8070"/>
  <circle cx="140" cy="195" r="4" fill="#9a8070"/>
  <path d="M 148 57 C 140 48 128 46 128 54 C 128 62 140 64 148 61 Z" fill="#f9a8c0" stroke="#e07898" stroke-width="0.7"/>
  <path d="M 148 57 C 156 48 168 46 168 54 C 168 62 156 64 148 61 Z" fill="#f9a8c0" stroke="#e07898" stroke-width="0.7"/>
  <path d="M 145 61 C 141 67 137 72 134 70" stroke="#e07898" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <path d="M 151 61 C 155 67 159 72 162 70" stroke="#e07898" stroke-width="1.5" fill="none" stroke-linecap="round"/>
  <circle cx="148" cy="58" r="5"   fill="#fdd0e0" stroke="#e07898" stroke-width="0.7"/>
  <circle cx="148" cy="58" r="2.5" fill="#f9a8c0"/>
</svg>`

async function makeIcon() {
  const assetsDir = path.join(__dirname, '..', 'assets')
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir)

  // SVG → 1024×1024 PNG
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } })
  const png1024 = resvg.render().asPng()
  fs.writeFileSync(path.join(assetsDir, 'icon.png'), png1024)
  console.log('✓ icon.png (1024×1024)')

  // 256×256 PNG saved to disk for ICO conversion
  const resvg256 = new Resvg(svg, { fitTo: { mode: 'width', value: 256 } })
  const png256path = path.join(assetsDir, 'icon-256.png')
  fs.writeFileSync(png256path, resvg256.render().asPng())

  // file path → ICO
  const pngToIcoFn = pngToIco.default || pngToIco
  const ico = await pngToIcoFn([png256path])
  fs.writeFileSync(path.join(assetsDir, 'icon.ico'), ico)
  fs.unlinkSync(png256path)
  console.log('✓ icon.ico')
  console.log('\nDone! assets/icon.ico is ready.')
}

makeIcon().catch(console.error)
