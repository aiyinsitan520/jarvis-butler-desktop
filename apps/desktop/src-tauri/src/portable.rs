//! Profile bootstrap, audited migration and UI bridge for local knowledge.
use crate::{AppState,Res,workspace};
use tauri::{AppHandle,Manager,Emitter};
use tauri_plugin_dialog::DialogExt;
use serde_json::{Value,json};
use std::path::{Path,PathBuf};
use jarvis_workspace::vault::{atomic,safe};
static BOOTSTRAP:std::sync::OnceLock<PathBuf>=std::sync::OnceLock::new();
pub fn resolve(default:PathBuf)->Res<PathBuf>{
    let pointer=default.join("profile.json");let _=BOOTSTRAP.set(pointer.clone());
    if pointer.exists(){let v:Value=serde_json::from_slice(&std::fs::read(&pointer).map_err(|_|"无法读取资料位置")?).map_err(|_|"资料位置配置损坏")?;let path=PathBuf::from(v["dataDir"].as_str().ok_or("资料位置无效")?);if !path.is_dir()||!path.join("dingmi.db").is_file()||!path.join("workspace.db").is_file(){return Err("指定资料目录不可用；请连接原磁盘，不会自动新建空资料覆盖".into());}return Ok(path);}
    Ok(if default.join("dingmi.db").exists()||crate::dev_data_dir().is_some(){default}else{default.join(".jarvis")})
}
pub fn library(app:&AppHandle)->PathBuf{let st=app.state::<AppState>();if st.data_dir.file_name().is_some_and(|n|n==".jarvis"){st.data_dir.parent().unwrap().to_path_buf()}else{st.data_dir.join("library")}}
fn store(app:&AppHandle)->tauri::State<'_,workspace::Runtime>{app.state::<workspace::Runtime>()}
pub fn export_attachments(app:&AppHandle)->Res<()>{let st=app.state::<AppState>();let from=st.data_dir.join("attachments");if !from.exists(){return Ok(());}let root=library(app);for e in std::fs::read_dir(&from).map_err(|_|"附件目录不可读")?{let e=e.map_err(|_|"附件读取失败")?;safe(&from,&e.path())?;if !e.file_type().map_err(|_|"附件不可用")?.is_file(){continue;}let target=root.join("attachments").join(e.file_name());safe(&root,&target)?;if !target.exists(){let bytes=std::fs::read(e.path()).map_err(|_|"无法读取附件")?;atomic(&target,&bytes)?;}}Ok(())}
#[tauri::command]pub fn workspace_local_status(app:AppHandle)->Res<Value>{let r=store(&app);Ok(json!({"platform":std::env::consts::OS,"root":library(&app),"vault":r.store.vault_status()?,"collectors":r.store.get_value("collectors")?.unwrap_or(json!([])),"collection":r.store.get_value("collector-status")?,"learning":r.store.get_value("learning-config")?.unwrap_or(json!({"auto":false,"wechat":false})),"reports":r.store.get_value("learning-reports")?.unwrap_or(json!({})),"backgroundError":r.store.get_value("background-error")?}))}
#[tauri::command]pub fn workspace_notification_test(app:AppHandle)->Res<String>{
 #[cfg(target_os="macos")] {use tauri_plugin_notification::NotificationExt;app.notification().builder().title("贾维喵学习回顾").body("通知测试。若没有出现，请在系统设置 → 通知中允许贾维喵管家。").show().map_err(|_|"系统未接受通知请求，请检查系统通知设置")?;return Ok("已向系统提交通知请求；实际显示取决于通知权限与专注模式".into());}
 #[cfg(not(target_os="macos"))] {let _=app;Ok("Windows 使用原生提醒卡片，学习报告会进入提醒队列".into())}
}
#[tauri::command]pub fn workspace_local_open(app:AppHandle)->Res<()>{let root=library(&app);std::fs::create_dir_all(&root).map_err(|_|"无法创建资料目录")?;open(&root)}
pub fn open(path:&Path)->Res<()>{
    let cmd=if cfg!(target_os="macos"){ "open" }else if cfg!(windows){"explorer"}else{"xdg-open"};
    std::process::Command::new(cmd).arg(path).spawn().map(|_|()).map_err(|_|"无法打开文件夹".into())
}
#[tauri::command]pub async fn workspace_local_scan(app:AppHandle)->Res<Value>{let r=store(&app);let _guard=r.capture_lock.lock().await;workspace::native_outbox(&app).await?;let root=library(&app);let v=r.store.vault_scan(&root).await?;export_attachments(&app)?;r.store.collect(&root)?;r.store.export_conversations(&root)?;let _=app.emit("archive-changed",());Ok(v)}
#[tauri::command]pub async fn workspace_local_resolve(app:AppHandle,id:String,choice:String)->Res<()>{let r=store(&app);let _guard=r.capture_lock.lock().await;r.store.vault_resolve(&library(&app),&id,&choice).await?;let _=app.emit("workspace-changed",());Ok(())}
#[tauri::command]pub fn workspace_collector_preview(app:AppHandle,kind:String)->Res<Value>{if !matches!(kind.as_str(),"codex"|"claude"|"gemini"){return Err("未知来源".into());}let Some(path)=app.dialog().file().set_title("选择该AI工具的会话日志目录（不选择账号配置目录）").blocking_pick_folder()else{return Ok(Value::Null);};let path=path.into_path().map_err(|_|"目录不可用")?;let preview=jarvis_workspace::ingest::preview(&path,&kind)?;let id=uuid::Uuid::new_v4().to_string();let result=json!({"id":id,"kind":kind,"path":path,"preview":preview,"enabled":true});store(&app).store.set_value("collector-preview",&result)?;Ok(result)}
#[tauri::command]pub fn workspace_collector_save(app:AppHandle,id:String,enabled:bool)->Res<()>{let r=store(&app);let mut cs=r.store.get_value("collectors")?.unwrap_or(json!([]));let rows=cs.as_array_mut().ok_or("来源配置损坏")?;if let Some(c)=rows.iter_mut().find(|c|c["id"]==id){c["enabled"]=json!(enabled);}else{let mut p=r.store.get_value("collector-preview")?.filter(|p|p["id"]==id).ok_or("请先预览来源")?;p["enabled"]=json!(enabled);rows.push(p);}r.store.set_value("collectors",&cs)}
#[tauri::command]pub fn workspace_learning_config(app:AppHandle,auto:bool,wechat:bool)->Res<()>{let r=store(&app);let device=app.state::<AppState>().device.clone();r.store.set_value("learning-config",&json!({"auto":auto,"wechat":wechat,"pushDevice":device}))}
#[tauri::command]pub async fn workspace_learning_retry(app:AppHandle,day:String)->Res<Value>{let r=store(&app);let _guard=r.capture_lock.lock().await;let model=workspace::model(&app)?;r.store.learning_tick(&library(&app),model.as_ref(),Some(&day)).await}
fn copy_tree(base:&Path,from:&Path,to:&Path)->Res<()>{safe(base,from)?;if !from.exists(){return Ok(());}if from.is_dir(){if to.starts_with(from){return Err("不能把目录递归复制到自身".into());}std::fs::create_dir_all(to).map_err(|_|"无法创建目标目录")?;for entry in std::fs::read_dir(from).map_err(|_|"读取源目录失败")?{let entry=entry.map_err(|_|"目录读取失败")?;copy_tree(base,&entry.path(),&to.join(entry.file_name()))?;}}else{let bytes=std::fs::read(from).map_err(|_|"资料读取失败")?;atomic(to,&bytes)?;if bytes!=std::fs::read(to).map_err(|_|"副本校验失败")? || bytes!=std::fs::read(from).map_err(|_|"源文件在迁移时改变")?{return Err("复制校验失败".into());}}Ok(())}
fn copy_library(from:&Path,to:&Path)->Res<()>{for name in ["notes","todos","inspirations","conversations","reviews","conflicts","attachments","README.md","index.json","data.json"]{copy_tree(from,&from.join(name),&to.join(name))?;}Ok(())}
#[tauri::command]pub async fn workspace_local_backup(app:AppHandle)->Res<String>{
 let r=store(&app);let _guard=r.capture_lock.lock().await;let st=app.state::<AppState>();let dest=st.data_dir.join("backups").join(format!("portable-{}",uuid::Uuid::new_v4()));std::fs::create_dir_all(&dest).map_err(|_|"无法创建备份")?;
 let native=st.db.lock().unwrap();let result=(||->Res<()>{
 native.execute("VACUUM INTO ?1",[dest.join("dingmi.db").to_string_lossy().as_ref()]).map_err(|_|"笔记备份失败")?;native.execute_batch("PRAGMA query_only=ON").map_err(|_|"暂停笔记失败")?;
 r.store.backup_and_freeze(&dest.join("workspace.db"))?;for name in ["attachments","wechat-attachments","vault-id.json"]{copy_tree(&st.data_dir,&st.data_dir.join(name),&dest.join(name))?;}let root=library(&app);if root.exists(){copy_library(&root,&dest.join("library"))?;}
 atomic(&dest.join("backup.json"),json!({"format":"jarvis-portable-backup","version":1,"createdAt":chrono::Utc::now().to_rfc3339()}).to_string().as_bytes())?;Ok(())})();
 let _=native.execute_batch("PRAGMA query_only=OFF");let _=r.store.freeze(false);result?;Ok(dest.to_string_lossy().into())
}
#[tauri::command]pub async fn workspace_local_restore(app:AppHandle)->Res<bool>{
 let Some(source)=app.dialog().file().set_title("选择包含 backup.json 的贾维喵备份目录").blocking_pick_folder()else{return Ok(false);};let source=source.into_path().map_err(|_|"备份位置无效")?;
 safe(&source,&source.join("backup.json"))?;let manifest:Value=serde_json::from_slice(&std::fs::read(source.join("backup.json")).map_err(|_|"缺少备份清单")?).map_err(|_|"备份清单损坏")?;if manifest["format"]!="jarvis-portable-backup"||manifest["version"]!=1{return Err("不支持的备份版本".into());}
 for name in ["dingmi.db","workspace.db"]{safe(&source,&source.join(name))?;let c=rusqlite::Connection::open_with_flags(source.join(name),rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|_|"备份数据库不可用")?;let check:String=c.query_row("PRAGMA integrity_check",[],|r|r.get(0)).map_err(|_|"备份校验失败")?;if check!="ok"{return Err("备份完整性检查失败".into());}}
 let Some(target)=app.dialog().file().set_title("选择新的空文件夹用于恢复；原资料保留，成功后重启").blocking_pick_folder()else{return Ok(false);};let target=target.into_path().map_err(|_|"目标位置无效")?;
 let source_c=std::fs::canonicalize(&source).map_err(|_|"备份目录不可用")?;let target_c=std::fs::canonicalize(&target).map_err(|_|"恢复目录不可用")?;let current_c=std::fs::canonicalize(library(&app)).ok();
 if target_c.starts_with(&source_c)||source_c.starts_with(&target_c)||current_c.is_some_and(|c|target_c.starts_with(&c)||c.starts_with(&target_c)){return Err("恢复目录必须在原资料与备份之外".into());}
 if std::fs::read_dir(&target).map_err(|_|"目标目录不可用")?.next().is_some(){return Err("恢复目标必须为空目录".into());}
 let _current_backup=workspace_local_backup(app.clone()).await?;let r=store(&app);let _guard=r.capture_lock.lock().await;let st=app.state::<AppState>();let native=st.db.lock().unwrap();native.execute_batch("PRAGMA query_only=ON").map_err(|_|"无法暂停笔记")?;
 let result=(||->Res<()>{r.store.freeze(true)?;let internal=target.join(".jarvis");std::fs::create_dir_all(&internal).map_err(|_|"无法创建恢复目录")?;for name in ["dingmi.db","workspace.db","vault-id.json","attachments","wechat-attachments"]{copy_tree(&source,&source.join(name),&internal.join(name))?;}if source.join("library").exists(){copy_library(&source.join("library"),&target)?;}atomic(BOOTSTRAP.get().ok_or("启动位置未初始化")?,json!({"dataDir":internal}).to_string().as_bytes())?;Ok(())})();
 if let Err(e)=result{let _=native.execute_batch("PRAGMA query_only=OFF");let _=r.store.freeze(false);return Err(e);}drop(native);app.restart()
}
/// Snapshot both databases, copy readable files, then switch the bootstrap pointer last.
/// Restoring write access on every failure keeps the current application usable.
fn migrate_files(native:&rusqlite::Connection,store:&jarvis_workspace::WorkspaceStore,data:&Path,source_root:&Path,root:&Path,pointer:&Path)->Res<()> {
    let target=root.join(".jarvis");std::fs::create_dir_all(&target).map_err(|_|"无法创建资料目录")?;
    let result=(||->Res<()>{
        native.execute("VACUUM INTO ?1",[target.join("dingmi.db").to_string_lossy().as_ref()]).map_err(|_|"笔记备份失败")?;
        native.execute_batch("PRAGMA query_only=ON").map_err(|_|"无法暂停笔记写入")?;
        store.backup_and_freeze(&target.join("workspace.db"))?;
        for name in ["attachments","wechat-attachments","icons","vault-id.json"]{copy_tree(data,&data.join(name),&target.join(name))?;}
        if source_root.exists(){copy_library(source_root,root)?;}
        for name in ["dingmi.db","workspace.db"]{
            let c=rusqlite::Connection::open_with_flags(target.join(name),rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|_|"无法核对副本")?;
            let check:String=c.query_row("PRAGMA integrity_check",[],|r|r.get(0)).map_err(|_|"副本校验失败")?;
            if check!="ok"{return Err("副本完整性校验未通过".into());}
        }
        atomic(pointer,json!({"dataDir":target}).to_string().as_bytes())?;Ok(())
    })();
    if result.is_err(){let _=native.execute_batch("PRAGMA query_only=OFF");let _=store.freeze(false);}
    result
}
fn validate_migration_target(root:&Path,data:&Path,library:&Path)->Res<()> {
    let canonical=std::fs::canonicalize(root).map_err(|_|"新目录不可用")?;
    let old=std::fs::canonicalize(data).map_err(|_|"原资料目录不可用")?;
    let current_library=std::fs::canonicalize(library).unwrap_or(old.clone());
    if canonical.starts_with(&old)||old.starts_with(&canonical)||canonical.starts_with(&current_library)||current_library.starts_with(&canonical){return Err(format!("目标与当前资料库重叠：{}。请选择其他位置；当前资料未移动。",root.display()));}
    if !directory_is_empty(root)?{return Err(format!("目标文件夹已有内容：{}。请选择其他位置或新建空文件夹；不会覆盖已有资料。",root.display()));}
    Ok(())
}
fn directory_is_empty(path:&Path)->Res<bool>{
    let mut entries=std::fs::read_dir(path).map_err(|_|format!("无法读取文件夹：{}，请检查磁盘是否连接及访问权限。",path.display()))?;
    match entries.next(){None=>Ok(true),Some(Ok(_))=>Ok(false),Some(Err(_))=>Err("读取文件夹内容失败，请检查磁盘和权限".into())}
}
/// A populated parent (including E:\) gets a separate, exclusively created library.
/// Never merge with an existing directory or follow an existing junction.
fn prepare_migration_target(selected:&Path,data:&Path,library:&Path)->Res<PathBuf>{
    let selected=std::fs::canonicalize(selected).map_err(|_|"选择的位置不可用，请检查磁盘是否连接")?;
    let old=std::fs::canonicalize(data).map_err(|_|"原资料目录不可用")?;
    let current_library=std::fs::canonicalize(library).unwrap_or(old.clone());
    if selected.starts_with(&old)||selected.starts_with(&current_library){return Err("选择的位置在当前资料库内，请选择其他文件夹或其他磁盘；当前资料未移动。".into());}
    if directory_is_empty(&selected)?{validate_migration_target(&selected,data,library)?;return Ok(selected);}
    let target=selected.join("贾维喵资料");
    // Validate containment before creating anything, including when selected is an ancestor.
    if old.starts_with(&target)||current_library.starts_with(&target){return Err("该位置下的“贾维喵资料”包含当前资料库，请选择其他位置。".into());}
    std::fs::create_dir(&target).map_err(|e|if e.kind()==std::io::ErrorKind::AlreadyExists{
        format!("保存位置已存在：{}。为避免覆盖或混合资料，请另选位置或新建一个空文件夹。",target.display())
    }else{format!("无法在选择的位置新建资料文件夹：{}。请检查磁盘空间和写入权限。",target.display())})?;
    validate_migration_target(&target,data,library)?;
    Ok(target)
}
#[tauri::command]pub async fn workspace_local_migrate(app:AppHandle)->Res<bool>{
    let Some(path)=app.dialog().file().set_title("选择保存位置；非空目录下新建“贾维喵资料”，完成后重启").blocking_pick_folder()else{return Ok(false);};let root=path.into_path().map_err(|_|"目录不可用")?;
    let st=app.state::<AppState>();
    let root=prepare_migration_target(&root,&st.data_dir,&library(&app))?;
    let r=store(&app);let _guard=r.capture_lock.lock().await;
    workspace::native_outbox(&app).await?;
    r.store.vault_scan(&library(&app)).await?;export_attachments(&app)?;r.store.export_conversations(&library(&app))?;
    let native=st.db.lock().unwrap();
    let result=migrate_files(&native,&r.store,&st.data_dir,&library(&app),&root,BOOTSTRAP.get().ok_or("资料启动位置未初始化")?);
    if let Err(e)=result{return Err(format!("迁移失败，仍使用原资料；目标副本保留：{e}"));}
    drop(native);app.restart()
}

