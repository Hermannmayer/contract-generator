// ── State ──
let companies=[], clients=[], factories=[], ports=[], templates=[];
let productRows=[], sealPath="", seals=[];
let currentTemplateId=null, previewType="pi", debounceTimer=null;
let nextGroupId=1, dragIdx=null;

// ── Init ──
document.addEventListener("DOMContentLoaded", async()=>{
  await loadAllData();
  setupNavItems();
  setupPreviewTabs();
  setupResizeHandle();
  addProductRow();
  loadHistory();
  document.addEventListener("input", schedulePreviewRefresh);
  document.addEventListener("change", schedulePreviewRefresh);
  loadSeals();
});

async function loadAllData(){
  const [c,cl,f,p,t]=await Promise.all([fetchJSON("/api/companies"),fetchJSON("/api/clients"),fetchJSON("/api/factories"),fetchJSON("/api/ports"),fetchJSON("/api/templates")]);
  companies=c; clients=cl; factories=f; ports=p; templates=t;
  populateSelect("company-select",companies,"name");
  populateSelect("client-select",clients,"name");
  populateSelect("factory-select",factories,"name");
  populateSelect("port-from-select",ports,"name");
  populateSelect("template-select",templates,"name");
  if(t.length>0){currentTemplateId=t[0].id; loadTemplate(currentTemplateId);}
  document.getElementById("factory-select").onchange=onFactoryChange;
}
function onFactoryChange(){
  const fid=parseInt(document.getElementById("factory-select").value);
  const fac=factories.find(f=>f.id===fid);
  if(fac&&fac.default_template_id) loadTemplate(fac.default_template_id);
}
async function fetchJSON(u){const r=await fetch(u);return r.json();}
function populateSelect(id,items,tk){
  const s=document.getElementById(id); if(!s) return;
  s.innerHTML=items.map(i=>`<option value="${i.id}">${i[tk]||i.name}</option>`).join("");
}

// ── Resizable Preview Panel ──
let resizeActive = false;
function setupResizeHandle(){
  const handle = document.getElementById("resize-handle");
  if(!handle) return;
  handle.addEventListener("mousedown", e => {
    resizeActive = true;
    handle.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });
}
document.addEventListener("mousemove", e => {
  if(!resizeActive) return;
  const app = document.querySelector(".app");
  const appRect = app.getBoundingClientRect();
  const panel = document.getElementById("preview-panel");
  // Calculate new panel width from right edge
  const newWidth = Math.max(200, Math.min(600, appRect.right - e.clientX));
  app.style.gridTemplateColumns = `180px 1fr 4px ${newWidth}px`;
});
document.addEventListener("mouseup", () => {
  if(resizeActive){
    resizeActive = false;
    document.querySelector("#resize-handle").classList.remove("active");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }
});

// ── Nav ──
function setupNavItems(){
  document.querySelectorAll(".nav-item").forEach(item=>{
    item.addEventListener("click",e=>{e.preventDefault();openPanel(item.dataset.panel);});
  });
}

// ── Preview ──
function setupPreviewTabs(){
  document.querySelectorAll(".preview-tab").forEach(tab=>{
    tab.addEventListener("click",()=>{
      document.querySelectorAll(".preview-tab").forEach(t=>t.classList.remove("active"));
      tab.classList.add("active");
      previewType=tab.dataset.preview;
      refreshPreview();
    });
  });
}
function schedulePreviewRefresh(){clearTimeout(debounceTimer);debounceTimer=setTimeout(refreshPreview,800);}
async function refreshPreview(){
  const p=buildPayload();
  const ep=previewType==="pi"?"/api/preview-pi":"/api/preview-factory";
  try{
    const r=await fetch(ep,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});
    const h=await r.text();
    document.getElementById("preview-frame").srcdoc=h;
  }catch(e){}
}

