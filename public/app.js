// ── State ─────────────────────────────────────────────────────────────────────
const S={
  view:'home',fieldId:null,nodeRef:null,
  assessStep:0,
  assessData:{wpwText:'',interText:'',proofUrl:'',pass:null},
  challenge:null,
  scaffoldResult:null,scaffolding:false,scaffoldMsg:'',
  draftField: null,
  data:{fields:[], todos:[]}
};

// ── Util ──────────────────────────────────────────────────────────────────────
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const getField=id=>S.data.fields.find(f=>f.id===id);
const getNode=(fid,pi,ni)=>getField(fid)?.phases[pi]?.nodes[ni];

function phaseProgress(p){
  const n=p.nodes||[];if(!n.length)return 0;
  return Math.round(n.filter(x=>x.combined!==null&&x.combined>=5).length/n.length*100);
}
function isUnlocked(field,pi){
  if(pi===0)return true;
  const prev=field.phases[pi-1];
  const pct=phaseProgress(prev);
  const thr=prev.unlock_threshold||80;
  const floor=(prev.nodes||[]).every(n=>n.combined===null||n.combined>=3);
  return pct>=thr&&floor;
}
function phaseStatus(field,pi){
  if(!isUnlocked(field,pi))return'locked';
  const pct=phaseProgress(field.phases[pi]);
  return pct>=(field.phases[pi].unlock_threshold||80)?'done':'active';
}
function calcScore(arr){
  return Math.round(arr.reduce((a,b)=>a+(b||0),0)/(arr.length*2)*10);
}
const axCls=a=>a==='theory'?'ax-t':a==='skill'?'ax-s':'ax-m';
const axLbl=a=>a==='theory'?'Theory':a==='skill'?'Skill':'Mixed';
const domCls=d=>d==='theory'?'d-theory':d==='skill'?'d-skill':'d-mixed';
const domLbl=d=>d==='theory'?'Theory-heavy':d==='skill'?'Skill-heavy':'Theory + Skill';

// ── Markdown & Upload ────────────────────────────────────────────────────────
function renderMarkdownData(text, edId) {
  if (!text) return '';
  
  // 1. Process custom media elements first so we keep our delete buttons & styling
  let processedText = text.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
    const lUrl = url.toLowerCase();
    const delBtn = edId ? `<button class="btn btn-sm btn-danger" style="position:absolute;top:10px;right:10px;" onclick="removeMedia('${url}', '${edId}')">Delete</button>` : '';
    if (lUrl.endsWith('.mp4') || lUrl.endsWith('.webm') || lUrl.endsWith('.mov')) {
      return `\n\n<div style="position:relative; margin:10px 0; border-radius:8px; overflow:hidden; border:1px solid var(--border); background:var(--bg2)"><video controls style="max-width:100%; display:block; max-height:400px; margin:0 auto;"><source src="${url}"></video>${delBtn}</div>\n\n`;
    } else {
      return `\n\n<div style="position:relative; margin:10px 0; border-radius:8px; overflow:hidden; border:1px solid var(--border); background:var(--bg2); display:flex; justify-content:center;"><img src="${url}" alt="${alt}" style="max-width:100%; object-fit:contain; max-height:400px; cursor:pointer;" onclick="window.open('${url}','_blank')">${delBtn}</div>\n\n`;
    }
  });

  // 2. Use marked if available for rich Markdown support (headers, lists, etc)
  if (typeof marked !== 'undefined') {
    return marked.parse(processedText, { breaks: true, gfm: true });
  }

  // 3. Fallback logic if marked isn't loaded
  let html = processedText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:var(--purple); text-decoration:underline">$1</a>');
  html = html.replace(/\n/g, '<br/>');
  return html;
}

window.togglePreview = function(btn, edId, prvId) {
  const ed = document.getElementById(edId);
  const prv = document.getElementById(prvId);
  if (!ed || !prv) return;
  if (ed.style.display === 'none') {
    ed.style.display = 'block';
    prv.style.display = 'none';
    btn.innerText = 'Preview';
  } else {
    ed.style.display = 'none';
    prv.style.display = 'block';
    prv.innerHTML = renderMarkdownData(ed.value, edId) || '<span style="font-style:italic">No content yet</span>';
    btn.innerText = 'Edit';
  }
};

window.removeMedia = function(url, edId) {
  const ed = document.getElementById(edId);
  if (!ed) return;
  if (!confirm('Remove this media from your notes? (This removes it from this text layout)')) return;
  const escapedUrl = url.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`!\\[.*?\\]\\(${escapedUrl}\\)`);
  ed.value = ed.value.replace(regex, '');
  ed.dispatchEvent(new Event('input', { bubbles: true }));
  // Refresh preview if it's currently showing
  const prvId = edId.replace('editor', 'preview');
  const prv = document.getElementById(prvId);
  if (prv && prv.style.display === 'block') {
    prv.innerHTML = renderMarkdownData(ed.value, edId) || '<span style="font-style:italic">No content yet</span>';
  }
};

async function handleFileUpload(file) {
  if (!file) return null;
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'X-File-Name': file.name },
      body: file
    });
    if (res.ok) {
      const data = await res.json();
      return '/' + data.url;
    }
  } catch(e) {
    console.error("Upload failed", e);
  }
  alert("File upload failed. Check standard output log.");
  return null;
}

