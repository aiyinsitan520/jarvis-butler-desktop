//! Native bridge for the six-table workspace, credentials, desktop projections and iLink worker.
use crate::{db,AppState,Res};
use jarvis_workspace::{WorkspaceStore,ConnectionConfig,Expected,ai::{self,ModelConfig},wechat};
use serde_json::{Value,json};
use rusqlite::{params,OptionalExtension};
use std::{sync::{Arc,Mutex,OnceLock},path::PathBuf,time::Duration};
use tauri::{AppHandle,Manager,Emitter};

pub struct Runtime {pub store:Arc<WorkspaceStore>,login:tokio::sync::Mutex<Option<wechat::Login>>,wechat_status:Mutex<Value>,pub(crate) capture_lock:tokio::sync::Mutex<()>,chat_jobs:Mutex<std::collections::HashMap<String,tokio::sync::oneshot::Sender<()>>>,login_epoch:std::sync::atomic::AtomicU64}
static SERVICE:OnceLock<String>=OnceLock::new();
static LEGACY_SERVICE:OnceLock<String>=OnceLock::new();
fn secret_read(key:&str)->Res<Option<String>>{
    match keyring::Entry::new(SERVICE.get().ok_or("凭据服务未初始化")?,key).and_then(|e|e.get_password()) {
        Ok(s)=>Ok(Some(s)),Err(keyring::Error::NoEntry)=>{
            if let Some(legacy)=LEGACY_SERVICE.get(){match keyring::Entry::new(legacy,key).and_then(|e|e.get_password()){
                Ok(value)=>{secret_set(key,&value)?;Ok(Some(value))},Err(keyring::Error::NoEntry)=>Ok(None),Err(_)=>Err("本机凭据存储不可用".into())}}
            else{Ok(None)}
        },Err(_)=>Err("本机凭据存储不可用，已停止需要凭据的操作".into())
    }
}
fn secret_set(key:&str,value:&str)->Res<()>{keyring::Entry::new(SERVICE.get().ok_or("凭据服务未初始化")?,key).and_then(|e|e.set_password(value)).map_err(|_|"无法写入本机凭据存储".into())}
fn secret_remove(key:&str){if let Some(s)=LEGACY_SERVICE.get(){if let Ok(e)=keyring::Entry::new(s,key){let _=e.delete_credential();}}if let Some(s)=SERVICE.get(){if let Ok(e)=keyring::Entry::new(s,key){let _=e.delete_credential();}}}
fn runtime(app:&AppHandle)->tauri::State<'_,Runtime>{app.state::<Runtime>()}
fn text(v:&Value,k:&str)->String{v[k].as_str().unwrap_or("").into()}
fn step_id(v:&Value)->String{use sha2::{Sha256,Digest};format!("n{:x}",Sha256::digest(jarvis_workspace::stable(v).as_bytes()))}
fn connection_secret(key:&str)->Res<Option<ConnectionConfig>>{secret_read(key)?.map(|s|{let v:Value=serde_json::from_str(&s).map_err(|_|"共享连接配置无效")?;ConnectionConfig::checked(&text(&v,"baseUrl"),&text(&v,"token"))}).transpose()}
fn connection_token(base_url:&str,token:String)->Res<String>{if !token.is_empty(){return Ok(token);}for key in ["workspace-connection","workspace-candidate-connection"]{if let Some(cfg)=connection_secret(key)?{if cfg.base_url==base_url.trim().trim_end_matches('/'){return Ok(cfg.token);}}}Err("请填写设备令牌".into())}
fn promote_connection(cfg:&ConnectionConfig)->Res<()>{secret_set("workspace-connection",&json!({"baseUrl":cfg.base_url,"token":cfg.token}).to_string())?;secret_remove("workspace-pending-connection");Ok(())}
async fn recover_server(app:&AppHandle)->Res<()>{
    let r=runtime(app);let _guard=r.capture_lock.lock().await;
    let status=r.store.server_transfer_status()?;
    let Some(raw)=secret_read("workspace-pending-connection")?else{return Ok(());};let pending:Value=serde_json::from_str(&raw).map_err(|_|"待恢复的连接凭据无效")?;
    let cfg=ConnectionConfig::checked(&text(&pending,"baseUrl"),&text(&pending,"token"))?;
    if pending["credentialId"].is_string()&&pending["credentialId"]==status["credentialId"]&&matches!(status["status"].as_str(),Some("pending"|"unknown")){
        r.store.resume_server(cfg.clone()).await?;promote_connection(&cfg)?;
    }else if pending["credentialId"].is_string()&&r.store.get_value("server-connection-credential")?.as_ref()==Some(&pending["credentialId"])&&!r.store.is_local()?{
        r.store.configure(Some(cfg.clone()))?;promote_connection(&cfg)?;
    }Ok(())
}
pub fn model(app:&AppHandle)->Res<Option<ModelConfig>>{
    let Some(v)=runtime(app).store.get_value("model-public")?else{return Ok(None);};
    let mut c:ModelConfig=serde_json::from_value(v).map_err(|_|"本机模型配置损坏")?;c.api_key=secret_read("model-key")?.unwrap_or_default();Ok(Some(c))
}
pub fn configured_model()->Res<Option<ModelConfig>>{
    let Some(v)=secret_read("model-config")?else{return Ok(None);};let mut c:ModelConfig=serde_json::from_str(&v).map_err(|_|"模型配置无效")?;c.api_key=secret_read("model-key")?.unwrap_or_default();Ok(Some(c))
}
pub fn init(app:&AppHandle)->Res<()>{
    let st=app.state::<AppState>();use sha2::{Sha256,Digest};
    let id_path=st.data_dir.join("vault-id.json");
    let identity:Value=if id_path.exists(){serde_json::from_slice(&std::fs::read(&id_path).map_err(|_|"无法读取资料库标识")?).map_err(|_|"资料库标识损坏")?}else{let v=json!({"id":uuid::Uuid::new_v4().to_string(),"legacyService":format!("jarvis-desktop-{:x}",Sha256::digest(st.data_dir.to_string_lossy().as_bytes()))});jarvis_workspace::vault::atomic(&id_path,v.to_string().as_bytes())?;v};
    let vault_id=identity["id"].as_str().ok_or("资料库标识缺失")?;uuid::Uuid::parse_str(vault_id).map_err(|_|"资料库标识无效")?;
    let _=SERVICE.set(format!("org.jarvis.butler.{vault_id}"));if let Some(legacy)=identity["legacyService"].as_str(){let _=LEGACY_SERVICE.set(legacy.into());}
    let store=WorkspaceStore::open(&st.data_dir.join("workspace.db"))?;
    if let Some(cfg)=connection_secret("workspace-connection")?{store.configure(Some(cfg))?;}
    else if !store.is_local()? {if let Some(raw)=secret_read("workspace-pending-connection")?{let v:Value=serde_json::from_str(&raw).map_err(|_|"待恢复连接无效")?;if v["credentialId"].is_string()&&store.get_value("server-connection-credential")?.as_ref()==Some(&v["credentialId"]){let cfg=ConnectionConfig::checked(&text(&v,"baseUrl"),&text(&v,"token"))?;store.configure(Some(cfg.clone()))?;promote_connection(&cfg)?;}}}
    st.db.lock().unwrap().execute_batch("CREATE TABLE IF NOT EXISTS workspace_map(kind TEXT NOT NULL,native_id INTEGER NOT NULL,cloud_id TEXT NOT NULL,base TEXT NOT NULL,PRIMARY KEY(kind,native_id),UNIQUE(kind,cloud_id));").map_err(|_|"无法创建资料映射")?;
    app.manage(Runtime{store,login:tokio::sync::Mutex::new(None),wechat_status:Mutex::new(json!({"channelStatus":"stopped","qrStatus":"not_started"})),capture_lock:tokio::sync::Mutex::new(()),chat_jobs:Mutex::new(std::collections::HashMap::new()),login_epoch:std::sync::atomic::AtomicU64::new(0)});
    Ok(())
}
pub fn start(app:AppHandle){
    let a=app.clone();tauri::async_runtime::spawn(async move{loop{
        let r=runtime(&a);
        let _=recover_server(&a).await;
        let show_request=a.state::<AppState>().data_dir.join("show-main.request");
        if show_request.is_file()&&std::fs::remove_file(&show_request).is_ok(){let handle=a.clone();let _=a.run_on_main_thread(move||crate::win::open_main(&handle));}
        if !r.store.server_transfer_active().unwrap_or(true)&&r.store.view().is_ok_and(|v|v.configured||v.local){
            let _=r.store.flush().await;
            if r.store.refresh().await.is_ok(){let _=native_outbox(&a).await;let _=project(&a);}
        }
        if !r.store.server_transfer_active().unwrap_or(true){
            let _guard=r.capture_lock.lock().await;
            if let Ok(tasks)=r.store.captures(){for task in tasks.into_iter().filter(|v|v["origin"]!="wechat"&&(v["status"]=="saved_local"||v["status"]=="source_saved"||v["status"]=="organized"||(v["status"]=="waiting_ai"&&model(&a).ok().flatten().is_some_and(|m|m.auto_organize)))){if let Some(id)=task["id"].as_str(){let m=model(&a).ok().flatten();let _=r.store.process_capture(id,m.as_ref(),false).await;}}}
        }
        let _=daily_review(&a);
        let _=a.emit("workspace-changed",());let _=a.emit("data-changed",());
        tokio::time::sleep(Duration::from_secs(5)).await;
    }});
    let b=app.clone();tauri::async_runtime::spawn(async move { loop {
        let r=runtime(&b);let result=async {let _guard=r.capture_lock.lock().await;let root=crate::portable::library(&b);
            r.store.vault_scan(&root).await?;crate::portable::export_attachments(&b)?;r.store.collect(&root)?;r.store.export_conversations(&root)?;
            let m=model(&b)?;r.store.learning_tick(&root,m.as_ref(),None).await?;deliver_reviews(&b).await?;Ok::<(),String>(())
        }.await;
        let _=r.store.set_value("background-error",&result.err().map(Value::String).unwrap_or(Value::Null));
        let _=b.emit("archive-changed",());tokio::time::sleep(Duration::from_secs(30)).await;
    }});
    tauri::async_runtime::spawn(async move{wechat_loop(app).await;});
}
fn set_status(app:&AppHandle,key:&str,value:Value){runtime(app).wechat_status.lock().unwrap()[key]=value;let _=app.emit("workspace-im-changed",());}

