let appliedSearchQuery="";

function injectAppliedSearch(){
  const view=document.getElementById("appliedView");
  const list=document.getElementById("appliedJobsList");
  if(!view||!list||document.getElementById("appliedSearchWrap"))return;
  const wrap=document.createElement("section");
  wrap.id="appliedSearchWrap";
  wrap.className="applied-search-wrap";
  wrap.innerHTML=`<div class="applied-search-field"><span class="applied-search-icon" aria-hidden="true">⌕</span><input id="appliedSearch" type="search" autocomplete="off" placeholder="Search applied jobs, companies, stages, or notes..." aria-label="Search applied jobs"><button id="clearAppliedSearch" type="button" class="applied-search-clear hidden" aria-label="Clear search">×</button></div><p id="appliedSearchStatus" class="subtle applied-search-status"></p><div id="appliedSearchEmpty" class="empty-state hidden"><strong>No applied jobs found.</strong><p>Try a different job title, company, stage, or keyword.</p></div>`;
  list.parentNode.insertBefore(wrap,list);
  const input=document.getElementById("appliedSearch");
  const clear=document.getElementById("clearAppliedSearch");
  input.value=appliedSearchQuery;
  input.addEventListener("input",()=>{appliedSearchQuery=input.value;filterAppliedJobs()});
  input.addEventListener("search",()=>{appliedSearchQuery=input.value;filterAppliedJobs()});
  clear.addEventListener("click",()=>{appliedSearchQuery="";input.value="";input.focus();filterAppliedJobs()});
}

function appliedSearchHaystack(job){
  const d=applicationDetails[job.id]||{};
  return [job.title,job.company,job.location,job.salary,job.resume,d.stage,d.notes,d.appliedAt].filter(Boolean).join(" ").toLowerCase();
}

function filterAppliedJobs(){
  injectAppliedSearch();
  const input=document.getElementById("appliedSearch");
  const clear=document.getElementById("clearAppliedSearch");
  const status=document.getElementById("appliedSearchStatus");
  const empty=document.getElementById("appliedSearchEmpty");
  if(!input||!status||!empty)return;
  if(input.value!==appliedSearchQuery)input.value=appliedSearchQuery;
  const query=appliedSearchQuery.trim().toLowerCase();
  clear?.classList.toggle("hidden",!query);
  const applied=Object.values(trackedJobs).filter(job=>statuses[job.id]==="applied");
  const matchingIds=new Set((query?applied.filter(job=>appliedSearchHaystack(job).includes(query)):applied).map(job=>job.id));
  document.querySelectorAll("#appliedJobsList .application-card").forEach(card=>card.classList.toggle("hidden",!matchingIds.has(card.dataset.applicationId)));
  const visible=query?matchingIds.size:applied.length;
  status.textContent=query?`${visible} of ${applied.length} application${applied.length===1?"":"s"} match your search.`:applied.length?`${applied.length} application${applied.length===1?"":"s"} tracked.`:"";
  empty.classList.toggle("hidden",!query||visible>0);
}

const baseRenderAppliedForSearch=renderApplied;
renderApplied=function(){baseRenderAppliedForSearch();injectAppliedSearch();filterAppliedJobs()};

const baseShowViewForAppliedSearch=showView;
showView=function(name){baseShowViewForAppliedSearch(name);if(name==="applied"){injectAppliedSearch();filterAppliedJobs()}};

document.querySelectorAll('.nav-item[data-view="applied"]').forEach(btn=>{
  btn.addEventListener("click",()=>setTimeout(()=>{injectAppliedSearch();filterAppliedJobs()},0));
});

injectAppliedSearch();
filterAppliedJobs();