// ── Product Rows ──
function addProductRow(data={}){
  productRows.push({...data,imagePaths:data.imagePaths||[],cartonGroup:0,cartonGroupFirst:true});
  renderAllTables();
}
function addShareCartonRow(){
  if(productRows.length===0){addProductRow();return;}
  const last=productRows[productRows.length-1];
  const gid=last.cartonGroup||nextGroupId++;
  productRows.push({cartonGroup:gid,cartonGroupFirst:false,imagePaths:[]});
  renderAllTables();
}
function removeProductRow(idx){
  productRows.splice(idx,1);
  reassignCartonGroups();
  renderAllTables();
}
function copyProductRow(idx){
  const orig=productRows[idx];
  const copy=JSON.parse(JSON.stringify(orig));
  copy.cartonGroup=0; copy.cartonGroupFirst=true;
  productRows.splice(idx+1,0,copy);
  renderAllTables();
}
function changeCartonGroup(idx, group){
  productRows[idx].cartonGroup=group;
  if(!group) productRows[idx].cartonGroupFirst=true;
  reassignCartonGroups();
  recalcAll();
  renderAllTables();
}
function reassignCartonGroups(){
  const seen={};
  productRows.forEach(p=>{
    if(!p.cartonGroup){p.cartonGroup=0;p.cartonGroupFirst=true;return;}
    if(!seen[p.cartonGroup]){seen[p.cartonGroup]=true;p.cartonGroupFirst=true;}
    else p.cartonGroupFirst=false;
  });
}
function updateProduct(idx,key,val){productRows[idx][key]=val;calcDerived(idx);renderAllTables();}

// ── Drag & Drop ──
function onDragStart(e,idx){
  dragIdx=idx;
  e.target.classList.add("dragging");
  e.dataTransfer.effectAllowed="move";
}
function onDragOver(e,idx){
  e.preventDefault();
  const tr=e.target.closest("tr");
  if(!tr)return;
  document.querySelectorAll("#shared-body tr").forEach(r=>r.classList.remove("drag-over"));
  tr.classList.add("drag-over");
}
function onDragEnd(e){
  document.querySelectorAll("#shared-body tr").forEach(r=>r.classList.remove("dragging","drag-over"));
  dragIdx=null;
}
function onDrop(e,idx){
  e.preventDefault();
  onDragEnd(e);
  if(dragIdx===null||dragIdx===idx)return;
  const item=productRows.splice(dragIdx,1)[0];
  productRows.splice(idx,0,item);
  reassignCartonGroups();
  renderAllTables();
}

function calcDerived(idx){
  const p=productRows[idx];
  const qty=p.qty||0; const ppc=p.pcsPerCarton||0;
  if(p.cartonGroup&&!p.cartonGroupFirst)return;
  p.cartons=ppc>0?Math.ceil(qty/ppc):0;
  p.amount_usd=(qty*(p.unit_price_usd||0)).toFixed(2);
  p.amount_cny=(qty*(p.unit_price_cny||0)).toFixed(2);
  if(p.cartonGroup){
    productRows.forEach((r,i)=>{if(i!==idx&&r.cartonGroup===p.cartonGroup) r.cartons=p.cartons;});
  }
}
function recalcAll(){
  productRows.forEach((p,i)=>{
    if(!p.cartonGroup||p.cartonGroupFirst){
      const ppc=p.pcsPerCarton||0; const qty=p.qty||0;
      p.cartons=ppc>0?Math.ceil(qty/ppc):0;
      p.amount_usd=(qty*(p.unit_price_usd||0)).toFixed(2);
      p.amount_cny=(qty*(p.unit_price_cny||0)).toFixed(2);
    }
  });
  productRows.forEach(p=>{
    if(p.cartonGroup&&!p.cartonGroupFirst){
      const leader=productRows.find(r=>r.cartonGroup===p.cartonGroup&&r.cartonGroupFirst);
      if(leader) p.cartons=leader.cartons;
      const qty=p.qty||0;
      p.amount_usd=(qty*(p.unit_price_usd||0)).toFixed(2);
      p.amount_cny=(qty*(p.unit_price_cny||0)).toFixed(2);
    }
  });
}

// ── Render All Tables ──
function renderAllTables(){
  renderSharedTable();
  renderPITable();
  renderFactoryTable();
  updateTotals();
}