#[tauri::command]pub fn workspace_view(app:AppHandle)->Res<jarvis_workspace::View>{runtime(&app).store.view()}
#[tauri::command]pub async fn workspace_refresh(app:AppHandle)->Res<jarvis_workspace::View>{let r=runtime(&app);if r.store.server_transfer_active()?{return Err("首次同步结果待核对，请恢复连接")?;}r.store.flush().await?;r.store.refresh().await?;native_outbox(&app).await?;project(&app)?;let _=app.emit("data-changed",());r.store.view()}
#[tauri::command]pub async fn workspace_command(app:AppHandle,command:Value,expected:Option<Expected>)->Res<Value>{
    let op=runtime(&app).store.submit(command,expected).await?;project(&app)?;let _=app.emit("data-changed",());let _=app.emit("workspace-changed",());Ok(json!({"operation":op,"view":runtime(&app).store.view()?}))
}
#[tauri::command]pub async fn workspace_save_connection(app:AppHandle,base_url:String,token:String)->Res<()>{
    let cfg=ConnectionConfig::checked(&base_url,&token)?;let preview=runtime(&app).store.preview_server(&cfg).await?;
    if preview["uploadLocal"]==true&&jarvis_workspace::TABLES.iter().any(|t|preview["localCounts"][*t].as_u64().unwrap_or(0)>0){return Err("请使用同步设置的预览和确认合并，已有内容不会自动上传".into());}
    workspace_connect_server(app,base_url,token,text(&preview,"id"),"keep".into()).await.map(|_|())
}
#[tauri::command]pub async fn workspace_preview_server(app:AppHandle,base_url:String,token:String)->Res<Value>{
    let r=runtime(&app);let _guard=r.capture_lock.lock().await;
    native_outbox(&app).await?;
    let token=connection_token(&base_url,token)?;
    r.store.preview_server(&ConnectionConfig::checked(&base_url,&token)?).await
}
fn backup_before_server(app:&AppHandle)->Res<()>{
    let st=app.state::<AppState>();let root=st.data_dir.join("backups").join(format!("server-{}",uuid::Uuid::new_v4().simple()));std::fs::create_dir_all(&root).map_err(|_|"无法创建本机备份目录")?;
    st.db.lock().unwrap().execute("VACUUM INTO ?1",[root.join("dingmi.db").to_string_lossy().as_ref()]).map_err(|_|"原生资料备份失败，已停止连接")?;
    let connection=rusqlite::Connection::open(st.data_dir.join("workspace.db")).map_err(|_|"无法打开本机资料备份")?;
    connection.execute("VACUUM INTO ?1",[root.join("workspace.db").to_string_lossy().as_ref()]).map_err(|_|"知识资料备份失败，已停止连接")?;Ok(())
}
#[tauri::command]pub async fn workspace_connect_server(app:AppHandle,base_url:String,token:String,preview_id:String,resolution:String)->Res<Value>{
    let r=runtime(&app);let _guard=r.capture_lock.lock().await;
    if r.store.server_transfer_active()?{return Err("请先核对正在进行的首次同步")?;}
    native_outbox(&app).await?;
    let token=connection_token(&base_url,token)?;
    let cfg=ConnectionConfig::checked(&base_url,&token)?;let credential_id=uuid::Uuid::new_v4().simple().to_string();backup_before_server(&app)?;
    secret_set("workspace-pending-connection",&json!({"baseUrl":cfg.base_url,"token":cfg.token,"credentialId":credential_id}).to_string())?;
    let result=r.store.connect_server(cfg.clone(),&preview_id,&resolution,&credential_id).await?;promote_connection(&cfg)?;
    project(&app)?;let _=app.emit("workspace-changed",());let _=app.emit("data-changed",());Ok(result)
}
#[tauri::command]pub async fn workspace_resume_server(app:AppHandle,token:Option<String>)->Res<Value>{
    if let Some(token)=token.filter(|s|!s.trim().is_empty()) {let r=runtime(&app);let _guard=r.capture_lock.lock().await;let status=r.store.server_transfer_status()?;if !r.store.server_transfer_active()?{return Err("没有待核对的首次同步任务")?;}let cfg=ConnectionConfig::checked(&text(&status,"baseUrl"),&token)?;secret_set("workspace-pending-connection",&json!({"baseUrl":cfg.base_url,"token":cfg.token,"credentialId":status["credentialId"]}).to_string())?;}
    recover_server(&app).await?;let r=runtime(&app);if r.store.server_transfer_active()?{return Err("首次同步尚待核对，请补充设备令牌后恢复连接".into());}project(&app)?;let _=app.emit("workspace-changed",());r.store.server_transfer_status()
}
#[tauri::command]pub fn workspace_settings(app:AppHandle)->Res<Value>{
    let r=runtime(&app);let m=model(&app)?;let bound=secret_read("wechat-account")?.is_some();let paired=secret_read("wechat-paired")?.is_some();
    Ok(json!({"connection":r.store.get_value("connection-public")?,"sync":{"candidate":r.store.get_value("server-candidate-public")?,"transfer":r.store.server_transfer_status()?,"lastSuccess":r.store.get_value("sync-last-success")?},"model":m.map(|m|m.public()),"memoryRoot":r.store.get_value("memory-root")?,"wechat":{"bound":bound,"paired":paired,"enabled":r.store.get_value("wechat-enabled")?.unwrap_or(json!(false)),"state":r.wechat_status.lock().unwrap().clone()}}))
}
fn model_draft(app:&AppHandle,config:Value)->Res<ModelConfig>{
 let mut c:ModelConfig=serde_json::from_value(config).map_err(|_|"模型配置无效")?;c.validate_endpoint()?;
 if c.api_key=="__KEEP__"{let old=model(app)?.ok_or("请填写此接口的API Key")?;c.reuse_key(&old)?;}
 Ok(c)
}
#[tauri::command]pub fn workspace_save_model(app:AppHandle,config:Value)->Res<()>{
    let mut c=model_draft(&app,config)?;c.model=c.model.trim().into();c.validate()?;if c.models.len()>1000||c.model.len()>512{return Err("模型清单最多1000项，模型ID最长512字节".into());}
    c.models.retain(|id|!id.trim().is_empty()&&id.len()<=512);c.models.sort();c.models.dedup();if !c.models.contains(&c.model){c.models.insert(0,c.model.clone());}
    secret_set("model-key",&c.api_key)?;c.api_key.clear();let mut native=c.clone();native.models.clear();secret_set("model-config",&serde_json::to_string(&native).unwrap())?;runtime(&app).store.set_value("model-public",&serde_json::to_value(&c).unwrap())?;
    let st=app.state::<AppState>();let mut s=st.settings.lock().unwrap();s.ai_key="__MANAGED__".into();s.ai_base=c.base_url;s.ai_model=c.model;s.sync_ai_key=false;crate::settings::save_local(&st.db.lock().unwrap(),&s).map_err(|_|"模型外观状态保存失败")?;
    let _=app.emit("settings-changed",s.clone());let _=app.emit("workspace-changed",());Ok(())
}
#[tauri::command]pub async fn workspace_models(app:AppHandle,config:Option<Value>)->Res<Vec<String>>{let c=if let Some(v)=config{model_draft(&app,v)?}else{model(&app)?.ok_or("请先填写接口地址")?};ai::list_models(&c).await}
#[tauri::command]pub async fn workspace_ai_chat(app:AppHandle,messages:Value,selected_model:Option<String>,request_id:String)->Res<String>{
    if request_id.len()>128||request_id.len()<16{return Err("对话请求标识无效".into());}
    let (sender,mut cancel)=tokio::sync::oneshot::channel();
    {let r=runtime(&app);let mut jobs=r.chat_jobs.lock().unwrap();if jobs.len()>=8||jobs.contains_key(&request_id){return Err("已有对话正在处理".into());}jobs.insert(request_id.clone(),sender);}
    let result=async {
        let mut c=model(&app)?.ok_or("先配置模型")?;
        if let Some(m)=selected_model{if m!=c.model&&!c.models.contains(&m){return Err("该模型未在本机配置中选择".into());}c.model=m;}
        let xs=messages.as_array().ok_or("对话格式无效")?;
        if xs.len()>100||messages.to_string().len()>400000{return Err("对话过长".into());}
        tokio::select!{r=ai::chat(&c,messages,false)=>r,_=&mut cancel=>Err("已停止本轮生成，草稿已保留".into())}
    }.await;
    runtime(&app).chat_jobs.lock().unwrap().remove(&request_id);result
}
#[tauri::command]pub fn workspace_ai_cancel(app:AppHandle,request_id:String){if let Some(sender)=runtime(&app).chat_jobs.lock().unwrap().remove(&request_id){let _=sender.send(());}}

