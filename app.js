const DEFAULT_CRITERIA={minSalary:"100000",location:"NYC / Long Island / Remote",tracks:["A","B","C"]};
let jobs=readJSON("kja_jobs",[]);
let statuses=readJSON("kja_statuses",{});
let trackedJobs=readJSON("kja_tracked_jobs",{});
let applicationDetails=readJSON("kja_application_details",{});
let criteria=readJSON("kja_criteria",DEFAULT_CRITERIA);
let feedUpdatedAt=localStorage.getItem("kja_feed_updated")||"";

const $=id=>document.getElementById(id);
const jobsList=$("jobsList"),savedJobsList=$("savedJobsList"),appliedJobsList=$("appliedJobsList");
const matchCount=$("matchCount"),savedCount=$("savedCount"),appliedCount=$("appliedCount"),topFitDisplay=$("topFitDisplay"),minSalaryDisplay=$("minSalaryDisplay");
const minSalary=$("minSalary"),locationPref=$("locationPref"),saveCriteria=$("saveCriteria"),saveMessage=$("saveMessage"),refreshJobs=$("refreshJobs"),feedStatus=$("feedStatus"),installBtn=$("installBtn");

function readJSON(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return value??fallback}catch{return fallback}}
function saveJSON(key,value){localStorage.setItem(key,JSON.stringify(value))}
function esc(value=""){return String(value).replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]))}
function moneyK(value){return "$"+(Number(value)/1000)+"K"}
function todayISO(){return new Date().toISOString().slice(0,10)}
function formatFeedDate(value){if(!value)return "";const d=new Date(value);return Number.isNaN(d.getTime())?"":d.toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
function salaryMax(salary=""){
  const matches=[...String(salary).matchAll(/\$?([0-9][0-9,.]*)\s*(K)?/gi)];
  const values=matches.map(m=>{let n=Number(m[1].replace(/,/g,""));if(m[2])n*=1000;return n}).filter(n=>Number.isFinite(n)&&n>1000);
  return values.length?Math.max(...values):0;
}
function isNYC(location=""){return /(new york|nyc|manhattan|brooklyn|queens|bronx|staten island)/i.test(location)}
function isLongIsland(location=""){return /(long island|nassau|suffolk|mineola|garden city|melville|hicksville|hempstead|inwood, ny)/i.test(location)}
function isRemote(location=""){return /remote/i.test(location)}
function locationMatches(job){
  const loc=job.location||"";
  if(criteria.location==="NYC only")return isNYC(loc);
  if(criteria.location==="NYC + Long Island")return isNYC(loc)||isLongIsland(loc);
  if(criteria.location==="Remote only")return isRemote(loc);
  return isNYC(loc)||isLongIsland(loc)||isRemote(loc);
}
function isProgramRole(job){return /(program|project|implementation|transformation|launch)/i.test(`${job.title||""} ${job.why||""}`)}
function trackMatches(job){
  const tracks=Array.isArray(criteria.tracks)?criteria.tracks:DEFAULT_CRITERIA.tracks;
  if(!tracks.length)return true;
  return tracks.includes(job.resume)||(tracks.includes("P")&&isProgramRole(job));
}
function filteredJobs(){return jobs.filter(job=>salaryMax(job.salary)>=Number(criteria.minSalary||0)&&locationMatches(job)&&trackMatches(job))}
function snapshotJob(job){if(job&&job.id){trackedJobs[job.id]={...trackedJobs[job.id],...job};saveJSON("kja_tracked_jobs",trackedJobs)}}
function jobById(id){return jobs.find(j=>j.id===id)||trackedJobs[id]}

function jobCard(job){
  const current=statuses[job.id]||"";
  const applyButton=job.applyUrl?`<a class="action-btn" href="${esc(job.applyUrl)}" target="_blank" rel="noopener">View job</a>`:"<span></span>";
  const gap=job.gap?`<p class="job-gap"><strong>Watch-out:</strong> ${esc(job.gap)}</p>`:"";
  return `<article class="job-card">
    <div class="job-top"><div><h4>${esc(job.title)}</h4><div class="company">${esc(job.company)}</div></div><span class="fit-badge">${esc(job.fit)}% fit</span></div>
    <div class="meta"><span>${esc(job.location)}</span><span>${esc(job.salary)}</span></div>
    <p>${esc(job.why)}</p>${gap}
    <div class="resume-rec">Recommended Resume: <strong>${esc(job.resume)}</strong></div>
    <div class="actions">${applyButton}<button class="action-btn ${current==="saved"?"selected":""}" data-job="${esc(job.id)}" data-status="saved">Save</button><button class="action-btn ${current==="skipped"?"selected":""}" data-job="${esc(job.id)}" data-status="skipped">Skip</button><button class="action-btn ${current==="expired"?"selected":""}" data-job="${esc(job.id)}" data-status="expired" title="The job link has expired or no longer exists">Link Expired / Not Found</button><button class="action-btn ${current==="applied"?"selected":""}" data-job="${esc(job.id)}" data-status="applied">Applied</button></div>
  </article>`;
}

function renderToday(){
  const visible=filteredJobs();
  jobsList.innerHTML=visible.length?visible.map(jobCard).join(""):`<div class="empty-state"><strong>No jobs match these criteria.</strong><p>Try changing your salary, location, or role-track filters in Criteria.</p></div>`;
  bindStatusButtons(jobsList);
  matchCount.textContent=visible.length;
  topFitDisplay.textContent=visible.length?Math.max(...visible.map(j=>Number(j.fit)||0))+"%":"—";
  const feedDate=formatFeedDate(feedUpdatedAt);
  feedStatus.textContent=feedDate?`Job feed updated ${feedDate}.`:"Using the most recently saved job feed.";
}

function renderSaved(){
  const saved=Object.values(trackedJobs).filter(job=>statuses[job.id]==="saved");
  savedJobsList.innerHTML=saved.length?saved.map(jobCard).join(""):`<div class="empty-state"><strong>No saved jobs yet.</strong><p>Tap Save on any job and it will appear here.</p></div>`;
  bindStatusButtons(savedJobsList);
}

function applicationCard(job){
  const detail=applicationDetails[job.id]||{appliedAt:todayISO(),stage:"Applied",notes:""};
  const stages=["Applied","Phone Screen","Recruiter Screen","Hiring Manager","Interview","Final Interview","Offer","Rejected","Withdrawn"];
  return `<article class="job-card application-card" data-application-id="${esc(job.id)}">
    <div class="job-top"><div><h4>${esc(job.title)}</h4><div class="company">${esc(job.company)}</div></div><span class="stage-badge">${esc(detail.stage||"Applied")}</span></div>
    <div class="meta"><span>${esc(job.location)}</span><span>${esc(job.salary)}</span><span>Resume ${esc(job.resume||"")}</span></div>
    ${job.applyUrl?`<a class="action-btn" href="${esc(job.applyUrl)}" target="_blank" rel="noopener">Open original posting</a>`:""}
    <div class="tracker-fields">
      <label>Applied date<input type="date" class="application-date" value="${esc(detail.appliedAt||todayISO())}"></label>
      <label>Stage<select class="application-stage">${stages.map(stage=>`<option ${stage===(detail.stage||"Applied")?"selected":""}>${stage}</option>`).join("")}</select></label>
      <label>Notes<textarea class="application-notes" placeholder="Interview notes, recruiter name, follow-up date...">${esc(detail.notes||"")}</textarea></label>
    </div>
  </article>`;
}

function renderApplied(){
  const applied=Object.values(trackedJobs).filter(job=>statuses[job.id]==="applied");
  appliedJobsList.innerHTML=applied.length?applied.map(applicationCard).join(""):`<div class="empty-state"><strong>No applications tracked yet.</strong><p>Tap Applied on a job after you submit it. It will stay here even when the daily feed changes.</p></div>`;
  appliedJobsList.querySelectorAll(".application-card").forEach(card=>{
    const id=card.dataset.applicationId;
    const save=()=>{
      applicationDetails[id]={
        appliedAt:card.querySelector(".application-date").value||todayISO(),
        stage:card.querySelector(".application-stage").value,
        notes:card.querySelector(".application-notes").value
      };
      saveJSON("kja_application_details",applicationDetails);
      card.querySelector(".stage-badge").textContent=applicationDetails[id].stage;
    };
    card.querySelector(".application-date").addEventListener("change",save);
    card.querySelector(".application-stage").addEventListener("change",save);
    card.querySelector(".application-notes").addEventListener("change",save);
    card.querySelector(".application-notes").addEventListener("blur",save);
  });
}

function bindStatusButtons(container){
  container.querySelectorAll(".action-btn[data-job]").forEach(btn=>btn.addEventListener("click",()=>setStatus(btn.dataset.job,btn.dataset.status)));
}
function setStatus(id,next){
  const job=jobById(id);if(job)snapshotJob(job);
  const current=statuses[id]||"";
  statuses[id]=current===next?"":next;
  if(statuses[id]==="applied"&&!applicationDetails[id])applicationDetails[id]={appliedAt:todayISO(),stage:"Applied",notes:""};
  saveJSON("kja_statuses",statuses);saveJSON("kja_application_details",applicationDetails);
  renderAll();
}
function renderCounts(){
  savedCount.textContent=Object.values(statuses).filter(v=>v==="saved").length;
  appliedCount.textContent=Object.values(statuses).filter(v=>v==="applied").length;
  minSalaryDisplay.textContent=moneyK(criteria.minSalary||100000);
}
function renderAll(){renderToday();renderSaved();renderApplied();renderCounts()}

async function loadJobs(){
  refreshJobs.disabled=true;refreshJobs.textContent="Refreshing…";
  try{
    const res=await fetch("./jobs.json",{cache:"no-store"});if(!res.ok)throw new Error("Job feed unavailable");
    const data=await res.json();
    if(Array.isArray(data.jobs)){jobs=data.jobs;saveJSON("kja_jobs",jobs);feedUpdatedAt=data.updatedAt||new Date().toISOString();localStorage.setItem("kja_feed_updated",feedUpdatedAt)}
  }catch(err){console.warn("Using cached job feed",err)}
  finally{refreshJobs.disabled=false;refreshJobs.textContent="Refresh";renderAll()}
}

function applyCriteriaToUI(){
  criteria={...DEFAULT_CRITERIA,...criteria};
  if(!Array.isArray(criteria.tracks))criteria.tracks=[...DEFAULT_CRITERIA.tracks];
  minSalary.value=criteria.minSalary;locationPref.value=criteria.location;
  document.querySelectorAll("#trackChips .chip").forEach(chip=>chip.classList.toggle("active",criteria.tracks.includes(chip.dataset.track)));
  minSalaryDisplay.textContent=moneyK(criteria.minSalary);
}
document.querySelectorAll("#trackChips .chip").forEach(chip=>chip.addEventListener("click",()=>chip.classList.toggle("active")));
saveCriteria.addEventListener("click",()=>{
  const selected=[...document.querySelectorAll("#trackChips .chip.active")].map(chip=>chip.dataset.track);
  criteria={minSalary:minSalary.value,location:locationPref.value,tracks:selected};saveJSON("kja_criteria",criteria);applyCriteriaToUI();renderAll();
  saveMessage.textContent=`Saved. ${filteredJobs().length} current jobs match.`;setTimeout(()=>saveMessage.textContent="",2600);
});
refreshJobs.addEventListener("click",loadJobs);

function showView(name){
  const map={today:"todayView",saved:"savedView",applied:"appliedView",criteria:"criteriaView",resumes:"resumesView"};
  Object.values(map).forEach(id=>$(id).classList.add("hidden"));$(map[name]||map.today).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(btn=>btn.classList.toggle("active",btn.dataset.view===name));
  if(name==="resumes")refreshResumeLibrary();
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>showView(btn.dataset.view)));

