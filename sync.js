const SUPABASE_URL="https://zmvgbfidisvomjudlhlt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_DODNbrIsNo7jmaeen2VnwA_fiRvjUN1";
const cloud=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
let cloudSession=null;
let syncBusy=false;

function injectSyncPanel(){
  const mount=document.getElementById("syncPanelMount");
  if(!mount)return;
  mount.innerHTML=`<section class="panel sync-panel">
    <div class="section-heading compact"><div><div class="eyebrow">CLOUD SYNC</div><h3>Phone + desktop sync</h3></div><span id="syncDot" class="sync-dot"></span></div>
    <p class="subtle">Sign in once on each device. Saved jobs, applications, criteria, notes, and Resume A/B/C/D will sync through your private Supabase account.</p>
    <div id="syncSignedOut">
      <div class="form-grid sync-form">
        <label>Email<input id="syncEmail" type="email" autocomplete="email" placeholder="you@example.com"></label>
        <label>Password<input id="syncPassword" type="password" autocomplete="current-password" minlength="8" placeholder="8+ characters"></label>
      </div>
      <div class="sync-actions">
        <button id="syncSignIn" class="primary-btn">Sign in</button>
        <button id="syncSignUp" class="ghost-btn">Create account</button>
      </div>
    </div>
    <div id="syncSignedIn" class="hidden">
      <p class="sync-account">Signed in as <strong id="syncEmailDisplay"></strong></p>
      <div class="sync-actions">
        <button id="syncNow" class="primary-btn">Sync now</button>
        <button id="syncSignOut" class="ghost-btn">Sign out</button>
      </div>
    </div>
    <p id="syncMessage" class="save-message"></p>
  </section>`;
  document.getElementById("syncSignIn").addEventListener("click",signInCloud);
  document.getElementById("syncSignUp").addEventListener("click",signUpCloud);
  document.getElementById("syncSignOut").addEventListener("click",signOutCloud);
  document.getElementById("syncNow").addEventListener("click",()=>syncAll({manual:true}));
  renderCloudAuth();
}

function setSyncMessage(message,error=false){
  const el=document.getElementById("syncMessage");if(!el)return;
  el.textContent=message||"";el.classList.toggle("error-message",!!error);
}
function renderCloudAuth(){
  const out=document.getElementById("syncSignedOut"),inside=document.getElementById("syncSignedIn"),dot=document.getElementById("syncDot"),email=document.getElementById("syncEmailDisplay");
  if(!out||!inside)return;
  const signedIn=!!cloudSession;
  out.classList.toggle("hidden",signedIn);inside.classList.toggle("hidden",!signedIn);
  if(dot)dot.classList.toggle("online",signedIn);
  if(email)email.textContent=cloudSession?.user?.email||"";
}
async function signUpCloud(){
  const email=document.getElementById("syncEmail").value.trim(),password=document.getElementById("syncPassword").value;
  if(!email||password.length<8){setSyncMessage("Enter your email and a password of at least 8 characters.",true);return}
  setSyncMessage("Creating account…");
  const {data,error}=await cloud.auth.signUp({email,password});
  if(error){setSyncMessage(error.message,true);return}
  if(data.session){cloudSession=data.session;renderCloudAuth();await syncAll({firstLogin:true});setSyncMessage("Account created and synced.")}
  else setSyncMessage("Account created. Check your email to confirm it, then come back and sign in.");
}
async function signInCloud(){
  const email=document.getElementById("syncEmail").value.trim(),password=document.getElementById("syncPassword").value;
  if(!email||!password){setSyncMessage("Enter your email and password.",true);return}
  setSyncMessage("Signing in…");
  const {data,error}=await cloud.auth.signInWithPassword({email,password});
  if(error){setSyncMessage(error.message,true);return}
  cloudSession=data.session;renderCloudAuth();await syncAll({firstLogin:true});setSyncMessage("Signed in and synced.");
}
async function signOutCloud(){await cloud.auth.signOut();cloudSession=null;renderCloudAuth();setSyncMessage("Signed out. Local app data stays on this device.");}