#[tauri::command]pub async fn workspace_capture(app:AppHandle,raw:String)->Res<Value>{let c=runtime(&app).store.capture(None,&raw,"desktop",vec![])?;Ok(serde_json::to_value(c).unwrap())}
#[tauri::command]pub fn workspace_tasks(app:AppHandle)->Res<Value>{let r=runtime(&app);let mut captures=r.store.captures()?;for c in &mut captures{c["deliveryStatus"]=r.store.get_value(&format!("delivery:{}",text(c,"id")))?.unwrap_or(Value::Null);}Ok(json!({"operations":r.store.operations()?,"captures":captures}))}
#[tauri::command]pub async fn workspace_process_capture(app:AppHandle,id:String,retry:bool)->Res<Value>{let r=runtime(&app);let _guard=r.capture_lock.lock().await;let m=model(&app)?;let c=r.store.process_capture(&id,m.as_ref(),retry).await?;project(&app)?;let _=app.emit("workspace-changed",());Ok(serde_json::to_value(c).unwrap())}
#[tauri::command]pub async fn workspace_retry(app:AppHandle,id:String)->Res<Value>{let op=runtime(&app).store.retry(&id).await?;Ok(serde_json::to_value(op).unwrap())}
#[tauri::command]pub fn workspace_discard(app:AppHandle,id:String)->Res<()>{runtime(&app).store.discard(&id)}
#[tauri::command]pub async fn workspace_memory_pick(app:AppHandle)->Res<Option<String>>{use tauri_plugin_dialog::DialogExt;let p=app.dialog().file().blocking_pick_folder();if let Some(p)=p{let path=p.into_path().map_err(|_|"目录不可用")?;let s=path.to_string_lossy().to_string();runtime(&app).store.set_value("memory-root",&json!(s))?;runtime(&app).store.set_value("memory-cache",&Value::Null)?;Ok(Some(s))}else{Ok(None)}}
#[tauri::command]pub async fn workspace_memory_index(app:AppHandle,refresh:bool)->Res<Value>{
    let r=runtime(&app);if !refresh{if let Some(v)=r.store.get_value("memory-cache")?.filter(|v|!v.is_null()){return Ok(v);}}
    let root=r.store.get_value("memory-root")?.and_then(|v|v.as_str().map(str::to_owned)).ok_or("在设置中选择只读 Markdown 仓库")?;
    let index=tauri::async_runtime::spawn_blocking(move||jarvis_workspace::memory::index(&PathBuf::from(root))).await.map_err(|_|"仓库扫描中断")??;r.store.set_value("memory-cache",&index)?;Ok(index)
}
#[tauri::command]pub async fn workspace_memory_read(app:AppHandle,path:String)->Res<Value>{let root=runtime(&app).store.get_value("memory-root")?.and_then(|v|v.as_str().map(str::to_owned)).ok_or("尚未选择仓库")?;let p=path.clone();let body=tauri::async_runtime::spawn_blocking(move||jarvis_workspace::memory::read(&PathBuf::from(root),&p)).await.map_err(|_|"读取中断")??;Ok(json!({"path":path,"title":PathBuf::from(&path).file_stem().unwrap_or_default().to_string_lossy(),"content":body,"modified":0}))}

