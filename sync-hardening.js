const CLOUD_MANAGED_JOBS_KEY="kja_cloud_managed_job_ids";
let cloudManagedJobIds=new Set(readJSON(CLOUD_MANAGED_JOBS_KEY,[]));

function persistCloudManagedJobIds(){saveJSON(CLOUD_MANAGED_JOBS_KEY,[...cloudManagedJobIds])}
function nonBlank(value){return value!==null&&value!==undefined&&String(value).trim()!==""}
function hasUsableJobMetadata(job){return !!job&&(nonBlank(job.title)||nonBlank(job.company))}
function preferredValue(remote,local,fallback=""){return nonBlank(remote)?remote:(nonBlank(local)?local:fallback)}
function currentJobMetadata(id){
  const feed=Array.isArray(jobs)?jobs.find(j=>j.id===id):null;
  const manual=(typeof customJobs!=="undefined"&&customJobs)?customJobs[id]:null;
  return feed||manual||trackedJobs[id]||{};
}

if(!localStorage.getItem(CLOUD_MANAGED_JOBS_KEY)&&localStorage.getItem("kja_last_cloud_sync")){
  cloudManagedJobIds=new Set(Object.keys(statuses).filter(id=>statuses[id]));
  persistCloudManagedJobIds();
}

function hardenedCloudJobRow(id){
  const job=currentJobMetadata(id),d=applicationDetails[id]||{};
  const fit=job.fit===null||job.fit===undefined||job.fit===""?null:Number(job.fit);
  return {
    user_id:cloudSession.user.id,
    job_id:id,
    status:statuses[id]||"saved",
    title:nonBlank(job.title)?job.title:null,
    company:nonBlank(job.company)?job.company:null,
    location:nonBlank(job.location)?job.location:null,
    salary:nonBlank(job.salary)?job.salary:null,
    fit:Number.isFinite(fit)?fit:null,
    resume:nonBlank(job.resume)?job.resume:null,
    why:nonBlank(job.why)?job.why:null,
    gap:nonBlank(job.gap)?job.gap:null,
    apply_url:nonBlank(job.applyUrl)?job.applyUrl:null,
    applied_at:d.appliedAt||null,
    stage:d.stage||null,
    notes:d.notes||null,
    updated_at:new Date().toISOString()
  };
}
cloudJobRow=hardenedCloudJobRow;

pushJobState=async function(id){
  if(!cloudSession)return;
  const uid=cloudSession.user.id;
  if(!statuses[id]){
    const {error}=await cloud.from("user_job_state").delete().eq("user_id",uid).eq("job_id",id);
    if(error)throw error;
    cloudManagedJobIds.add(id);
    persistCloudManagedJobIds();
    return;
  }

  const row=hardenedCloudJobRow(id);
  if(!hasUsableJobMetadata(row)){
    const {data:existing,error:readErr}=await cloud.from("user_job_state").select("job_id,title,company").eq("user_id",uid).eq("job_id",id).maybeSingle();
    if(readErr)throw readErr;
    if(existing){
      const d=applicationDetails[id]||{};
      const {error:updateErr}=await cloud.from("user_job_state").update({status:statuses[id],applied_at:d.appliedAt||null,stage:d.stage||null,notes:d.notes||null,updated_at:new Date().toISOString()}).eq("user_id",uid).eq("job_id",id);
      if(updateErr)throw updateErr;
      cloudManagedJobIds.add(id);persistCloudManagedJobIds();
    }
    return;
  }

  const {error}=await cloud.from("user_job_state").upsert(row,{onConflict:"user_id,job_id"});
  if(error)throw error;
  cloudManagedJobIds.add(id);
  persistCloudManagedJobIds();
};

pushAllLocalJobState=async function(){
  if(!cloudSession)return;
  for(const id of Object.keys(statuses).filter(id=>statuses[id])){
    const row=hardenedCloudJobRow(id);
    if(!hasUsableJobMetadata(row))continue;
    const {error}=await cloud.from("user_job_state").upsert(row,{onConflict:"user_id,job_id"});
    if(error)throw error;
    cloudManagedJobIds.add(id);
  }
  persistCloudManagedJobIds();
};

