const CUSTOM_JOBS_KEY="kja_custom_jobs";
let customJobs=readJSON(CUSTOM_JOBS_KEY,{});
let currentCustomAnalysis=null;

const RESUME_PROFILES={
  A:{name:"Healthcare Operations",keywords:["healthcare","aba","behavioral health","patient","patients","clinic","clinical","provider","providers","therapy","therapist","care coordination","intake","authorization","medicaid","case management","practice operations","health services","medical","care delivery"]},
  B:{name:"Business & Systems Operations",keywords:["operations","operational","systems","workflow","process improvement","automation","crm","salesforce","implementation","project management","program management","cross-functional","sop","documentation","vendor","onboarding","process design","business operations","systems operations","power automate","dataverse","monday.com"]},
  C:{name:"Growth Operations",keywords:["growth","growth operations","pipeline","revenue","go-to-market","gtm","marketing operations","funnel","acquisition","retention","conversion","lifecycle","campaign","sales operations","growth strategy","commercial","demand generation","customer growth"]},
  D:{name:"Business Analyst / Systems Analyst",keywords:["business analyst","systems analyst","requirements","requirements gathering","process mapping","testing","uat","qa","troubleshooting","data analysis","reporting","sql","user stories","technical documentation","web application","system integration","functional requirements","business requirements","data quality","dashboard"]}
};
const COMMON_STRENGTHS=["training","onboarding","stakeholder","stakeholders","project","implementation","workflow","process","reporting","dashboard","excel","crm","cross-functional","documentation","sop","automation","systems"];