async function pushPreferences(){
  if(!cloudSession)return;
  const uid=cloudSession.user.id;
  const row={user_id:uid,min_salary:Number(criteria.minSalary||100000),location:criteria.location||"NYC / Long Island / Remote",tracks:Array.isArray(criteria.tracks)?criteria.tracks:["A","B","C","D"],updated_at:new Date().toISOString()};
  const {error}=await cloud.from("user_preferences").upsert(row,{onConflict:"user_id"});if(error)throw error;
}
function cloudJobRow(id){
  const job=jobById(id)||trackedJobs[id]||{};const d=applicationDetails[id]||{};
  return {user_id:cloudSession.user.id,job_id:id,status:statuses[id]||"saved",title:job.title||null,company:job.company||null,location:job.location||null,salary:job.salary||null,fit:Number.isFinite(Number(job.fit))?Number(job.fit):null,resume:job.resume||null,why:job.why||null,gap:job.gap||null,apply_url:job.applyUrl||null,applied_at:d.appliedAt||null,stage:d.stage||null,notes:d.notes||null,updated_at:new Date().toISOString()};
}
async function pushJobState(id){
  if(!cloudSession)return;
  if(!statuses[id]){const {error}=await cloud.from("user_job_state").delete().eq("user_id",cloudSession.user.id).eq("job_id",id);if(error)throw error;return}
  const {error}=await cloud.from("user_job_state").upsert(cloudJobRow(id),{onConflict:"user_id,job_id"});if(error)throw error;
}
async function pushAllLocalJobState(){
  if(!cloudSession)return;
  const ids=Object.keys(statuses).filter(id=>statuses[id]);
  if(!ids.length)return;
  const {error}=await cloud.from("user_job_state").upsert(ids.map(cloudJobRow),{onConflict:"user_id,job_id"});if(error)throw error;
}
async function pullCloudData(){
  if(!cloudSession)return {hasPrefs:false,remoteJobs:[]};
  const uid=cloudSession.user.id;
  const [{data:prefs,error:pErr},{data:remoteJobs,error:jErr}]=await Promise.all([
    cloud.from("user_preferences").select("*").eq("user_id",uid).maybeSingle(),
    cloud.from("user_job_state").select("*").eq("user_id",uid)
  ]);
  if(pErr)throw pErr;if(jErr)throw jErr;
  if(prefs){criteria={minSalary:String(prefs.min_salary),location:prefs.location,tracks:prefs.tracks||["A","B","C","D"]};saveJSON("kja_criteria",criteria);applyCriteriaToUI();}
  (remoteJobs||[]).forEach(r=>{
    statuses[r.job_id]=r.status;
    trackedJobs[r.job_id]={id:r.job_id,title:r.title||"",company:r.company||"",location:r.location||"",salary:r.salary||"",fit:r.fit||0,resume:r.resume||"",why:r.why||"",gap:r.gap||"",applyUrl:r.apply_url||""};
    if(r.status==="applied")applicationDetails[r.job_id]={appliedAt:r.applied_at||todayISO(),stage:r.stage||"Applied",notes:r.notes||""};
  });
  saveJSON("kja_statuses",statuses);saveJSON("kja_tracked_jobs",trackedJobs);saveJSON("kja_application_details",applicationDetails);renderAll();
  return {hasPrefs:!!prefs,remoteJobs:remoteJobs||[]};
}