#[tauri::command]pub async fn workspace_open_media(app:AppHandle,capture_id:String,file:String)->Res<()>{
    let capture=runtime(&app).store.captures()?.into_iter().find(|v|v["id"]==capture_id).ok_or("附件记录不存在")?;
    if !capture["attachments"].as_array().is_some_and(|xs|xs.iter().any(|v|v.as_str()==Some(file.as_str())))||file.contains(['/', '\\'])||file.contains("..") {return Err("附件标识无效".into());}
    let root=app.state::<AppState>().data_dir.join("wechat-attachments");let p=root.join(file);let info=std::fs::symlink_metadata(&p).map_err(|_|"附件不存在")?;
    if !info.is_file()||info.file_type().is_symlink()||!p.canonicalize().map_err(|_|"附件不可用")?.starts_with(root.canonicalize().map_err(|_|"附件目录不可用")?){return Err("附件路径越界".into());}
    #[cfg(windows)] let _ = std::process::Command::new("explorer.exe").arg("/select,").arg(&p).spawn().map_err(|_|"无法在资源管理器显示附件")?;
    #[cfg(target_os="macos")] let _=std::process::Command::new("open").arg("-R").arg(&p).spawn().map_err(|_|"无法在Finder显示附件")?;Ok(())
}

// Existing Dingmi windows write to the local projection. Dirty records are durable drafts until confirmed.
fn native_command(kind:&str,row:&Value,cloud:Option<&Value>,notebook:&str)->Value{
    if row["deleted"].as_bool()==Some(true){return json!({"type":"delete","table":kind,"id":cloud.map(|v|v["id"].clone()).unwrap_or(Value::Null)});}
    let data=if kind=="notes" {json!({"title":row["title"],"content":row["body"].as_str().unwrap_or("").replace("(att:","(desktop-attachment:"),"tags":cloud.map(|v|v["tags"].clone()).unwrap_or(json!([]))})}else{json!({"title":row["title"],"done":row["done"],"priority":if row["urgent"]==true{"high"}else{"normal"},"due":row["due"]})};
    if let Some(old)=cloud{json!({"type":"update","table":kind,"id":old["id"],"data":data})}else if kind=="notes"{json!({"type":"createNote","data":{"notebookId":notebook,"title":data["title"],"content":data["content"]}})}else{let mut data=data;data.as_object_mut().unwrap().remove("done");if data["due"]==""{data.as_object_mut().unwrap().remove("due");}json!({"type":"createTodo","data":data})}
}
fn dirty(app:&AppHandle)->Res<Vec<Value>>{
    let st=app.state::<AppState>();let c=st.db.lock().unwrap();let mut out=vec![];
    for kind in ["notes","todos"]{
        let table=if kind=="notes"{"notes"}else{"reminders"};let mut q=c.prepare(&format!("SELECT id FROM {table} WHERE dirty=1")).map_err(|_|"无法读取本机草稿")?;
        let ids=q.query_map([],|r|r.get::<_,i64>(0)).map_err(|_|"无法读取草稿")?.collect::<std::result::Result<Vec<_>,_>>().map_err(|_|"草稿读取失败")?;
        for id in ids{let row=if kind=="notes"{let n=db::get_note(&c,id).map_err(|_|"笔记读取失败")?.ok_or("笔记缺失")?;json!({"kind":kind,"id":id,"uid":n.uid,"title":n.title,"body":n.body,"deleted":n.deleted_at.is_some()})}else{let r=db::get_reminder(&c,id).map_err(|_|"提醒读取失败")?.ok_or("提醒缺失")?;if r.uid.starts_with("jarvis-learning-review-"){continue;}json!({"kind":kind,"id":id,"uid":r.uid,"title":r.title,"done":r.done,"urgent":r.urgent,"due":r.due_at,"lastDone":r.last_done_at,"recurring":r.repeat.is_recurring(),"deleted":r.deleted_at.is_some()})};out.push(row);}
    }Ok(out)
}
async fn native_outbox(app:&AppHandle)->Res<()>{
    let rt=runtime(app);let rows=dirty(app)?;
    for row in rows{
        let kind=row["kind"].as_str().unwrap();let id=row["id"].as_i64().unwrap();let uid=row["uid"].as_str().unwrap();let key=format!("native-outbox:{kind}:{uid}");
        let previous=rt.store.get_value(&key)?;
        if let Some(p)=previous.as_ref(){let op_id=text(p,"operationId");if let Some(op)=rt.store.operations()?.into_iter().find(|o|o.id==op_id){
            if op.status!="committed"{continue;}
            if let Some(cloud_id)=op.result.filter(|s|!s.is_empty()){
                let st=app.state::<AppState>();let c=st.db.lock().unwrap();let base=rt.store.cached()?.and_then(|s|s.data[kind].as_array().and_then(|xs|xs.iter().find(|v|v["id"]==cloud_id).cloned())).unwrap_or(json!({"id":cloud_id}));
                c.execute("INSERT INTO workspace_map VALUES(?1,?2,?3,?4) ON CONFLICT(kind,native_id) DO UPDATE SET cloud_id=excluded.cloud_id,base=excluded.base",params![kind,id,cloud_id,base.to_string()]).map_err(|_|"资料映射失败")?;
            }
            if p["row"]==row{let st=app.state::<AppState>();let table=if kind=="notes"{"notes"}else{"reminders"};st.db.lock().unwrap().execute(&format!("UPDATE {table} SET dirty=0 WHERE id=?1"),[id]).map_err(|_|"草稿状态保存失败")?;rt.store.set_value(&key,&Value::Null)?;continue;}
            rt.store.set_value(&key,&Value::Null)?;
        }}
        let mapping:Option<String>={let st=app.state::<AppState>();let c=st.db.lock().unwrap();c.query_row("SELECT base FROM workspace_map WHERE kind=?1 AND native_id=?2",params![kind,id],|r|r.get(0)).optional().map_err(|_|"映射读取失败")?};
        let old:Option<Value>=mapping.map(|s|serde_json::from_str(&s)).transpose().map_err(|_|"映射损坏")?;
        if row["deleted"]==true&&old.is_none(){let st=app.state::<AppState>();let t=if kind=="notes"{"notes"}else{"reminders"};st.db.lock().unwrap().execute(&format!("UPDATE {t} SET dirty=0 WHERE id=?1"),[id]).map_err(|_|"草稿状态错误")?;continue;}
        let snapshot=rt.store.cached()?.ok_or("等待共享资料")?;
        let current=old.as_ref().and_then(|old|snapshot.data[kind].as_array()?.iter().find(|v|v["id"]==old["id"]));
        if let (Some(base),Some(now))=(&old,current){if base!=now{let op_id=step_id(&json!({"row":row,"base":base}));let op=jarvis_workspace::Operation{id:op_id.clone(),command:native_command(kind,&row,Some(base),""),expected:Some(snapshot.expected()),fingerprint:None,status:"conflict".into(),result:None,error:Some("另一客户端已修改这条记录，请核对本机草稿".into())};rt.store.save_operation(&op)?;rt.store.set_value(&key,&json!({"operationId":op_id,"row":row}))?;continue;}}
        let inbox=if kind=="notes"&&old.is_none(){rt.store.ensure_inbox().await?}else{String::new()};
        let command=native_command(kind,&row,old.as_ref(),&inbox);let op_id=step_id(&json!({"row":row,"expected":snapshot.expected()}));
        rt.store.set_value(&key,&json!({"operationId":op_id,"row":row}))?;
        let op=rt.store.submit_once(&op_id,command,if old.is_some(){Some(snapshot.expected())}else{None}).await?;
        if op.status=="committed"{
            let cloud_id=op.result.as_deref().unwrap_or("");let base=rt.store.cached()?.and_then(|s|s.data[kind].as_array().and_then(|xs|xs.iter().find(|v|v["id"]==cloud_id).cloned())).unwrap_or(json!({"id":cloud_id,"_desktopDeleted":true}));
            let same=dirty(app)?.iter().any(|current|current==&row);
            let st=app.state::<AppState>();let c=st.db.lock().unwrap();
            c.execute("INSERT INTO workspace_map VALUES(?1,?2,?3,?4) ON CONFLICT(kind,native_id) DO UPDATE SET cloud_id=excluded.cloud_id,base=excluded.base",params![kind,id,cloud_id,base.to_string()]).map_err(|_|"资料映射确认失败")?;
            let table=if kind=="notes"{"notes"}else{"reminders"};if same {c.execute(&format!("UPDATE {table} SET dirty=0 WHERE id=?1"),[id]).map_err(|_|"本机草稿确认失败")?;}
            rt.store.set_value(&key,&Value::Null)?;
        }
    }Ok(())
}