$("exportApplications").addEventListener("click",()=>{
  const applied=Object.values(trackedJobs).filter(job=>statuses[job.id]==="applied");
  if(!applied.length){alert("No applications to export yet.");return}
  const rows=[["Company","Title","Location","Salary","Applied Date","Stage","Resume","Job URL","Notes"]];
  applied.forEach(job=>{const d=applicationDetails[job.id]||{};rows.push([job.company,job.title,job.location,job.salary,d.appliedAt||"",d.stage||"Applied",job.resume||"",job.applyUrl||"",d.notes||""])});
  const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`kevin-job-applications-${todayISO()}.csv`;a.click();URL.revokeObjectURL(url);
});

const RESUME_DB="kevin-job-agent-local",RESUME_STORE="resumes";
function openResumeDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(RESUME_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(RESUME_STORE))req.result.createObjectStore(RESUME_STORE,{keyPath:"slot"})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function putResume(slot,file){const db=await openResumeDB();return new Promise((resolve,reject)=>{const tx=db.transaction(RESUME_STORE,"readwrite");tx.objectStore(RESUME_STORE).put({slot,name:file.name,type:file.type||"application/octet-stream",blob:file,updatedAt:new Date().toISOString()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function getResume(slot){const db=await openResumeDB();return new Promise((resolve,reject)=>{const req=db.transaction(RESUME_STORE,"readonly").objectStore(RESUME_STORE).get(slot);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function removeResume(slot){const db=await openResumeDB();return new Promise((resolve,reject)=>{const tx=db.transaction(RESUME_STORE,"readwrite");tx.objectStore(RESUME_STORE).delete(slot);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function refreshResumeLibrary(){
  for(const slot of ["A","B","C"]){
    const record=await getResume(slot).catch(()=>null);const status=$("resumeStatus"+slot);const buttons=document.querySelectorAll(`[data-resume-slot="${slot}"].resume-view,[data-resume-slot="${slot}"].resume-download,[data-resume-slot="${slot}"].resume-remove`);
    status.textContent=record?record.name:"No file added yet.";buttons.forEach(btn=>btn.disabled=!record);
  }
}
document.querySelectorAll(".resume-file-input").forEach(input=>input.addEventListener("change",async()=>{const file=input.files&&input.files[0];if(!file)return;await putResume(input.dataset.resumeSlot,file);input.value="";refreshResumeLibrary()}));
document.querySelectorAll(".resume-view").forEach(btn=>btn.addEventListener("click",async()=>{const record=await getResume(btn.dataset.resumeSlot);if(!record)return;const url=URL.createObjectURL(record.blob);window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000)}));
document.querySelectorAll(".resume-download").forEach(btn=>btn.addEventListener("click",async()=>{const record=await getResume(btn.dataset.resumeSlot);if(!record)return;const url=URL.createObjectURL(record.blob);const a=document.createElement("a");a.href=url;a.download=record.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}));
document.querySelectorAll(".resume-remove").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm(`Remove Resume ${btn.dataset.resumeSlot} from this device?`))return;await removeResume(btn.dataset.resumeSlot);refreshResumeLibrary()}));

let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;installBtn.classList.remove("hidden")});installBtn.addEventListener("click",async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;installBtn.classList.add("hidden")});
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"))}

applyCriteriaToUI();renderAll();loadJobs();refreshResumeLibrary();