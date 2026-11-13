//! Portable Markdown projection. Files enter the same CAS command path as the UI.
use crate::{WorkspaceStore, Result, stable};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{path::{Path, PathBuf}, collections::{BTreeMap, HashSet}};

pub fn hash(s: &str) -> String { format!("{:x}", Sha256::digest(s.as_bytes())) }
pub fn atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    if std::fs::read(path).ok().as_deref()==Some(bytes){return Ok(());}
    let parent = path.parent().ok_or("文件目录无效")?;
    std::fs::create_dir_all(parent).map_err(|_| "无法创建资料目录")?;
    let temp = parent.join(format!(".jarvis-{}.tmp", uuid::Uuid::new_v4()));
    let result = (|| {
        use std::io::Write;
        let mut f = std::fs::OpenOptions::new().write(true).create_new(true).open(&temp).map_err(|_| "无法创建临时文件")?;
        f.write_all(bytes).and_then(|_| f.sync_all()).map_err(|_| "资料写入失败，请检查磁盘空间")?;
        // Windows rename cannot replace an existing file; MoveFileEx is supplied below.
        replace(&temp, path)
    })();
    if result.is_err() { let _ = std::fs::remove_file(temp); }
    result
}
#[cfg(test)] mod tests {
 use super::*;
 async fn fixture()->(tempfile::TempDir,std::sync::Arc<WorkspaceStore>,String){let d=tempfile::tempdir().unwrap();let s=WorkspaceStore::open(&d.path().join("internal/workspace.db")).unwrap();let nb=s.submit(json!({"type":"createNotebook","data":{"name":"学习"}}),None).await.unwrap().result.unwrap();let id=s.submit(json!({"type":"createNote","data":{"notebookId":nb,"title":"标题","content":"原始"}}),None).await.unwrap().result.unwrap();s.vault_scan(&d.path().join("library")).await.unwrap();(d,s,id)}
 #[tokio::test]async fn bidirectional_rename_conflict_and_delete_require_confirmation(){
  let(d,s,id)=fixture().await;let root=d.path().join("library");let status=s.vault_status().unwrap();let path=root.join(status["entries"][&id]["path"].as_str().unwrap());
  let raw=std::fs::read_to_string(&path).unwrap().replace("原始","外部编辑");std::fs::write(&path,&raw).unwrap();let scan=s.vault_scan(&root).await.unwrap();assert!(scan["issues"].as_array().unwrap().is_empty());assert_eq!(s.cached().unwrap().unwrap().data["notes"][0]["content"],"外部编辑");
  let renamed=path.with_file_name("renamed.md");std::fs::rename(&path,&renamed).unwrap();s.vault_scan(&root).await.unwrap();assert!(s.vault_status().unwrap()["entries"][&id]["path"].as_str().unwrap().ends_with("renamed.md"));
  let raw=std::fs::read_to_string(&renamed).unwrap().replace("外部编辑","另一外部稿");std::fs::write(&renamed,&raw).unwrap();s.submit(json!({"type":"update","table":"notes","id":id,"data":{"content":"应用编辑"}}),None).await.unwrap();let v=s.vault_scan(&root).await.unwrap();assert_eq!(v["issues"][0]["conflict"],true);assert_eq!(std::fs::read_to_string(&renamed).unwrap(),raw);
  s.vault_resolve(&root,&id,"external").await.unwrap();assert_eq!(s.cached().unwrap().unwrap().data["notes"][0]["content"],"另一外部稿");std::fs::remove_file(&renamed).unwrap();assert_eq!(s.vault_scan(&root).await.unwrap()["issues"][0]["deleted"],true);assert_eq!(s.cached().unwrap().unwrap().data["notes"].as_array().unwrap().len(),1);s.vault_resolve(&root,&id,"restore").await.unwrap();assert!(renamed.exists());
 }
 #[tokio::test]async fn malformed_and_duplicate_ids_never_overwrite(){let(d,s,id)=fixture().await;let root=d.path().join("library");let state=s.vault_status().unwrap();let p=root.join(state["entries"][&id]["path"].as_str().unwrap());std::fs::copy(&p,p.with_file_name("duplicate.md")).unwrap();assert!(s.vault_scan(&root).await.unwrap()["issues"].as_array().unwrap().iter().any(|i|i["error"].as_str().unwrap().contains("重复ID")));assert_eq!(s.cached().unwrap().unwrap().data["notes"][0]["content"],"原始");}
 #[test]fn attachment_escape_is_rejected(){assert!(mutable("notes",&json!({"content":"[x](../secret)"})).is_err());let d=tempfile::tempdir().unwrap();assert!(safe(d.path(),&d.path().join("../outside")).is_err());}
 #[tokio::test]async fn lost_projection_write_uses_existing_receipt(){let(d,s,id)=fixture().await;let root=d.path().join("library");let state=s.vault_status().unwrap();let path=root.join(state["entries"][&id]["path"].as_str().unwrap());let raw=std::fs::read_to_string(&path).unwrap().replace("原始","已提交但未更新文件头");std::fs::write(&path,&raw).unwrap();let doc=parse(&raw).unwrap();let request=format!("vault-{}",hash(&format!("{id}:{}:{}",doc["base"],hash(&raw))));let snap=s.cached().unwrap().unwrap();let op=s.submit_once(&request,json!({"type":"update","table":"notes","id":id,"data":mutable("notes",&doc).unwrap()}),Some(snap.expected())).await.unwrap();assert_eq!(op.status,"committed");let before=s.operations().unwrap().len();assert!(s.vault_scan(&root).await.unwrap()["issues"].as_array().unwrap().is_empty());assert_eq!(s.operations().unwrap().len(),before);assert_eq!(parse(&std::fs::read_to_string(path).unwrap()).unwrap()["base"],hash(&stable(&s.cached().unwrap().unwrap().data["notes"][0])));}
 #[test]fn failed_atomic_replace_retains_existing_target(){let d=tempfile::tempdir().unwrap();let target=d.path().join("target");std::fs::create_dir(&target).unwrap();std::fs::write(target.join("existing"),b"kept").unwrap();assert!(atomic(&target,b"new").is_err());assert_eq!(std::fs::read(target.join("existing")).unwrap(),b"kept");assert_eq!(std::fs::read_dir(d.path()).unwrap().count(),1);}
 #[tokio::test]async fn frozen_backup_preserves_data_and_rejects_writes(){let(d,s,_)=fixture().await;let p=d.path().join("backup.db");s.backup_and_freeze(&p).unwrap();assert!(s.set_value("x",&json!(1)).is_err());s.freeze(false).unwrap();s.set_value("x",&json!(1)).unwrap();let copy=WorkspaceStore::open(&p).unwrap();assert_eq!(copy.cached().unwrap().unwrap().data["notes"].as_array().unwrap().len(),1);assert!(copy.get_value("x").unwrap().is_none());}
}
#[cfg(not(windows))] fn replace(a:&Path,b:&Path)->Result<()> {std::fs::rename(a,b).map_err(|_|"资料原子替换失败".into())}
#[cfg(windows)] fn replace(a:&Path,b:&Path)->Result<()> {
    use std::os::windows::ffi::OsStrExt;
    #[link(name="kernel32")] extern "system" {fn MoveFileExW(a:*const u16,b:*const u16,flags:u32)->i32;}
    let a:Vec<u16>=a.as_os_str().encode_wide().chain(Some(0)).collect();let b:Vec<u16>=b.as_os_str().encode_wide().chain(Some(0)).collect();
    if unsafe{MoveFileExW(a.as_ptr(),b.as_ptr(),1|8)}==0 {Err("资料原子替换失败".into())}else{Ok(())}
}
pub fn safe(root:&Path,path:&Path)->Result<()> {
    let base=std::fs::canonicalize(root).map_err(|_|"资料目录不存在")?;
    let mut p=path.to_path_buf();
    while !p.exists() {p=p.parent().ok_or("文件路径越界")?.to_path_buf();}
    if !std::fs::canonicalize(&p).map_err(|_|"无法核对文件路径")?.starts_with(&base){return Err("拒绝目录外文件".into());}
    let relative=path.strip_prefix(root).map_err(|_|"文件路径越界")?;
    let mut check=root.to_path_buf();for c in relative.components(){if !matches!(c,std::path::Component::Normal(_)){return Err("文件路径无效".into());}check.push(c);if let Ok(m)=std::fs::symlink_metadata(&check){if m.file_type().is_symlink(){return Err("不读取符号链接".into());}}}
    Ok(())
}
pub fn markdown(table:&str,row:&Value)->String {
    let mut header=row.clone();header.as_object_mut().unwrap().remove("content");header["table"]=json!(table);
    header["base"]=json!(hash(&stable(row)));
    let mut s=String::from("---\n");for(k,v)in header.as_object().unwrap(){s.push_str(&format!("{k}: {}\n",v));}s.push_str("---\n");
    if let Some(body)=row["content"].as_str(){s.push_str(&body.replace("(desktop-attachment:","(../attachments/"));}s.push('\n');s
}
pub fn parse(s:&str)->Result<Value> {
    let s=s.replace("\r\n","\n");let rest=s.strip_prefix("---\n").ok_or("需要保留 Markdown 元数据头")?;
    let (head,body)=rest.split_once("\n---\n").ok_or("元数据头没有结束")?;
    let mut v=json!({});for line in head.lines(){if line.trim().is_empty(){continue;}let(k,value)=line.split_once(':').ok_or("元数据行格式无效")?;
        if v.get(k.trim()).is_some(){return Err("重复元数据字段".into());}
        // The documented format is YAML with JSON scalar/array values.
        v[k.trim()]=serde_json::from_str(value.trim()).map_err(|_|format!("字段 {} 请使用 JSON 值（文字需双引号）",k.trim()))?;
    }v["content"]=json!(body.strip_suffix('\n').unwrap_or(body));Ok(v)
}
fn mutable(table:&str,doc:&Value)->Result<Value>{
    let fields:&[&str]=match table{"notes"=>&["title","content","tags","notebookId"],"todos"=>&["title","done","priority","due","notebookId"],"inspirations"=>&["title","content","tags","relatedNotes"],_=>return Err("该资料仅供阅读".into())};
    let mut data=json!({});for k in fields{if let Some(v)=doc.get(*k){data[*k]=v.clone();}}
    let normalized=doc["content"].as_str().unwrap_or("").replace("(../attachments/","(desktop-attachment:");
    if data.get("content").is_some(){data["content"]=json!(normalized);}
    let content=normalized.as_str();
    if content.contains("file://")||content.contains("\\\\")||content.contains(":\\")||content.contains("../")||content.contains("asset.localhost"){return Err("正文含本机绝对路径或越界附件，请使用 attachments/ 下相对引用".into());}
    Ok(data)
}
fn files(root:&Path,dir:&Path,out:&mut Vec<PathBuf>)->Result<()> {
    safe(root,dir)?;if !dir.exists(){return Ok(());}for e in std::fs::read_dir(dir).map_err(|_|"无法读取资料目录")?{
        let p=e.map_err(|_|"目录读取失败")?.path();safe(root,&p)?;let m=std::fs::symlink_metadata(&p).map_err(|_|"无法读取文件信息")?;
        if out.len()>10000{return Err("资料文件超过10000个，请分库处理".into());}
        if m.is_dir(){files(root,&p,out)?;}else if p.extension().is_some_and(|e|e=="md"){if m.len()>8*1024*1024{return Err("Markdown超过8MiB".into());}out.push(p);}
    }Ok(())
}
impl WorkspaceStore {
    pub fn vault_status(&self)->Result<Value>{Ok(self.get_value("vault-state")?.unwrap_or(json!({"entries":{},"issues":[]})))}
    pub async fn vault_scan(&self,root:&Path)->Result<Value>{
        std::fs::create_dir_all(root).map_err(|_|"无法创建资料文件夹")?;
        let mut state=self.vault_status()?;let mut entries=state["entries"].as_object().cloned().unwrap_or_default();let mut issues=Vec::new();
        let mut docs=BTreeMap::new();let mut duplicate=HashSet::new();let mut total_bytes=0usize;
        for table in ["notes","todos","inspirations"] {let dir=root.join(table);std::fs::create_dir_all(&dir).map_err(|_|"无法创建分类目录")?;let mut paths=Vec::new();files(root,&dir,&mut paths)?;
            for path in paths {let relative=path.strip_prefix(root).unwrap().to_string_lossy().replace('\\',"/");let raw=std::fs::read_to_string(&path).map_err(|_|"资料不是UTF-8")?;total_bytes+=raw.len();if total_bytes>64*1024*1024{return Err("Markdown扫描超过64MiB，请分库处理；原文件未覆盖".into());}
                match parse(&raw){Ok(doc)=>{let id=doc["id"].as_str().unwrap_or("").to_string();if id.is_empty()||id.len()>128||doc["table"]!=table{issues.push(json!({"path":relative,"error":"保留原始id和table；新增资料请在贾维斯创建"}));continue;}
                    if docs.insert(id.clone(),(table.to_string(),relative,raw,doc)).is_some(){duplicate.insert(id);}
                },Err(e)=>issues.push(json!({"path":relative,"error":e}))}
            }
        }
        for id in &duplicate{issues.push(json!({"id":id,"error":"重复ID，两个文件均未导入"}));}
        let mut snap=self.cached()?.unwrap_or(self.local_snapshot()?);
        for(id,(table,path,raw,doc))in &docs{if duplicate.contains(id){continue;}
            let file_hash=hash(raw);let old=entries.get(id).cloned().unwrap_or(Value::Null);
            let row=snap.data[table].as_array().unwrap().iter().find(|r|r["id"]==*id).cloned();
            if old["fileHash"]==file_hash{if let Some(e)=entries.get_mut(id){e["path"]=json!(path);}continue;}
            let Some(row)=row else{issues.push(json!({"id":id,"path":path,"error":"数据库记录不存在，保留文件"}));continue;};
            let request=format!("vault-{}",hash(&format!("{id}:{}:{file_hash}",doc["base"])));
            if let Ok(data)=mutable(table,doc){
                let acknowledged=self.operations()?.iter().any(|o|o.id==request&&o.status=="committed"&&o.command["data"]==data);
                if acknowledged&&data.as_object().unwrap().iter().all(|(k,v)|row[k]==*v){let output=markdown(table,&row);safe(root,&root.join(path))?;atomic(&root.join(path),output.as_bytes())?;entries.insert(id.clone(),json!({"table":table,"path":path,"base":hash(&stable(&row)),"fileHash":hash(&output)}));continue;}
            }
            if old.is_null()||doc["base"]!=hash(&stable(&row))||old["base"]!=doc["base"]{issues.push(json!({"id":id,"path":path,"error":"双方版本已变化，外部稿已保留","conflict":true}));continue;}
            match mutable(table,doc){Err(e)=>issues.push(json!({"id":id,"path":path,"error":e})),Ok(data)=>{
                let command=json!({"type":"update","table":table,"id":id,"data":data});
                let op=self.submit_once(&request,command,Some(snap.expected())).await?;
                if op.status=="committed"{snap=self.cached()?.unwrap_or(snap);let row=snap.data[table].as_array().unwrap().iter().find(|r|r["id"]==*id).unwrap();let output=markdown(table,row);
                    safe(root,&root.join(path))?;atomic(&root.join(path),output.as_bytes())?;entries.insert(id.clone(),json!({"table":table,"path":path,"base":hash(&stable(row)),"fileHash":hash(&output)}));
                }else{issues.push(json!({"id":id,"path":path,"error":op.error.unwrap_or(op.status),"operationId":op.id}));}
            }}
        }
        for table in ["notes","todos","inspirations"]{for row in snap.data[table].as_array().unwrap(){let id=row["id"].as_str().unwrap();if duplicate.contains(id){continue;}
            let old=entries.get(id).cloned().unwrap_or(Value::Null);let path=old["path"].as_str().map(str::to_owned).unwrap_or_else(||format!("{table}/{}.md",hash(id)));
            if !old.is_null()&&!docs.contains_key(id){issues.push(json!({"id":id,"path":path,"error":"文件已移除，等待确认删除或恢复","deleted":true}));continue;}
            if issues.iter().any(|e|e["id"]==id){continue;}let output=markdown(table,row);
            if old["base"]!=hash(&stable(row))||old.is_null(){safe(root,&root.join(&path))?;
                if old.is_null()&&root.join(&path).exists(){issues.push(json!({"id":id,"path":path,"error":"目标文件已存在，未覆盖"}));continue;}
                atomic(&root.join(&path),output.as_bytes())?;entries.insert(id.into(),json!({"table":table,"path":path,"base":hash(&stable(row)),"fileHash":hash(&output)}));}
        }}
        state=json!({"entries":entries,"issues":issues,"lastScan":chrono::Utc::now().to_rfc3339()});self.set_value("vault-state",&state)?;
        safe(root,&root.join("index.json"))?;atomic(&root.join("index.json"),serde_json::to_string_pretty(&json!({"version":1,"records":state["entries"],"notebooks":snap.data["notebooks"],"sources":snap.data["sources"],"relations":snap.data["relations"]})).unwrap().as_bytes())?;
        if !root.join("README.md").exists(){atomic(&root.join("README.md"),"# 贾维斯资料库\n\nnotes、todos、inspirations 支持外部编辑；会话原文仅供读取。元数据采用 YAML 的 JSON 值语法，保留 id、table、base。同步冲突在贾维斯的本地资料页处理。不要修改 .jarvis，不要用网盘同步运行中的数据库。附件使用相对路径。index.json 可供其他 AI 定位文件。\n".as_bytes())?;}
        Ok(state)
    }
    pub async fn vault_resolve(&self,root:&Path,id:&str,choice:&str)->Result<()> {
        let mut state=self.vault_status()?;let entry=state["entries"][id].clone();let path=root.join(entry["path"].as_str().ok_or("资料映射不存在")?);safe(root,&path)?;
        let table=entry["table"].as_str().ok_or("资料类型不存在")?;let snap=self.refresh().await?;
        let row=snap.data[table].as_array().unwrap().iter().find(|r|r["id"]==id).ok_or("记录已删除")?;
        if choice=="delete"{let op=self.submit(json!({"type":"delete","table":table,"id":id}),Some(snap.expected())).await?;if op.status!="committed"{return Err("删除尚未确认".into());}state["entries"].as_object_mut().unwrap().remove(id);}
        else {if path.exists(){let raw=std::fs::read(&path).map_err(|_|"无法备份冲突稿")?;let backup=root.join("conflicts").join(format!("{}-{}.md",hash(id),uuid::Uuid::new_v4()));safe(root,&backup)?;atomic(&backup,&raw)?;}
            let current=if choice=="external"{let doc=parse(&std::fs::read_to_string(&path).map_err(|_|"外部稿不存在")?)?;if doc["id"]!=id||doc["table"]!=table{return Err("外部稿标识已改变".into());}let op=self.submit(json!({"type":"update","table":table,"id":id,"data":mutable(table,&doc)?}),Some(snap.expected())).await?;if op.status!="committed"{return Err("外部稿保存尚未确认".into());}self.cached()?.unwrap().data[table].as_array().unwrap().iter().find(|r|r["id"]==id).unwrap().clone()}else if choice=="restore"{row.clone()}else{return Err("无效冲突处理选项".into());};
            let output=markdown(table,&current);atomic(&path,output.as_bytes())?;state["entries"][id]=json!({"table":table,"path":entry["path"],"base":hash(&stable(&current)),"fileHash":hash(&output)});
        }self.set_value("vault-state",&state)
    }
    pub fn freeze(&self,on:bool)->Result<()> {self.db.lock().unwrap().execute_batch(if on{"PRAGMA query_only=ON"}else{"PRAGMA query_only=OFF"}).map_err(|_|"无法暂停资料写入".into())}
    pub fn backup_db(&self,path:&Path)->Result<()> {self.db.lock().unwrap().execute("VACUUM INTO ?1",[path.to_string_lossy().as_ref()]).map(|_|()).map_err(|_|"资料数据库备份失败".into())}
    pub fn backup_and_freeze(&self,path:&Path)->Result<()> {let db=self.db.lock().unwrap();db.execute("VACUUM INTO ?1",[path.to_string_lossy().as_ref()]).map_err(|_|"资料数据库备份失败")?;db.execute_batch("PRAGMA query_only=ON").map_err(|_|"资料暂停失败".into())}
}