pub fn project(app:&AppHandle)->Res<()>{
    let Some(snapshot)=runtime(app).store.cached()?else{return Ok(());};let st=app.state::<AppState>();let c=st.db.lock().unwrap();
    for kind in ["notes","todos"]{for row in snapshot.data[kind].as_array().into_iter().flatten(){
        let cloud_id=row["id"].as_str().ok_or("共享标识无效")?;
        let found:Option<i64>=c.query_row("SELECT native_id FROM workspace_map WHERE kind=?1 AND cloud_id=?2",params![kind,cloud_id],|r|r.get(0)).optional().map_err(|_|"映射读取失败")?;
        let table=if kind=="notes"{"notes"}else{"reminders"};
        if let Some(id)=found{let local_dirty:i64=c.query_row(&format!("SELECT dirty FROM {table} WHERE id=?1"),[id],|r|r.get(0)).unwrap_or(0);if local_dirty!=0{continue;}}
        let mut rolled=false;
        let id=if kind=="notes"{
            let mut n=found.and_then(|id|db::get_note(&c,id).ok().flatten()).unwrap_or_default();let unchanged=n.title==text(row,"title")&&n.body==text(row,"content").replace("(desktop-attachment:","(att:");n.title=text(row,"title");n.body=text(row,"content").replace("(desktop-attachment:","(att:");if n.uid.is_empty(){n.uid=cloud_id.into();}
            if unchanged&&found.is_some(){n.id}else{db::upsert_note(&c,&n).map_err(|_|"笔记投影失败")?}
        }else{
            let mut r=found.and_then(|id|db::get_reminder(&c,id).ok().flatten()).unwrap_or_default();if r.uid.is_empty(){r.uid=cloud_id.into();}
            let due=text(row,"due").replace('T'," ").chars().take(16).collect::<String>();
            let changed=r.due_at!=due||r.done!=(row["done"]==true);
            r.title=text(row,"title");r.urgent=row["priority"]=="high";
            if r.repeat.is_recurring() && row["done"]==true && !r.done {crate::complete(&mut r);rolled=true;}else{r.done=row["done"]==true;}
            if changed{r.snoozed_until=None;r.state=if due.is_empty(){db::ST_SEEN}else{db::ST_WAIT};}if !rolled {r.due_at=due;}
            db::upsert_reminder(&c,&r).map_err(|_|"待办投影失败")?
        };
        c.execute(&format!("UPDATE {table} SET dirty={},deleted_at=NULL WHERE id=?1",if rolled {1}else{0}),[id]).map_err(|_|"投影确认失败")?;
        c.execute("INSERT INTO workspace_map VALUES(?1,?2,?3,?4) ON CONFLICT(kind,native_id) DO UPDATE SET cloud_id=excluded.cloud_id,base=excluded.base",params![kind,id,cloud_id,row.to_string()]).map_err(|_|"映射保存失败")?;
    }
    let mut q=c.prepare("SELECT native_id,cloud_id FROM workspace_map WHERE kind=?1").map_err(|_|"映射读取失败")?;let maps=q.query_map([kind],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?))).map_err(|_|"映射读取失败")?.collect::<std::result::Result<Vec<_>,_>>().map_err(|_|"映射读取失败")?;
    for (id,cloud_id)in maps{if !snapshot.data[kind].as_array().is_some_and(|xs|xs.iter().any(|r|r["id"]==cloud_id)){let table=if kind=="notes"{"notes"}else{"reminders"};c.execute(&format!("UPDATE {table} SET deleted_at=COALESCE(deleted_at,?2),done=done WHERE id=?1 AND dirty=0").replace(",done=done",if kind=="notes"{""}else{",done=1"}),params![id,db::now_sec()]).map_err(|_|"删除投影失败")?;}}
    }Ok(())
}

