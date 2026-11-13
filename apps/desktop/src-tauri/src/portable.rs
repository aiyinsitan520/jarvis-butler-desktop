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
#[tauri::command]pub fn workspace_local_status(app:AppHandle)->Res<Value>{let r=store(&app);Ok(json!({"root":library(&app),"vault":r.store.vault_status()?,"collectors":r.store.get_value("collectors")?.unwrap_or(json!([])),"collection":r.store.get_value("collector-status")?,"learning":r.store.get_value("learning-config")?.unwrap_or(json!({"auto":false,"wechat":false})),"reports":r.store.get_value("learning-reports")?.unwrap_or(json!({})),"backgroundError":r.store.get_value("background-error")?}))}
#[tauri::command]pub fn workspace_local_open(app:AppHandle)->Res<()>{let root=library(&app);std::fs::create_dir_all(&root).map_err(|_|"无法创建资料目录")?;open(&root)}
pub fn open(path:&Path)->Res<()>{
    let cmd=if cfg!(target_os="macos"){ "open" }else if cfg!(windows){"explorer"}else{"xdg-open"};
    std::process::Command::new(cmd).arg(path).spawn().map(|_|()).map_err(|_|"无法打开文件夹".into())
}
#[tauri::command]pub async fn workspace_local_scan(app:AppHandle)->Res<Value>{let r=store(&app);let _guard=r.capture_lock.lock().await;let root=library(&app);let v=r.store.vault_scan(&root).await?;r.store.collect(&root)?;r.store.export_conversations(&root)?;let _=app.emit("archive-changed",());Ok(v)}
#[tauri::command]pub async fn workspace_local_resolve(app:AppHandle,id:String,choice:String)->Res<()>{let r=store(&app);let _guard=r.capture_lock.lock().await;r.store.vault_resolve(&library(&app),&id,&choice).await?;let _=app.emit("workspace-changed",());Ok(())}
#[tauri::command]pub fn workspace_collector_preview(app:AppHandle,kind:String)->Res<Value>{if !matches!(kind.as_str(),"codex"|"claude"|"gemini"){return Err("未知来源".into());}let Some(path)=app.dialog().file().set_title("选择该AI工具的会话日志目录（不选择账号配置目录）").blocking_pick_folder()else{return Ok(Value::Null);};let path=path.into_path().map_err(|_|"目录不可用")?;let preview=jarvis_workspace::ingest::preview(&path,&kind)?;let id=uuid::Uuid::new_v4().to_string();let result=json!({"id":id,"kind":kind,"path":path,"preview":preview,"enabled":true});store(&app).store.set_value("collector-preview",&result)?;Ok(result)}
#[tauri::command]pub fn workspace_collector_save(app:AppHandle,id:String,enabled:bool)->Res<()>{let r=store(&app);let mut cs=r.store.get_value("collectors")?.unwrap_or(json!([]));let rows=cs.as_array_mut().ok_or("来源配置损坏")?;if let Some(c)=rows.iter_mut().find(|c|c["id"]==id){c["enabled"]=json!(enabled);}else{let mut p=r.store.get_value("collector-preview")?.filter(|p|p["id"]==id).ok_or("请先预览来源")?;p["enabled"]=json!(enabled);rows.push(p);}r.store.set_value("collectors",&cs)}
#[tauri::command]pub fn workspace_learning_config(app:AppHandle,auto:bool,wechat:bool)->Res<()>{let r=store(&app);let device=app.state::<AppState>().device.clone();r.store.set_value("learning-config",&json!({"auto":auto,"wechat":wechat,"pushDevice":device}))}
#[tauri::command]pub async fn workspace_learning_retry(app:AppHandle,day:String)->Res<Value>{let r=store(&app);let _guard=r.capture_lock.lock().await;let model=workspace::model(&app)?;r.store.learning_tick(&library(&app),model.as_ref(),Some(&day)).await}
fn copy_tree(base:&Path,from:&Path,to:&Path)->Res<()>{safe(base,from)?;if !from.exists(){return Ok(());}if from.is_dir(){if to.starts_with(from){return Err("不能把目录递归复制到自身".into());}std::fs::create_dir_all(to).map_err(|_|"无法创建目标目录")?;for entry in std::fs::read_dir(from).map_err(|_|"读取源目录失败")?{let entry=entry.map_err(|_|"目录读取失败")?;copy_tree(base,&entry.path(),&to.join(entry.file_name()))?;}}else{let bytes=std::fs::read(from).map_err(|_|"资料读取失败")?;atomic(to,&bytes)?;if bytes!=std::fs::read(to).map_err(|_|"副本校验失败")? || bytes!=std::fs::read(from).map_err(|_|"源文件在迁移时改变")?{return Err("复制校验失败".into());}}Ok(())}
fn copy_library(from:&Path,to:&Path)->Res<()>{for name in ["notes","todos","inspirations","conversations","reviews","conflicts","attachments","README.md","index.json"]{copy_tree(from,&from.join(name),&to.join(name))?;}Ok(())}
#[tauri::command]pub async fn workspace_local_backup(app:AppHandle)->Res<String>{
 let r=store(&app);let _guard=r.capture_lock.lock().await;let st=app.state::<AppState>();let dest=st.data_dir.join("backups").join(format!("portable-{}",uuid::Uuid::new_v4()));std::fs::create_dir_all(&dest).map_err(|_|"无法创建备份")?;
 let native=st.db.lock().unwrap();let result=(||->Res<()>{
 native.execute("VACUUM INTO ?1",[dest.join("dingmi.db").to_string_lossy().as_ref()]).map_err(|_|"笔记备份失败")?;native.execute_batch("PRAGMA query_only=ON").map_err(|_|"暂停笔记失败")?;
 r.store.backup_and_freeze(&dest.join("workspace.db"))?;for name in ["attachments","wechat-attachments","vault-id.json"]{copy_tree(&st.data_dir,&st.data_dir.join(name),&dest.join(name))?;}let root=library(&app);if root.exists(){copy_library(&root,&dest.join("library"))?;}
 atomic(&dest.join("backup.json"),json!({"format":"jarvis-portable-backup","version":1,"createdAt":chrono::Utc::now().to_rfc3339()}).to_string().as_bytes())?;Ok(())})();
 let _=native.execute_batch("PRAGMA query_only=OFF");let _=r.store.freeze(false);result?;Ok(dest.to_string_lossy().into())
}
#[tauri::command]pub async fn workspace_local_restore(app:AppHandle)->Res<bool>{
 let Some(source)=app.dialog().file().set_title("选择包含 backup.json 的贾维斯备份目录").blocking_pick_folder()else{return Ok(false);};let source=source.into_path().map_err(|_|"备份位置无效")?;
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
#[tauri::command]pub async fn workspace_local_migrate(app:AppHandle)->Res<bool>{
    let Some(path)=app.dialog().file().set_title("选择空文件夹作为新资料库，完成后自动重启").blocking_pick_folder()else{return Ok(false);};let root=path.into_path().map_err(|_|"目录不可用")?;
    let canonical=std::fs::canonicalize(&root).map_err(|_|"新目录不可用")?;let st=app.state::<AppState>();let old=std::fs::canonicalize(&st.data_dir).map_err(|_|"原资料目录不可用")?;
    let current_library=std::fs::canonicalize(library(&app)).unwrap_or(old.clone());
    if canonical.starts_with(&old)||old.starts_with(&canonical)||canonical.starts_with(&current_library)||current_library.starts_with(&canonical)||std::fs::read_dir(&root).map_err(|_|"无法读取目标目录")?.next().is_some(){return Err("请选择原资料库外的空文件夹；网盘目录请仅用于备份".into());}
    let r=store(&app);let _guard=r.capture_lock.lock().await;let native=st.db.lock().unwrap();let target=root.join(".jarvis");std::fs::create_dir_all(&target).map_err(|_|"无法创建资料目录")?;
    let result=(||->Res<()>{native.execute("VACUUM INTO ?1",[target.join("dingmi.db").to_string_lossy().as_ref()]).map_err(|_|"笔记备份失败")?;native.execute_batch("PRAGMA query_only=ON").map_err(|_|"无法暂停笔记写入")?;
        r.store.backup_and_freeze(&target.join("workspace.db"))?;for name in ["attachments","wechat-attachments","icons","vault-id.json"]{copy_tree(&st.data_dir,&st.data_dir.join(name),&target.join(name))?;}let source_root=library(&app);if source_root.exists(){copy_library(&source_root,&root)?;}
        for name in ["dingmi.db","workspace.db"]{let c=rusqlite::Connection::open(target.join(name)).map_err(|_|"无法核对副本")?;let check:String=c.query_row("PRAGMA integrity_check",[],|r|r.get(0)).map_err(|_|"副本校验失败")?;if check!="ok"{return Err("副本完整性校验未通过".into());}}
        atomic(BOOTSTRAP.get().ok_or("资料启动位置未初始化")?,json!({"dataDir":target}).to_string().as_bytes())?;Ok(())})();
    if let Err(e)=result{let _=native.execute_batch("PRAGMA query_only=OFF");let _=r.store.freeze(false);return Err(format!("迁移失败，仍使用原资料；目标副本保留：{e}"));}
    drop(native);app.restart()
}

#[cfg(test)]mod tests{use super::*;
 #[test]fn copy_does_not_follow_symlinks_or_copy_into_itself(){let root=std::env::temp_dir().join(format!("jarvis-copy-{}",uuid::Uuid::new_v4()));std::fs::create_dir_all(root.join("source/notes")).unwrap();std::fs::write(root.join("source/notes/a.md"),"original").unwrap();assert!(copy_tree(&root,&root.join("source"),&root.join("source/child")).is_err());copy_library(&root.join("source"),&root.join("backup")).unwrap();assert_eq!(std::fs::read_to_string(root.join("backup/notes/a.md")).unwrap(),"original");let c=root.canonicalize().unwrap();assert!(c.starts_with(std::env::temp_dir().canonicalize().unwrap()));std::fs::remove_dir_all(c).unwrap();}
}
