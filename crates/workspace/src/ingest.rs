//! Opt-in local transcript readers. No browser profiles, credential files or tool outputs.
use crate::{Result,WorkspaceStore,vault::{hash,safe,atomic}};
use serde_json::{json,Value};
use std::path::{Path,PathBuf};
fn text(v:&Value)->String{if let Some(s)=v.as_str(){return s.into();}v.as_array().into_iter().flatten().filter_map(|p|p["text"].as_str()).collect::<Vec<_>>().join("\n")}
fn timestamp(v:&Value)->i64{v.as_i64().map(|n|if n<100000000000{n*1000}else{n}).or_else(||v.as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()).map(|d|d.timestamp_millis())).unwrap_or(0)}
pub fn parse(kind:&str,raw:&str,key:&str)->Result<Value>{
    let mut messages=Vec::new();let mut events=Vec::new();let mut source_id=String::new();let mut created=0;let mut updated=0;
    if kind=="gemini"{
        let v:Value=serde_json::from_str(raw).map_err(|_|"Gemini会话JSON无效")?;source_id=v["sessionId"].as_str().unwrap_or(key).into();created=timestamp(&v["startTime"]);updated=timestamp(&v["lastUpdated"]);
        for m in v["messages"].as_array().ok_or("不是Gemini CLI会话")?{let role=match m["type"].as_str(){Some("user")=>"user",Some("gemini")=>"assistant",_=>continue};let content=text(&m["content"]);if !content.trim().is_empty(){messages.push(json!({"role":role,"content":content,"id":m["id"],"timestamp":m["timestamp"]}));}}
    }else if matches!(kind,"codex"|"claude"){
        for line in raw.lines().filter(|l|!l.trim().is_empty()){
            let v:Value=match serde_json::from_str(line){Ok(v)=>v,Err(_)=>return Err("日志含未写完或无效JSON行，下次重新读取".into())};
            let at=timestamp(&v["timestamp"]);if at>0{if created==0{created=at;}updated=updated.max(at);}
            if kind=="codex"{
                if v["type"]=="session_meta"{source_id=v["payload"]["id"].as_str().unwrap_or(key).into();}
                if v["type"]=="response_item"&&v["payload"]["type"]=="message"{let m=&v["payload"];if matches!(m["role"].as_str(),Some("user"|"assistant")){let content=text(&m["content"]);if !content.trim().is_empty(){messages.push(json!({"role":m["role"],"content":content,"id":m["id"],"timestamp":v["timestamp"],"branch":m["parent_id"]}));}}}
                if v["type"]=="event_msg" {let p=&v["payload"];let role=match p["type"].as_str(){Some("user_message")=>"user",Some("agent_message")=>"assistant",_=>continue};if let Some(s)=p["message"].as_str(){events.push(json!({"role":role,"content":s,"timestamp":v["timestamp"]}));}}
            }else{if source_id.is_empty(){source_id=v["sessionId"].as_str().unwrap_or(key).into();}if matches!(v["type"].as_str(),Some("user"|"assistant")){let m=&v["message"];let content=text(&m["content"]);if !content.trim().is_empty(){messages.push(json!({"role":v["type"],"content":content,"id":v["uuid"],"branch":v["parentUuid"],"timestamp":v["timestamp"]}));}}}
        }
        if messages.is_empty(){messages=events;}
    }else{return Err("未知采集器".into());}
    if messages.is_empty(){return Err("未找到用户与AI的文字问答".into());}if messages.len()>10000{return Err("单个会话超过10000条消息".into());}
    let title=messages.iter().find(|m|m["role"]=="user").and_then(|m|m["content"].as_str()).unwrap_or("AI会话").chars().take(80).collect::<String>();
    Ok(json!({"id":format!("auto-{}",hash(&format!("{kind}:{source_id}"))),"source":match kind{"codex"=>"Codex","claude"=>"Claude Code",_=>"Gemini CLI"},"title":title,"createdAt":created.max(1),"updatedAt":updated.max(created).max(1),"sourceSessionId":source_id,"messages":messages}))
}
fn walk(root:&Path,dir:&Path,kind:&str,out:&mut Vec<PathBuf>,depth:usize)->Result<()>{
    if depth>10{return Err("目录层级过深".into());}safe(root,dir)?;
    for e in std::fs::read_dir(dir).map_err(|_|"无法读取授权目录")?{let p=e.map_err(|_|"目录项读取失败")?.path();let m=std::fs::symlink_metadata(&p).map_err(|_|"文件信息不可用")?;
        if m.file_type().is_symlink(){continue;}if p.file_name().is_some_and(|s|s.to_string_lossy().starts_with('.')){continue;}
        if m.is_dir(){walk(root,&p,kind,out,depth+1)?;}else{let ext=p.extension().and_then(|e|e.to_str()).unwrap_or("");let name=p.file_name().unwrap().to_string_lossy();
            if (kind=="gemini"&&ext=="json"&&name.starts_with("session-"))||(kind!="gemini"&&ext=="jsonl"){if m.len()<=20*1024*1024{out.push(p);}}
        }if out.len()>2000{return Err("超过2000个会话文件，请缩小授权目录".into());}
    }Ok(())
}
pub fn preview(root:&Path,kind:&str)->Result<Value>{let mut paths=vec![];walk(root,root,kind,&mut paths,0)?;Ok(json!({"files":paths.len(),"kind":kind,"extensions":if kind=="gemini"{"session-*.json"}else{"*.jsonl"}}))}
impl WorkspaceStore{
    pub fn collect(&self,library:&Path)->Result<Value>{
        let configs=self.get_value("collectors")?.unwrap_or(json!([]));let mut cursors=self.get_value("collector-cursors")?.unwrap_or(json!({}));let mut issues=vec![];let mut imported=0;
        for source in configs.as_array().into_iter().flatten().filter(|c|c["enabled"]==true){let root=Path::new(source["path"].as_str().ok_or("采集目录无效")?);let kind=source["kind"].as_str().unwrap_or("");let sid=source["id"].as_str().unwrap_or("");let mut files=vec![];
            if let Err(e)=walk(root,root,kind,&mut files,0){issues.push(json!({"sourceId":sid,"error":e}));continue;}
            for file in files{safe(root,&file)?;let key=hash(&file.to_string_lossy());let raw=std::fs::read_to_string(&file).map_err(|_|"会话文件不是UTF-8")?;let digest=hash(&raw);if cursors[&key]["hash"]==digest{continue;}
                match parse(kind,&raw,&key){Err(e)=>{if issues.len()<100{issues.push(json!({"sourceId":sid,"file":file.file_name().unwrap().to_string_lossy(),"error":e}));}},Ok(mut session)=>{
                    session["collectorId"]=json!(sid);session["sourceFile"]=json!(file.file_name().unwrap().to_string_lossy());
                    let mut archive=self.get_value("learning-archive")?.unwrap_or(json!({"sessions":[],"review":{"enabled":false,"hour":9,"lastDay":"","completed":{}}}));
                    let sessions=archive["sessions"].as_array_mut().ok_or("归档损坏")?;if let Some(old)=sessions.iter_mut().find(|s|s["id"]==session["id"]){if old["important"]==true{session["important"]=json!(true);}*old=session.clone();}else{sessions.push(session.clone());}
                    if sessions.len()>1000||archive.to_string().len()>24*1024*1024{issues.push(json!({"sourceId":sid,"error":"归档达到1000会话或24MiB限制，请先备份分库"}));continue;}
                    // Sanitized raw versions contain dialogue only, never tool output or credentials from config files.
                    let raw_path=library.join("conversations/raw").join(format!("{}.json",hash(&session.to_string())));safe(library,&raw_path)?;if !raw_path.exists(){atomic(&raw_path,serde_json::to_string_pretty(&session).unwrap().as_bytes())?;}
                    self.compare_set_value("learning-archive",&archive,archive["revision"].as_u64().unwrap_or(0))?;
                    cursors[&key]=json!({"hash":digest,"length":raw.len(),"sessionId":session["id"]});self.set_value("collector-cursors",&cursors)?;imported+=1;
                }}
            }
        }
        let result=json!({"imported":imported,"issues":issues,"lastScan":chrono::Utc::now().to_rfc3339()});self.set_value("collector-status",&result)?;Ok(result)
    }
    pub fn export_conversations(&self,root:&Path)->Result<()> {
        let archive=self.get_value("learning-archive")?.unwrap_or(json!({"sessions":[]}));let mut index=vec![];
        for s in archive["sessions"].as_array().into_iter().flatten(){let id=s["id"].as_str().ok_or("会话ID缺失")?;let path=format!("conversations/{}.md",hash(id));let mut body=format!("# {}\n\n来源：{} · ID：{}\n\n",s["title"].as_str().unwrap_or("会话"),s["source"].as_str().unwrap_or("AI"),id);
            for m in s["messages"].as_array().into_iter().flatten(){body.push_str(&format!("## {}\n\n{}\n\n",m["role"].as_str().unwrap_or(""),m["content"].as_str().unwrap_or("")));}
            let p=root.join(&path);safe(root,&p)?;if std::fs::read_to_string(&p).ok().as_deref()!=Some(&body){atomic(&p,body.as_bytes())?;}index.push(json!({"id":id,"title":s["title"],"path":path,"source":s["source"]}));
        }let p=root.join("conversations/index.json");safe(root,&p)?;atomic(&p,serde_json::to_string_pretty(&index).unwrap().as_bytes())
    }
}
#[cfg(test)]mod tests{use super::*;
 #[test]fn incremental_append_truncation_and_restart_keep_one_session(){let d=tempfile::tempdir().unwrap();let logs=d.path().join("logs");let library=d.path().join("library");std::fs::create_dir_all(&logs).unwrap();std::fs::create_dir_all(&library).unwrap();let db=d.path().join("state.db");let s=WorkspaceStore::open(&db).unwrap();s.set_value("collectors",&json!([{"id":"test","kind":"claude","path":logs,"enabled":true}])).unwrap();let file=logs.join("s.jsonl");let user=r#"{"sessionId":"s","type":"user","message":{"content":"question"}}"#;let answer=r#"{"sessionId":"s","type":"assistant","message":{"content":"answer"}}"#;std::fs::write(&file,user).unwrap();assert_eq!(s.collect(&library).unwrap()["imported"],1);drop(s);let s=WorkspaceStore::open(&db).unwrap();assert_eq!(s.collect(&library).unwrap()["imported"],0);std::fs::write(&file,format!("{user}\n{answer}")).unwrap();s.collect(&library).unwrap();let a=s.get_value("learning-archive").unwrap().unwrap();assert_eq!(a["sessions"].as_array().unwrap().len(),1);assert_eq!(a["sessions"][0]["messages"].as_array().unwrap().len(),2);std::fs::write(&file,user).unwrap();s.collect(&library).unwrap();assert_eq!(s.get_value("learning-archive").unwrap().unwrap()["sessions"].as_array().unwrap().len(),1);}
 #[test]fn codex_prefers_response_items_over_duplicate_events(){let s=parse("codex","{\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"x\"}}\n{\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"x\"}]}}","a").unwrap();assert_eq!(s["messages"].as_array().unwrap().len(),1);}
 #[test]fn partial_tail_is_not_committed(){assert!(parse("claude","{\"type\":\"user\"}","a").is_err());assert!(parse("codex","{\"type\":", "a").is_err());}
 #[test]fn gemini_and_claude_keep_message_identity(){let s=parse("gemini",r#"{"sessionId":"s","messages":[{"type":"user","id":"u","content":"hi"},{"type":"gemini","id":"a","content":"hello"}]}"#,"f").unwrap();assert_eq!(s["messages"][1]["id"],"a");let c=parse("claude",r#"{"sessionId":"s","type":"assistant","uuid":"m","parentUuid":"p","message":{"content":[{"type":"text","text":"hi"},{"type":"tool_use","name":"secret"}]}}"#,"f").unwrap();assert_eq!(c["messages"][0]["content"],"hi");assert_eq!(c["messages"][0]["branch"],"p");}
}
