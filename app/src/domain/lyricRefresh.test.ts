import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from './model.ts';
import {onlyNewImportedLyrics} from './lyricRefresh.ts';
test('somente adições automáticas permitem reaplicar uma ação sem ocultar conflitos de usuário',()=>{
  const before=emptyWorkspace();
  const lyric={trackId:'a',text:'Texto de teste',revision:'lrclib:12:hash',source:'https://lrclib.net/api/get/12',importedAt:'',themes:[],mood:'',languages:[]};
  const after={...before,revision:1,lyrics:{a:lyric}};
  assert.equal(onlyNewImportedLyrics(before,after),true);
  assert.equal(onlyNewImportedLyrics(after,{...after,revision:2,lyrics:{a:{...lyric,text:'Texto corrigido'}}}),false);
  assert.equal(onlyNewImportedLyrics(before,{...after,lyrics:{a:{...lyric,revision:'manual'}}}),false);
  assert.equal(onlyNewImportedLyrics(before,{...after,metadata:{artists:[],albums:[],genres:['Rock'],labels:[],languages:[]}}),false);
});
