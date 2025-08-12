const table = document.getElementById('dex');
const q = document.getElementById('q');
const hideCaught = document.getElementById('hideCaught');
const countEl = document.getElementById('count');
const tabs = document.getElementById('tabs');
const availabilityFilter = document.getElementById('availabilityFilter');

const STORAGE_KEY = 'hoenn_caught_v4';
let DATA = null;
let currentSheet = 0;

// PWA: service worker + install prompt
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.style.display = 'inline-block';
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = 'none';
});
window.addEventListener('appinstalled', () => {
  if (installBtn) installBtn.style.display = 'none';
});

// Dynamic sticky header offset
function calcHeadOffset(){
  const header = document.querySelector('header');
  const t = document.getElementById('tabs');
  const h = (header?.offsetHeight||0) + (t?.offsetHeight||0);
  document.documentElement.style.setProperty('--head-offset', (h||98)+'px');
}
window.addEventListener('resize', calcHeadOffset);
window.addEventListener('load', calcHeadOffset);
setTimeout(calcHeadOffset, 50);

// Contrast helpers
function hexToRgb(hex){const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex||'');return m?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}:null;}
function luminance(r,g,b){const a=[r,g,b].map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);});return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2];}
function contrastColor(hex){const rgb=hexToRgb(hex);if(!rgb) return null;return luminance(rgb.r,rgb.g,rgb.b)>0.6?'#0b1020':null;}

function cellBg(styleMap, header){
  const s = styleMap && styleMap[header];
  return s && s.bg ? s.bg : null;
}

function toSlug(name){return String(name||'').replace(/♀/g,'f').replace(/♂/g,'m').replace(/[ .’']/g,'').toLowerCase();}
function deriveNameAndLink(row, headers){
  if (row._Name || row._Link) return {name: row._Name, link: row._Link};
  for (const h of headers){
    const v = row[h];
    if (typeof v === 'string' && v.includes(' Link (Serebii)')){
      const name = v.replace(' Link (Serebii)','').trim();
      return {name, link: 'https://www.serebii.net/pokemon/'+toSlug(name)+'/'};
    }
  }
  for (const h of headers){
    const v = row[h];
    if (typeof v === 'string' && v.length <= 30 && /^[A-Za-z][A-Za-z\-\.\s'’♀♂]*$/.test(v)){
      const name = v.trim();
      return {name, link: 'https://www.serebii.net/pokemon/'+toSlug(name)+'/'};
    }
  }
  return {name:'', link:''};
}

function getProgress(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'); } catch{ return {}; } }
function setProgress(p){ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
let progress = getProgress();

function renderTabs() {
  tabs.innerHTML = '';
  DATA.sheets.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.textContent = s.sheet;
    btn.className = 'tab' + (i===currentSheet ? ' active' : '');
    btn.addEventListener('click', () => {
      currentSheet = i;
      render();
      buildAvailabilityFilter();
      document.querySelectorAll('.tab').forEach((t, idx) => t.classList.toggle('active', idx===currentSheet));
      calcHeadOffset();
    });
    tabs.appendChild(btn);
  });
}

function buildAvailabilityFilter(){
  const s = DATA.sheets[currentSheet];
  const idx = s.headers.findIndex(h => String(h).toLowerCase().includes('availability'));
  const values = new Set();
  if(idx >= 0){
    s.rows.forEach(r => {
      const v = r[s.headers[idx]];
      if(v != null && String(v).trim()) values.add(String(v));
    });
  }
  const selected = availabilityFilter.value;
  availabilityFilter.innerHTML = `<option value="">All availability</option>` + 
    Array.from(values).sort().map(v => `<option value="${v}">${v}</option>`).join('');
  availabilityFilter.value = selected || '';
}

function render(){
  const s = DATA.sheets[currentSheet];
  const headers = s.headers;
  const nameHeader = headers[s.name_idx] || 'Pokémon';
  let html = '<thead><tr>';
  html += '<th>Caught?</th>';
  headers.forEach(h => html += `<th>${h||''}</th>`);
  html += '</tr></thead><tbody>';

  const term = (q.value||'').toLowerCase();
  const availSel = availabilityFilter.value;
  let shown = 0;
  s.rows.forEach(r => {
    const id = `${s.sheet}:${r._Dex ?? r._Name}`;
    const caught = !!progress[id];
    if(hideCaught.checked && caught) return;
    if(availSel){
      const ai = headers.findIndex(h => String(h).toLowerCase().includes('availability'));
      const av = ai>=0 ? r[headers[ai]] : '';
      if(String(av) !== availSel) return;
    }
    const hay = Object.values(r).join(' ').toLowerCase();
    if(term && !hay.includes(term)) return;

    shown++;
    html += '<tr>';
    html += `<td><button class="caughtToggle ${caught?'checked':''}" data-id="${id}"><span>${caught?'✓':''}</span></button></td>`;
    headers.forEach(h => {
      let val = r[h];
      if(val == null) val = '';
      let style = '';
      const bg = cellBg(r._styles, h);
      if(bg){ const txt = contrastColor(bg); style = ` style="background:${bg}${txt?';color:'+txt:''}"`; }

      if (h === nameHeader || String(h).includes('Pokémon')) {
        const fb = deriveNameAndLink(r, headers);
        const nm = (r._Name || (typeof val==='string'?val.replace(' Link (Serebii)','').trim():'') || fb.name || '');
        const link = (r._Link || fb.link || '#');
        if (nm) html += `<td${style}><a href="${link}" target="_blank" rel="noopener">${nm}</a></td>`;
        else html += `<td${style}></td>`;
      } else {
        html += `<td${style}>${String(val)}</td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;
  countEl.textContent = `${shown} shown / ${s.rows.length} total`;
  document.querySelectorAll('.caughtToggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const cur = !!progress[id];
      progress[id] = !cur;
      if(!progress[id]) delete progress[id];
      setProgress(progress);
      render();
    });
  });
  // Update title with counters
  let total = s.rows.length, caughtCt = 0;
  s.rows.forEach(r => { const id = `${s.sheet}:${r._Dex ?? r._Name}`; if (progress[id]) caughtCt++; });
  document.title = `Hoenn Dex — ${s.sheet} (${caughtCt}/${total})`;
}

async function load(){
  const resp = await fetch('app_data_all.json?v=4');
  DATA = await resp.json();
  renderTabs();
  buildAvailabilityFilter();
  render();
}

q.addEventListener('input', () => render());
hideCaught.addEventListener('change', () => render());
availabilityFilter.addEventListener('change', () => render());

// export/import
document.getElementById('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(progress)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hoenn_progress_all.json';
  a.click();
  URL.revokeObjectURL(a.href);
});
document.getElementById('import').addEventListener('click', () => {
  document.getElementById('importFile').click();
});
document.getElementById('importFile').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      progress = JSON.parse(reader.result);
      setProgress(progress);
      render();
    } catch(e){ alert('Invalid file'); }
  };
  reader.readAsText(f);
});

load();
