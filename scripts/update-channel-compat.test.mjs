import test from 'node:test';import assert from 'node:assert/strict';
import {channelManifest,sameArtifacts,repository,legacyRepository} from './update-channel-compat.mjs';
test('renamed channel serves old clients without changing signed artifacts',()=>{
 const original={version:'0.4.6',platforms:{'windows-x86_64':{url:`https://github.com/${repository}/releases/download/v0.4.6-preview.1/package.exe`,signature:'signed',sha256:'hash',size:123}}};
 const channel=channelManifest(original);
 assert.ok(channel.platforms['windows-x86_64'].url.includes(legacyRepository));
 assert.ok(original.platforms['windows-x86_64'].url.includes(repository));
 assert.equal(channel.platforms['windows-x86_64'].signature,'signed');
 assert.ok(sameArtifacts(channel,original));
 const different=structuredClone(original);different.platforms['windows-x86_64'].sha256='changed';assert.ok(!sameArtifacts(different,original));
 assert.deepEqual(channelManifest(channel),channel);
});
test('unrelated repository cannot be published as a compatibility channel',()=>{
 assert.throws(()=>channelManifest({platforms:{x:{url:'https://github.com/other/repo/releases/download/v1/package.exe'}}}));
});