#[tauri::command]pub async fn workspace_wechat_login(app:AppHandle)->Res<Value>{let epoch=runtime(&app).login_epoch.fetch_add(1,std::sync::atomic::Ordering::SeqCst)+1;let login=wechat::Client::new()?.start_login().await?;if runtime(&app).login_epoch.load(std::sync::atomic::Ordering::SeqCst)!=epoch{return Err("绑定已取消".into());}let out=json!({"qrcodeUrl":login.display,"status":"wait"});*runtime(&app).login.lock().await=Some(login);set_status(&app,"qrStatus",json!("wait"));Ok(out)}
#[tauri::command]pub async fn workspace_wechat_poll(app:AppHandle,pin:Option<String>)->Res<Value>{
    let r=runtime(&app);let epoch=r.login_epoch.load(std::sync::atomic::Ordering::SeqCst);let mut guard=r.login.lock().await;let login=guard.as_mut().ok_or("请先生成二维码")?;
    if let Some(pin)=pin.filter(|s|!s.is_empty()){if !pin.bytes().all(|b|b.is_ascii_digit())||pin.len()>12{return Err("请输入手机显示的数字 PIN".into());}login.verify_code=Some(pin);}
    let(status,account)=wechat::Client::new()?.poll_login(login).await?;
    if r.login_epoch.load(std::sync::atomic::Ordering::SeqCst)!=epoch{return Err("绑定已取消".into());}
    if let Some(a)=account{r.store.set_value("wechat-enabled",&json!(false))?;secret_set("wechat-account",&serde_json::to_string(&a).unwrap())?;secret_remove("wechat-paired");r.store.set_value("wechat-cursor",&json!(""))?;*guard=None;}
    set_status(&app,"qrStatus",json!(status));Ok(json!({"status":status}))
}
#[tauri::command]pub fn workspace_wechat_pair(app:AppHandle)->Res<String>{let n=u32::from_le_bytes(uuid::Uuid::new_v4().as_bytes()[..4].try_into().unwrap())%1000000;let code=format!("{n:06}");secret_set("wechat-pair-code",&json!({"code":code,"expires":chrono::Utc::now().timestamp()+600}).to_string())?;runtime(&app).store.set_value("wechat-enabled",&json!(true))?;Ok(code)}
#[tauri::command]pub fn workspace_wechat_enable(app:AppHandle,enabled:bool)->Res<()>{runtime(&app).store.set_value("wechat-enabled",&json!(enabled))?;set_status(&app,"channelStatus",json!(if enabled{"connecting"}else{"stopped"}));Ok(())}
#[tauri::command]pub fn workspace_wechat_unbind(app:AppHandle)->Res<()>{let r=runtime(&app);r.login_epoch.fetch_add(1,std::sync::atomic::Ordering::SeqCst);r.store.set_value("wechat-enabled",&json!(false))?;for key in ["wechat-account","wechat-paired","wechat-pair-code","wechat-review-context"]{secret_remove(key);}for c in r.store.captures()?{secret_remove(&format!("reply-{}",text(&c,"id")));}set_status(&app,"channelStatus",json!("stopped"));Ok(())}
#[tauri::command]pub async fn workspace_wechat_resend(app:AppHandle,id:String)->Res<()>{
    let r=runtime(&app);let c=r.store.captures()?.into_iter().find(|v|v["id"]==id).ok_or("原消息不存在")?;
    let a:wechat::Account=serde_json::from_str(&secret_read("wechat-account")?.ok_or("请先绑定微信")?).map_err(|_|"本机微信配置损坏")?;
    let reply:Value=serde_json::from_str(&secret_read(&format!("reply-{id}"))?.ok_or("来信上下文已不可用")?).map_err(|_|"来信上下文无效")?;
    if reply["account"]!=a.account_id{return Err("账号已更换，未补发".into());}
    if secret_read("wechat-paired")?.as_deref()!=Some(text(&reply,"to").as_str()){return Err("该用户已解除配对，未补发".into());}
    let body=if c["status"]=="complete"{format!("已保存整理笔记：{}\n{}",text(&c["organized"],"title"),text(&c["organized"],"summary"))}else if !c["sourceId"].is_null(){"原文已共享保存。整理状态请在桌面收件箱查看。".into()}else{"原文已保存在此电脑的待同步箱。".into()};
    r.store.set_value(&format!("delivery:{id}"),&json!("unknown"))?;
    wechat::Client::new()?.send(&a,&text(&reply,"to"),&text(&reply,"context"),&body,&format!("jarvis-retry-{}",uuid::Uuid::new_v4().simple())).await?;
    r.store.set_value(&format!("delivery:{id}"),&json!("sent"))?;Ok(())
}
async fn wechat_loop(app:AppHandle){
    loop{let result=wechat_tick(&app).await;if let Err(e)=result{set_status(&app,"error",json!(e));if e.contains("认证失效"){let _=runtime(&app).store.set_value("wechat-enabled",&json!(false));set_status(&app,"channelStatus",json!("auth_expired"));}else{set_status(&app,"channelStatus",json!("reconnecting"));}}tokio::time::sleep(Duration::from_secs(3)).await;}
}
async fn wechat_tick(app:&AppHandle)->Res<()>{
    let r=runtime(app);if r.store.get_value("wechat-enabled")?!=Some(json!(true)){return Ok(());}
    let Some(account)=secret_read("wechat-account")?else{return Ok(());};let a:wechat::Account=serde_json::from_str(&account).map_err(|_|"微信本机凭据损坏")?;let client=wechat::Client::new()?;
    let cursor=r.store.get_value("wechat-cursor")?.and_then(|v|v.as_str().map(str::to_owned)).unwrap_or_default();
    let updates=client.updates(&a,&cursor).await?;
    if r.store.get_value("wechat-enabled")?!=Some(json!(true))||secret_read("wechat-account")?.as_deref()!=Some(account.as_str()){return Ok(());}
    set_status(app,"channelStatus",json!("online"));set_status(app,"error",Value::Null);
    for msg in updates["msgs"].as_array().into_iter().flatten(){
        if msg["message_type"]!=1||msg["group_id"].as_str().is_some_and(|s|!s.is_empty()){continue;}
        let sender=text(msg,"from_user_id");if sender.is_empty(){continue;}let content=wechat::text(msg);let context=text(msg,"context_token");
        let paired=secret_read("wechat-paired")?;
        if paired.as_deref()!=Some(sender.as_str()){
            let code=secret_read("wechat-pair-code")?.and_then(|s|serde_json::from_str::<Value>(&s).ok());
            if let Some(code)=code{if content.trim()==text(&code,"code")&&code["expires"].as_i64().unwrap_or(0)>chrono::Utc::now().timestamp()&&(a.owner_id.is_empty()||a.owner_id==sender){secret_set("wechat-paired",&sender)?;secret_remove("wechat-pair-code");client.send(&a,&sender,&context,"配对成功。发文字可保存到收件箱；开启自动整理后会生成笔记。发 /help 查看说明。",&uuid::Uuid::new_v4().to_string()).await?;}}
            continue;
        }
        if !context.is_empty(){secret_set("wechat-review-context",&json!({"account":a.account_id,"to":sender,"context":context}).to_string())?;}
        let id=wechat::incoming_key(&a.account_id,msg);
        if !r.store.captures()?.iter().any(|v|v["id"]==id){
            let mut files=vec![];let mut limitations=vec![];
            for(i,item)in msg["item_list"].as_array().into_iter().flatten().enumerate(){if files.len()>=5{limitations.push("超过5个附件的部分未接收");break;}match item["type"].as_u64(){Some(2|4)=>{let dir=app.state::<AppState>().data_dir.join("wechat-attachments");files.push(client.download(item,&dir,&id,i).await?);},Some(3|5)=>limitations.push("语音或视频首版未解析，请补充文字"),_=>{}}}
            let raw=if content.trim().is_empty(){limitations.join("；")}else{content.clone()};
            if !raw.trim().is_empty()||!files.is_empty(){r.store.capture(Some(&id),&raw,"wechat",files)?;secret_set(&format!("reply-{id}"),&json!({"to":sender,"context":context,"account":a.account_id}).to_string())?;set_status(app,"lastReceived",json!(chrono::Utc::now().to_rfc3339()));}
        }
        if !context.is_empty() && r.store.captures()?.iter().any(|v|v["id"]==id) {secret_set(&format!("reply-{id}"),&json!({"to":sender,"context":context,"account":a.account_id}).to_string())?;}
    }
    // Captures and reply credentials have been durably saved before advancing the cursor.
    if let Some(cursor)=updates["get_updates_buf"].as_str(){r.store.set_value("wechat-cursor",&json!(cursor))?;}
    for task in r.store.captures()?.into_iter().filter(|v|v["origin"]=="wechat"){
        let id=text(&task,"id");let delivery_key=format!("delivery:{id}");let delivery=r.store.get_value(&delivery_key)?;
        let reply=secret_read(&format!("reply-{id}"))?.and_then(|s|serde_json::from_str::<Value>(&s).ok());let Some(reply)=reply else{continue;};if reply["account"]!=a.account_id{continue;}
        if secret_read("wechat-paired")?.as_deref()!=Some(text(&reply,"to").as_str()){continue;}
        let raw=text(&task,"raw");
        let answer=if matches!(raw.trim(),"今日回顾"|"/review"){latest_review(app)?}else if raw.trim()=="/help"{"直接发文字保存原文；开启自动整理后归档为笔记。今日回顾 或 /review 获取学习报告；/status 查看连接。整理失败可在桌面收件箱手动重试。图片和文件仅保存在此电脑。".into()}else if raw.trim()=="/status"{let v=r.store.view()?;format!("资料服务：{}；待同步 {} 项。电脑需要保持开机，托盘进程运行。",if v.online{"在线"}else{"离线"},v.pending)}else{
            let _guard=r.capture_lock.lock().await;let model=model(app)?;let c=r.store.process_capture(&id,model.as_ref(),false).await?;let _=project(app);
            if c.status=="complete"{format!("已保存并整理：{}\n{}",c.organized.as_ref().map(|o|o.title.as_str()).unwrap_or("笔记"),c.organized.as_ref().map(|o|o.summary.as_str()).unwrap_or(""))}else if c.source_id.is_some(){format!("原文已保存。{}",c.error.as_deref().unwrap_or("自动整理尚未启用，可在桌面配置模型。"))}else{"原文已保存在本机待同步箱，资料服务暂不可用。".into()}
        };
        if r.store.get_value("wechat-enabled")?!=Some(json!(true)){return Ok(());}
        if delivery.is_none(){r.store.set_value(&delivery_key,&json!("unknown"))?;client.send(&a,&text(&reply,"to"),&text(&reply,"context"),&answer,&format!("jarvis-{id}")).await?;r.store.set_value(&delivery_key,&json!("sent"))?;set_status(app,"lastSent",json!(chrono::Utc::now().to_rfc3339()));}
    }let _=app.emit("workspace-changed",());Ok(())
}

