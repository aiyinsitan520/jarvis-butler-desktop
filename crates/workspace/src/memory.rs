//! User-selected Markdown vault, read-only. No default private path and no link following.
use crate::Result;
use serde_json::{json,Value};
use std::{path::{Path,Component},fs};
const MAX_FILE:u64=2*1024*1024;
const SKIP:[&str;6]=[".obsidian",".git",".trash",".claudian",".smart-env","node_modules"];
pub fn read(root:&Path,relative:&str)->Result<String>{
    let p=Path::new(relative);if p.is_absolute()||p.components().any(|c|!matches!(c,Component::Normal(_)))||p.extension().and_then(|s|s.to_str())!=Some("md"){return Err("只允许仓库内 Markdown 相对路径".into());}
    let base=root.canonicalize().map_err(|_|"仓库目录不可用")?;let mut cur=base.clone();
    for part in p.components(){if SKIP.iter().any(|s|part.as_os_str()==*s){return Err("不读取仓库内部配置".into());}cur.push(part);let m=fs::symlink_metadata(&cur).map_err(|_|"笔记不存在")?;if m.file_type().is_symlink(){return Err("不读取符号链接".into());}}
    let actual=cur.canonicalize().map_err(|_|"笔记不可用")?;
    if !actual.starts_with(&base)||fs::metadata(&actual).map_err(|_|"无法读取笔记")?.len()>MAX_FILE{return Err("笔记越界或超过2MiB".into());}
    fs::read_to_string(actual).map_err(|_|"笔记不是可读取的 UTF-8 文本".into())
}
fn collect(root:&Path,dir:&Path,out:&mut Vec<Value>,depth:usize)->Result<()>{
    if depth>24{return Err("仓库目录过深".into());}
    for entry in fs::read_dir(dir).map_err(|_|"无法读取仓库目录")?{
        let entry=entry.map_err(|_|"无法读取仓库目录项")?;let kind=entry.file_type().map_err(|_|"无法读取文件类型")?;
        if kind.is_symlink(){continue;}let name=entry.file_name().to_string_lossy().to_string();
        if kind.is_dir(){if !name.starts_with('.')&&!SKIP.contains(&name.as_str()){collect(root,&entry.path(),out,depth+1)?;}continue;}
        if !kind.is_file()||!name.ends_with(".md"){continue;}
        if out.len()>=10000{return Err("仓库超过10000篇，需选择更小的子目录".into());}
        let relative=entry.path().strip_prefix(root).map_err(|_|"仓库路径无效")?.to_string_lossy().replace('\\',"/");
        let meta=entry.metadata().map_err(|_|"文件信息不可用")?;if meta.len()>MAX_FILE{continue;}
        let text=read(root,&relative)?;
        let tags:Vec<_>=text.split_whitespace().filter_map(|s|s.strip_prefix('#')).filter(|s|!s.is_empty()&&!s.starts_with('#')).take(50).map(|s|s.trim_matches(|c:char|c==','||c=='，').to_string()).collect();
        let links:Vec<_>=text.split("[[").skip(1).filter_map(|s|s.split_once("]]").map(|(a,_)|a.split('|').next().unwrap_or("").to_string())).take(100).collect();
        out.push(json!({"path":relative,"title":name.trim_end_matches(".md"),"folder":relative.split('/').next().filter(|_|relative.contains('/')).unwrap_or("(根目录)"),"frontmatter":{},"excerpt":text.chars().take(400).collect::<String>(),"tags":tags,"links":links,"modified":meta.modified().ok().and_then(|s|s.duration_since(std::time::UNIX_EPOCH).ok()).map(|s|s.as_millis()as u64).unwrap_or(0),"size":meta.len()}));
    }Ok(())
}
pub fn index(root:&Path)->Result<Value>{
    if fs::symlink_metadata(root).map_err(|_|"请选择可用的笔记目录")?.file_type().is_symlink(){return Err("不读取符号链接仓库".into());}
    let root=root.canonicalize().map_err(|_|"仓库不可用")?;let mut notes=Vec::new();collect(&root,&root,&mut notes,0)?;
    notes.sort_by(|a,b|a["path"].as_str().cmp(&b["path"].as_str()));
    let mut folders=std::collections::BTreeMap::<String,usize>::new();let mut tags=std::collections::BTreeMap::<String,usize>::new();
    for n in &notes{*folders.entry(n["folder"].as_str().unwrap_or("").into()).or_default()+=1;for t in n["tags"].as_array().into_iter().flatten(){if let Some(s)=t.as_str(){*tags.entry(s.into()).or_default()+=1;}}}
    Ok(json!({"vaultName":root.file_name().unwrap_or_default().to_string_lossy(),"scannedAt":chrono::Utc::now().to_rfc3339(),"total":notes.len(),"withContent":notes.iter().filter(|n|n["size"].as_u64().unwrap_or(0)>0).count(),"linked":notes.iter().filter(|n|n["links"].as_array().is_some_and(|a|!a.is_empty())).count(),"recent":notes.iter().filter(|n|n["modified"].as_i64().unwrap_or(0)>chrono::Utc::now().timestamp_millis()-7*86400000).count(),"folders":folders.into_iter().map(|(name,count)|json!({"name":name,"count":count})).collect::<Vec<_>>(),"tags":tags.into_iter().map(|(name,count)|json!({"name":name,"count":count})).collect::<Vec<_>>(),"notes":notes}))
}
#[cfg(test)]mod tests{use super::*;#[test]fn traversal_and_internal_settings_are_rejected(){let d=tempfile::tempdir().unwrap();fs::write(d.path().join("one.md"),"#tag [[two]]").unwrap();assert!(read(d.path(),"../secret.md").is_err());assert!(read(d.path(),".obsidian/x.md").is_err());assert!(read(d.path(),"one.txt").is_err());assert_eq!(index(d.path()).unwrap()["total"],1);assert_eq!(read(d.path(),"one.md").unwrap(),"#tag [[two]]");}}