async function uploadResumeCloud(slot,record){
  if(!cloudSession||!record?.blob)return;
  const uid=cloudSession.user.id,path=`${uid}/${slot}`;
  const {error:uErr}=await cloud.storage.from("resumes").upload(path,record.blob,{upsert:true,contentType:record.type||"application/octet-stream"});if(uErr)throw uErr;
  const {error:mErr}=await cloud.from("user_resumes").upsert({user_id:uid,slot,original_name:record.name,mime_type:record.type||"application/octet-stream",storage_path:path,updated_at:new Date().toISOString()},{onConflict:"user_id,slot"});if(mErr)throw mErr;
}
async function deleteResumeCloud(slot){
  if(!cloudSession)return;const uid=cloudSession.user.id;
  await cloud.storage.from("resumes").remove([`${uid}/${slot}`]);
  await cloud.from("user_resumes").delete().eq("user_id",uid).eq("slot",slot);
}
async function syncResumes(){
  if(!cloudSession)return;const uid=cloudSession.user.id;
  const {data:meta,error}=await cloud.from("user_resumes").select("*").eq("user_id",uid);if(error)throw error;
  const remoteBySlot=Object.fromEntries((meta||[]).map(r=>[r.slot,r]));
  for(const slot of ["A","B","C","D"]){
    const local=await getResume(slot).catch(()=>null),remote=remoteBySlot[slot];
    if(local&&!remote){await uploadResumeCloud(slot,local);continue}
    if(!local&&remote){const {data,error:dErr}=await cloud.storage.from("resumes").download(remote.storage_path);if(dErr)throw dErr;const file=new File([data],remote.original_name,{type:remote.mime_type||data.type});await putResumeLocalOnly(slot,file);continue}
    if(local&&remote){const remoteTime=new Date(remote.updated_at||0).getTime(),localTime=new Date(local.updatedAt||0).getTime();if(remoteTime>localTime){const {data,error:dErr}=await cloud.storage.from("resumes").download(remote.storage_path);if(dErr)throw dErr;const file=new File([data],remote.original_name,{type:remote.mime_type||data.type});await putResumeLocalOnly(slot,file)}else if(localTime>remoteTime){await uploadResumeCloud(slot,local)}}
  }
  await refreshResumeLibrary();
}

const originalPutResume=putResume;
async function putResumeLocalOnly(slot,file){return originalPutResume(slot,file)}
putResume=async function(slot,file){await originalPutResume(slot,file);if(cloudSession){const record=await getResume(slot);await uploadResumeCloud(slot,record)}};
const originalRemoveResume=removeResume;
removeResume=async function(slot){await originalRemoveResume(slot);if(cloudSession)await deleteResumeCloud(slot)};
const originalSetStatus=setStatus;
setStatus=function(id,next){originalSetStatus(id,next);if(cloudSession)pushJobState(id).catch(err=>setSyncMessage(`Sync issue: ${err.message}`,true))};

saveCriteria.addEventListener("click",()=>{if(cloudSession)setTimeout(()=>pushPreferences().catch(err=>setSyncMessage(`Sync issue: ${err.message}`,true)),0)});
appliedJobsList.addEventListener("change",e=>{const card=e.target.closest(".application-card");if(card&&cloudSession)setTimeout(()=>pushJobState(card.dataset.applicationId).catch(err=>setSyncMessage(`Sync issue: ${err.message}`,true)),0)});
appliedJobsList.addEventListener("blur",e=>{const card=e.target.closest?.(".application-card");if(card&&cloudSession)setTimeout(()=>pushJobState(card.dataset.applicationId).catch(err=>setSyncMessage(`Sync issue: ${err.message}`,true)),0)},true);

async function syncAll({manual=false,firstLogin=false}={}){
  if(!cloudSession||syncBusy)return;syncBusy=true;
  try{
    setSyncMessage("Syncing…");
    const uid=cloudSession.user.id;
    const [{data:prefs},{data:remoteJobs}]=await Promise.all([
      cloud.from("user_preferences").select("user_id").eq("user_id",uid).maybeSingle(),
      cloud.from("user_job_state").select("job_id").eq("user_id",uid)
    ]);
    if(!prefs)await pushPreferences();
    if(!(remoteJobs||[]).length)await pushAllLocalJobState();
    await pullCloudData();
    await syncResumes();
    localStorage.setItem("kja_last_cloud_sync",new Date().toISOString());
    setSyncMessage(manual?"Everything is synced.":firstLogin?"This device is synced to your account.":"Synced.");
  }catch(err){console.error(err);setSyncMessage(`Sync failed: ${err.message}`,true)}finally{syncBusy=false}
}

async function initCloud(){
  injectSyncPanel();
  const {data}=await cloud.auth.getSession();cloudSession=data.session||null;renderCloudAuth();
  cloud.auth.onAuthStateChange((_event,session)=>{cloudSession=session;renderCloudAuth()});
  if(cloudSession)await syncAll();
}
initCloud();