// Conversation archive never enters shared six-table snapshots or sync exports.
#[tauri::command]pub fn workspace_archive_load(app:AppHandle)->Res<Value>{Ok(runtime(&app).store.get_value("learning-archive")?.unwrap_or(json!({"sessions":[],"review":{"enabled":false,"hour":9,"lastDay":"","completed":{}}}))) }
#[tauri::command]pub fn workspace_archive_save(app:AppHandle,value:Value)->Res<()>{
 if value.to_string().len()>24*1024*1024||!value["sessions"].as_array().is_some_and(|v|v.len()<=1000){return Err("会话归档超过限制（1000会话、24MiB），请先导出备份".into());}
 if !value["review"]["enabled"].is_boolean()||!value["review"]["hour"].as_u64().is_some_and(|h|h<=23)||!value["review"]["completed"].is_object(){return Err("回顾配置无效".into());}
 let mut ids=std::collections::HashSet::new();
 for session in value["sessions"].as_array().unwrap(){let id=session["id"].as_str().ok_or("会话标识无效")?;if id.len()>128||id.len()<8||!id.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_')||!ids.insert(id)||!session["source"].is_string()||!session["title"].is_string()||session["createdAt"].as_u64().is_none()||!session["messages"].as_array().is_some_and(|ms|ms.len()<=10000&&ms.iter().all(|m|matches!(m["role"].as_str(),Some("user"|"assistant"))&&m["content"].is_string())){return Err("会话归档格式无效".into());}}
 runtime(&app).store.compare_set_value("learning-archive",&value,value["revision"].as_u64().unwrap_or(0))?;let _=app.emit("archive-changed",());Ok(())
}