window.triggerMediaUpload = function(inputId) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*,video/*';
  inp.style.display = 'none';
  inp.onchange = async (e) => {
    const fn = e.target.files[0];
    if(fn) {
      const el = document.getElementById(inputId);
      const prevVal = el.value;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      el.value = prevVal.slice(0, start) + "\nUploading...\n" + prevVal.slice(end);
      
      const url = await handleFileUpload(fn);
      if(url) {
        const md = `![media](${url})`;
        el.value = prevVal.slice(0, start) + "\n" + md + "\n" + prevVal.slice(end);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        el.value = prevVal; // revert
      }
    }
  };
  document.body.appendChild(inp);
  inp.click();
  setTimeout(() => document.body.removeChild(inp), 1000);
};

// ── Storage ───────────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch('/api/fields');
    if (res.ok) {
      const rawFields = await res.json();
      rawFields.forEach(f => {
        if (!f.id) f.id = uid();
        (f.phases || []).forEach((p, pi) => {
          if (!p.id) p.id = 'p_' + uid();
          if (p.phase === undefined) p.phase = pi + 1;
          if (!p.depends_on) p.depends_on = [];
          if (!p.level_cap) p.level_cap = 10;
          (p.nodes || []).forEach(n => {
            if (!n.id) n.id = uid();
          });
        });
      });
      S.data.fields = rawFields;
    } else {
      S.data.fields = [];
    }
  } catch(e) {
    console.warn("Could not load from server, falling back to empty fields.", e);
    S.data.fields = [];
  }
  try {
    const res2 = await fetch('/api/todos');
    if(res2.ok) S.data.todos = await res2.json();
    else S.data.todos = [];
  } catch(e) { S.data.todos = []; }
}

async function saveFieldData(fieldObj) {
  try {
    await fetch('/api/fields', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fieldObj)
    });
  } catch(e) {
    console.error("Failed to save field to server.", e);
    alert("Failed to save field to local data folder. Is the Python server running?");
  }
}

async function deleteFieldData(fieldId) {
  try {
    await fetch('/api/fields/' + fieldId, {
      method: 'DELETE'
    });
  } catch(e) {
    console.error("Failed to delete field from server.", e);
  }
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function nav(view,opts={}){
  S.view=view;
  if(opts.fieldId!==undefined)S.fieldId=opts.fieldId;
  if(opts.nodeRef!==undefined)S.nodeRef=opts.nodeRef;
  if(opts.phaseIdx!==undefined)S.phaseIdx=opts.phaseIdx;
  if(view==='assess'){S.assessStep=0;S.assessData={wpwText:'',interText:'',proofUrl:'',pass:null};S.challenge=null;}
  if(view==='add'){
    S.scaffoldResult=null;
    S.scaffoldMsg='';
    S.draftField = {
      id: null, // null implies new
      field: '', domain: 'mixed', description: '', curriculum_design: '',
      phases: []
    };
  }
  if(view==='edit'){
    const f = getField(S.fieldId);
    if(f) {
      S.scaffoldResult=null;
      S.scaffoldMsg='';
      // Deep clone to avoid mutating state directly before saving
      S.draftField = JSON.parse(JSON.stringify(f));
      S.view = 'add'; // Re-use the form view
    } else {
      S.view = 'home';
    }
  }
  render();
}

// ── Import / Export ───────────────────────────────────────────────────────────
function triggerImport() {
  const fileInput = document.getElementById('import-file');
  if (fileInput) fileInput.click();
}

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const importedField = JSON.parse(event.target.result);
      if (!importedField.field || !importedField.phases) throw new Error("Invalid field file format.");
      
      importedField.id = uid();
      if (importedField.phases) {
        importedField.phases.forEach(p => {
          if (p.nodes) {
            p.nodes.forEach(n => { n.id = uid(); });
          }
        });
      }
      
      S.data.fields.push(importedField);
      await saveFieldData(importedField);
      nav('home');
      alert(`Successfully imported: ${importedField.field}`);
    } catch (err) {
      alert("Failed to import: " + err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

function exportField(fieldId) {
  const field = getField(fieldId);
  if (!field) return;
  const exportData = JSON.stringify(field, null, 2);
  const blob = new Blob([exportData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${field.field.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-curriculum.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Embed Parsing ─────────────────────────────────────────────────────────────
function renderProofEmbed(url) {
  if (!url) return '';
  try {
    const p = new URL(url);
    const host = p.hostname.toLowerCase();
    
    // YouTube
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let vid = '';
      if (host.includes('youtu.be')) vid = p.pathname.slice(1);
      else vid = p.searchParams.get('v');
      if (vid) {
        return `<div style="margin-top:12px;border-radius:var(--r);overflow:hidden;border:1px solid var(--border)"><iframe width="100%" height="200" src="https://www.youtube.com/embed/${vid}" frameborder="0" allowfullscreen></iframe></div>`;
      }
    }
    
    // Raw Images
    if (p.pathname.match(/\.(jpeg|jpg|gif|png|webp)$/i) || host.includes('imgur.com/a/')===false && host.includes('imgur')) {
      let src = url;
      if (host.includes('imgur.com') && !p.pathname.match(/\./)) src += '.png';
      return `<div style="margin-top:12px;border-radius:var(--r);overflow:hidden;border:1px solid var(--border);max-height:200px;display:flex;justify-content:center;background:var(--bg2)"><img src="${src}" style="max-width:100%;object-fit:contain"></div>`;
    }
    
    // Fallback Link Display
    return `<div style="margin-top:12px;background:var(--bg2);padding:10px 14px;border-radius:var(--r);border:1px solid var(--border);display:flex;align-items:center;gap:10px">
      <span style="font-size:16px">🔗</span>
      <div style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        <div style="font-size:12px;font-weight:500;color:var(--text)">External Proof Link</div>
        <a href="${url}" target="_blank" style="font-size:12px;color:var(--purple);text-decoration:none">${url}</a>
      </div>
    </div>`;
  } catch(e) { return ''; } // Invalid URL
}

// ── Shared partials ───────────────────────────────────────────────────────────
function renderBars(node){
  if(node.combined===null)return`<span class="unassessed">Not assessed yet</span>`;
  const t=node.theory_score??0,s=node.skill_score??0,c=node.combined??0;
  return`<div class="sm-row" style="display:flex; align-items:center; gap:8px; margin-bottom:6px"><span class="sm-lbl" style="width:50px;font-size:11px;color:var(--text3)">Theory</span><div class="sm-bg" style="flex:1;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden"><div class="sm-fill" style="height:100%;width:${t*10}%;background:#7F77DD"></div></div><span class="sm-val" style="width:30px;font-size:11px;color:var(--text)">${t}/10</span></div>
<div class="sm-row" style="display:flex; align-items:center; gap:8px; margin-bottom:6px"><span class="sm-lbl" style="width:50px;font-size:11px;color:var(--text3)">Skill</span><div class="sm-bg" style="flex:1;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden"><div class="sm-fill" style="height:100%;width:${s*10}%;background:#1D9E75"></div></div><span class="sm-val" style="width:30px;font-size:11px;color:var(--text)">${s}/10</span></div>
<div class="sm-row" style="display:flex; align-items:center; gap:8px; margin-bottom:0"><span class="sm-lbl" style="width:50px;font-size:11px;color:var(--text3)">Combined</span><div class="sm-bg" style="flex:1;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden"><div class="sm-fill" style="height:100%;width:${c*10}%;background:#EF9F27"></div></div><span class="sm-val" style="width:30px;font-size:11px;color:var(--text)">${c.toFixed(1)}</span></div>`;
}

function renderPhaseNodes(p,pi,fieldId,unlocked){
  const allNodes = p.nodes || [];
  const visibleNodes = allNodes.slice(0, 3);
  const hiddenCount = allNodes.length - 3;
  
  let nodesHtml = visibleNodes.map(n => `
    <div class="tree-node" style="padding: 8px 10px; display:flex; align-items:center; min-height:45px;" onclick="openNote('${n.id}', '${n.name.replace(/'/g, "\\'")}')">
      <div class="tn-title" style="font-size:12px; font-weight:500; line-height:1.2;">${n.name}</div>
    </div>`).join('');
    
  if (hiddenCount > 0) {
    nodesHtml += `
      <div class="tree-node" style="padding: 8px 10px; display:flex; align-items:center; justify-content:center; background:transparent; border-style:dashed; cursor:pointer; min-height:45px;" onclick="nav('phase', {fieldId:'${fieldId}', phaseIdx:${pi}})">
        <div class="tn-title" style="color:var(--text3); font-style:italic; font-size:12px;">+ ${hiddenCount} more...</div>
      </div>`;
  }
  return `<div class="tree-node-grid" style="display:grid; grid-template-columns:repeat(2, 1fr); gap:6px; margin-top:8px; margin-bottom:2px;">${nodesHtml}</div>`;
}

function isUnlocked(field, pi) {
  const p = field.phases[pi];
  if (!p.depends_on || p.depends_on.length === 0) return true;
  return p.depends_on.every(reqId => {
    const parent = field.phases.find(x => x.id === reqId);
    return parent && parent.combined !== null && parent.combined >= 5;
  });
}

function phaseStatus(field, pi) {
  const p = field.phases[pi];
  if (p.combined !== null && p.combined >= 5) return 'done';
  return isUnlocked(field, pi) ? 'active' : 'locked';
}

function phaseProgress(p) {
  return p.combined !== null ? Math.round((p.combined / 10) * 100) : 0;
}

function renderPhasesHTML(phases,fieldId,interactive){
  const field=getField(fieldId);
  
  // Compute Depths
  const depthMap = {};
  let maxDepth = 0;
  let changed = true;
  let iters = 0;
  while(changed && iters < 100) {
    changed = false;
    iters++;
    phases.forEach(p => {
      let d = 0;
      if (p.depends_on && p.depends_on.length) {
        p.depends_on.forEach(reqId => { d = Math.max(d, (depthMap[reqId] || 0) + 1); });
      }
      if (depthMap[p.id] !== d) { depthMap[p.id] = d; maxDepth = Math.max(maxDepth, d); changed = true; }
    });
  }
  if (iters >= 100) console.warn("Cyclic dependency detected in AI output! Graph rendering fallback initiated.");
  
  // Group by depth
  const levels = [];
  for(let i=0; i<=maxDepth; i++) levels[i] = [];
  phases.forEach((p, pi) => levels[depthMap[p.id]||0].push({p, pi}));

  const levelsHtml = levels.map((lvl, d) => {
    const rowHtml = lvl.map(({p, pi}) => {
      const status=field?phaseStatus(field,pi):'active';
      const unlocked=field?isUnlocked(field,pi):true;
      const isDone = p.combined !== null && p.combined >= 5;
      const stLbl={locked:'Locked',active:'Active',done:'Done'}[status];
      const stCls={locked:'st-locked',active:'st-active',done:'st-done'}[status];
      const blockCls = isDone && interactive ? 'tree-phase done' : 'tree-phase';

      return `<div class="${blockCls}" id="phasecard-${p.id}" data-pid="${p.id}" data-deps="${(p.depends_on||[]).join(',')}" onmouseenter="hoverPhase('${p.id}')" onmouseleave="unhoverPhase()">
        <div class="tp-head">
          <div class="tp-l">
            <div class="ph-name">${p.name}</div>
          </div>
          <div class="ph-r">
            ${interactive?`<span class="st-b ${stCls}">${isDone ? 'Passed' : stLbl}</span>`:''}
            <span class="cap-b">cap ${p.level_cap}</span>
          </div>
        </div>
        <div class="tp-body">
          <div style="font-size:12px;color:var(--text3);margin-bottom:6px;line-height:1.4">${p.focus||''}</div>
          ${renderPhaseNodes(p,pi,fieldId,unlocked)}
          
          <div class="tp-footer" style="margin-top:12px; padding-top:10px; border-top:1px solid var(--border)">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
              <div style="flex:1; min-width:200px;">
                ${renderBars(p)} 
              </div>
              <div>
                ${unlocked
                  ?`<button class="btn btn-p btn-sm" onclick="nav('phase',{fieldId:'${fieldId}',phaseIdx:${pi}})">Open Phase</button>`
                  :`<span style="font-size:12px;color:var(--text3)">Locked</span>`}
              </div>
            </div>
            ${p.challenge?`<div class="chal-note"><span style="font-weight:500;color:var(--text2)">Phase Challenge (${p.challenge_time_min}min):</span> ${p.challenge}</div>`:''}
          </div>
        </div>
      </div>`;
    }).join('');
    return `<div class="flow-level" style="display:flex; justify-content:center; gap:60px; margin-bottom:80px; min-width:min-content">${rowHtml}</div>`;
  }).join('');

  return `<div class="canvas-tree" style="position:relative; width:100%; min-width:min-content; padding:20px 0; overflow-x:auto">
    <svg id="canvas-svg" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:0; overflow:visible"></svg>
    <div style="position:relative; z-index:1; width:100%; min-width:min-content; display:flex; flex-direction:column; align-items:center">${levelsHtml}</div>
  </div>`;
}

// ── View: Note Modal ──────────────────────────────────────────────────────────
async function openNote(noteId, title) {
  S.prevView = S.view;
  S.view = 'note';
  S.activeNoteId = noteId;
  S.activeNoteTitle = title;
  render();
  
  const ta = document.getElementById('note-editor');
  ta.value = 'Loading...';
  try {
    const res = await fetch('/api/notes/' + noteId);
    ta.value = await res.text();
  } catch(e) {
    ta.value = '# Error loading note';
  }
  const prev = document.getElementById('note-preview');
  if (prev) {
    prev.innerHTML = renderMarkdownData(ta.value, 'note-editor') || '<span style="font-style:italic">No content yet. Click Edit to begin.</span>';
  }
}

async function saveNote() {
  const ta = document.getElementById('note-editor');
  try {
    await fetch('/api/notes/' + S.activeNoteId, {
      method: 'POST',
      body: ta.value
    });
    nav(S.prevView || 'field');
  } catch(e) { alert("Failed to save note."); }
}

function renderNoteItem() {
  return `<div class="nav nav-sticky" style="margin-bottom: 1rem">
    <button class="btn-back" onclick="saveNote()">← Save & Close</button>
    <div style="font-size:16px;font-weight:500;color:var(--text)">${S.activeNoteTitle}</div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-sm" onclick="triggerMediaUpload('note-editor')">Upload Media</button>
      <button class="btn btn-sm" onclick="togglePreview(this, 'note-editor', 'note-preview')">Edit</button>
      <button class="btn btn-p btn-sm" onclick="saveNote()">Save</button>
    </div>
  </div>
  <textarea id="note-editor" style="display:none; width:100%; height:75vh; padding:16px; border:1px solid var(--border); border-radius:var(--rl); background:var(--bg2); color:var(--text); font-family:monospace; font-size:14px; resize:vertical; outline:none;"></textarea>
  <div id="note-preview" class="md-preview" style="display:block; width:100%; min-height:75vh; padding:16px; border:1px solid var(--border); border-radius:var(--rl); background:var(--bg2); color:var(--text2); font-size:14px;">Loading...</div>
  <div style="font-size:12px; color:var(--text3); margin-top:8px">Markdown supported. Media uploads and links paste here. Auto-saved on close.</div>`;
}

// ── View: Home ────────────────────────────────────────────────────────────────
function renderHome(){
  const fields=S.data.fields;
  
  if(!fields.length)return`
    <div class="nav">
      <span class="nav-title">Expertise Tracker V7</span>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm" onclick="triggerImport()">Import JSON</button>
        <button class="btn btn-p btn-sm" onclick="nav('add')">+ Create New</button>
      </div>
    </div>
    <div class="empty-state" style="margin-top: 2rem;">
      <h2>Welcome to Expertise Tracker V7</h2>
      <p style="color:var(--text2);margin-top:10px">The DAG knowledge engine is ready. Create a field to begin tracking.</p>
      <div style="display:flex;justify-content:center;gap:10px;margin-top:20px">
        <button class="btn" onclick="triggerImport()">Import JSON</button>
        <button class="btn btn-p" onclick="nav('add')">+ Create field</button>
      </div>
    </div>`;
    
  // Calculate Global Stats
  let totalXP = 0;
  let theoryXP = 0;
  let skillXP = 0;
  let totalPhases = 0;
  let conqueredPhases = 0;
  const recentActivity = [];

  fields.forEach(f => {
    (f.phases||[]).forEach((p, idx) => {
      totalPhases++;
      const c = p.combined || 0;
      const t = p.theory_score || 0;
      const s = p.skill_score || 0;
      totalXP += c;
      theoryXP += t;
      skillXP += s;
      
      if (c >= 5) conqueredPhases++;
      
      if (p.last_assessed) {
        recentActivity.push({
          date: new Date(p.last_assessed), field: f.field, fieldId: f.id, phaseId: p.id, phaseName: p.name, pi: idx
        });
      }
    });
  });

  const level = Math.floor(totalXP / 10) + 1;
  const tPct = (theoryXP + skillXP) > 0 ? Math.round((theoryXP / (theoryXP + skillXP)) * 100) : 50;
  const sPct = 100 - tPct;
  recentActivity.sort((a,b) => b.date - a.date);
  const topRecent = recentActivity.slice(0, 3);

  const dashHtml = `
    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-lbl">Global Tracker Level</div>
        <div class="dash-stat">Lv. ${level}</div>
        <div style="font-size:12px;color:var(--text3)">${totalXP.toFixed(1)} Total XP Earned · ${conqueredPhases}/${totalPhases} Phases</div>
      </div>
      <div class="dash-card" style="cursor:pointer" onclick="nav('todos')" title="Click to view To-Do List">
        <div class="dash-lbl">Global To-Do List</div>
        <div class="dash-stat" style="font-size:24px">${S.data.todos.filter(t=>!t.done).length} Pending Tasks</div>
        <div style="margin-top:12px; font-size:13px; color:var(--text3)">${S.data.todos.filter(t=>t.done).length} completed</div>
      </div>
      <div class="dash-card" style="padding:16px 24px">
        <div class="dash-lbl" style="margin-bottom:12px">Recent Activity</div>
        ${topRecent.length ? topRecent.map(r => `
          <div class="activity-item" onclick="nav('field', {fieldId:'${r.fieldId}'})">
            <div>
              <div style="font-size:13px;font-weight:500;color:var(--text)">${r.phaseName}</div>
              <div class="activity-meta">${r.field}</div>
            </div>
            <div style="font-size:16px;color:var(--text3)">→</div>
          </div>
        `).join('') : '<div style="font-size:13px;color:var(--text3)">No completed assessments yet.</div>'}
      </div>
    </div>
  `;
    
  const cards=fields.map(f=>{
    const total=(f.phases||[]).length;
    const done=(f.phases||[]).filter(p=>p.combined!==null&&p.combined>=5).length;
    const pct=total?Math.round(done/total*100):0;
    const assessed=(f.phases||[]).filter(p=>p.combined!==null).length;
    return`<div class="field-card" onclick="nav('field',{fieldId:'${f.id}'})" style="background:var(--bg2); border:1px solid var(--border); border-radius:var(--r); padding:16px; cursor:pointer; transition:transform 0.2s; margin-bottom:12px;">
      <div class="fc-top" style="display:flex; justify-content:space-between; margin-bottom:12px">
        <div><div class="fc-name" style="font-size:16px;font-weight:600;color:var(--text)">${f.field}</div><div class="fc-meta" style="font-size:12px;color:var(--text2)">${assessed}/${total} phases assessed</div></div>
        <span class="d-badge ${domCls(f.domain)}" style="font-size:10px;padding:4px 8px;border-radius:12px;text-transform:uppercase">${domLbl(f.domain)}</span>
      </div>
      <div class="prog-row" style="display:flex;align-items:center;gap:10px"><span class="prog-lbl" style="font-size:11px;color:var(--text3)">Progress</span><div class="prog-bg" style="flex:1;height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div class="prog-fill pf-a" style="width:${pct}%;height:100%;background:var(--green)"></div></div><span class="prog-pct" style="font-size:11px;color:var(--text)">${pct}%</span></div>
    </div>`;
  }).join('');
  
  return`
  <div class="nav" style="border-bottom:none; margin-bottom:10px">
    <span class="nav-title" style="font-size:24px; font-weight:700">Sovereign Dashboard</span>
    <div style="display:flex;gap:8px">
      <button class="btn btn-sm" onclick="triggerImport()">Import</button>
      <button class="btn btn-p btn-sm" onclick="nav('add')">+ New Curriculum</button>
    </div>
  </div>
  ${dashHtml}
  <div style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text);border-bottom:1px solid var(--border);padding-bottom:8px">Active Fields</div>
  <div class="field-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px">${cards}</div>`;
}

// ── View: Field ───────────────────────────────────────────────────────────────
function renderField(){
  const f=getField(S.fieldId);if(!f)return renderHome();
  return`<div class="nav nav-sticky" style="margin-bottom: 1rem">
    <button class="btn-back" onclick="nav('home')">← Dashboard</button>
    <div style="display:flex;gap:8px">
      <button class="btn btn-sm" onclick="nav('edit',{fieldId:'${f.id}'})">Edit</button>
    </div>
  </div>
  
  <div style="display:flex; flex-direction:column; align-items:center; text-align:center; margin-bottom:1.5rem;">
    <div style="display:flex; justify-content:center; align-items:center; gap:12px; margin-bottom:8px;">
      <div style="font-size:24px;font-weight:700;color:var(--text);letter-spacing:-0.5px">${f.field}</div>
      <span class="d-badge ${domCls(f.domain)}">${domLbl(f.domain)}</span>
    </div>
    <div style="font-size:14px;color:var(--text3);line-height:1.5; max-width: 500px;">${f.description}</div>
  </div>
  
  <div style="margin-bottom: 2rem; text-align:center;">
    <button class="btn btn-sm" onclick="const e=document.getElementById('cd-container'); e.style.display=e.style.display==='none'?'block':'none'">Toggle Curriculum Design</button>
  </div>
  
  <div id="cd-container" class="curriculum-design-card" style="display:${f.curriculum_design?'block':'none'}; margin-bottom:2rem; padding:16px; border:1px solid var(--border); border-radius:var(--r); background:var(--bg2);">
    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
      <div style="font-size:14px;font-weight:600;color:var(--text);">Curriculum Design & Study Plan</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm" onclick="triggerMediaUpload('cd-editor')">Upload Media</button>
        <button class="btn btn-sm" onclick="togglePreview(this, 'cd-editor', 'cd-preview')">Edit</button>
      </div>
    </div>
    <div style="font-size:12px; color:var(--text3); margin-bottom:8px">Draft your overarching approach. Include mindmaps, syllabi, and reference links here. Markdown supported.</div>
    <textarea id="cd-editor" class="form-input" rows="6" style="display:none;" oninput="const f=S.data.fields.find(x=>x.id==='${f.id}'); f.curriculum_design=this.value;" onblur="saveFieldData(getField('${f.id}'))" placeholder="Type notes or upload mindmaps...">${f.curriculum_design||''}</textarea>
    <div id="cd-preview" class="md-preview" style="display:block;font-size:13px; line-height:1.6; color:var(--text2); padding:10px; background:var(--bg2); border:1px solid var(--border); min-height:80px; border-radius:var(--r);">${renderMarkdownData(f.curriculum_design, 'cd-editor') || '<span style="font-style:italic">No content yet. Click Edit to begin.</span>'}</div>
  </div>
  
  ${renderPhasesHTML(f.phases,f.id,true)}
  <div style="margin-top:24px;display:flex;justify-content:space-between;padding-top:16px;border-top:1px solid var(--border)">
    <button class="btn btn-sm" onclick="exportField('${f.id}')">Export to JSON</button>
    <button class="btn btn-sm btn-danger" onclick="deleteField('${f.id}')">Remove field</button>
  </div>`;
}

function togglePhase(i){
  const b=document.getElementById('pbody-'+i),c=document.getElementById('chev-'+i);
  if(!b)return;
  const o=b.classList.toggle('open');
  if(c)c.classList.toggle('open',o);
}

async function deleteField(id){
  if(!confirm('Remove this field and all its progress?'))return;
  S.data.fields=S.data.fields.filter(f=>f.id!==id);
  await deleteFieldData(id);
  nav('home');
}

// ── View: Assess ──────────────────────────────────────────────────────────────
function renderAssess(){
  const field=getField(S.fieldId);
  const phase=field?.phases[S.nodeRef.phaseIdx];
  if(!phase)return renderHome();

  // Show both WPW and Interleaving for comprehensive testing
  const needsAuth = true;
  const needsPrac = true;
  
  const steps = [];
  if (needsAuth) steps.push('Whole Part Whole');
  if (needsPrac) steps.push('Interleaving Project');
  steps.push('Provide Proof');
  steps.push('Verdict');

  const stepNav=`
    <div class="nav nav-sticky" style="margin-bottom:1rem; border-bottom:none">
       <button class="btn-back" onclick="nav('field',{fieldId:'${S.fieldId}'})" style="padding: 6px 12px">✕ Cancel</button>
       <div class="step-nav" style="margin-bottom:0; flex:1; margin-left: 20px;">${steps.map((s,i)=>{
        const cls=i<S.assessStep?'done':i===S.assessStep?'active':'';
        const dCls=i<S.assessStep?'done':i===S.assessStep?'active':'';
        return`${i>0?'<div class="s-line"></div>':''}<div class="s-pip ${cls}"><div class="s-dot ${dCls}">${i<S.assessStep?'✓':i+1}</div><span style="white-space:nowrap">${s}</span></div>`;
      }).join('')}</div>
    </div>`;

  const header=`<div class="a-header"><div class="a-name">Phase Validation: ${phase.name}</div><div class="a-meta">${field.field} · Phase ${phase.phase}</div></div>`;

  let body='';
  const stepName = steps[S.assessStep];

  if(stepName==='Whole Part Whole'){
    body=`<div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:.5rem">Whole Part Whole (Theory)</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:1rem;line-height:1.5">
        To prove theoretical mastery, explain the concept starting from the big picture (Whole), break down the exact mechanics (Part), and re-assemble it into the broader ecosystem (Whole).
      </div>
      <div style="margin-bottom:8px; display:flex; gap:8px;">
        <button class="btn btn-sm" onclick="triggerMediaUpload('wpw-editor')">Upload Media</button>
        <button class="btn btn-sm" onclick="togglePreview(this, 'wpw-editor', 'wpw-preview')">Edit</button>
      </div>
      <textarea id="wpw-editor" class="form-input" rows="8" style="display:none;" placeholder="Type your WPW breakdown here..." oninput="S.assessData.wpwText=this.value">${S.assessData.wpwText}</textarea>
      <div id="wpw-preview" class="md-preview" style="display:block; padding:10px; background:var(--bg2); border:1px solid var(--border); min-height:100px; border-radius:var(--r); font-size:13px;color:var(--text2)">${renderMarkdownData(S.assessData.wpwText, 'wpw-editor') || '<span style="font-style:italic">No content yet. Click Edit to begin.</span>'}</div>
      <div class="actions" style="margin-top:20px"><div></div><button class="btn btn-p" onclick="stepA(${S.assessStep+1})">Next →</button></div>`;
  } else if(stepName==='Interleaving Project'){
    body=`<div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:.5rem">Interleaving Project (Skill)</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:1rem;line-height:1.5">
        To prove practical skill, you must execute a project that forces you to use this phase's syllabus *interleaved* with previous concepts. How did you apply this practically?
      </div>
      <div style="margin-bottom:8px; display:flex; gap:8px;">
        <button class="btn btn-sm" onclick="triggerMediaUpload('inter-editor')">Upload Media</button>
        <button class="btn btn-sm" onclick="togglePreview(this, 'inter-editor', 'inter-preview')">Edit</button>
      </div>
      <textarea id="inter-editor" class="form-input" rows="8" style="display:none;" placeholder="Describe the practical project execution..." oninput="S.assessData.interText=this.value">${S.assessData.interText}</textarea>
      <div id="inter-preview" class="md-preview" style="display:block; padding:10px; background:var(--bg2); border:1px solid var(--border); min-height:100px; border-radius:var(--r); font-size:13px;color:var(--text2)">${renderMarkdownData(S.assessData.interText, 'inter-editor') || '<span style="font-style:italic">No content yet. Click Edit to begin.</span>'}</div>
      <div class="actions" style="margin-top:20px"><button class="btn btn-sm" onclick="stepA(${S.assessStep-1})">← Back</button><button class="btn btn-p" onclick="stepA(${S.assessStep+1})">Next →</button></div>`;
  } else if(stepName==='Provide Proof'){
    body=`<div style="font-size:16px;font-weight:600;color:var(--text);margin-bottom:.5rem">Provide Proof</div>
      <div style="font-size:13px;color:var(--text2);margin-bottom:1rem;line-height:1.5">
        The tracker demands hard proof. Paste a link to your code repo, an Imgur screenshot, a YouTube video, or a Google Doc demonstrating your mastery over this phase.
      </div>
      <div class="form-group">
        <label class="form-label">Proof URL (Required)</label>
        <input class="form-input" value="${S.assessData.proofUrl}" oninput="S.assessData.proofUrl=this.value" placeholder="https://...">
      </div>
      
      <div style="margin-top:1.5rem;padding-top:1.5rem;border-top:1px solid var(--border)">
        <div style="font-size:14px;font-weight:500;margin-bottom:10px">Self-Verdict</div>
        <div class="r-group" style="display:flex;gap:10px">
          <div class="ro${S.assessData.pass===true?' ro-pass':''}" onclick="setVerdict(true)">Passed Mastery</div>
          <div class="ro${S.assessData.pass===false?' ro-fail':''}" onclick="setVerdict(false)">Failed / Not Ready</div>
        </div>
      </div>
      
      <div class="actions" style="margin-top:20px"><button class="btn btn-sm" onclick="stepA(${S.assessStep-1})">← Back</button><button class="btn btn-p" onclick="stepA(${S.assessStep+1})">See results →</button></div>`;
  } else if(stepName === 'Verdict') {
    const passed = S.assessData.pass === true;
    const c = passed ? 10 : 0;
    
    // Add success glow
    const successGlow = passed ? 'glow-success' : '';
    const vCls = passed ? 'v-pass' : 'v-fail';
    const vMsg = passed ? `Phase conquered! You've provided proof and validated your mastery.` : `Validation failed. Keep studying the notes and attempt the project/proof again later.`;
    
    body=`<div class="res-grid" style="grid-template-columns:1fr; max-width:300px; margin:0 auto 1.5rem;">
      <div class="res-card ${successGlow}"><div class="rc-n" style="color:${passed?'#1D9E75':'#E24B4A'}">${passed?'PASS':'FAIL'}</div><div class="rc-l">Final Verdict</div></div>
    </div>
    
    <div class="verdict ${vCls}" style="margin-top:10px;text-align:center">${vMsg}</div>
    
    ${S.assessData.proofUrl ? `<div style="margin-bottom:1.5rem">
      <div style="font-size:13px;font-weight:500;margin-bottom:4px">Your Proof:</div>
      ${renderProofEmbed(S.assessData.proofUrl)}
    </div>` : ''}

    <div class="actions" style="margin-top:2rem"><button class="btn btn-sm" onclick="stepA(${S.assessStep-1})">← Revise Proof</button><button class="btn btn-p" onclick="saveAssess(${c})">Save & Continue</button></div>`;
  }
  return stepNav+header+body;
}

function setVerdict(v){S.assessData.pass=v;repaint();}
function stepA(n){
  if (n > 0 && S.assessStep === stepsLength() - 2) {
      if (!S.assessData.proofUrl.trim()) {
          alert('A Proof URL is required.'); return;
      }
      if (S.assessData.pass === null) {
          alert('You must select a Self-Verdict pass/fail outcome.'); return;
      }
  }
  const maxSteps = stepsLength() - 1;
  S.assessStep=Math.max(0,Math.min(maxSteps,n));
  document.body.scrollTop=0;document.documentElement.scrollTop=0;
  repaint();
}
function stepsLength() {
  const needsAuth = true;
  const needsPrac = true;
  let len = 2; // proof + verdict
  if(needsAuth) len++;
  if(needsPrac) len++;
  return len;
}
function repaint(){document.getElementById('app').innerHTML=renderAssess();}

async function saveAssess(c){
  const field=getField(S.fieldId);if(!field)return;
  const phase=field.phases[S.nodeRef.phaseIdx];
  phase.combined=c;
  phase.proof_url = S.assessData.proofUrl;
  phase.wpw_text = S.assessData.wpwText;
  phase.interleave_text = S.assessData.interText;
  phase.last_assessed=new Date().toISOString();
  // Using the new python server
  await saveFieldData(field);
  nav('field',{fieldId:S.fieldId});
}

// ── View: Add / Edit Field ──────────────────────────────────────────────────────
function renderAdd(){
  const df = S.draftField;
  
  let aiSection = '';
  if (S.scaffolding) {
    aiSection = `<div class="sc-status" style="margin-top:10px">${S.scaffoldMsg}</div>`;
  } else if (!df.id) {
    aiSection = `
      <div class="form-row" style="align-items:center;background:var(--bg2);padding:10px;border-radius:var(--r);margin-bottom:15px;">
        <div style="font-size:12px;color:var(--text2);flex:1">Or, let AI generate a starting point:</div>
        <div style="display:flex;gap:5px;flex:2">
          <input id="ai-topic" class="form-input" placeholder="Topic (e.g. Neuroscience)" onkeydown="if(event.key==='Enter')doScaffold()">
          <button class="btn btn-p btn-sm" onclick="doScaffold()" style="white-space:nowrap">AI Generate</button>
        </div>
      </div>
    `;
  }

  const phasesHtml = df.phases.map((p, pi) => `
    <div class="form-section">
      <div class="form-section-head">
        <span class="fsh-title">Phase ${pi + 1}</span>
        <button class="btn btn-sm btn-danger" onclick="draftRmPhase(${pi})">Remove Phase</button>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Phase Name</label><input class="form-input" value="${p.name||''}" oninput="draftUpdPhase(${pi},'name',this.value)" placeholder="e.g. Fundamentals"></div>
        <div class="form-group">
          <label class="form-label">Axis</label>
          <select class="form-select" onchange="draftUpdPhase(${pi},'axis',this.value)">
            <option value="theory" ${p.axis==='theory'?'selected':''}>Theory-heavy</option>
            <option value="skill" ${p.axis==='skill'?'selected':''}>Skill-heavy</option>
            <option value="mixed" ${p.axis==='mixed'?'selected':''}>Mixed</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:2"><label class="form-label">Focus / Goal</label><input class="form-input" value="${p.focus||''}" oninput="draftUpdPhase(${pi},'focus',this.value)" placeholder="Main objective of this phase"></div>
        <div class="form-group"><label class="form-label">Unlock At (%)</label><input type="number" class="form-input" value="${p.unlock_threshold||80}" oninput="draftUpdPhase(${pi},'unlock_threshold',parseInt(this.value)||80)"></div>
      </div>
      
      <div class="form-group">
        <label class="form-label">Prerequisites</label>
        <div style="font-size:12px;color:var(--text3);margin-bottom:4px">Select phases that must be mastered before unlocking this one.</div>
        <div style="padding:10px; border:1px solid var(--border); border-radius:var(--r); background:var(--bg2);">
          ${df.phases.length === 1 ? '<div style="font-size:12px;color:var(--text3)">Add more phases to set prerequisites.</div>' : ''}
          ${df.phases.map((op, opi) => {
            if (opi === pi) return ''; // Can't depend on self
            const parentId = op.id || ('p_'+opi);
            const parentName = op.name || ('Phase '+(opi+1));
            const checked = (p.depends_on||[]).includes(parentId) ? 'checked' : '';
            return `<label style="display:flex; align-items:center; font-size:13px; margin-bottom:6px; color:var(--text); cursor:pointer"><input type="checkbox" ${checked} onchange="draftToggleDep(${pi}, '${parentId}', this.checked)" style="margin-right:8px"> <span>${parentName}</span></label>`;
          }).join('')}
        </div>
      </div>
      
      <div class="form-row" style="margin-bottom:0">
        <div class="form-group" style="flex:3"><label class="form-label">Phase Challenge</label><input class="form-input" value="${p.challenge||''}" oninput="draftUpdPhase(${pi},'challenge',this.value)" placeholder="e.g. Build X in 20m"></div>
        <div class="form-group"><label class="form-label">Mins</label><input type="number" class="form-input" value="${p.challenge_time_min||15}" oninput="draftUpdPhase(${pi},'challenge_time_min',parseInt(this.value)||15)"></div>
      </div>
      
      <div style="margin-top:20px;">
        <div style="font-size:14px;font-weight:500;margin-bottom:10px">Nodes / Sub-concepts in Phase ${pi + 1}</div>
        ${(p.nodes||[]).map((n, ni) => `
          <div class="sub-node-section" style="padding:10px; border-radius:var(--r); background:var(--bg2); margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px; align-items:center">
              <input class="form-input" value="${n.name||''}" oninput="draftUpdNode(${pi},${ni},'name',this.value)" placeholder="Node Name (e.g. The Synapse)" style="padding:6px 10px; font-size:13px; max-width:200px">
              <span style="font-size:12px;cursor:pointer;color:var(--red)" onclick="draftRmNode(${pi},${ni})">✕</span>
            </div>
            <input class="form-input form-input-sm" value="${n.description||''}" oninput="draftUpdNode(${pi},${ni},'description',this.value)" placeholder="Short description" style="padding:6px 10px; font-size:13px">
          </div>
        `).join('')}
        <button class="btn btn-sm" onclick="draftAddNode(${pi})" style="margin-top:4px">+ Add Node</button>
      </div>
    </div>
  `).join('');

  const cancelClick = df.id ? `nav('field', {fieldId:'${df.id}'})` : `nav('home')`;

  return `<div class="nav nav-sticky" style="margin-bottom:1.5rem">
    <button class="btn-back" onclick="${cancelClick}">← Cancel</button>
    <span class="nav-title">${df.id ? 'Edit Curriculum' : 'Create Curriculum Field'}</span>
    <button class="btn btn-p btn-sm" onclick="saveDraftField()">Save Field</button>
  </div>
  
  ${aiSection}
  
  <div class="form-section">
    <div class="form-row">
      <div class="form-group" style="flex:2">
        <label class="form-label">Field Name</label>
        <input class="form-input" value="${df.field}" oninput="S.draftField.field=this.value" placeholder="e.g. Advanced TypeScript">
      </div>
      <div class="form-group">
        <label class="form-label">Domain Type</label>
        <select class="form-select" onchange="S.draftField.domain=this.value">
          <option value="theory" ${df.domain==='theory'?'selected':''}>Theory-heavy</option>
          <option value="skill" ${df.domain==='skill'?'selected':''}>Skill-heavy</option>
          <option value="mixed" ${df.domain==='mixed'?'selected':''}>Mixed</option>
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-bottom:0">
      <label class="form-label">Short Description</label>
      <input class="form-input" value="${df.description}" oninput="S.draftField.description=this.value" placeholder="What is the overall goal of tracking this field?">
    </div>
  </div>

  <div style="margin-top:20px;margin-bottom:12px;font-size:16px;font-weight:500;color:var(--text);display:flex;justify-content:space-between;align-items:center">
    Phases & Curriculum Nodes
    <button class="btn btn-sm" onclick="draftAddPhase()">+ Add Phase</button>
  </div>
  
  ${phasesHtml.length ? phasesHtml : '<div class="empty" style="padding:2rem 1rem"><h3>No phases yet</h3><p>Add a phase to start building your curriculum.</p></div>'}
  
  <div class="actions" style="margin-top:2rem">
    <button class="btn" onclick="${cancelClick}">Cancel</button>
    <button class="btn btn-p" onclick="saveDraftField()">Save Field</button>
  </div>
  `;
}

// ── Draft Form Handlers ──────────────────────────────────────────
function draftAddPhase() {
  S.draftField.phases.push({
    id: 'p_' + uid(),
    phase: S.draftField.phases.length + 1,
    name: '', focus: '', duration_estimate: '', level_cap: 10, unlock_threshold: 80,
    axis: 'mixed', challenge: '', challenge_time_min: 15,
    combined: null, wpw_text: '', interleave_text: '', proof_url: '', last_assessed: null,
    depends_on: [],
    nodes: []
  });
  render();
}
function draftRmPhase(pi) {
  const removedId = S.draftField.phases[pi].id;
  S.draftField.phases.splice(pi, 1);
  S.draftField.phases.forEach((p, i) => {
    p.phase = i + 1;
    if (p.depends_on) p.depends_on = p.depends_on.filter(x => x !== removedId);
  });
  render();
}
function draftUpdPhase(pi, key, val) { S.draftField.phases[pi][key] = val; }
function draftToggleDep(pi, parentId, isChecked) {
  const p = S.draftField.phases[pi];
  if (!p.depends_on) p.depends_on = [];
  if (isChecked && !p.depends_on.includes(parentId)) p.depends_on.push(parentId);
  else if (!isChecked) p.depends_on = p.depends_on.filter(x => x !== parentId);
}

function draftAddNode(pi) {
  S.draftField.phases[pi].nodes.push({ id: uid(), name: '', description: '' });
  render();
}
function draftRmNode(pi, ni) {
  S.draftField.phases[pi].nodes.splice(ni, 1);
  render();
}
function draftUpdNode(pi, ni, key, val) { S.draftField.phases[pi].nodes[ni][key] = val; }

// ── Generate & Save ──────────────────────────────────────────────
async function doScaffold(){
  const el=document.getElementById('ai-topic');
  const field=el?.value.trim();if(!field)return;
  S.scaffolding=true;S.scaffoldMsg='Analysing field structure and generating nodes...';
  render();
  const msgs=['Analysing field structure...','Mapping knowledge phases...','Writing nodes and challenges...'];
  let mi=0;
  const tick=setInterval(()=>{mi=(mi+1)%msgs.length;if(S.scaffolding)S.scaffoldMsg=msgs[mi];render();},2000);
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',max_tokens:1500,
        system:`You are an expert curriculum architect mapping real DAG flowcharts. Output ONLY valid JSON — no markdown, no preamble, no backticks.
Schema: {"field":"string","domain":"theory|skill|mixed","description":"1 sentence","phases":[{"id":"p_string","depends_on":["p_string"],"phase":1,"name":"2-3 word string","focus":"one sentence","axis":"theory|skill|mixed","challenge":"concrete timed task completable offline in 10–20 min","challenge_time_min":15,"level_cap":10,"unlock_threshold":80,"nodes":[{"name":"granular topic name","description":"1 sentence exact definition"}]}]}
Rules: Output 4-6 phases in a 2D DAG topological layout. The "Fundamentals" phase MUST have depends_on: []. Sub-specializations branching off that root MUST list the root's "id" in their "depends_on" array. At least one pair of phases should be parallel (e.g., branching out horizontally from the same parent). Phases are broad concepts. Nodes are micro-elements to memorize inside them. Challenges must be specific tasks. Return ONLY valid JSON.`,
        messages:[{role:'user',content:`Map out a non-linear Skill Tree / Dependency Graph curriculum for: ${field}`}]
      })
    });
    clearInterval(tick);
    const data=await res.json();
    if(data.error)throw new Error(data.error.message);
    const txt=data.content.filter(b=>b.type==='text').map(b=>b.text).join('');
    const generatedField = JSON.parse(txt.replace(/```json|```/g,'').trim());
    S.draftField = generatedField;
    S.scaffoldMsg='';
  }catch(e){clearInterval(tick);S.scaffoldMsg='Error: '+e.message;alert(S.scaffoldMsg);}
  S.scaffolding=false;render();
}

async function saveDraftField(){
  const df = S.draftField;
  if (!df.field.trim()) { alert("Please enter a Field Name."); return; }
  if (!df.phases.length) { alert("Please add at least one phase."); return; }
  
  const existingIdx = S.data.fields.findIndex(f => f.id === df.id);
  
  const fieldToSave = {
    id: df.id || uid(),
    field: df.field.trim(),
    domain: df.domain,
    description: df.description.trim(),
    curriculum_design: df.curriculum_design || '',
    createdAt: df.createdAt || new Date().toISOString(),
    phases: df.phases.map((p, pi) => ({
      ...p,
      id: p.id || 'p_' + uid(),
      depends_on: p.depends_on || [],
      phase: pi + 1,
      axis: p.axis || 'mixed',
      combined: p.combined ?? null,
      bhs_content: p.bhs_content || '',
      wpw_text: p.wpw_text || '',
      interleave_text: p.interleave_text || '',
      proof_url: p.proof_url || '',
      last_assessed: p.last_assessed ?? null,
      nodes: (p.nodes || []).map(n => ({
        id: n.id || uid(),
        name: n.name,
        description: n.description
      }))
    }))
  };

  if (existingIdx >= 0) {
    S.data.fields[existingIdx] = fieldToSave;
  } else {
    S.data.fields.push(fieldToSave);
  }
  
  await saveFieldData(fieldToSave);
  nav('field', { fieldId: fieldToSave.id });
}

// ── View: Phase Detail ────────────────────────────────────────────────────────
function renderPhase() {
  const f = getField(S.fieldId);
  const p = f?.phases[S.phaseIdx];
  if (!p) return renderHome();
  
  const status=phaseStatus(f,S.phaseIdx);
  const unlocked=isUnlocked(f,S.phaseIdx);
  
  const nodesHtml = (p.nodes||[]).map((n,ni)=>`
    <div class="node-item">
      <div class="ni-top"><div class="ni-name" style="cursor:pointer;" onclick="openNote('${n.id}', '${n.name.replace(/'/g, "\\'")}')">${n.name}</div></div>
      <div class="ni-desc">${n.description}</div>
      ${n.challenge?`<div class="chal-note" style="margin-top:8px"><span style="font-weight:500;color:var(--text2)">Challenge (${n.challenge_time_min}min):</span> ${n.challenge}</div>`:''}
    </div>`).join('');
    
  return `<div class="nav">
    <button class="btn-back" onclick="nav('field')">← Back to Map</button>
    <span class="nav-title">Phase ${p.phase}: ${p.name}</span>
  </div>
  <div style="font-size:13px;color:var(--text);margin-bottom:1.5rem">${p.focus||''}</div>
  
  <div class="bhs-card" style="margin-bottom:2rem; padding:16px; border:1px solid var(--border); border-radius:var(--r); background:var(--bg2);">
    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:12px;">
      <div style="font-size:14px;font-weight:600;color:var(--text);">Study Canvas (BHS / Hipshot / Multipass)</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-sm" onclick="triggerMediaUpload('bhs-editor')">Upload Media</button>
        <button class="btn btn-sm" onclick="togglePreview(this, 'bhs-editor', 'bhs-preview')">Edit</button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">Upload mindmap screenshots, drop links, and jot rough study notes here. Auto-saves.</div>
    <textarea id="bhs-editor" class="form-input" rows="8" style="display:none;" placeholder="Drop mindmaps and study notes here..." oninput="const f=S.data.fields.find(x=>x.id==='${f.id}'); f.phases[${S.phaseIdx}].bhs_content=this.value;" onblur="saveFieldData(getField('${f.id}'))">${p.bhs_content||''}</textarea>
    <div id="bhs-preview" class="md-preview" style="display:block; padding:10px; background:var(--bg2); border:1px solid var(--border); min-height:100px; border-radius:var(--r); font-size:13px;color:var(--text2)">${renderMarkdownData(p.bhs_content, 'bhs-editor') || '<span style="font-style:italic">No content yet. Click Edit to begin.</span>'}</div>
  </div>
  
  <div style="font-size:14px;font-weight:600;margin-bottom:12px;color:var(--text);">Phase Nodes</div>
  <div>${nodesHtml.length ? nodesHtml : '<div style="font-size:13px;color:var(--text3)">No nodes in this phase.</div>'}</div>
  
  <div style="margin-top:2rem; padding-top:16px; border-top:1px solid var(--border); text-align:center;">
    ${unlocked ? `<button class="btn btn-p" style="padding:10px 24px; font-size:14px" onclick="nav('assess',{fieldId:'${f.id}',nodeRef:{phaseIdx:${S.phaseIdx}}})">${p.combined!==null?'Re-assess Entire Phase (Review)':'Assess Phase Mastery'}</button>` : `<span style="font-size:13px;color:var(--text3)">This phase is currently locked. Complete prerequisites first.</span>`}
  </div>
  `;
}

// ── View: Todos ───────────────────────────────────────────────────────────────
async function saveTodos() {
  try {
    await fetch('/api/todos', { method: 'POST', body: JSON.stringify(S.data.todos) });
  } catch(e) {}
  render();
}

function addTodo() {
  const el = document.getElementById('new-todo');
  const txt = el.value.trim();
  if(!txt) return;
  S.data.todos.unshift({ id: uid(), text: txt, done: false, createdAt: Date.now() });
  el.value = '';
  saveTodos();
}

function toggleTodo(id) {
  const t = S.data.todos.find(x => x.id === id);
  if(t) { t.done = !t.done; saveTodos(); }
}

function editTodo(id, newText) {
  const t = S.data.todos.find(x => x.id === id);
  if(t) {
    if(!newText.trim()) return rmTodo(id);
    t.text = newText.trim();
    saveTodos();
  }
}

function rmTodo(id) {
  S.data.todos = S.data.todos.filter(x => x.id !== id);
  saveTodos();
}

function renderTodos() {
  const list = S.data.todos.map(t => {
    const safeText = t.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; padding:12px; border:1px solid var(--border); background:var(--bg); border-radius:var(--r); margin-bottom:8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
      <div style="display:flex; align-items:flex-start; gap:12px; flex:1; min-width:0;">
        <input type="checkbox" ${t.done?'checked':''} style="cursor:pointer; width:16px; height:16px; margin-top:2px;" onchange="toggleTodo('${t.id}')">
        <div contenteditable="true" 
             style="flex:1; outline:none; font-size:14px; line-height:1.4; color: ${t.done?'var(--text3)':'var(--text)'}; ${t.done?'text-decoration:line-through;':''}; overflow-wrap:anywhere; min-width:0;"
             onblur="editTodo('${t.id}', this.innerText)"
             onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}">
          ${safeText}
        </div>
      </div>
      <button class="btn btn-sm btn-danger" style="margin-left:12px; flex-shrink:0;" onclick="rmTodo('${t.id}')">Remove</button>
    </div>
  `}).join('');

  return `<div class="nav">
    <button class="btn-back" onclick="nav('home')">← Back to Dashboard</button>
    <span class="nav-title">Global To-Do List</span>
  </div>
  <div style="display:flex; gap:10px; margin-bottom: 24px">
    <input id="new-todo" class="form-input" style="flex:1" placeholder="Add a new task..." onkeydown="if(event.key==='Enter')addTodo()">
    <button class="btn btn-p" onclick="addTodo()">Add Task</button>
  </div>
  ${list.length ? list : '<div class="empty"><h3>All caught up!</h3><p style="color:var(--text3)">No tasks remaining in your backlog.</p></div>'}
  `;
}

// ── Render ────────────────────────────────────────────────────────────────────
function render(){
  const app=document.getElementById('app');
  switch(S.view){
    case'home':app.innerHTML=renderHome();break;
    case'field':app.innerHTML=renderField();break;
    case'phase':app.innerHTML=renderPhase();break;
    case'assess':app.innerHTML=renderAssess();break;
    case'add':app.innerHTML=renderAdd();break;
    case'todos':app.innerHTML=renderTodos();break;
    case'note':app.innerHTML=renderNoteItem();break;
    default:app.innerHTML=renderHome();
  }
  if (S.view === 'field' || S.view === 'add') {
    setTimeout(window.drawConnections, 50);
  }
}

// ── DAG connection Drawer ──────────────────────────────────────────────────────────────
window.drawConnections = function() {
  const svg = document.getElementById('canvas-svg');
  if (!svg) return;
  svg.innerHTML = '';
  const container = svg.parentElement;
  if (!container) return;
  
  // Wait to ensure DOM has rendered flex layout properly
  const cRect = container.getBoundingClientRect();
  const scollLeft = container.scrollLeft;
  const scrollTop = container.scrollTop;

  const cards = document.querySelectorAll('.tree-phase');
  cards.forEach(card => {
    const pId = card.getAttribute('data-pid');
    const deps = (card.getAttribute('data-deps')||'').split(',').filter(x=>x);
    deps.forEach(depId => {
      const parentCard = document.getElementById('phasecard-' + depId);
      if(!parentCard) return;
      
      const parentIsDone = parentCard.classList.contains('done');

      const r1 = parentCard.getBoundingClientRect();
      const r2 = card.getBoundingClientRect();

      // Accounts for potential scrolling inside the container
      const x1 = r1.left + r1.width / 2 - cRect.left + scollLeft;
      const y1 = r1.bottom - cRect.top + scrollTop;
      const x2 = r2.left + r2.width / 2 - cRect.left + scollLeft;
      const y2 = r2.top - cRect.top + scrollTop;
      
      const cy = (y1 + y2) / 2;
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1} ${cy}, ${x2} ${cy}, ${x2} ${y2}`);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', parentIsDone ? 'var(--green)' : 'rgba(255,255,255,0.2)'); // Visibly brighter!
      path.setAttribute('stroke-width', '3');
      path.setAttribute('class', 'path-line' + (parentIsDone ? ' flow' : ''));
      path.setAttribute('data-source', depId);
      path.setAttribute('data-target', pId);
      svg.appendChild(path);
      
      // Add Arrowhead
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      arrow.setAttribute('points', `${x2-6},${y2-8} ${x2+6},${y2-8} ${x2},${y2}`);
      arrow.setAttribute('fill', parentIsDone ? 'var(--green)' : 'rgba(255,255,255,0.3)');
      arrow.setAttribute('class', 'path-line' + (parentIsDone ? ' flow' : ''));
      arrow.setAttribute('data-source', depId);
      arrow.setAttribute('data-target', pId);
      svg.appendChild(arrow);
    });
  });
};

window.addEventListener('resize', () => {
  if (S.view === 'field' || S.view === 'add') window.drawConnections();
});

// Run Initialization
loadData().then(()=>render());