pullCloudData=async function(){
  if(!cloudSession)return {hasPrefs:false,remoteJobs:[]};
  const uid=cloudSession.user.id;
  const [{data:prefs,error:pErr},{data:remoteData,error:jErr}]=await Promise.all([
    cloud.from("user_preferences").select("*").eq("user_id",uid).maybeSingle(),
    cloud.from("user_job_state").select("*").eq("user_id",uid)
  ]);
  if(pErr)throw pErr;if(jErr)throw jErr;

  if(prefs){
    criteria={minSalary:String(prefs.min_salary),location:prefs.location,tracks:prefs.tracks||["A","B","C","D"]};
    saveJSON("kja_criteria",criteria);applyCriteriaToUI();
  }

  let remoteJobs=remoteData||[];
  const remoteById=new Map(remoteJobs.map(r=>[r.job_id,r]));

  // A local job that has never been seen by cloud is treated as a new/offline item.
  // Push it only when we have real metadata, which prevents blank saved cards.
  for(const id of Object.keys(statuses).filter(id=>statuses[id])){
    if(remoteById.has(id)||cloudManagedJobIds.has(id))continue;
    const row=hardenedCloudJobRow(id);
    if(!hasUsableJobMetadata(row))continue;
    const {error}=await cloud.from("user_job_state").upsert(row,{onConflict:"user_id,job_id"});
    if(error)throw error;
    remoteJobs.push(row);remoteById.set(id,row);cloudManagedJobIds.add(id);
  }

  // If a previously synced job is no longer in cloud, another device unsaved/untracked it.
  // Clear the stale local status instead of resurrecting it on the next sync.
  const remoteIds=new Set(remoteJobs.map(r=>r.job_id));
  for(const id of cloudManagedJobIds){
    if(remoteIds.has(id))continue;
    if(statuses[id])delete statuses[id];
    if(applicationDetails[id])delete applicationDetails[id];
  }

  const repairs=[];
  for(const r of remoteJobs){
    const local=currentJobMetadata(r.job_id);
    const merged={
      ...local,
      id:r.job_id,
      title:preferredValue(r.title,local.title,""),
      company:preferredValue(r.company,local.company,""),
      location:preferredValue(r.location,local.location,""),
      salary:preferredValue(r.salary,local.salary,""),
      fit:r.fit!==null&&r.fit!==undefined?r.fit:(local.fit??null),
      resume:preferredValue(r.resume,local.resume,""),
      why:preferredValue(r.why,local.why,""),
      gap:preferredValue(r.gap,local.gap,""),
      applyUrl:preferredValue(r.apply_url,local.applyUrl,"")
    };
    statuses[r.job_id]=r.status;
    trackedJobs[r.job_id]=merged;
    if(r.status==="applied")applicationDetails[r.job_id]={appliedAt:r.applied_at||applicationDetails[r.job_id]?.appliedAt||todayISO(),stage:r.stage||applicationDetails[r.job_id]?.stage||"Applied",notes:r.notes??applicationDetails[r.job_id]?.notes??""};
    cloudManagedJobIds.add(r.job_id);

    // If an older cloud row is missing metadata but this device still knows the job,
    // repair the cloud copy instead of overwriting the good local snapshot with blanks.
    if((!nonBlank(r.title)||!nonBlank(r.company))&&hasUsableJobMetadata(merged)){
      const repair=hardenedCloudJobRow(r.job_id);
      repair.status=r.status;
      repairs.push(cloud.from("user_job_state").upsert(repair,{onConflict:"user_id,job_id"}));
    }
  }

  saveJSON("kja_statuses",statuses);
  saveJSON("kja_tracked_jobs",trackedJobs);
  saveJSON("kja_application_details",applicationDetails);
  persistCloudManagedJobIds();
  renderAll();

  if(repairs.length){
    const results=await Promise.all(repairs);
    const failure=results.find(x=>x.error);if(failure?.error)throw failure.error;
  }
  return {hasPrefs:!!prefs,remoteJobs};
};

async function runHardenedSyncAfterLoad(){
  for(let i=0;i<8;i++){
    if(typeof cloudSession!=="undefined"&&cloudSession&&!syncBusy){
      try{await syncAll()}catch(err){console.warn("Hardened sync retry failed",err)}
      return;
    }
    await new Promise(resolve=>setTimeout(resolve,350));
  }
}
runHardenedSyncAfterLoad();