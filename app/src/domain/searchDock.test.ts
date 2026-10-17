import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchDockFrames, searchPlacement} from './searchDock.ts';
import type {SearchDockGeometry} from './searchDock.ts';
const geometry: SearchDockGeometry = {anchor:{left:220,top:400,width:840,height:74},header:{left:0,top:0,width:1280,height:76},brandRight:210,navLeft:920,viewportWidth:1280,scrollX:0,scrollY:0,wasDocked:false};

test('posição original acompanha o documento sem deslocar o conteúdo da página',()=>{
  assert.deepEqual(searchPlacement(geometry),{left:220,top:400,width:840,dock:null});
  assert.deepEqual(searchPlacement({...geometry,scrollY:100,anchor:{...geometry.anchor,top:300}}),{left:220,top:400,width:840,dock:null});
});
test('busca compacta cabe entre o logo e o menu com margem em ambos os lados',()=>{
  for(const navLeft of [920,710,570]) {
    const placed=searchPlacement({...geometry,navLeft,anchor:{...geometry.anchor,top:85}});
    assert.equal(placed.dock,'inline');
    assert.ok(placed.left>=geometry.brandRight+24);
    assert.ok(placed.left+placed.width<=navLeft-24);
    assert.equal(placed.top,16);
  }
});
test('telas estreitas ou sem espaço central usam uma segunda linha, afastada da navegação',()=>{
  const mobile=searchPlacement({...geometry,viewportWidth:390,anchor:{...geometry.anchor,top:85}});
  assert.deepEqual(mobile,{left:20,top:84,width:350,dock:'stacked'});
  assert.equal(searchPlacement({...geometry,navLeft:500,anchor:{...geometry.anchor,top:85}}).dock,'stacked');
});
test('tolerância mantém o estado perto do limiar, sem oscilar entre fixo e original',()=>{
  const anchor={...geometry.anchor,top:95};
  assert.equal(searchPlacement({...geometry,anchor,wasDocked:false}).dock,null);
  assert.equal(searchPlacement({...geometry,anchor,wasDocked:true}).dock,'inline');
  assert.equal(searchPlacement({...geometry,anchor:{...anchor,top:101},wasDocked:true}).dock,null);
});
test('a entrada reduz a largura abaixo do header antes de subir, e a volta desce antes de expandir',()=>{
  const placed={left:350,top:16,width:560,dock:'inline' as const};
  const entering=searchDockFrames({left:220,top:88,width:840,height:74},placed,312,76);
  assert.deepEqual(entering[1],{left:'350px',top:'88px',width:'560px',offset:.55,opacity:1});
  const leaving=searchDockFrames({left:350,top:16,width:560,height:44},{left:220,top:400,width:840,dock:null},290,76);
  assert.equal(leaving[1].top,'400px'); assert.equal(leaving[1].width,'560px');
  assert.equal(leaving[2].width,'840px'); assert.equal(leaving[2].top,'400px');
});
test('saltos de rolagem revelam o campo diretamente no espaço seguro do menu',()=>{
  const frames=searchDockFrames({left:220,top:-200,width:840,height:74},{left:350,top:16,width:560,dock:'inline'},600,76);
  assert.equal(frames.length,2); assert.equal(frames[0].opacity,0);
  assert.equal(frames[0].left,'350px'); assert.equal(frames[0].width,'560px'); assert.equal(frames[1].top,'16px');
});