#[cfg(test)]mod tests{use super::*;
 #[tokio::test]async fn migration_preserves_two_databases_and_rolls_back_failed_pointer_switch(){
  let root=std::env::temp_dir().join(format!("jarvis-migration-e2e-{}",uuid::Uuid::new_v4()));let data=root.join("old");let library=data.join("library");
  let native=crate::db::open(&data).unwrap();let store=jarvis_workspace::WorkspaceStore::open(&data.join("workspace.db")).unwrap();
  let note=crate::db::upsert_note(&native,&crate::db::Note{title:"迁移笔记".into(),body:"原生正文".into(),..Default::default()}).unwrap();
  let op=store.submit(json!({"type":"createInspiration","data":{"title":"迁移灵感","content":"合成资料"}}),None).await.unwrap();assert_eq!(op.status,"committed");store.vault_scan(&library).await.unwrap();
  std::fs::create_dir_all(data.join("attachments")).unwrap();std::fs::write(data.join("attachments/test.txt"),"附件").unwrap();std::fs::write(data.join("vault-id.json"),"identity-kept").unwrap();
  let pointer=root.join("bootstrap/profile.json");let bad=root.join("failed");std::fs::create_dir_all(&pointer).unwrap();
  assert!(migrate_files(&native,&store,&data,&library,&bad,&pointer).is_err());
  native.execute("INSERT INTO kv(key,value) VALUES('rollback-check','ok')",[]).unwrap();store.set_value("rollback-check",&json!(true)).unwrap();assert!(pointer.is_dir());
  let pointer=root.join("bootstrap/good-profile.json");let parent=root.join("新磁盘已有文件");std::fs::create_dir_all(&parent).unwrap();std::fs::write(parent.join("existing.txt"),"原有文件").unwrap();let dest=prepare_migration_target(&parent,&data,&library).unwrap();assert_eq!(dest,parent.canonicalize().unwrap().join("贾维喵资料"));
  migrate_files(&native,&store,&data,&library,&dest,&pointer).unwrap();
  assert_eq!(std::fs::read_to_string(parent.join("existing.txt")).unwrap(),"原有文件");
  let config:Value=serde_json::from_slice(&std::fs::read(&pointer).unwrap()).unwrap();assert_eq!(PathBuf::from(config["dataDir"].as_str().unwrap()),dest.join(".jarvis"));
  let copied=rusqlite::Connection::open(dest.join(".jarvis/dingmi.db")).unwrap();assert_eq!(crate::db::get_note(&copied,note).unwrap().unwrap().body,"原生正文");assert!(data.join("dingmi.db").exists());
  let copied_store=jarvis_workspace::WorkspaceStore::open(&dest.join(".jarvis/workspace.db")).unwrap();assert_eq!(copied_store.cached().unwrap().unwrap().data["inspirations"][0]["content"],"合成资料");
  assert_eq!(std::fs::read(library.join("data.json")).unwrap(),std::fs::read(dest.join("data.json")).unwrap());assert_eq!(std::fs::read_to_string(dest.join(".jarvis/attachments/test.txt")).unwrap(),"附件");assert_eq!(std::fs::read_to_string(dest.join(".jarvis/vault-id.json")).unwrap(),"identity-kept");
  native.execute_batch("PRAGMA query_only=OFF").unwrap();store.freeze(false).unwrap();drop(copied_store);drop(copied);drop(store);drop(native);
  let canonical=root.canonicalize().unwrap();assert!(canonical.starts_with(std::env::temp_dir().canonicalize().unwrap()));std::fs::remove_dir_all(canonical).unwrap();
 }
 #[tokio::test]
 #[ignore="requires an explicitly supplied isolated target volume"]
 async fn migration_to_selected_test_disk(){
  let base=PathBuf::from(std::env::var("JARVIS_MIGRATION_TEST_ROOT").expect("set isolated test output root"));let base=base.canonicalize().unwrap();
  let source=std::env::temp_dir().join(format!("jarvis-cross-source-{}",uuid::Uuid::new_v4()));let target=base.join(format!("jarvis-cross-target-{}",uuid::Uuid::new_v4()));std::fs::create_dir(&target).unwrap();std::fs::write(target.join("existing.txt"),"keep").unwrap();
  let native=crate::db::open(&source).unwrap();let store=jarvis_workspace::WorkspaceStore::open(&source.join("workspace.db")).unwrap();store.set_value("synthetic-check",&json!("preserved")).unwrap();let id=crate::db::upsert_note(&native,&crate::db::Note{title:"跨盘测试".into(),body:"合成内容".into(),..Default::default()}).unwrap();
  let library=source.join("library");store.vault_scan(&library).await.unwrap();let dest=prepare_migration_target(&target,&source,&library).unwrap();let pointer=source.join("test-profile.json");
  migrate_files(&native,&store,&source,&library,&dest,&pointer).unwrap();
  let copied=rusqlite::Connection::open(dest.join(".jarvis/dingmi.db")).unwrap();assert_eq!(crate::db::get_note(&copied,id).unwrap().unwrap().body,"合成内容");let copy_store=jarvis_workspace::WorkspaceStore::open(&dest.join(".jarvis/workspace.db")).unwrap();assert_eq!(copy_store.get_value("synthetic-check").unwrap(),Some(json!("preserved")));assert!(dest.join("data.json").is_file());assert_eq!(std::fs::read_to_string(target.join("existing.txt")).unwrap(),"keep");
  native.execute_batch("PRAGMA query_only=OFF").unwrap();store.freeze(false).unwrap();drop(copy_store);drop(copied);drop(store);drop(native);
  let target=target.canonicalize().unwrap();assert!(target.starts_with(&base));std::fs::remove_dir_all(target).unwrap();let source=source.canonicalize().unwrap();assert!(source.starts_with(std::env::temp_dir().canonicalize().unwrap()));std::fs::remove_dir_all(source).unwrap();
  println!("PASS real SQLite migration from TEMP to explicitly selected volume; existing files preserved");
 }
 #[test]fn selecting_populated_parent_creates_separate_library_without_overwriting(){
  let root=std::env::temp_dir().join(format!("jarvis-parent-{}",uuid::Uuid::new_v4()));let data=root.join("old");let library=data.join("library");let parent=root.join("disk");
  std::fs::create_dir_all(&library).unwrap();std::fs::create_dir_all(&parent).unwrap();std::fs::write(parent.join("existing.txt"),"keep").unwrap();
  let target=prepare_migration_target(&parent,&data,&library).unwrap();assert_eq!(target,parent.canonicalize().unwrap().join("贾维喵资料"));assert!(directory_is_empty(&target).unwrap());
  assert!(prepare_migration_target(&parent,&data,&library).unwrap_err().contains("已存在"));assert_eq!(std::fs::read_to_string(parent.join("existing.txt")).unwrap(),"keep");
  let empty=root.join("empty");std::fs::create_dir_all(&empty).unwrap();assert_eq!(prepare_migration_target(&empty,&data,&library).unwrap(),empty.canonicalize().unwrap());
  assert!(prepare_migration_target(&data,&data,&library).unwrap_err().contains("当前资料库内"));
  let ancestor=prepare_migration_target(&root,&data,&library).unwrap();assert!(ancestor.ends_with("贾维喵资料"));
  let canonical=root.canonicalize().unwrap();assert!(canonical.starts_with(std::env::temp_dir().canonicalize().unwrap()));std::fs::remove_dir_all(canonical).unwrap();
 }
 #[test]fn migration_requires_empty_separate_folder_and_copies_agent_files(){
  let root=std::env::temp_dir().join(format!("jarvis-migrate-{}",uuid::Uuid::new_v4()));
  let data=root.join("original/.jarvis");let library=root.join("original");let target=root.join("新资料目录");
  std::fs::create_dir_all(&data).unwrap();std::fs::create_dir_all(&target).unwrap();
  assert!(validate_migration_target(&target,&data,&library).is_ok());
  assert!(validate_migration_target(&data,&data,&library).is_err());
  assert!(validate_migration_target(&root,&data,&library).is_err());
  let child=library.join("child");std::fs::create_dir_all(&child).unwrap();assert!(validate_migration_target(&child,&data,&library).is_err());
  std::fs::write(target.join("existing.txt"),"keep").unwrap();assert!(validate_migration_target(&target,&data,&library).is_err());
  std::fs::write(library.join("data.json"),"{\"notes\":[]}").unwrap();copy_library(&library,&target).unwrap();
  assert_eq!(std::fs::read(library.join("data.json")).unwrap(),std::fs::read(target.join("data.json")).unwrap());
  assert_eq!(std::fs::read_to_string(target.join("existing.txt")).unwrap(),"keep");
  let canonical=root.canonicalize().unwrap();assert!(canonical.starts_with(std::env::temp_dir().canonicalize().unwrap()));std::fs::remove_dir_all(canonical).unwrap();
 }
 #[test]fn copy_does_not_follow_symlinks_or_copy_into_itself(){let root=std::env::temp_dir().join(format!("jarvis-copy-{}",uuid::Uuid::new_v4()));std::fs::create_dir_all(root.join("source/notes")).unwrap();std::fs::write(root.join("source/notes/a.md"),"original").unwrap();assert!(copy_tree(&root,&root.join("source"),&root.join("source/child")).is_err());copy_library(&root.join("source"),&root.join("backup")).unwrap();assert_eq!(std::fs::read_to_string(root.join("backup/notes/a.md")).unwrap(),"original");let c=root.canonicalize().unwrap();assert!(c.starts_with(std::env::temp_dir().canonicalize().unwrap()));std::fs::remove_dir_all(c).unwrap();}
}