function renderSharedTable(){
  const tbody=document.getElementById("shared-body");
  tbody.innerHTML=productRows.map((p,i)=>`
    <tr draggable="true" ondragstart="onDragStart(event,${i})" ondragover="onDragOver(event,${i})" ondrop="onDrop(event,${i})" ondragend="onDragEnd(event)">
      <td class="drag-handle">⠿</td>
      <td><input class="name-input" value="${esc(p.name||'')}" onchange="updateProduct(${i},'name',this.value)" placeholder="品名"></td>
      <td><input value="${esc(p.item_no||'')}" onchange="updateProduct(${i},'item_no',this.value)" placeholder="货号"></td>
      <td>
        <input type="file" accept="image/*" onchange="uploadImage(${i},this)" style="display:none" id="img-upload-${i}">
        <div class="img-cell-multi" onclick="document.getElementById('img-upload-${i}').click()">
          ${(p.imagePaths||[]).map(ip=>`<span class="img-wrapper"><img src="${ip}" class="img-thumb"><button class="img-rm" onclick="event.stopPropagation();removeImage(${i},'${ip}')">&times;</button></span>`).join('')}
          <span class="img-add">+</span>
        </div>
      </td>
      <td><input value="${esc(p.color||'')}" onchange="updateProduct(${i},'color',this.value)" placeholder="颜色"></td>
      <td><input value="${esc(p.size||'')}" onchange="updateProduct(${i},'size',this.value)" placeholder="尺寸"></td>
      <td><input type="number" value="${p.qty||''}" onchange="updateProduct(${i},'qty',parseFloat(this.value)||0);recalcAll();renderAllTables()" placeholder="0"></td>
      <td><input type="number" value="${p.pcsPerCarton||''}" onchange="updateProduct(${i},'pcsPerCarton',parseFloat(this.value)||0);recalcAll();renderAllTables()" placeholder="0"></td>
      <td><span>${p.cartons||'-'}</span></td>
      <td class="carton-group-cell">
        <input class="carton-group-input" value="${p.cartonGroup||''}" onchange="changeCartonGroup(${i}, parseInt(this.value)||0);renderAllTables()" placeholder="0">
      </td>
      <td><button class="btn-icon" onclick="copyProductRow(${i})" title="复制行">📋</button></td>
      <td><button class="del-btn" onclick="removeProductRow(${i})" title="删除">&times;</button></td>
    </tr>
  `).join("");
}

function renderPITable(){
  const tbody=document.getElementById("pi-body");
  tbody.innerHTML=productRows.map((p,i)=>`
    <tr class="${p.cartonGroup&&!p.cartonGroupFirst?'group-sub-row':''}">
      <td><input class="name-input readonly" value="${esc(p.name||'')}" readonly title="共用表填写"></td>
      <td><input class="readonly" value="${esc(p.item_no||'')}" readonly></td>
      <td><input class="${p.cartonGroup&&!p.cartonGroupFirst?'hidden-cell':'readonly'}" value="${p.cartonGroup&&!p.cartonGroupFirst?'':(p.pcsPerCarton||'')}" readonly></td>
      <td class="${p.cartonGroup&&!p.cartonGroupFirst?'hidden-cell':''}">${p.cartonGroup&&!p.cartonGroupFirst?'':`<span class="merged-cell">${p.cartons||'-'}</span>`}</td>
      <td><input type="number" step="0.01" class="price-input" value="${p.unit_price_usd||''}" onchange="updateProduct(${i},'unit_price_usd',parseFloat(this.value)||0);recalcAll();renderAllTables()" placeholder="FOB$"></td>
      <td><strong>${p.amount_usd||'0.00'}</strong></td>
    </tr>
  `).join("");
}

function renderFactoryTable(){
  const tbody=document.getElementById("factory-body");
  tbody.innerHTML=productRows.map((p,i)=>`
    <tr class="${p.cartonGroup&&!p.cartonGroupFirst?'group-sub-row':''}">
      <td><input class="name-input readonly" value="${esc(p.name||'')}" readonly title="共用表填写"></td>
      <td><input class="readonly" value="${esc(p.item_no||'')}" readonly></td>
      <td><input class="${p.cartonGroup&&!p.cartonGroupFirst?'hidden-cell':'readonly'}" value="${p.cartonGroup&&!p.cartonGroupFirst?'':(p.pcsPerCarton||'')}" readonly></td>
      <td class="${p.cartonGroup&&!p.cartonGroupFirst?'hidden-cell':''}">${p.cartonGroup&&!p.cartonGroupFirst?'':`<span class="merged-cell">${p.cartons||'-'}</span>`}</td>
      <td><input type="number" step="0.01" class="price-input" value="${p.unit_price_cny||''}" onchange="updateProduct(${i},'unit_price_cny',parseFloat(this.value)||0);recalcAll();renderAllTables()" placeholder="加工费¥"></td>
      <td><strong>${p.amount_cny||'0.00'}</strong></td>
      <td><input value="${esc(p.delivery_date||'')}" onchange="updateProduct(${i},'delivery_date',this.value)" placeholder="交期"></td>
    </tr>
  `).join("");
}

function updateTotals(){
  let tq=0,tc=0,tu=0,tcn=0;
  const seenGrp={};
  productRows.forEach(p=>{
    tq+=p.qty||0;
    if(!p.cartonGroup){tc+=p.cartons||0;}
    else if(!seenGrp[p.cartonGroup]){seenGrp[p.cartonGroup]=true;tc+=p.cartons||0;}
    tu+=parseFloat(p.amount_usd)||0;
    tcn+=parseFloat(p.amount_cny)||0;
  });
  document.getElementById("total-qty").textContent=tq;
  document.getElementById("total-cartons").textContent=tc;
  document.getElementById("total-usd").textContent=tu.toFixed(2);
  document.getElementById("total-cny").textContent=tcn.toFixed(2);
  const dr=document.getElementById("deposit-rate").value;
  const da=(tu*parseFloat(dr)/100).toFixed(2);
  document.getElementById("deposit-display").textContent=dr;
  document.getElementById("deposit-amount").textContent=da;
}