fn daily_review(app:&AppHandle)->Res<()>{
 use chrono::Timelike;
 let r=runtime(app);let Some(mut archive)=r.store.get_value("learning-archive")?else{return Ok(());};
 let now=chrono::Local::now();let day=now.format("%Y-%m-%d").to_string();
 if archive["review"]["enabled"]!=true||now.hour()<archive["review"]["hour"].as_u64().unwrap_or(9) as u32||archive["review"]["lastDay"]==day{return Ok(());}
 let millis=now.timestamp_millis();let mut due=archive["sessions"].as_array().into_iter().flatten().filter(|s|{
  let created=s["createdAt"].as_i64().unwrap_or(millis);let stage=[1i64,3,7,14,30].into_iter().filter(|days|millis-created>=days*86400000).last();
  stage.is_some_and(|stage|archive["review"]["completed"][s["id"].as_str().unwrap_or("")].as_i64().unwrap_or(0)<created+stage*86400000)
 }).collect::<Vec<_>>();due.sort_by_key(|s|(!s["important"].as_bool().unwrap_or(false),s["createdAt"].as_i64().unwrap_or(0)));
 if due.is_empty(){return Ok(());}
 let count=due.len().min(5);let detail=due.into_iter().take(5).map(|s|{
  let body=s["messages"].as_array().into_iter().flatten().rev().find(|m|m["role"]=="assistant").map(|m|text(m,"content")).unwrap_or_default();format!("{}\n{}",text(s,"title"),body.chars().take(160).collect::<String>())
 }).collect::<Vec<_>>().join("\n\n");
 let uid=format!("jarvis-learning-review-{day}");let st=app.state::<AppState>();let db=st.db.lock().unwrap();
 let exists:i64=db.query_row("SELECT COUNT(*) FROM reminders WHERE uid=?1",[&uid],|row|row.get(0)).map_err(|_|"回顾提醒检查失败")?;
 if exists==0{let rem=db::Reminder{uid,title:format!("学习回顾：今天有 {count} 条成果值得再想一遍"),detail:format!("{detail}\n\n打开主面板 → 学习回顾，查看原会话并标记已回顾。"),due_at:now.format("%Y-%m-%d %H:%M").to_string(),..Default::default()};db::upsert_reminder(&db,&rem).map_err(|_|"学习回顾提醒保存失败")?;}
 drop(db);archive["review"]["lastDay"]=json!(day);r.store.compare_set_value("learning-archive",&archive,archive["revision"].as_u64().unwrap_or(0))?;Ok(())
}
fn latest_review(app:&AppHandle)->Res<String>{let reports=runtime(app).store.get_value("learning-reports")?.unwrap_or(json!({}));Ok(reports.as_object().into_iter().flatten().filter(|(_,v)|v["body"].is_string()).max_by_key(|(k,_)|*k).map(|(_,v)|text(v,"body")).unwrap_or_else(||"暂无学习回顾，请在桌面开启学习回顾并采集会话。".into()))}
async fn deliver_reviews(app:&AppHandle)->Res<()>{
 let r=runtime(app);let mut reports=r.store.get_value("learning-reports")?.unwrap_or(json!({}));let cfg=r.store.get_value("learning-config")?.unwrap_or(json!({}));
 let keys=reports.as_object().into_iter().flatten().filter(|(_,v)|v["body"].is_string()&&v["desktop"]=="pending").map(|(k,_)|k.clone()).collect::<Vec<_>>();
 if !keys.is_empty(){let day=chrono::Local::now().format("%Y-%m-%d").to_string();let st=app.state::<AppState>();let db=st.db.lock().unwrap();let uid=format!("jarvis-learning-review-{day}");let exists:i64=db.query_row("SELECT COUNT(*) FROM reminders WHERE uid=?1",[&uid],|row|row.get(0)).map_err(|_|"通知查询失败")?;if exists==0{let rem=db::Reminder{uid,title:format!("{} 份学习回顾已准备好",keys.len()),detail:"打开主面板 → 学习回顾，查看重点、复习问题和原会话。".into(),due_at:chrono::Local::now().format("%Y-%m-%d %H:%M").to_string(),..Default::default()};db::upsert_reminder(&db,&rem).map_err(|_|"学习通知保存失败")?;}#[cfg(target_os="macos")] {use tauri_plugin_notification::NotificationExt;let result=app.notification().builder().title("贾维喵学习回顾").body(format!("{} 份报告已准备好，请打开学习回顾查看。",keys.len())).show();for key in &keys{reports[key]["systemNotification"]=json!(if result.is_ok(){"submitted"}else{"failed"});}}
 for key in keys{reports[&key]["desktop"]=json!("queued");}r.store.set_value("learning-reports",&reports)?;}
 if cfg["wechat"]!=true||cfg["pushDevice"]!=app.state::<AppState>().device||r.store.get_value("wechat-enabled")?!=Some(json!(true)){return Ok(());}
 let Some(raw)=secret_read("wechat-account")?else{return Ok(());};let a:wechat::Account=serde_json::from_str(&raw).map_err(|_|"微信凭据无效")?;
 let paired=secret_read("wechat-paired")?;let context=secret_read("wechat-review-context")?.and_then(|s|serde_json::from_str::<Value>(&s).ok());
 let keys=reports.as_object().into_iter().flatten().filter(|(_,v)|v["body"].is_string()&&v["wechat"]=="pending").map(|(k,_)|k.clone()).collect::<Vec<_>>();
 for key in keys{let Some(ctx)=context.as_ref().filter(|c|c["account"]==a.account_id&&paired.as_deref()==c["to"].as_str())else{reports[&key]["wechat"]=json!("waiting_context");reports[&key]["deliveryError"]=json!("缺少本人会话上下文，请发送“今日回顾”获取");continue;};
  reports[&key]["wechat"]=json!("unknown");r.store.set_value("learning-reports",&reports)?;
  let summary=if reports[&key]["status"]=="complete"{text(&reports[&key],"body").chars().take(1300).collect::<String>()}else{"本日学习会话已归档，AI整理尚未完成。请在桌面查看原文与复习卡片。".into()};
  let body=format!("学习回顾 {key}\n{summary}\n完整内容与来源请在贾维喵查看。");
  match wechat::Client::new()?.send(&a,&text(ctx,"to"),&text(ctx,"context"),&body,&format!("review-{}-{key}",app.state::<AppState>().device)).await{Ok(())=>{reports[&key]["wechat"]=json!("sent");},Err(e)=>{reports[&key]["deliveryError"]=json!(format!("发送结果未知或被协议拒绝：{e}。请发送“今日回顾”获取；不会自动重复发送。"));}}
 }r.store.set_value("learning-reports",&reports)
}
#[tauri::command]pub async fn workspace_archive_export(app:AppHandle)->Res<bool>{
 use tauri_plugin_dialog::DialogExt;
 let Some(file)=app.dialog().file().set_file_name("jarvis-conversations.json").add_filter("JSON",&["json"]).blocking_save_file()else{return Ok(false);};
 let file=file.into_path().map_err(|_|"导出位置不可用")?;let archive=workspace_archive_load(app)?;std::fs::write(file,serde_json::to_vec_pretty(&archive).unwrap()).map_err(|_|"会话备份写入失败")?;Ok(true)
}
