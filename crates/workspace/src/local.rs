//! Local six-table authority. Snapshot and receipt commit in one SQLite transaction.
use crate::*;
fn rows<'a>(d:&'a mut Value,t:&str)->Result<&'a mut Vec<Value>>{if !TABLES.contains(&t){return Err("无效数据表".into());}d[t].as_array_mut().ok_or("数据表损坏".into())}
fn required(v:&Value,k:&str)->Result<String>{v[k].as_str().filter(|s|!s.trim().is_empty()).map(str::to_owned).ok_or_else(||format!("缺少字段 {k}"))}
impl WorkspaceStore {
 pub fn is_local(&self)->Result<bool>{Ok(self.config.read().unwrap().is_none()&&self.get_value("workspace-origin")?.is_none())}
 pub fn local_snapshot(&self)->Result<Snapshot>{if let Some(s)=self.cached()?{return Ok(s);}let s=snapshot(empty_data());self.set_value("snapshot",&serde_json::to_value(&s).unwrap())?;Ok(s)}
 pub(crate) fn local_submit(&self,id:&str,command:Value,expected:Option<Expected>,retry:bool)->Result<Operation>{
  let mut db=self.db.lock().unwrap();let tx=db.transaction().map_err(|_|"本地事务失败")?;
  let old:Option<String>=tx.query_row("SELECT payload FROM operations WHERE id=?1",[id],|r|r.get(0)).optional().map_err(|_|"回执读取失败")?;
  if let Some(old)=old{let op:Operation=serde_json::from_str(&old).map_err(|_|"回执损坏")?;if op.command!=command{return Err("任务标识内容已改变".into());}if !retry||!matches!(op.status.as_str(),"conflict"|"draft"){return Ok(op);}}
  let raw:Option<String>=tx.query_row("SELECT value FROM kv WHERE key='snapshot'",[],|r|r.get(0)).optional().map_err(|_|"快照读取失败")?;
  let current=raw.map(|s|serde_json::from_str::<Snapshot>(&s)).transpose().map_err(|_|"快照损坏")?.unwrap_or_else(||snapshot(empty_data()));
  let mut op=Operation{id:id.into(),command:command.clone(),expected:expected.clone(),fingerprint:None,status:"committed".into(),result:None,error:None};
  if expected.is_some_and(|e|e!=current.expected()){op.status="conflict".into();op.error=Some("另一窗口已修改资料，草稿已保留".into());}else{
   let mut data=current.data;op.result=Some(apply(&mut data,&command)?);data["revision"]=json!(data["revision"].as_u64().unwrap_or(0)+1);let next=snapshot(data);validate_snapshot(serde_json::to_value(&next).unwrap())?;
   tx.execute("INSERT INTO kv VALUES('snapshot',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[serde_json::to_string(&next).unwrap()]).map_err(|_|"本地快照保存失败")?;
  }
  tx.execute("INSERT INTO operations VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload",params![id,serde_json::to_string(&op).unwrap(),chrono::Utc::now().timestamp_millis()]).map_err(|_|"本地回执保存失败")?;tx.commit().map_err(|_|"本地保存未完成")?;Ok(op)
 }
}
fn snapshot(mut data:Value)->Snapshot{let at=chrono::Utc::now().to_rfc3339();data["exportedAt"]=json!(at);Snapshot{hash:format!("{:x}",Sha256::digest(stable(&data).as_bytes())),data,saved_at:at}}
fn apply(d:&mut Value,c:&Value)->Result<String>{
 let now=chrono::Utc::now().timestamp_millis();let args=&c["data"];let typ=required(c,"type")?;let mut id=c["id"].as_str().unwrap_or("").to_string();
 let kind=match typ.as_str(){"createNotebook"=>Some("notebooks"),"createNote"=>Some("notes"),"createSource"=>Some("sources"),"createTodo"=>Some("todos"),"createInspiration"=>Some("inspirations"),"createRelation"=>Some("relations"),_=>None};
 if let Some(t)=kind{
  id=format!("local-{}",uuid::Uuid::new_v4());let mut v=json!({"id":id,"createdAt":now});
  match t{
   "notebooks"=>{v["name"]=json!(required(args,"name")?);v["desc"]=json!(args["desc"].as_str().unwrap_or(""));v["tone"]=json!(args["tone"].as_str().unwrap_or("amber"));v["updatedAt"]=json!(now);},
   "notes"|"sources"=>{let nb=required(args,"notebookId")?;if !d["notebooks"].as_array().unwrap().iter().any(|n|n["id"]==nb){return Err("笔记本不存在".into());}v["notebookId"]=json!(nb);v["title"]=json!(args["title"].as_str().filter(|s|!s.trim().is_empty()).unwrap_or("未命名笔记"));v["content"]=json!(args["content"].as_str().unwrap_or(""));if t=="notes"{v["tags"]=json!([]);v["updatedAt"]=json!(now);}else{v["type"]=json!(args["type"].as_str().unwrap_or("file"));if args["url"].is_string(){v["url"]=args["url"].clone();}}},
   "todos"=>{v["title"]=json!(required(args,"title")?);v["done"]=json!(false);v["priority"]=json!(args["priority"].as_str().unwrap_or("normal"));for k in ["notebookId","due"]{if args[k].is_string(){v[k]=args[k].clone();}}},
   "inspirations"=>{let body=required(args,"content")?;v["title"]=json!(args["title"].as_str().unwrap_or(body.lines().next().unwrap_or("灵感")));v["content"]=json!(body);v["tags"]=json!([]);v["relatedNotes"]=json!([]);},
   "relations"=>{for k in ["fromId","fromType","toId","toType","relationType"]{v[k]=json!(required(args,k)?);}v["weight"]=json!(1);},_=>unreachable!()
  }rows(d,t)?.push(v);
 }else if typ=="update"{
  let t=required(c,"table")?;let row=rows(d,&t)?.iter_mut().find(|v|v["id"]==id).ok_or("记录不存在")?;
  let allowed=match t.as_str(){"notebooks"=>vec!["name","desc","tone"],"notes"=>vec!["title","content","tags","notebookId"],"todos"=>vec!["title","done","priority","due","notebookId"],"inspirations"=>vec!["title","content","tags","relatedNotes"],"sources"=>vec!["title","content","url","type"],_=>vec![]};
  for(k,v)in args.as_object().ok_or("修改格式无效")?{if !allowed.contains(&k.as_str()){return Err("不能修改该字段".into());}row[k]=v.clone();}if t=="notes"||t=="notebooks"{row["updatedAt"]=json!(now);}
 }else if typ=="delete"{
  let t=required(c,"table")?;let mut removed=vec![id.clone()];if t=="notebooks"{for child in ["notes","sources","todos"]{let xs=rows(d,child)?;removed.extend(xs.iter().filter(|v|v["notebookId"]==id).map(|v|v["id"].as_str().unwrap().to_string()));xs.retain(|v|v["notebookId"]!=id);}}
  rows(d,&t)?.retain(|v|v["id"]!=id);rows(d,"relations")?.retain(|v|!removed.iter().any(|id|v["fromId"]==*id||v["toId"]==*id));for v in rows(d,"inspirations")?{if let Some(xs)=v["relatedNotes"].as_array_mut(){xs.retain(|v|!removed.iter().any(|id|*v==*id));}}
 }else{return Err("本地模式暂不支持该命令".into());}
 // Check references and essential mutable fields before the transaction can commit.
 for t in ["notes","sources","todos"]{for v in d[t].as_array().unwrap(){if let Some(nb)=v["notebookId"].as_str(){if !d["notebooks"].as_array().unwrap().iter().any(|n|n["id"]==nb){return Err("笔记本引用不存在".into());}}}}
 for t in ["notes","inspirations"]{for v in d[t].as_array().unwrap(){if !v["tags"].as_array().is_some_and(|xs|xs.iter().all(|x|x.is_string())){return Err("标签格式无效".into());}}}
 for v in d["todos"].as_array().unwrap(){if !matches!(v["priority"].as_str(),Some("high"|"normal"|"low"))||!v["title"].as_str().is_some_and(|s|!s.trim().is_empty()){return Err("待办字段无效".into());}}
 for v in d["inspirations"].as_array().unwrap(){if !v["content"].as_str().is_some_and(|s|!s.trim().is_empty())||!v["title"].is_string()||!v["relatedNotes"].as_array().is_some_and(|xs|xs.iter().all(|id|d["notes"].as_array().unwrap().iter().any(|n|n["id"]==*id))){return Err("灵感内容或关联无效".into());}}
 for v in d["notebooks"].as_array().unwrap(){if !matches!(v["tone"].as_str(),Some("blue"|"teal"|"amber"|"rose"|"purple"))||!v["name"].as_str().is_some_and(|s|!s.trim().is_empty()){return Err("笔记本字段无效".into());}}
 for v in d["sources"].as_array().unwrap(){if !matches!(v["type"].as_str(),Some("web"|"file"|"pdf"|"video"|"audio")){return Err("来源类型无效".into());}if let Some(url)=v["url"].as_str().filter(|s|!s.is_empty()){if !reqwest::Url::parse(url).is_ok_and(|u|matches!(u.scheme(),"http"|"https")){return Err("来源链接格式无效".into());}}}
 for v in d["relations"].as_array().unwrap(){if !matches!(v["relationType"].as_str(),Some("derived_from"|"mentions"|"contradicts")){return Err("关系类型无效".into());}for side in ["from","to"]{let kind=v[format!("{side}Type")].as_str().unwrap_or("");let table=match kind{"notebook"=>"notebooks","note"=>"notes","source"=>"sources","todo"=>"todos","inspiration"=>"inspirations",_=>return Err("关联类型无效".into())};if !d[table].as_array().unwrap().iter().any(|n|n["id"]==v[format!("{side}Id")]){return Err("关联目标不存在".into());}}}
 Ok(id)
}

#[cfg(test)]mod tests{use super::*;
 #[tokio::test]async fn local_cas_dedupe_and_restart(){let dir=tempfile::tempdir().unwrap();let p=dir.path().join("local.db");let s=WorkspaceStore::open(&p).unwrap();let first=s.refresh().await.unwrap();let cmd=json!({"type":"createNotebook","data":{"name":"本地"}});let a=s.submit_once("local-test-create-0001",cmd.clone(),Some(first.expected())).await.unwrap();assert_eq!(a.status,"committed");assert_eq!(s.submit_once("local-test-create-0001",cmd.clone(),None).await.unwrap().result,a.result);let conflict=s.submit(cmd,Some(first.expected())).await.unwrap();assert_eq!(conflict.status,"conflict");assert_eq!(s.retry(&conflict.id).await.unwrap().status,"committed");drop(s);let s=WorkspaceStore::open(&p).unwrap();assert!(s.view().unwrap().local);assert_eq!(s.refresh().await.unwrap().data["notebooks"].as_array().unwrap().len(),2);assert!(s.configure(Some(ConnectionConfig::checked("http://localhost:1","fixture").unwrap())).is_err());}
 #[test]fn archive_compare_and_set_rejects_stale_writer(){let d=tempfile::tempdir().unwrap();let s=WorkspaceStore::open(&d.path().join("cas.db")).unwrap();s.compare_set_value("archive",&json!({"sessions":["original"]}),0).unwrap();assert!(s.compare_set_value("archive",&json!({"sessions":["stale"]}),0).is_err());assert_eq!(s.get_value("archive").unwrap().unwrap()["sessions"][0],"original");}
 #[tokio::test]async fn invalid_local_command_does_not_mutate(){let d=tempfile::tempdir().unwrap();let s=WorkspaceStore::open(&d.path().join("s.db")).unwrap();assert!(s.submit(json!({"type":"createNote","data":{"title":"x","notebookId":"missing"}}),None).await.is_err());assert!(s.refresh().await.unwrap().data["notes"].as_array().unwrap().is_empty());}
}
