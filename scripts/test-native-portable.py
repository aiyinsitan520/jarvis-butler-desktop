"""Native worker smoke test: synthetic profile only; no debugger, production data or model."""
import json,sqlite3,time
from datetime import datetime,timedelta,timezone
from pathlib import Path

fixture=json.loads(Path('output/portable-native-fixture.json').read_text(encoding='utf-8-sig'))
root=Path(fixture['dataDir'])
assert root.name.startswith('jarvis-portable-native-')
def wait(fn,timeout=50):
    until=time.monotonic()+timeout
    while time.monotonic()<until:
        try:
            value=fn()
            if value:return value
        except (sqlite3.Error,FileNotFoundError,KeyError,IndexError):pass
        time.sleep(.5)
    raise AssertionError('Native worker did not complete within bound')
wait(lambda:(root/'workspace.db').exists())
logs=root/'synthetic-logs';logs.mkdir(exist_ok=True)
at=(datetime.now(timezone.utc)-timedelta(days=1)).isoformat()
rows=[{'type':'session_meta','timestamp':at,'payload':{'id':'synthetic-portable-session'}},{'type':'response_item','timestamp':at,'payload':{'type':'message','role':'user','content':[{'type':'input_text','text':'什么是主动回忆？'}]}},{'type':'response_item','timestamp':at,'payload':{'type':'message','role':'assistant','content':[{'type':'output_text','text':'合上资料，用自己的话解释概念。'}]}}]
(logs/'rollout.jsonl').write_text('\n'.join(json.dumps(r,ensure_ascii=False) for r in rows),encoding='utf-8')
with sqlite3.connect(root/'workspace.db') as c:
    for key,value in [('collectors',[{'id':'native-synthetic','kind':'codex','path':str(logs),'enabled':True}]),('learning-archive',{'sessions':[],'revision':1,'review':{'enabled':True,'hour':0,'lastDay':'','completed':{}}})]:
        c.execute('INSERT INTO kv VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',(key,json.dumps(value,ensure_ascii=False)))
with sqlite3.connect(root/'dingmi.db') as c:
    now=str(int(time.time()))
    c.execute('INSERT INTO notes(uid,title,body,created_at,updated_at,ver,dirty) VALUES(?,?,?,?,?,?,1)',('portable-native-note','可迁移笔记','合成原文',now,now,f'{int(time.time()*1000):013}-0000-fixture'))
def value(key):
    with sqlite3.connect(root/'workspace.db') as c:
        row=c.execute('SELECT value FROM kv WHERE key=?',(key,)).fetchone()
        return json.loads(row[0]) if row else None
state=wait(lambda:value('vault-state') and any((root/'library'/v['path']).exists() for v in value('vault-state')['entries'].values()) and value('vault-state'))
entry=next(v for v in state['entries'].values() if v['table']=='notes');path=root/'library'/entry['path']
path.write_text(path.read_text(encoding='utf-8').replace('合成原文','外部AI修改的合成笔记'),encoding='utf-8')
wait(lambda:value('snapshot')['data']['notes'][0]['content']=='外部AI修改的合成笔记')
wait(lambda:value('learning-archive')['sessions'])
reports=wait(lambda:value('learning-reports'))
assert len(value('learning-archive')['sessions'])==1
assert list((root/'library/conversations').glob('*.md'))
assert any(r['status']=='excerpt' and r['desktop']=='queued' for r in reports.values())
with sqlite3.connect(root/'dingmi.db') as c:
    assert c.execute('SELECT body FROM notes WHERE uid=?',('portable-native-note',)).fetchone()[0]=='外部AI修改的合成笔记'
print(json.dumps({'nativeWorker':True,'markdownToDatabaseToNative':True,'automaticTranscript':True,'dailyReportAndDesktopQueue':True,'realModelCalls':0,'productionWrites':0},ensure_ascii=False))