// ── Multi-Image Upload ──
async function uploadImage(idx,input){
  if(!input.files||!input.files[0])return;
  for(const file of input.files){
    const fd=new FormData();fd.append("image",file);
    try{
      const r=await fetch("/api/upload-image",{method:"POST",body:fd});
      const d=await r.json();
      if(!productRows[idx].imagePaths) productRows[idx].imagePaths=[];
      productRows[idx].imagePaths.push(d.path);
    }catch(e){toast("图片上传失败");}
  }
  input.value="";
  renderAllTables();
  schedulePreviewRefresh();
}
function removeImage(idx,path){
  if(!productRows[idx].imagePaths)return;
  productRows[idx].imagePaths=productRows[idx].imagePaths.filter(p=>p!==path);
  renderAllTables();
  schedulePreviewRefresh();
}

function loadSeals(){
  seals = JSON.parse(localStorage.getItem("seals")||"[]");
  const sel = document.getElementById("seal-select");
  if(!sel) return;
  sel.innerHTML = '<option value="">无</option>' +
    seals.map(s => `<option value="${s.path}">${esc(s.name)}</option>`).join('');
  sealPath = sel.value || "";
}
function selectSeal(path){ sealPath = path || ""; }
async function uploadSeal(name){
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*';
  input.onchange = async function(){
    if(!input.files[0]) return;
    const fd = new FormData(); fd.append("image", input.files[0]);
    try{
      const r = await fetch("/api/upload-image",{method:"POST",body:fd});
      const d = await r.json();
      seals.push({id:"s"+Date.now(), name:name||"公章", path:d.path, created:new Date().toISOString()});
      localStorage.setItem("seals", JSON.stringify(seals));
      loadSeals();
      toast("公章已保存");
    }catch(e){toast("上传失败");}
  };
  input.click();
}
function deleteSeal(id){
  seals = seals.filter(s => s.id !== id);
  localStorage.setItem("seals", JSON.stringify(seals));
  loadSeals();
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ── Clauses ──
let clauseList=[];  // [{id, text}]
const CN_NUMS_12=["一","二","三","四","五","六","七","八","九","十","十一","十二"];

function clauseNumText(idx){
  // Start from 二 since 一 is in the info table
  if(idx < 11) return CN_NUMS_12[idx+1];  // idx 0→二, 1→三, ... 10→十二
  return String(idx+2);  // idx 11→十三
}

function renderClauses(data){
  clauseList = CN_NUMS_12.map((num,i)=>{
    const key = ["clause_1_product","clause_2_quality","clause_3_mold_fee","clause_4_packaging","clause_5_delivery","clause_6_inspection","clause_7_payment","clause_8_guarantee","clause_9_liability","clause_10_dispute","clause_11_shipping","clause_12_other"][i];
    return {id:"c"+i, text: data[key]||""};
  });
  renderClauseItems();
}

function renderClauseItems(){
  document.getElementById("clause-list").innerHTML=clauseList.map((c,i)=>`
    <div class="clause-item">
      <span class="clause-num">${clauseNumText(i)}、</span>
      <textarea onchange="updateClauseText(${i},this.value)" rows="2">${esc(c.text)}</textarea>
      <button class="btn-icon" onclick="copyClauseRow(${i})" title="复制行">📋</button>
      <button class="del-btn" onclick="deleteClauseRow(${i})" title="删除">&times;</button>
    </div>
  `).join("");
}

function addClauseRow(){
  clauseList.push({id:"c"+Date.now(), text:""});
  renderClauseItems();
}
function copyClauseRow(i){
  clauseList.splice(i+1, 0, {id:"c"+Date.now(), text:clauseList[i].text});
  renderClauseItems();
}
function deleteClauseRow(i){
  if(clauseList.length <= 1) return;
  clauseList.splice(i, 1);
  renderClauseItems();
}
function updateClauseText(i, val){ clauseList[i].text = val; }

function loadTemplate(tid){
  currentTemplateId=parseInt(tid);
  const tpl=templates.find(t=>t.id===currentTemplateId);
  if(tpl){renderClauses(tpl);document.getElementById("template-select").value=tid;}
}

async function saveTemplate(){
  const name=document.getElementById("new-template-name").value.trim();
  if(!name){toast("请输入新模板名称");return;}
  const clauses={};
  clauseList.forEach((c,i)=>{
    const keys=["clause_1_product","clause_2_quality","clause_3_mold_fee","clause_4_packaging","clause_5_delivery","clause_6_inspection","clause_7_payment","clause_8_guarantee","clause_9_liability","clause_10_dispute","clause_11_shipping","clause_12_other"];
    if(i<12) clauses[keys[i]] = c.text;
  });
  const fid=parseInt(document.getElementById("factory-select").value)||null;
  try{
    const r=await fetch("/api/templates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,factory_id:fid,...clauses})});
    const tpl=await r.json();templates.push(tpl);
    populateSelect("template-select",templates,"name");
    document.getElementById("template-select").value=tpl.id;currentTemplateId=tpl.id;
    toast("模板已保存: "+name);
  }catch(e){toast("保存失败");}
}
function loadCurrentTemplate(){if(currentTemplateId)loadTemplate(currentTemplateId);}
function getCurrentClauses(){
  const clauses={};
  const keys=["clause_1_product","clause_2_quality","clause_3_mold_fee","clause_4_packaging","clause_5_delivery","clause_6_inspection","clause_7_payment","clause_8_guarantee","clause_9_liability","clause_10_dispute","clause_11_shipping","clause_12_other"];
  clauseList.forEach((c,i)=>{ if(i<12) clauses[keys[i]] = c.text; });
  return clauses;
}

// ── Build payload ──
function buildPayload(){
  const ci=parseInt(document.getElementById("company-select").value);
  const cli=parseInt(document.getElementById("client-select").value);
  const fi=parseInt(document.getElementById("factory-select").value);
  const pi=parseInt(document.getElementById("port-from-select").value);
  const company=companies.find(c=>c.id===ci)||{};
  const client=clients.find(c=>c.id===cli)||{};
  const factory=factories.find(f=>f.id===fi)||{};
  const portFrom=ports.find(p=>p.id===pi)||{};

  recalcAll();
  let tq=0,tc=0,tu=0,tcn=0;
  const seenGrp={};
  productRows.forEach(p=>{
    tq+=p.qty||0;
    if(!p.cartonGroup){tc+=p.cartons||0;}
    else if(!seenGrp[p.cartonGroup]){seenGrp[p.cartonGroup]=true;tc+=p.cartons||0;}
    tu+=parseFloat(p.amount_usd)||0;
    tcn+=parseFloat(p.amount_cny)||0;
  });
  const dr=document.getElementById("deposit-rate").value;
  const da=(tu*parseFloat(dr)/100).toFixed(2);

  return {
    contract_no:"CY-"+document.getElementById("contract-no").value,
    date:document.getElementById("contract-date").value,
    sign_place:document.getElementById("sign-place").value,
    supplier_code:document.getElementById("supplier-code").value,
    etd:document.getElementById("etd").value,
    payment:document.getElementById("payment-select").value,
    deposit_rate:dr, deposit_amount:da, seal_path: (document.getElementById("seal-select")?.value||""),
    port_to:{name_en:document.getElementById("port-to").value},
    company, client, factory, port_from:portFrom,
    products:productRows.map(p=>({
      name:p.name||"", item_no:p.item_no||"", color:p.color||"", size:p.size||"",
      qty:p.qty||0, pcs_per_carton:p.pcsPerCarton||"", cartons:p.cartons||0,
      unit_price_usd:p.unit_price_usd||"", amount_usd:p.amount_usd||"0.00",
      unit_price_cny:p.unit_price_cny||"", amount_cny:p.amount_cny||"0.00",
      delivery_date:p.delivery_date||"", image_path:(p.imagePaths||[])[0]||"",
      carton_group:p.cartonGroup||0, carton_group_first:p.cartonGroupFirst!==false,
    })),
    total_qty:tq, total_cartons:tc, total_amount_usd:tu.toFixed(2), total_amount_cny:tcn.toFixed(2),
    price_note: document.getElementById("price-note")?.value || "",
    delivery_note: document.getElementById("delivery-note")?.value || "",
    clauses:getCurrentClauses(),
  };
}

// ── Generate & Download ──
async function generate(type){
  const payload=buildPayload();
  if(!payload.contract_no){toast("请填写合同编号");return;}
  try{
    const r=await fetch(`/api/generate-${type}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(!r.ok){const body=await r.text();try{const e=JSON.parse(body);toast("生成失败: "+(e.error||r.statusText));}catch(e2){toast("生成失败: "+body.substring(0,80));}return;}
    const blob=await r.blob();
    const ext=type.includes("pdf")?"pdf":"xlsx";
    const label=type.includes("pi")?"PI客户合同":"工厂合同";
    downloadBlob(blob,`${payload.contract_no}-${label}.${ext}`);
    saveToHistory(payload);
    toast(`${label} 已生成`);
  }catch(e){toast("生成失败: "+e.message);}
}
async function generateAll(){
  const payload=buildPayload();
  if(!payload.contract_no){toast("请填写合同编号");return;}
  for(const t of["pi-excel","pi-pdf","factory-excel","factory-pdf"]){
    try{
      const r=await fetch(`/api/generate-${t}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      if(!r.ok)continue;
      const blob=await r.blob();
      const ext=t.includes("pdf")?"pdf":"xlsx";
      const label=t.includes("pi")?"PI客户合同":"工厂合同";
      downloadBlob(blob,`${payload.contract_no}-${label}.${ext}`);
    }catch(e){}
  }
  saveToHistory(payload);
  toast("四种格式已全部生成");
}
function downloadBlob(blob,filename){
  const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=filename;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);
}

// ── History (save full state, click to restore) ──
function saveToHistory(payload){
  const state = captureFormState();
  let h=JSON.parse(localStorage.getItem("contract-history")||"[]");
  const idx = h.findIndex(x => x.contract_no === payload.contract_no);
  const entry = {contract_no:payload.contract_no, date:payload.date, time:new Date().toISOString(), state:state};
  if(idx >= 0) h[idx] = entry; else h.unshift(entry);
  if(h.length>30)h=h.slice(0,30);
  localStorage.setItem("contract-history",JSON.stringify(h));
  loadHistory();
}

function saveContract(){
  const cn = "CY-" + (document.getElementById("contract-no").value || "draft");
  if(!document.getElementById("contract-no").value){toast("草稿已保存 (CY-draft)");}
  const state = captureFormState();
  let h=JSON.parse(localStorage.getItem("contract-history")||"[]");
  const idx = h.findIndex(x => x.contract_no === cn);
  const entry = {contract_no:cn, date:state.date||"", time:new Date().toISOString(), state:state};
  if(idx >= 0) h[idx] = entry; else h.unshift(entry);
  if(h.length>30)h=h.slice(0,30);
  localStorage.setItem("contract-history",JSON.stringify(h));
  loadHistory();
  toast("已保存: "+cn);
}

function newContract(){
  document.getElementById("contract-no").value = "";
  document.getElementById("contract-date").value = "";
  document.getElementById("etd").value = "";
  document.getElementById("supplier-code").value = "40007";
  document.getElementById("port-to").value = "TOKYO";
  productRows = []; addProductRow();
  clauseList = CN_NUMS_12.map((n,i)=>({id:"c"+i, text:""}));
  renderClauseItems();
  renderAllTables();
  document.getElementById("contract-no").focus();
  toast("已创建新合同");
}

function captureFormState(){
  return {
    contract_no: document.getElementById("contract-no").value,
    date: document.getElementById("contract-date").value,
    sign_place: document.getElementById("sign-place").value,
    supplier_code: document.getElementById("supplier-code").value,
    etd: document.getElementById("etd").value,
    payment_index: document.getElementById("payment-select").selectedIndex,
    deposit_rate: document.getElementById("deposit-rate").value,
    port_to: document.getElementById("port-to").value,
    company_id: parseInt(document.getElementById("company-select").value),
    client_id: parseInt(document.getElementById("client-select").value),
    factory_id: parseInt(document.getElementById("factory-select").value),
    port_from_id: parseInt(document.getElementById("port-from-select").value),
    template_id: currentTemplateId,
    productRows: JSON.parse(JSON.stringify(productRows)),
    clauseList: JSON.parse(JSON.stringify(clauseList)),
    factory_name: document.getElementById("factory-select")?.selectedOptions?.[0]?.text||'',
    total_amount_usd: document.getElementById("total-usd")?.textContent||'',
  };
}

function restoreFormState(state){
  if(!state) return;
  document.getElementById("contract-no").value = state.contract_no||"";
  document.getElementById("contract-date").value = state.date||"";
  document.getElementById("sign-place").value = state.sign_place||"";
  document.getElementById("supplier-code").value = state.supplier_code||"";
  document.getElementById("etd").value = state.etd||"";
  document.getElementById("payment-select").selectedIndex = state.payment_index||0;
  document.getElementById("deposit-rate").value = state.deposit_rate||"30%";
  document.getElementById("port-to").value = state.port_to||"TOKYO";
  if(state.company_id) document.getElementById("company-select").value = state.company_id;
  if(state.client_id) document.getElementById("client-select").value = state.client_id;
  if(state.factory_id) document.getElementById("factory-select").value = state.factory_id;
  if(state.port_from_id) document.getElementById("port-from-select").value = state.port_from_id;
  if(state.template_id) { currentTemplateId=state.template_id; try{loadTemplate(state.template_id);}catch(e){} }
  // Restore product rows
  productRows = (state.productRows||[]).map(p=>({
    ...p, imagePaths: p.imagePaths||[], cartonGroup: p.cartonGroup||0,
    cartonGroupFirst: p.cartonGroupFirst!==false,
  }));
  if(productRows.length===0) addProductRow();
  renderAllTables();
  // Restore clause edits
  if(state.clauseList) { clauseList = state.clauseList; renderClauseItems(); }
  else if(state.editedClauses) {
    // backward compat
    clauseList.forEach(c=>{c.text='';});
    Object.keys(state.editedClauses).forEach(k=>{
      const i = ['clause_1_product','clause_2_quality','clause_3_mold_fee','clause_4_packaging','clause_5_delivery','clause_6_inspection','clause_7_payment','clause_8_guarantee','clause_9_liability','clause_10_dispute','clause_11_shipping','clause_12_other'].indexOf(k);
      if(i>=0&&i<clauseList.length) clauseList[i].text = state.editedClauses[k];
    });
    renderClauseItems();
  }
  schedulePreviewRefresh();
}

function loadHistory(){
  const h=JSON.parse(localStorage.getItem("contract-history")||"[]");
  const q=(document.getElementById("hist-search")?.value||"").toLowerCase();
  const list=document.getElementById("history-list");
  const filtered = q ? h.filter(x=> x.contract_no?.toLowerCase().includes(q) || (x.state?.factory_name||'').toLowerCase().includes(q)) : h;
  list.innerHTML=filtered.map(x=>{
    const st = x.state || {};
    const fac = st.factory_name || '';
    const total = st.total_amount_usd || '';
    return `<li style="flex-wrap:wrap;padding:3px 0;border-bottom:1px solid #eee">
      <span onclick="restoreFormState(JSON.parse(localStorage.getItem('contract-history')).find(e=>e.contract_no==='${x.contract_no}').state)" style="flex:1;cursor:pointer;min-width:0">
        <strong>${x.contract_no}</strong><br>
        <small>${x.date}${fac?' | '+fac:''}${total?' | $'+total:''}</small>
      </span>
      <span style="display:flex;gap:2px;width:100%;margin-top:2px">
        <button class="hist-btn" onclick="event.stopPropagation();saveAsNewContract('${x.contract_no}')" title="另存新合同">📋</button>
        <button class="hist-btn hist-del" onclick="event.stopPropagation();deleteHistoryItem('${x.contract_no}')" title="删除">&times;</button>
      </span>
    </li>`;
  }).join("");
  if(!filtered.length) list.innerHTML='<li style="font-size:11px;color:#999;padding:4px">暂无匹配合同</li>';
}
function deleteHistoryItem(cy){
  let h=JSON.parse(localStorage.getItem("contract-history")||"[]");
  h = h.filter(x => x.contract_no !== cy);
  localStorage.setItem("contract-history",JSON.stringify(h));
  loadHistory();
}
function saveAsNewContract(cy){
  const h=JSON.parse(localStorage.getItem("contract-history")||"[]");
  const entry = h.find(x => x.contract_no === cy);
  if(entry && entry.state){
    restoreFormState(entry.state);
    document.getElementById("contract-no").value = '';
    document.getElementById("contract-no").focus();
    toast("已加载 "+cy+" 的数据，请修改CY号后保存");
  }
}

// ── Toast ──
function toast(msg){
  const el=document.createElement("div");el.className="toast";el.textContent=msg;
  document.body.appendChild(el);setTimeout(()=>el.remove(),2500);
}

// ── Management Modals ──
let editingId = null;

function openPanel(type){
  const overlay=document.getElementById("modal-overlay"),content=document.getElementById("modal-content");
  overlay.hidden=false; editingId = null;
  const cfgs={
    factories:{title:"工厂管理",items:factories,fields:["name","address","tax_id","bank_name","bank_account","category"],labels:["名称","地址","税号","开户行","账号","品类"],api:"/api/factories",table:"factories"},
    companies:{title:"公司管理",items:companies,fields:["name","name_en","address","address_en","tax_id","phone"],labels:["名称","英文名","地址","英文地址","税号","电话"],api:"/api/companies",table:"companies"},
    clients:{title:"客户管理",items:clients,fields:["name","address","phone"],labels:["名称","地址","电话"],api:"/api/clients",table:"clients"},
    templates:{title:"条款模板管理",items:templates,fields:["name"],labels:["模板名称"],api:"/api/templates",table:"templates"},
    seals:{title:"公章管理",items:seals,fields:["name"],labels:["名称"],api:"",table:"seals"},
  };
  const cfg=cfgs[type];if(!cfg)return;
  if(type === 'seals'){
    content.innerHTML=`
      <button class="close-btn" onclick="closeModal()">&times;</button><h3>公章管理</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        ${seals.map(s=>`
          <div style="border:1px solid #ddd;border-radius:6px;padding:8px;text-align:center;width:120px">
            <img src="${s.path}" style="max-width:80px;max-height:80px;display:block;margin:0 auto 4px">
            <small>${esc(s.name)}</small><br>
            <button class="btn btn-outline btn-sm" onclick="deleteSeal('${s.id}');closeModal();openPanel('seals')">删除</button>
          </div>
        `).join('')}
      </div>
      <div><button class="btn btn-primary btn-sm" onclick="closeModal();openPanel('seals');uploadSeal(prompt('公章名称:','公章'))">+ 上传新公章</button></div>`;
    return;
  }
  content.innerHTML=`
    <button class="close-btn" onclick="closeModal()">&times;</button><h3>${cfg.title}</h3>
    <table><thead><tr>${cfg.labels.map(l=>`<th>${l}</th>`).join("")}<th>操作</th></tr></thead>
    <tbody>${cfg.items.map(item=>`<tr>${cfg.fields.map(f=>`<td>${esc(String(item[f]||''))}</td>`).join("")}<td><button class="btn btn-outline btn-sm" onclick="editItem('${cfg.table}',${item.id})">编辑</button> <button class="btn btn-outline btn-sm" onclick="deleteItem('${cfg.table}',${item.id})">删除</button></td></tr>`).join("")}</tbody></table>
    <div style="margin-top:16px"><h4 id="form-title">新增</h4>
    <input type="hidden" id="edit-id" value="">
    ${cfg.fields.map((f,i)=>`<input placeholder="${cfg.labels[i]}" id="new-${f}" style="margin:4px;padding:6px">`).join("")}
    <button class="btn btn-primary btn-sm" style="margin:4px" id="save-btn" onclick="saveItem('${cfg.table}')">添加</button></div>`;
}
function closeModal(){document.getElementById("modal-overlay").hidden=true;}
function editItem(table, id){
  editingId = id;
  const cfgs_list = {
    factories: factories, companies: companies, clients: clients, templates: templates
  };
  const cfgs_fields = {
    factories: ["name","address","tax_id","bank_name","bank_account","category"],
    companies: ["name","name_en","address","address_en","tax_id","phone"],
    clients: ["name","address","phone"],
    templates: ["name"]
  };
  const items = cfgs_list[table] || [];
  const fields = cfgs_fields[table] || [];
  const item = items.find(i => i.id === id);
  if(!item) { toast("未找到该项目"); return; }
  fields.forEach(f => {
    const el = document.getElementById("new-"+f);
    if(el) el.value = item[f] || '';
  });
  document.getElementById("edit-id").value = id;
  const ft = document.getElementById("form-title");
  if(ft) ft.textContent = "编辑";
  const sb = document.getElementById("save-btn");
  if(sb) sb.textContent = "保存修改";
}
async function saveItem(table){
  const fieldsByTable = {
    factories: ["name","address","tax_id","bank_name","bank_account","category"],
    companies: ["name","name_en","address","address_en","tax_id","phone"],
    clients: ["name","address","phone"],
    templates: ["name"]
  };
  const api = "/api/" + table;
  const fields = fieldsByTable[table] || [];
  const data={};fields.forEach(f=>{const el=document.getElementById("new-"+f);if(el)data[f]=el.value;});
  const eid = document.getElementById("edit-id")?.value;
  try{
    if(eid && parseInt(eid)){
      const r=await fetch(api+"/"+eid,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
      if(!r.ok)throw new Error(await r.text());
      toast("更新成功");
    } else {
      const r=await fetch(api,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});
      if(!r.ok)throw new Error(await r.text());
      toast("添加成功");
    }
    closeModal();await loadAllData();openPanel(table);
  }catch(e){toast("操作失败: "+e.message);}
}
async function deleteItem(table,id){
  if(!confirm("确定删除？"))return;
  try{await fetch(`/api/${table}/${id}`,{method:"DELETE"});toast("已删除");closeModal();await loadAllData();}
  catch(e){toast("删除失败");}
}