function countTerms(text,terms){let score=0,hits=[];for(const term of terms){const safe=term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");const re=new RegExp(`\\b${safe.replace(/\\ /g,"\\s+")}\\b`,"i");if(re.test(text)){score++;hits.push(term)}}return {score,hits}}
function detectSource(url=""){const u=url.toLowerCase();if(u.includes("linkedin.com"))return "LinkedIn";if(u.includes("indeed.com"))return "Indeed";if(u.includes("greenhouse"))return "Greenhouse";if(u.includes("ashbyhq"))return "Ashby";if(u.includes("lever.co"))return "Lever";return url?"Company / Other":"Added by you"}
function makeCustomId(){return `custom-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function cleanText(v=""){return String(v).replace(/\s+/g," ").trim()}

function analyzeLocalJob({title="",company="",description="",url="",location="",salary=""}){
  const text=`${title} ${description}`.toLowerCase();
  const common=countTerms(text,COMMON_STRENGTHS);
  const scored=Object.entries(RESUME_PROFILES).map(([slot,p])=>{
    const m=countTerms(text,p.keywords);
    let raw=m.score*5+common.score*1.25;
    if(slot==="A"&&/(health|aba|behavior|therapy|patient|clinic|provider|care)/i.test(title))raw+=12;
    if(slot==="B"&&/(operations|systems|implementation|program|project)/i.test(title))raw+=10;
    if(slot==="C"&&/(growth|revenue|marketing|gtm|sales operations)/i.test(title))raw+=12;
    if(slot==="D"&&/(business analyst|systems analyst|analyst|requirements)/i.test(title))raw+=14;
    return {slot,name:p.name,raw,hits:m.hits};
  }).sort((a,b)=>b.raw-a.raw);
  const best=scored[0],second=scored[1];
  const evidence=Math.min(1,(best.hits.length+common.hits.length)/9);
  let fit=Math.round(62+Math.min(25,best.raw*0.9)+Math.min(6,common.score)-Math.max(0,(second.raw-best.raw+5)*0.15));
  fit=Math.max(68,Math.min(96,fit));
  if(evidence<.35)fit=Math.min(fit,82);
  const whyParts=[];
  if(best.hits.length)whyParts.push(`Strong signals for ${best.name.toLowerCase()}: ${best.hits.slice(0,5).join(", ")}.`);
  if(common.hits.length)whyParts.push(`Also overlaps with your transferable strengths in ${common.hits.slice(0,4).join(", ")}.`);
  if(!whyParts.length)whyParts.push(`This looks closest to your ${best.name.toLowerCase()} profile based on the title and responsibilities provided.`);
  const watch=[];
  if(/\b(sql|python|tableau|power bi)\b/i.test(text))watch.push("Technical/data tools appear important; describe only the level you can support accurately.");
  if(/\b(p&l|profit and loss|budget ownership|financial modeling|forecasting)\b/i.test(text))watch.push("The role appears to include financial ownership or modeling; make sure your examples support that requirement.");
  if(/\b(7\+|8\+|10\+|seven|eight|ten) years\b/i.test(text))watch.push("The experience requirement may be above your current direct experience, so position transferable ownership clearly.");
  if(/\b(licensed|license required|bcba required|rn required|clinical license)\b/i.test(text))watch.push("Check whether a professional license or clinical credential is mandatory before applying.");
  if(!watch.length)watch.push("This is an estimated local match. Review the must-have requirements before applying.");
  return {fit,resume:best.slot,resumeName:best.name,why:whyParts.join(" "),gap:watch.join(" "),source:detectSource(url),title:cleanText(title),company:cleanText(company),description:description.trim(),applyUrl:url.trim(),location:cleanText(location),salary:cleanText(salary)};
}

function injectCustomJobsUI(){
  const topbar=document.querySelector(".topbar");
  if(topbar&&!document.getElementById("addJobBtn")){
    const btn=document.createElement("button");btn.id="addJobBtn";btn.className="add-job-btn";btn.innerHTML="＋ <span>Add Job</span>";topbar.appendChild(btn);
  }
  const jobsList=document.getElementById("jobsList");
  if(jobsList&&!document.getElementById("jobSourceTabs")){
    const tabs=document.createElement("div");tabs.id="jobSourceTabs";tabs.className="job-source-tabs";tabs.innerHTML=`<button class="job-source-tab active" data-job-tab="recommended">Recommended</button><button class="job-source-tab" data-job-tab="myfinds">My Finds <span id="myFindCount">(0)</span></button>`;jobsList.parentNode.insertBefore(tabs,jobsList);
    const finds=document.createElement("div");finds.id="myFindsList";finds.className="jobs-list hidden";jobsList.parentNode.insertBefore(finds,jobsList.nextSibling);
  }
  if(!document.getElementById("addJobModal")){
    document.body.insertAdjacentHTML("beforeend",`<div id="addJobModal" class="job-modal" aria-hidden="true"><div class="job-sheet"><div class="job-sheet-head"><div><div class="eyebrow">MY FINDS</div><h2>Add a job</h2></div><button id="closeAddJob" class="job-modal-close" aria-label="Close">×</button></div><div id="addJobFormArea"><label>Job URL<input id="manualJobUrl" type="url" placeholder="https://www.linkedin.com/jobs/view/..."></label><div class="form-grid"><label>Job title<input id="manualJobTitle" placeholder="Operations Manager"></label><label>Company<input id="manualJobCompany" placeholder="Company name"></label></div><div class="form-grid"><label>Location <span class="optional-label">optional</span><input id="manualJobLocation" placeholder="New York, NY / Remote"></label><label>Salary <span class="optional-label">optional</span><input id="manualJobSalary" placeholder="$110K–$140K"></label></div><label>Job description<textarea id="manualJobDescription" placeholder="Paste the job description here..."></textarea></label><button id="analyzeManualJob" class="primary-btn full">Analyze Resume Fit</button><p class="subtle manual-privacy">Analysis runs locally in your browser. No OpenAI API is used.</p></div><section id="manualJobResult" class="manual-job-result hidden"><div class="manual-score-card"><div><div class="eyebrow hero-eyebrow">ESTIMATED FIT</div><strong id="manualFitScore">—</strong></div><div class="manual-resume-pill" id="manualResumePill">Resume —</div></div><section class="panel"><p class="subtle" id="manualSource"></p><h3 id="manualResultTitle"></h3><p id="manualResultCompany" class="company"></p><div class="resume-rec" id="manualResumeRec"></div><p><strong>Why:</strong> <span id="manualWhy"></span></p><p class="job-gap"><strong>Watch-out:</strong> <span id="manualGap"></span></p><button id="addManualJob" class="primary-btn full">Add to My Finds</button><button id="editManualJob" class="ghost-btn full secondary-full">Edit job</button></section></section></div></div>`);
  }
  bindCustomUI();renderMyFinds();
}

function bindCustomUI(){
  const add=document.getElementById("addJobBtn"),modal=document.getElementById("addJobModal"),close=document.getElementById("closeAddJob");
  if(add&&!add.dataset.bound){add.dataset.bound="1";add.addEventListener("click",openAddJob)}
  if(close&&!close.dataset.bound){close.dataset.bound="1";close.addEventListener("click",closeAddJob)}
  if(modal&&!modal.dataset.bound){modal.dataset.bound="1";modal.addEventListener("click",e=>{if(e.target===modal)closeAddJob()})}
  document.querySelectorAll(".job-source-tab").forEach(btn=>{if(btn.dataset.bound)return;btn.dataset.bound="1";btn.addEventListener("click",()=>switchJobTab(btn.dataset.jobTab))});
  const analyze=document.getElementById("analyzeManualJob");if(analyze&&!analyze.dataset.bound){analyze.dataset.bound="1";analyze.addEventListener("click",runManualAnalysis)}
  const edit=document.getElementById("editManualJob");if(edit&&!edit.dataset.bound){edit.dataset.bound="1";edit.addEventListener("click",()=>showManualForm(true))}
  const save=document.getElementById("addManualJob");if(save&&!save.dataset.bound){save.dataset.bound="1";save.addEventListener("click",saveManualJob)}
}
function openAddJob(){showManualForm(false);document.getElementById("addJobModal").classList.add("open");document.getElementById("addJobModal").setAttribute("aria-hidden","false")}
function closeAddJob(){document.getElementById("addJobModal").classList.remove("open");document.getElementById("addJobModal").setAttribute("aria-hidden","true")}
function showManualForm(keep=true){document.getElementById("addJobFormArea").classList.remove("hidden");document.getElementById("manualJobResult").classList.add("hidden");if(!keep){currentCustomAnalysis=null}}
function switchJobTab(name){document.querySelectorAll(".job-source-tab").forEach(b=>b.classList.toggle("active",b.dataset.jobTab===name));document.getElementById("jobsList").classList.toggle("hidden",name!=="recommended");document.getElementById("myFindsList").classList.toggle("hidden",name!=="myfinds");if(name==="myfinds")renderMyFinds()}

function runManualAnalysis(){
  const title=document.getElementById("manualJobTitle").value.trim(),company=document.getElementById("manualJobCompany").value.trim(),description=document.getElementById("manualJobDescription").value.trim();
  if(!title||!description){alert("Add at least the job title and job description so I can estimate the best résumé.");return}
  currentCustomAnalysis=analyzeLocalJob({title,company,description,url:document.getElementById("manualJobUrl").value,location:document.getElementById("manualJobLocation").value,salary:document.getElementById("manualJobSalary").value});
  const a=currentCustomAnalysis;
  document.getElementById("manualFitScore").textContent=`${a.fit}%`;
  document.getElementById("manualResumePill").textContent=`Resume ${a.resume}`;
  document.getElementById("manualSource").textContent=`Source: ${a.source} · Added by you`;
  document.getElementById("manualResultTitle").textContent=a.title;
  document.getElementById("manualResultCompany").textContent=a.company||"Company not entered";
  document.getElementById("manualResumeRec").innerHTML=`Best Resume: <strong>${esc(a.resume)} — ${esc(a.resumeName)}</strong>`;
  document.getElementById("manualWhy").textContent=a.why;
  document.getElementById("manualGap").textContent=a.gap;
  document.getElementById("addJobFormArea").classList.add("hidden");document.getElementById("manualJobResult").classList.remove("hidden");
}

async function saveManualJob(){
  if(!currentCustomAnalysis)return;
  const id=makeCustomId(),now=new Date().toISOString();
  const job={id,title:currentCustomAnalysis.title,company:currentCustomAnalysis.company||"Unknown company",location:currentCustomAnalysis.location||"Not specified",salary:currentCustomAnalysis.salary||"Not specified",fit:currentCustomAnalysis.fit,resume:currentCustomAnalysis.resume,why:currentCustomAnalysis.why,gap:currentCustomAnalysis.gap,applyUrl:currentCustomAnalysis.applyUrl,source:currentCustomAnalysis.source,description:currentCustomAnalysis.description,addedAt:now,updatedAt:now,addedByUser:true};
  customJobs[id]=job;trackedJobs[id]={...job};saveJSON(CUSTOM_JOBS_KEY,customJobs);saveJSON("kja_tracked_jobs",trackedJobs);
  if(typeof cloudSession!=="undefined"&&cloudSession)pushCustomJobCloud(job).catch(err=>setSyncMessage?.(`Sync issue: ${err.message}`,true));
  closeAddJob();clearManualForm();renderAll();renderMyFinds();switchJobTab("myfinds");
}
function clearManualForm(){["manualJobUrl","manualJobTitle","manualJobCompany","manualJobLocation","manualJobSalary","manualJobDescription"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});currentCustomAnalysis=null;showManualForm(true)}

function customJobCard(job){
  const current=statuses[job.id]||"";
  const view=job.applyUrl?`<a class="action-btn" href="${esc(job.applyUrl)}" target="_blank" rel="noopener">View job</a>`:`<span class="action-btn disabled-link">No link</span>`;
  return `<article class="job-card"><div class="job-top"><div><h4>${esc(job.title)}</h4><div class="company">${esc(job.company)}</div></div><span class="fit-badge">${esc(job.fit)}% est.</span></div><div class="meta"><span>${esc(job.source||"Added by you")} · Added by you</span>${job.location?`<span>${esc(job.location)}</span>`:""}${job.salary?`<span>${esc(job.salary)}</span>`:""}</div><p>${esc(job.why)}</p><p class="job-gap"><strong>Watch-out:</strong> ${esc(job.gap)}</p><div class="resume-rec">Recommended Resume: <strong>${esc(job.resume)}</strong></div><div class="actions">${view}<button class="action-btn ${current==="saved"?"selected":""}" data-job="${esc(job.id)}" data-status="saved">Save</button><button class="action-btn ${current==="skipped"?"selected":""}" data-job="${esc(job.id)}" data-status="skipped">Skip</button><button class="action-btn ${current==="applied"?"selected":""}" data-job="${esc(job.id)}" data-status="applied">Applied</button></div></article>`;
}
function renderMyFinds(){
  const list=document.getElementById("myFindsList");if(!list)return;
  const arr=Object.values(customJobs).sort((a,b)=>new Date(b.addedAt||0)-new Date(a.addedAt||0));
  list.innerHTML=arr.length?arr.map(customJobCard).join(""):`<div class="empty-state"><strong>No jobs added yet.</strong><p>Tap + Add Job to paste a job you found yourself.</p></div>`;
  bindStatusButtons(list);const c=document.getElementById("myFindCount");if(c)c.textContent=`(${arr.length})`;
}

const baseJobById=jobById;jobById=function(id){return customJobs[id]||baseJobById(id)};
const baseRenderToday=renderToday;renderToday=function(){baseRenderToday();renderMyFinds();const visible=filteredJobs();const customCount=Object.keys(customJobs).length;matchCount.textContent=visible.length+customCount};

async function pushCustomJobCloud(job){
  if(!cloudSession)return;
  const row={user_id:cloudSession.user.id,job_id:job.id,title:job.title,company:job.company,location:job.location,salary:job.salary,fit:job.fit,resume:job.resume,why:job.why,gap:job.gap,apply_url:job.applyUrl||null,source:job.source||"Added by you",description:job.description||null,added_at:job.addedAt||new Date().toISOString(),updated_at:job.updatedAt||new Date().toISOString()};
  const {error}=await cloud.from("user_custom_jobs").upsert(row,{onConflict:"user_id,job_id"});if(error)throw error;
}
async function syncCustomJobs(){
  if(typeof cloudSession==="undefined"||!cloudSession)return;
  const {data,error}=await cloud.from("user_custom_jobs").select("*").eq("user_id",cloudSession.user.id);if(error)throw error;
  const remote=data||[],seen=new Set();
  for(const r of remote){seen.add(r.job_id);const local=customJobs[r.job_id];const remoteTime=new Date(r.updated_at||0).getTime(),localTime=new Date(local?.updatedAt||0).getTime();if(!local||remoteTime>localTime){const job={id:r.job_id,title:r.title,company:r.company||"Unknown company",location:r.location||"Not specified",salary:r.salary||"Not specified",fit:r.fit||0,resume:r.resume||"B",why:r.why||"",gap:r.gap||"",applyUrl:r.apply_url||"",source:r.source||"Added by you",description:r.description||"",addedAt:r.added_at,updatedAt:r.updated_at,addedByUser:true};customJobs[job.id]=job;trackedJobs[job.id]={...trackedJobs[job.id],...job}}}
  for(const job of Object.values(customJobs)){if(!seen.has(job.id))await pushCustomJobCloud(job)}
  saveJSON(CUSTOM_JOBS_KEY,customJobs);saveJSON("kja_tracked_jobs",trackedJobs);renderAll();renderMyFinds();
}
if(typeof syncAll==="function"){
  const baseSyncAll=syncAll;syncAll=async function(opts){await baseSyncAll(opts);await syncCustomJobs().catch(err=>setSyncMessage?.(`Custom jobs sync issue: ${err.message}`,true))};
}
if(typeof cloud!=="undefined")cloud.auth.onAuthStateChange((_event,session)=>{if(session)setTimeout(()=>syncCustomJobs().catch(console.error),150)});
setTimeout(()=>{if(typeof cloudSession!=="undefined"&&cloudSession)syncCustomJobs().catch(console.error)},900);

injectCustomJobsUI();renderAll();