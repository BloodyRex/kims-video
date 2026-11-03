(function (global) {
  'use strict';

  const W = 640;
  const H = 360;
  const DPR = 2;
  // The creatures may overlap the translucent HUD edge; land creatures stop with their feet on GROUND_Y.
  const GROUND_Y = 318;
  const SEA_FLOOR_Y = 318;
  const PLAY = { left: 12, right: 628, top: 30, bottom: SEA_FLOOR_Y };
  // Touch layout (640x360 logical space):
  //   cards   = slots 0-8 of the species strip (9 cards, left aligned)
  //   shield  = slot 9, the last slot at the right end of the strip
  //   stick   = round joystick filling the space right of the card strip
  //   pause   = the box the old DBG toggle used; music sits directly underneath
  const CONTROL = {
    shield: { x: 453.5, y: 331, w: 45, h: 40 },
    stick: { x: 560, y: 274, r: 72, knob: 30 },
    restart: { x: 320, y: 235, w: 148, h: 34 },
    music: { x: 386, y: 33.5, w: 31, h: 15 },
    pause: { x: 386, y: 15, w: 31, h: 15 },
    // 全屏键：手机端用，占 HUD 顶部左侧那条空白（画面上方），比暂停/音乐键明显大一档。
    // 左边 322 起留给物种名（最长 CHOANOFLAGELLATE COLONY 约到 300），右边与暂停键 370.5 起不重叠。
    fullscreen: { x: 340, y: 25, w: 44, h: 38 },
    debugSlider: { x1: 220, x2: 448, y: 70, y1: 51, y2: 82 }
  };
  const CARD_FIRST_X = 8;
  const STICK = { active: false, id: null, dx: 0, dy: 0 };
  const CARD_STRIP = { x: 6, y: 307, w: 474, h: 49, slotW: 47, cardW: 45, cardH: 40, count: 9 };

  // These are representative evolutionary milestones, not a literal ancestor chain.
  const SEA_SPECIES = [
    { name:'RNA 自复制分子', en:'RNA REPLICATOR', short:'RNA 分子', shortEn:'RNA', era:'生命起源假说', eraEn:'RNA world hypothesis', color:'#f5b85d', dark:'#a85a39', light:'#ffe8a6', description:'能够储存遗传信息并参与自我复制的分子设想。', descriptionEn:'A proposed molecule capable of storing genetic information and helping replication.' },
    { name:'原始细菌', en:'PRIMITIVE BACTERIUM', short:'原始细菌', shortEn:'Bacterium', era:'早期原核生命', eraEn:'Early prokaryotes', color:'#72d2b2', dark:'#277b75', light:'#c7ffe1', description:'具有细胞膜、遗传物质和简单代谢的早期细胞生命。', descriptionEn:'Early cellular life with a membrane, genetic material and simple metabolism.' },
    { name:'蓝细菌', en:'CYANOBACTERIA', short:'蓝细菌', shortEn:'Cyanobacteria', era:'早期光合作用', eraEn:'Early photosynthesis', color:'#6dd5d2', dark:'#247e88', light:'#d0ff9c', description:'通过光合作用释放氧气，深刻改变了地球环境。', descriptionEn:'Photosynthetic microbes that released oxygen and transformed Earth.' },
    { name:'变形虫', en:'AMOEBA', short:'变形虫', shortEn:'Amoeba', era:'真核细胞', eraEn:'Eukaryotic cells', color:'#bc91ed', dark:'#654b9a', light:'#f0d7ff', description:'利用伪足改变形状，并包围、吞噬食物。', descriptionEn:'Uses changing pseudopods to surround and engulf food.' },
    { name:'领鞭毛虫群体', en:'CHOANOFLAGELLATE COLONY', short:'领鞭毛虫', shortEn:'Choanoflagellate', era:'动物近亲', eraEn:'Close animal relatives', color:'#75bdf1', dark:'#356d9e', light:'#d5f4ff', description:'多个细胞组成的群体形态，可帮助理解动物多细胞性的起源。', descriptionEn:'A multicellular-like colony that helps illuminate the origins of animal multicellularity.' },
    { name:'狄更逊生物', en:'DICKINSONIA', short:'狄更逊', shortEn:'Dickinsonia', era:'埃迪卡拉纪', eraEn:'Ediacaran period', color:'#e7bb75', dark:'#9b6c43', light:'#fff0bd', description:'身体扁平、呈椭圆形，并具有重复排列的体节状结构。', descriptionEn:'A flattened oval organism with repeated body segments.' },
    { name:'三叶虫', en:'TRILOBITE', short:'三叶虫', shortEn:'Trilobite', era:'寒武纪海洋', eraEn:'Cambrian seas', color:'#df9864', dark:'#834e42', light:'#ffd3a1', description:'拥有头甲、分节躯干和尾甲的古老节肢动物。', descriptionEn:'An ancient arthropod with a head shield, segmented thorax and tail shield.' },
    { name:'邓氏鱼', en:'DUNKLEOSTEUS', short:'邓氏鱼', shortEn:'Dunkleosteus', era:'泥盆纪海洋', eraEn:'Devonian seas', color:'#8ba9b4', dark:'#415b70', light:'#d8edf0', description:'头部覆盖厚重骨甲，拥有强大的颌部，是大型掠食性鱼类。', descriptionEn:'A large predatory fish with heavy head armor and powerful jaws.' },
    { name:'鱼石螈', en:'ICHTHYOSTEGA', short:'鱼石螈', shortEn:'Ichthyostega', era:'泥盆纪晚期', eraEn:'Late Devonian', color:'#9eaa76', dark:'#4e634d', light:'#e3d99b', description:'兼具鱼类特征与发达四肢的早期四足形类，适合表现水陆过渡。', descriptionEn:'An early tetrapod with a distinctive mix of fish-like traits and substantial limbs.' }
  ].map((s,i)=>{const size=[20,26,32,40,48,58,68,78,90][i];const raw=[36,64,60,42,52,50,50,70,83][i];return {...s,baseR:size*.32,sizeScale:size/raw};});

  // Land chapter: representative forms across deep time, not a literal ancestor chain.
  const LAND_SPECIES = [
    {...SEA_SPECIES[8], color:'#49b7d7', dark:'#245b78', light:'#b8f2f4'},
    { name:'节胸蜈蚣', en:'ARTHROPLEURA', short:'节胸蜈蚣', shortEn:'Arthropleura', era:'石炭纪', eraEn:'Carboniferous', color:'#4f876d', dark:'#213f3a', light:'#a6d9a2', description:'石炭纪巨型陆生节肢动物，身体细长，由许多坚硬体节组成，两侧排列着密集步足。', descriptionEn:'A giant Carboniferous arthropod with a long, many-segmented armored body and rows of legs.' },
    { name:'异齿龙', en:'DIMETRODON', short:'异齿龙', shortEn:'Dimetrodon', era:'早二叠世', eraEn:'Early Permian', color:'#d45b4e', dark:'#762f3c', light:'#f5ad9d', description:'背部高耸的帆状结构、短而强壮的四肢和鳄形头骨，使它极易辨认；它属于合弓类，并非恐龙。', descriptionEn:'Its tall dorsal sail, sturdy limbs and crocodile-like skull make it unmistakable. It was a synapsid, not a dinosaur.' },
    { name:'三瘤齿兽', en:'TRITYLODON', short:'三瘤齿兽', shortEn:'Tritylodon', era:'早侏罗世', eraEn:'Early Jurassic', color:'#d39b3e', dark:'#67431f', light:'#ffe29a', description:'早侏罗世的三瘤齿兽类，身体结实、四肢有力，前颌有醒目的凿状门齿，适合表现为比小型早期哺乳形类更壮实的地面动物。', descriptionEn:'An Early Jurassic tritylodont with a robust body, strong limbs and prominent chisel-like incisors.' },
    { name:'始祖鸟', en:'ARCHAEOPTERYX', short:'始祖鸟', shortEn:'Archaeopteryx', era:'晚侏罗世', eraEn:'Late Jurassic', color:'#4f8cc9', dark:'#234b75', light:'#c5e8f7', description:'拥有羽毛覆盖的翅膀、长而骨质的尾巴和带齿的颌部；扇动翅膀时，宽大的飞羽清晰展开。', descriptionEn:'A feathered early bird with broad feathered wings, a long bony tail and toothed jaws.' },
    { name:'风神翼龙', en:'QUETZALCOATLUS', short:'风神翼龙', shortEn:'Quetzalcoatlus', era:'晚白垩世', eraEn:'Late Cretaceous', color:'#477fae', dark:'#203a64', light:'#b9e3df', description:'体型巨大的翼龙，拥有极宽的翼膜、细长的颈部和无齿长喙。飞行时双翼大幅扇动，展开后形成醒目的宽阔剪影。', descriptionEn:'A giant pterosaur with an enormous membranous wingspan, a long neck and a toothless beak. Its broad wings create a striking silhouette as they flap.' },
    { name:'霸王龙', en:'TYRANNOSAURUS REX', short:'霸王龙', shortEn:'T. rex', era:'晚白垩世', eraEn:'Late Cretaceous', color:'#9b5dca', dark:'#492b70', light:'#e7c1f4', description:'巨大的头骨和强劲颌部布满锋利牙齿，后肢粗壮，前肢却短小得出奇。', descriptionEn:'A gigantic skull with powerful jaws and sharp teeth, massive hind legs and remarkably tiny forelimbs.' },
    { name:'猛犸象', en:'WOOLLY MAMMOTH', short:'猛犸象', shortEn:'Mammoth', era:'更新世', eraEn:'Pleistocene', color:'#bd6d3d', dark:'#5e372b', light:'#f4c184', description:'厚密长毛覆盖庞大身躯，弯曲长象牙向上卷起，长鼻灵活，步伐缓慢而沉重。', descriptionEn:'A massive Ice Age elephant with a shaggy coat, long upward-curving tusks, a flexible trunk and a heavy, slow gait.' },
    { name:'UFO 飞碟', en:'UFO SAUCER', short:'UFO', shortEn:'UFO', era:'未来幻想', eraEn:'Speculative future', color:'#42c2d2', dark:'#23536f', light:'#fff4a9', description:'经典银色飞碟，拥有玻璃穹顶、环形舷窗和脉冲灯带。收集满能量后，它将离开地面、穿越大气层，飞向黑洞。', descriptionEn:'A classic silver flying saucer with a glass dome, portholes and pulsing lights. At full energy it leaves the ground, crosses the atmosphere and flies into a black hole.' }
  ].map((s,i)=>{
    // The land scale is intentionally compact. The mammoth is the largest; the UFO is slightly smaller.
    // Compact all land sprites by about 10%; keep ranks monotonic except the
    // mammoth, whose real-world bulk is intentionally greater than the UFO.
    const size=[58.5,60.3,63,66,69,73.8,81,105.84,86.355][i];
    const raw=[83,157,61,123,104,178,150,117,112][i];
    const move=[1.00,.92,.88,1.08,1.22,1.26,.92,.48,1.10][i];
    return {...s,baseR:size*.32,sizeScale:size/raw,moveSpeed:move};
  });

  const UI = {
    zh: { title:'生命进化史', sea:'海洋纪元', land:'陆地纪元', stage:'阶段', score:'得分', time:'生存', energy:'成长能量', shieldOn:'防护中', shieldReady:'就绪', gameOver:'进化终止', eaten:'你被更高等级的生命体击败了', final:'最终形态', restart:'重新开始', shore:'海岸线已出现！向右移动，登上陆地。', shoreReady:'能量已充满！按住右侧摇杆，顶到右边界即可上岸。', landed:'成功登陆！新的生态世界已开启。', win:'进化旅程完成！', newStage:'进化成功', launchReady:'能量已充满！向右飞行，开启星际旅程。', space1:'冲出森林，穿越云层……', space2:'大气渐渐稀薄，地球在身后展开。', space3:'进入深空，前方出现引力漩涡。', space4:'飞向黑洞的光环，最终化为一道微光。', cardTap:'', music:'音乐', seaFood:'营养颗粒', landFood:'飞虫', debug:'调试', debugLevel:'玩家等级', debugOff:'调试关闭', paused:'已暂停', pausedHint:'点右上角播放键继续', pause:'暂停', resume:'继续' },
    en: { title:'LIFE EVOLUTION', sea:'OCEAN ERA', land:'LAND ERA', stage:'STAGE', score:'SCORE', time:'SURVIVE', energy:'ENERGY', shieldOn:'SHIELD', shieldReady:'READY', gameOver:'EVOLUTION ENDED', eaten:'A higher-level organism caught you.', final:'FINAL FORM', restart:'RESTART', shore:'The shoreline is near! Move right to reach land.', shoreReady:'Energy full! Push the right stick until you reach the far edge to make landfall.', landed:'You made landfall! A new ecosystem awaits.', win:'EVOLUTION COMPLETE!', newStage:'EVOLVED', launchReady:'Energy full! Move right to begin the interstellar journey.', space1:'Leaving the forest, rising through the clouds…', space2:'The atmosphere thins as Earth unfolds behind you.', space3:'Deep space opens; a gravitational vortex appears ahead.', space4:'You approach the black hole’s ring and fade into its light.', cardTap:'', music:'MUSIC', seaFood:'Nutrient', landFood:'Insect', debug:'DEBUG', debugLevel:'PLAYER LEVEL', debugOff:'DEBUG OFF', paused:'PAUSED', pausedHint:'Tap the play key at top right to resume', pause:'PAUSE', resume:'RESUME' }
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const snap = v => Math.round(v * 2) / 2;
  const rect = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(snap(x), snap(y), Math.max(.5, snap(w)), Math.max(.5, snap(h))); };

  function poly(ctx, points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function pxCircle(ctx, x, y, r, color, step) {
    const s = Math.max(.5, (step || 2) * .75);
    ctx.fillStyle = color;
    for (let yy = -r; yy <= r; yy += s) {
      for (let xx = -r; xx <= r; xx += s) {
        if (xx * xx + yy * yy <= r * r) ctx.fillRect(Math.round(x + xx), Math.round(y + yy), s, s);
      }
    }
  }

  function pixelLine(ctx, points, color, width) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = (width || 2) * .8;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.restore();
  }

  function drawRNA(ctx, t, c) {
    // Thin protocell membrane around a bright, animated RNA ribbon.
    rect(ctx, -18, -7, 34, 14, c.dark);
    rect(ctx, -16, -9, 30, 18, c.light);
    rect(ctx, -14, -7, 26, 14, '#183c58');
    const sway = Math.sin(t * 4) * 2;
    pixelLine(ctx, [[-13, 1], [-9, -4 + sway], [-5, 3], [-1, -3 - sway], [3, 3], [7, -3], [11, 1]], c.color, 2.5);
    [[-9, -4 + sway], [-1, -3 - sway], [7, -3]].forEach((p, i) => rect(ctx, p[0] - 1, p[1] - 1, 3, 3, i % 2 ? '#f1e58a' : '#ff8d75'));
    rect(ctx, -17, -2, 2, 4, c.color);
    rect(ctx, 15, -2, 2, 4, c.color);
    pxCircle(ctx, 0, -12, 2, '#fff1a8', 2);
  }

  function drawBacterium(ctx, t, c) {
    const wave = Math.sin(t * 7) * 3;
    poly(ctx, [[-17,-5],[-13,-9],[11,-9],[17,-5],[18,4],[12,9],[-12,9],[-18,4]], c.dark);
    rect(ctx, -14, -6, 27, 12, c.color);
    rect(ctx, -10, -3, 18, 6, c.light);
    rect(ctx, -4, -2, 3, 4, c.dark);
    rect(ctx, 5, 2, 4, 3, c.dark);
    pixelLine(ctx, [[-17,0],[-22,-4 + wave],[-27,-2 + wave],[-31,-7 + wave]], c.light, 2);
    pixelLine(ctx, [[-17,2],[-23,7 - wave],[-28,5 - wave],[-32,9 - wave]], c.light, 2);
    pxCircle(ctx, 11, -2, 2, '#f5fff0', 2);
  }

  function drawCyanobacteria(ctx, t, c) {
    const bob = Math.sin(t * 3) * 1.5;
    for (let i = 0; i < 6; i++) {
      const x = -21 + i * 7;
      rect(ctx, x, -7 + bob, 8, 14, c.dark);
      rect(ctx, x + 1, -6 + bob, 6, 12, c.color);
      rect(ctx, x + 2, -3 + bob, 4, 2, c.light);
      rect(ctx, x + 2, 2 + bob, 4, 2, '#b3f08f');
    }
    pixelLine(ctx, [[-22,-2],[-27,-5 + bob],[-31,-4 + bob]], c.light, 2);
    pixelLine(ctx, [[18,3],[24,6 + bob],[29,4 + bob]], c.light, 2);
    pxCircle(ctx, 0, -12, 2, '#eaff9a', 2);
  }

  function drawAmoeba(ctx, t, c) {
    const p = Math.sin(t * 2.8) * 2;
    poly(ctx, [[-17,-8],[-11,-12],[-3,-10],[2,-13],[8,-9],[13,-7],[16,-2],[21,-4],[18,3],[13,5],[11,11],[4,9],[-2,12],[-9,8],[-16,7],[-20,1]], c.dark);
    poly(ctx, [[-15,-7],[-10,-10],[-3,-8],[3,-11],[8,-7],[13,-5],[15,0],[18,-1],[15,4],[10,6],[9,9],[3,7],[-2,10],[-8,6],[-14,5],[-17,0]], c.color);
    poly(ctx, [[8,-4],[14,-7 - p],[20,-6 - p],[16,-1],[11,1]], c.light);
    pxCircle(ctx, -1, 0, 5, c.dark, 2);
    pxCircle(ctx, 0, -1, 3, '#f2d4ff', 2);
    pxCircle(ctx, -9, -5, 2, '#fff0a8', 2);
    rect(ctx, 7, 4, 4, 2, c.light);
  }

  function drawChoano(ctx, t, c) {
    const cells = [[-12,2],[-3,-5],[7,1],[0,8]];
    cells.forEach(([x,y], i) => {
      const pulse = Math.sin(t * 7 + i * 1.4) * 2;
      pxCircle(ctx, x, y, 6, c.dark, 2);
      pxCircle(ctx, x, y, 4, c.color, 2);
      pxCircle(ctx, x + 1, y - 1, 2, c.light, 2);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + i * 0.4;
        const sx = x + Math.cos(a) * 6;
        const sy = y + Math.sin(a) * 6;
        pixelLine(ctx, [[sx,sy],[sx + 3,sy - 4 + pulse],[sx + 5,sy - 7 + pulse]], c.light, 1.5);
      }
    });
    pixelLine(ctx, [[-18,1],[-24,-3],[-29,-1]], c.color, 2);
    pixelLine(ctx, [[10,8],[16,12],[21,9]], c.color, 2);
  }

  function drawDickinsonia(ctx, t, c) {
    const bob = Math.sin(t * 3) * 1.2;
    poly(ctx, [[-25,0],[-20,-9],[-10,-13],[4,-12],[18,-8],[25,0],[18,8],[4,12],[-10,13],[-20,8]], c.dark);
    poly(ctx, [[-22,0],[-18,-7],[-9,-10],[4,-10],[17,-6],[22,0],[17,6],[4,10],[-9,10],[-18,7]], c.color);
    for (let i = 0; i < 7; i++) {
      const x = -14 + i * 4.2;
      const h = 4 + (1 - Math.abs(i - 3) / 4) * 5;
      rect(ctx, x, -h + bob, 2, h * 2, i % 2 ? c.light : '#c99560');
    }
    rect(ctx, -19, -2, 38, 2, c.dark);
    pxCircle(ctx, 20, -2, 2, c.light, 2);
  }

  function drawTrilobite(ctx, t, c) {
    const legs = Math.sin(t * 11) * 2;
    // Tail, thorax and head shield; the three longitudinal lobes remain clear.
    poly(ctx, [[-25,0],[-20,-8],[-13,-10],[8,-9],[20,-6],[25,0],[20,7],[8,10],[-13,9],[-20,7]], c.dark);
    poly(ctx, [[-22,0],[-17,-6],[-11,-8],[8,-7],[18,-5],[22,0],[18,5],[8,7],[-11,7],[-17,5]], c.color);
    rect(ctx, -13, -7, 25, 3, c.light);
    rect(ctx, -13, 4, 25, 3, '#b87851');
    for (let i = 0; i < 5; i++) {
      const x = -9 + i * 5;
      rect(ctx, x, -5, 3, 10, i % 2 ? c.dark : '#f2c28c');
    }
    poly(ctx, [[13,-7],[21,-5],[25,0],[21,6],[13,7],[17,0]], c.light);
    pxCircle(ctx, 18, -3, 2, '#192f43', 2);
    for (let i = 0; i < 5; i++) {
      const x = -12 + i * 5;
      pixelLine(ctx, [[x,7],[x - 2,11 + (i % 2 ? legs : -legs)],[x - 4,13]], c.light, 1.5);
    }
  }

  function drawDunkleosteus(ctx, t, c) {
    const tail = Math.sin(t * 5) * 4;
    poly(ctx, [[-28,0],[-21,-8],[-10,-12],[5,-11],[19,-6],[26,-1],[19,7],[5,12],[-10,11],[-21,7]], c.dark);
    poly(ctx, [[-23,0],[-17,-7],[-8,-9],[6,-9],[18,-4],[23,0],[17,5],[5,9],[-9,8],[-18,5]], c.color);
    poly(ctx, [[-25,-1],[-34,-12 + tail],[-32,0],[-35,12 + tail],[-24,5]], c.dark);
    poly(ctx, [[-24,-1],[-31,-9 + tail],[-30,0],[-32,8 + tail],[-24,4]], c.light);
    // Distinct armored head and shearing jaw plates.
    poly(ctx, [[8,-9],[21,-8],[29,-3],[27,2],[20,5],[9,3],[5,-2]], c.light);
    poly(ctx, [[9,3],[21,6],[29,3],[24,9],[12,9],[6,5]], '#6c8494');
    rect(ctx, 17, -2, 7, 2, '#152d43');
    poly(ctx, [[-5,-10],[1,-16],[7,-11],[3,-7]], c.dark);
    poly(ctx, [[-1,9],[5,16],[11,8],[5,6]], c.dark);
    pxCircle(ctx, 20, -5, 2, '#fff0a8', 2);
    rect(ctx, -10, -3, 9, 2, c.light);
  }

  function drawIchthyostega(ctx, t, c) {
    const tail = Math.sin(t * 5) * 5;
    const step = Math.sin(t * 8) * 2.2;
    // Broad, fish-like head, heavy trunk, four stout limbs and a long finned tail.
    poly(ctx, [[-30,-2],[-23,-12],[-10,-15],[7,-13],[20,-8],[29,-3],[27,7],[15,12],[-4,13],[-20,8],[-29,4]], c.dark);
    poly(ctx, [[-26,-2],[-20,-10],[-9,-12],[7,-10],[19,-6],[25,-2],[23,5],[13,9],[-4,10],[-18,6],[-26,3]], c.color);
    poly(ctx, [[-20,8],[-15,13],[-7,12],[-10,7]], c.light);
    // Tail with a clearly visible fin.
    poly(ctx, [[-25,1],[-34,-4+tail],[-48,-12+tail],[-44,0],[-49,12+tail],[-34,6+tail],[-25,4]], c.dark);
    poly(ctx, [[-31,1],[-42,-7+tail],[-39,0],[-44,8+tail],[-31,5]], c.light);
    // Four limbs, staggered to suggest a crawl rather than a modern fish swim.
    pixelLine(ctx, [[-12,7],[-15,15+step],[-21,18+step],[-25,17+step]], c.dark, 5);
    pixelLine(ctx, [[12,6],[15,14-step],[21,16-step],[25,15-step]], c.dark, 5);
    pixelLine(ctx, [[-7,8],[-8,16-step],[-13,19-step],[-17,18-step]], c.light, 3);
    pixelLine(ctx, [[17,5],[20,12+step],[26,14+step],[29,13+step]], c.light, 3);
    // Head plates, eye and gill marks.
    poly(ctx, [[13,-9],[24,-7],[30,-2],[26,3],[16,2],[10,-3]], c.light);
    pxCircle(ctx, 20, -5, 3, '#243b39', 2); pxCircle(ctx, 21, -6, 1, '#fff4bc', 1);
    for (let i=0;i<3;i++) pixelLine(ctx, [[-2+i*4,-8],[-1+i*4,-3],[1+i*4,0]], '#5d795c', 1.5);
    pixelLine(ctx, [[-8,-11],[-3,-17],[5,-13]], c.light, 2);
    rect(ctx, 24, 1, 5, 2, '#35463d');
  }

  function drawArthropleura(ctx,t,c) {
    const sway=Math.sin(t*3.8)*1.15, step=Math.sin(t*10.5)*2.0;
    // A broad, flattened leaf-shaped armored trunk; segment seams are subtle,
    // so it reads as one long animal rather than a chain of beads.
    poly(ctx,[[-72,0],[-65,-8],[-48,-14],[-25,-17],[5,-17],[32,-13],[53,-8],[66,-2],[61,7],[43,13],[16,16],[-14,16],[-43,11],[-64,6]],c.dark);
    poly(ctx,[[-67,-1],[-59,-7],[-43,-12],[-22,-14],[5,-14],[30,-11],[50,-7],[60,-2],[55,5],[39,10],[15,13],[-13,13],[-40,9],[-59,4]],c.color);
    // Overlapping plates and fine growth bands follow the long oval silhouette.
    for(let i=0;i<10;i++){
      const x=-48+i*10.2, taper=1-Math.abs(i-4.5)*.075;
      pixelLine(ctx,[[x,-11*taper+sway],[x+1,-4*taper],[x+1,6*taper]],i%2?c.light:'#2d594e',2.0);
      rect(ctx,x-2,-10*taper+sway,4,2,i%2?'#82bd8b':'#356d5a');
    }
    // A dark central ridge and paired low-profile side keels.
    pixelLine(ctx,[[-48,-3+sway],[-22,-7+sway],[8,-7+sway],[36,-4+sway],[53,-1]],'#1d493f',2.8);
    pixelLine(ctx,[[-43,7],[-16,10],[14,10],[42,6]],c.light,1.3);
    // Many short legs remain visible under the leaf-like trunk, but not as a chain.
    for(let i=0;i<9;i++){
      const x=-45+i*12, phase=step*(i%2?1:-1);
      pixelLine(ctx,[[x,10],[x-2,15+phase],[x-6,19+phase]],c.dark,2.5);
      pixelLine(ctx,[[x+4,10],[x+7,15-phase],[x+11,18-phase]],'#294d43',2.3);
    }
    // Flattened head and paired antennae.
    poly(ctx,[[51,-7],[62,-8],[70,-3],[68,4],[57,7],[48,2]],c.dark);
    poly(ctx,[[54,-6],[63,-6],[67,-2],[64,3],[56,4],[51,0]],c.light);
    pxCircle(ctx,62,-4,2.1,'#142d29',2);pxCircle(ctx,63,-5,1,'#fff2bb',1);
    pixelLine(ctx,[[59,-7],[65,-15],[73,-18],[79,-17]],c.dark,1.8);
    pixelLine(ctx,[[55,-7],[58,-16],[65,-22],[71,-23]],c.light,1.6);
    // Short tail cerci and a faint leaf-like edge highlight.
    pixelLine(ctx,[[-63,1],[-72,4+sway],[-78,3+sway]],c.light,1.5);
    pixelLine(ctx,[[-62,5],[-70,10],[-76,10]],c.dark,1.5);
  }

  function drawDimetrodon(ctx,t,c) {
    const bob=Math.sin(t*4)*1.3, gait=Math.sin(t*8)*2;
    poly(ctx,[[-27,1],[-22,-7],[-10,-10],[9,-8],[23,-3],[29,1],[21,7],[4,10],[-14,8],[-25,5]],c.dark);
    poly(ctx,[[-23,0],[-18,-5],[-7,-7],[10,-6],[22,-2],[24,1],[18,5],[3,7],[-14,6],[-22,3]],c.color);
    // Tall, striped sail.
    const sailOuter=[[-17,-6],[-20,-23+bob],[-15,-20+bob],[-8,-30+bob],[-3,-19+bob],[4,-28+bob],[8,-16+bob],[15,-21+bob],[16,-5]];
    const sailInner=[[-14,-7],[-17,-20+bob],[-13,-18+bob],[-7,-26+bob],[-3,-17+bob],[3,-24+bob],[7,-14+bob],[12,-18+bob],[13,-6]];
    poly(ctx,sailOuter,'#702d45');
    const sailGradient=ctx.createLinearGradient(-15,-29,14,-5);
    sailGradient.addColorStop(0,'#d82f42');sailGradient.addColorStop(.48,'#ee5965');sailGradient.addColorStop(1,'#f3a0ad');
    poly(ctx,sailInner,sailGradient);
    // Individual sail rays and membrane bands, instead of a single flat sail patch.
    for(let i=0;i<6;i++){
      const x=-16+i*5.5,topY=-20-(i%2?5:1)+bob;
      pixelLine(ctx,[[x,-7],[x-1,topY]],i%2?'#8f3047':'#ffd0d2',1.5);
    }
    for(let i=0;i<4;i++) pixelLine(ctx,[[-15+i*7,-7],[-12+i*6,-14]],'#a33a50',1.5);
    rect(ctx,-15,-1,7,2,'#f0c58c');rect(ctx,-5,2,6,2,'#f0c58c');rect(ctx,6,-1,5,2,'#f0c58c');
    pixelLine(ctx,[[-13,6],[-15,13+gait],[-20,15+gait]],c.dark,4);
    pixelLine(ctx,[[13,5],[16,12-gait],[21,14-gait]],c.dark,4);
    pixelLine(ctx,[[-20,15+gait],[-24,16+gait],[-26,15+gait]],c.light,1.5);
    pixelLine(ctx,[[21,14-gait],[25,15-gait],[27,14-gait]],c.light,1.5);
    poly(ctx,[[20,-3],[29,-7],[34,-4],[30,1],[23,1]],c.light);
    pxCircle(ctx,28,-5,2,'#1d2e35',2);rect(ctx,31,-2,2,1,'#422f2b');
  }

  function drawTritylodon(ctx,t,c) {
    const gait=Math.sin(t*8.2)*2.1, tail=Math.sin(t*3.5)*3.2, sniff=Math.sin(t*5.1)*1.2;
    // A sturdy, low-slung tritylodont: deeper body than a shrew, but not a large predator.
    poly(ctx,[[-25,-2],[-42,-7],[-58,-13],[-55,-5],[-64,3],[-47,4],[-28,5]],c.dark);
    poly(ctx,[[-38,-8],[-29,-18],[-12,-21],[8,-18],[27,-10],[35,-1],[29,11],[10,16],[-15,14],[-34,7]],c.dark);
    poly(ctx,[[-34,-8],[-26,-15],[-10,-18],[9,-15],[24,-8],[30,-1],[25,8],[9,12],[-14,11],[-30,5]],c.color);
    // Short, powerful limbs and broad feet suggest a ground-dwelling omnivore/herbivore.
    pixelLine(ctx,[[-23,8],[-27,17+gait],[-31,23+gait],[-37,24+gait]],c.dark,5.2);
    pixelLine(ctx,[[-5,10],[-7,18-gait],[-10,23-gait],[-15,24-gait]],c.dark,4.8);
    pixelLine(ctx,[[15,8],[18,17+gait],[23,22+gait],[29,23+gait]],c.dark,5.2);
    pixelLine(ctx,[[28,4],[31,13-gait],[35,18-gait],[40,18-gait]],c.dark,4.6);
    for(const x of [-37,-15,29,40])rect(ctx,x-3,22,7,3,'#b99b72');
    // Narrow cheek and small ear distinguish the head from Dimetrodon's sail-backed outline.
    poly(ctx,[[20,-14],[31,-20],[43,-18],[52,-11],[55,-4],[49,2],[34,3],[25,-3]],c.dark);
    poly(ctx,[[26,-13],[35,-17],[46,-15],[51,-10],[50,-5],[40,-2],[29,-5]],c.light);
    poly(ctx,[[25,-18],[22,-25],[31,-22],[34,-16]],c.dark);
    pxCircle(ctx,45,-12,2.1,'#1e2928',2);pxCircle(ctx,46,-13,1,'#fff1c7',1);
    // Paired chisel-like incisors, not long canine fangs.
    rect(ctx,49,-3+sniff,3,7,'#fff0c8');rect(ctx,53,-3+sniff,3,7,'#f6dfac');
    rect(ctx,52,4+sniff,5,2,'#3e3430');
    // Sparse whiskers and a subtle cheek stripe add small-mammal detail.
    pixelLine(ctx,[[40,-2],[48,1],[54,0]],c.dark,1.1);
    pixelLine(ctx,[[40,1],[47,5],[53,5]],c.light,1.1);
    for(let i=0;i<3;i++)rect(ctx,25+i*4,2+i%2*3,2,1,c.light);
    // Tail is long and tapered, with a slight rhythmic sway.
    pixelLine(ctx,[[-50,-3],[-58,-5+tail*.35],[-68,-2+tail]],c.dark,3.2);
  }

  function drawArchaeopteryx(ctx,t,c) {
    const flap=Math.sin(t*6.4)*8;
    // Long feathered body and an unmistakable tail fan.
    poly(ctx,[[-28,0],[-18,-8],[-3,-10],[13,-7],[25,-2],[31,1],[21,7],[5,9],[-12,6]],c.dark);
    poly(ctx,[[-23,-1],[-15,-6],[-2,-8],[13,-5],[23,-1],[17,5],[3,7],[-11,4]],c.color);
    // Near wing rises and falls in a broad arc, with individual flight feathers.
    poly(ctx,[[-8,-4],[-22,-15-flap],[-18,-23-flap],[-9,-29-flap],[1,-26-flap],[11,-18-flap],[14,-7]],c.dark);
    poly(ctx,[[-7,-5],[-19,-15-flap],[-15,-21-flap],[-8,-26-flap],[0,-23-flap],[8,-16-flap],[10,-7]],c.light);
    for(let i=0;i<7;i++){
      const x=-19+i*4.2;
      pixelLine(ctx,[[x,-8],[x-7,-16-flap],[x-10,-23-flap+(i%2)*2]],i%2?c.color:c.light,1.6);
    }
    // Far wing is a darker silhouette offset behind the body.
    poly(ctx,[[-5,-5],[-15,-12+flap*.45],[-11,-19+flap*.45],[-2,-21+flap*.45],[7,-12+flap*.45],[10,-5]],c.dark);
    // Long bony tail with paired feather streamers.
    for(let i=0;i<7;i++){
      const f=i/6;
      pixelLine(ctx,[[-20,1],[-30-f*8,-2+f*10+flap*.08],[-40-f*9,-4+f*16]],i%2?c.light:c.color,1.9);
    }
    poly(ctx,[[20,-4],[29,-8],[35,-5],[31,-1],[22,1]],c.light);
    pxCircle(ctx,29,-5,2,'#172b27',2);rect(ctx,33,-3,2,1,'#4a4938');
    pixelLine(ctx,[[-5,6],[-8,14],[-13,16]],c.dark,3);
    pixelLine(ctx,[[10,6],[13,13],[18,14]],c.dark,3);
    pixelLine(ctx,[[-13,16],[-17,18],[-19,17]],c.light,1.3);
    pixelLine(ctx,[[18,14],[22,16],[24,15]],c.light,1.3);
  }

  function drawQuetzalcoatlus(ctx,t,c) {
    const flap=Math.sin(t*5.6)*10, farFlap=Math.sin(t*5.6+0.55)*7;
    const bob=Math.sin(t*2.8)*1.3, neck=Math.sin(t*3.1)*1.2;
    // Far wing: a long, tapered membrane behind the body.
    poly(ctx,[[-5,-4],[-22,-19-farFlap],[-49,-34-farFlap],[-83,-31-farFlap*.65],[-66,-13-farFlap*.3],[-28,2]],c.dark);
    poly(ctx,[[-8,-5],[-24,-18-farFlap],[-49,-30-farFlap],[-76,-27-farFlap*.65],[-61,-12-farFlap*.3],[-27,1]],c.color);
    // Near wing unfolds into a broad, angular fan. Individual finger bones define the span.
    poly(ctx,[[0,-3],[17,-22-flap],[46,-39-flap],[82,-34-flap*.7],[65,-13-flap*.28],[25,4]],c.dark);
    poly(ctx,[[1,-5],[18,-20-flap],[45,-34-flap],[73,-29-flap*.7],[59,-12-flap*.28],[24,1]],c.color);
    for(let i=0;i<6;i++){
      const f=i/5, tipX=20+f*52, tipY=-20-flap-f*10;
      pixelLine(ctx,[[2,-4],[tipX*.55,-10-flap*.48],[tipX,tipY]],i%2?c.light:'#6eafd0',1.8);
    }
    // Membrane panels shimmer subtly as the wings beat.
    for(let i=0;i<4;i++){
      const x=18+i*12;
      pixelLine(ctx,[[x,-14-flap*.55],[x+10,-22-flap*.8],[x+17,-28-flap*.72]],i%2?'#b9e3df':'#6aa7c8',1.1);
    }
    // Slim torso, long neck and compact pelvis identify a pterosaur rather than a bird.
    poly(ctx,[[-30,-5],[-20,-12],[-5,-13],[12,-8],[22,-1],[14,7],[-4,9],[-22,4]],c.dark);
    poly(ctx,[[-25,-5],[-17,-10],[-4,-10],[10,-6],[17,-1],[11,4],[-5,6],[-20,2]],c.color);
    pixelLine(ctx,[[11,-7],[22,-14+neck],[34,-22+neck],[49,-23+neck]],c.dark,6.2);
    pixelLine(ctx,[[14,-7],[25,-14+neck],[36,-20+neck],[49,-21+neck]],c.light,2.2);
    // Long toothless beak and backward cranial crest.
    poly(ctx,[[43,-26+neck],[51,-31+neck],[61,-30+neck],[75,-25+neck],[84,-21+neck],[76,-19+neck],[59,-21+neck],[49,-19+neck]],c.dark);
    poly(ctx,[[52,-27+neck],[61,-28+neck],[76,-23+neck],[82,-21+neck],[73,-21+neck],[58,-23+neck]],'#d7b879');
    poly(ctx,[[47,-27+neck],[39,-36+neck],[55,-32+neck],[63,-27+neck]],c.dark);
    pxCircle(ctx,58,-25+neck,2,'#16283b',2);pxCircle(ctx,59,-26+neck,1,'#effff0',1);
    // Hind legs and a small backward-pointing foot.
    pixelLine(ctx,[[-13,5],[-17,14+bob],[-23,18+bob],[-27,17+bob]],c.dark,3.8);
    pixelLine(ctx,[[3,6],[1,15-bob],[6,19-bob],[11,18-bob]],c.dark,3.8);
    pixelLine(ctx,[[-27,17+bob],[-31,19+bob],[-33,18+bob]],c.light,1.4);
    pixelLine(ctx,[[11,18-bob],[15,19-bob],[17,17-bob]],c.light,1.4);
    // A short tail tuft balances the long neck.
    pixelLine(ctx,[[-24,-2],[-34,1+ bob],[-40,0+bob]],c.dark,2.4);
  }

  function drawTyrannosaurus(ctx,t,c) {
    const gait=Math.sin(t*4.3)*2, jaw=Math.sin(t*2.3)*1.8, tail=Math.sin(t*3.2)*2.5;
    // Powerful hindquarters, deep torso and long balancing tail.
    poly(ctx,[[-22,-7],[-39,-14],[-56,-19],[-70,-14],[-64,-5],[-74,3],[-52,2],[-37,6],[-22,8]],c.dark);
    poly(ctx,[[-35,-10],[-22,-22],[-2,-25],[18,-19],[34,-8],[38,5],[24,16],[0,18],[-22,12],[-38,3]],c.dark);
    poly(ctx,[[-30,-10],[-19,-19],[-2,-21],[16,-16],[29,-7],[32,4],[20,12],[0,14],[-20,9],[-33,1]],c.color);
    // Small two-fingered forelimbs, intentionally tiny beside the chest.
    pixelLine(ctx,[[12,-7],[18,-2],[20,3],[25,2]],c.dark,3.2);
    pixelLine(ctx,[[17,-5],[22,0],[26,0]],c.light,1.3);
    // Massive skull and open jaws: the gape is a strong readable silhouette.
    poly(ctx,[[24,-17],[36,-26],[55,-27],[68,-20],[76,-10],[72,-2],[57,1],[39,-3],[28,-8]],c.dark);
    poly(ctx,[[30,-16],[41,-23],[56,-23],[68,-17],[71,-10],[62,-6],[44,-7],[31,-10]],c.light);
    // Lower jaw hangs open, with large blocky teeth.
    poly(ctx,[[37,-2],[51,3],[70,1],[76,5],[68,12],[50,11],[39,6]],c.dark);
    poly(ctx,[[42,0],[55,5],[69,4],[72,6],[66,9],[51,8],[42,4]],'#bd8065');
    for(let i=0;i<6;i++){
      const x=43+i*4.4;
      poly(ctx,[[x,-8],[x+2,-8],[x+1.2,-2-jaw],[x+.4,-3-jaw]],'#fff2d2');
      poly(ctx,[[x+1,5],[x+3,5],[x+2,1+jaw],[x+1,2+jaw]],'#fff2d2');
    }
    pxCircle(ctx,61,-19,2.6,'#162725',2);pxCircle(ctx,62,-20,1,'#fff0bf',1);
    rect(ctx,74,-10,3,2,'#49362f');
    // Huge hind legs and clawed feet carry the body; forelimbs stay short.
    pixelLine(ctx,[[-18,10],[-23,23+gait],[-20,31+gait],[-12,32+gait]],c.dark,9);
    pixelLine(ctx,[[12,12],[18,24-gait],[23,31-gait],[31,31-gait]],c.dark,9);
    for(const x of [-12,31]){
      rect(ctx,x-3,29,8,4,'#b99a73');
      pixelLine(ctx,[[x+3,31],[x+7,33],[x+9,31]],'#e7d3a9',1.7);
    }
    // Subtle scales and a lateral stripe keep the silhouette from reading as a generic monster.
    for(let i=0;i<6;i++)pxCircle(ctx,-22+i*8,-9+(i%2)*6,1.2,i%2?c.light:c.dark,1);
    pixelLine(ctx,[[-27,7],[-7,12],[15,8]],'#b1a078',1.4);
  }

  function drawMammoth(ctx,t,c) {
    const step=Math.sin(t*2.6)*1.1, trunk=Math.sin(t*2.1)*2.1;
    // Massive shoulder hump and a shaggy, almost floor-length coat.
    poly(ctx,[[-47,-7],[-40,-21],[-23,-28],[-2,-27],[17,-20],[31,-10],[36,7],[26,20],[7,24],[-24,21],[-43,12]],c.dark);
    poly(ctx,[[-42,-8],[-35,-19],[-21,-24],[-2,-23],[15,-17],[27,-8],[31,6],[21,17],[5,20],[-23,17],[-39,9]],c.color);
    // Layered fur locks along the back, belly and cheeks.
    for(let i=0;i<9;i++){
      const x=-35+i*7;
      poly(ctx,[[x,-19-(i%3)*2],[x+4,-25-(i%3)*2],[x+8,-18],[x+5,-12]],i%2?c.light:c.dark);
      poly(ctx,[[x,13],[x+5,19+(i%2)*3],[x+8,12],[x+4,7]],i%2?c.dark:'#7b5743');
    }
    // Huge head, small ear and a long flexible trunk.
    pxCircle(ctx,28,-15,10,c.dark,2);pxCircle(ctx,30,-16,7,c.color,2);
    poly(ctx,[[26,-21],[37,-23],[44,-17],[42,-8],[34,-5],[25,-11]],c.light);
    poly(ctx,[[23,-20],[17,-26],[10,-24],[15,-16],[24,-13]],c.dark);
    pxCircle(ctx,39,-16,2,'#192b28',2);pxCircle(ctx,40,-17,1,'#fff2c8',1);
    // Trunk curves down and curls forward at its tip.
    pixelLine(ctx,[[42,-8],[49,-1+trunk],[51,9+trunk],[47,18+trunk],[54,21+trunk]],c.dark,8);
    pixelLine(ctx,[[44,-7],[50,0+trunk],[51,9+trunk],[48,16+trunk],[54,18+trunk]],'#b88961',4);
    // Long ivory tusks arc outward and upward from the cheeks.
    pixelLine(ctx,[[29,-5],[38,1],[47,3],[54,-1],[56,-8]],'#f6e5b9',6);
    pixelLine(ctx,[[32,-4],[40,2],[48,3],[54,-1]],'#fff4d2',2);
    pixelLine(ctx,[[25,-4],[29,4],[38,9],[46,8],[51,3]],'#ead8ad',4.5);
    // Four stout, furred legs; a mammoth's gait is deliberately slow.
    pixelLine(ctx,[[-29,12],[-31,24+step],[-34,29+step]],c.dark,8);
    pixelLine(ctx,[[-12,16],[-13,26-step],[-15,29-step]],c.dark,8);
    pixelLine(ctx,[[12,15],[14,25+step],[16,29+step]],c.dark,8);
    pixelLine(ctx,[[27,9],[29,21-step],[31,26-step]],c.dark,8);
    for(const x of [-34,-15,16,31])rect(ctx,x-4,27,9,4,'#4c4036');
    // Tail tuft.
    pixelLine(ctx,[[-44,-4],[-52,2],[-55,9]],c.dark,3);poly(ctx,[[-54,7],[-61,9],[-57,15],[-51,12]],c.light);
  }

  function drawUFO(ctx,t,c) {
    const hover=Math.sin(t*3.2)*2.3, pulse=.5+.5*Math.sin(t*5.5);
    // Soft tractor-beam cone underneath the classic flying saucer.
    ctx.save();ctx.globalAlpha=.11+.08*pulse;
    poly(ctx,[[-24,10+hover],[24,10+hover],[39,43+hover],[-39,43+hover]],c.light);ctx.restore();
    // Wide metallic saucer hull.
    poly(ctx,[[-56,0+hover],[-43,-8+hover],[-23,-13+hover],[0,-15+hover],[24,-12+hover],[45,-6+hover],[56,0+hover],[43,8+hover],[23,12+hover],[0,14+hover],[-25,11+hover],[-45,6+hover]],c.dark);
    poly(ctx,[[-52,-1+hover],[-38,-7+hover],[-19,-10+hover],[2,-11+hover],[24,-9+hover],[44,-4+hover],[51,0+hover],[39,5+hover],[20,9+hover],[-2,10+hover],[-25,8+hover],[-43,4+hover]],c.color);
    poly(ctx,[[-39,-2+hover],[-25,-7+hover],[-6,-9+hover],[18,-7+hover],[38,-3+hover],[25,1+hover],[0,4+hover],[-25,2+hover]],c.light);
    // Glass dome with a stepped highlight.
    poly(ctx,[[-24,-8+hover],[-21,-18+hover],[-13,-25+hover],[-2,-29+hover],[12,-27+hover],[22,-19+hover],[27,-8+hover],[13,-6+hover],[-9,-6+hover]],c.dark);
    poly(ctx,[[-18,-9+hover],[-15,-17+hover],[-8,-23+hover],[2,-25+hover],[13,-21+hover],[19,-14+hover],[21,-8+hover],[4,-7+hover],[-10,-7+hover]],c.color);
    poly(ctx,[[-12,-14+hover],[-8,-21+hover],[1,-23+hover],[7,-20+hover],[1,-17+hover]],'#fff0c4');
    // Portholes and alternating perimeter lights.
    for(let i=0;i<7;i++){
      const x=-35+i*11.5, blink=.45+.55*Math.sin(t*6+i*1.7);
      pxCircle(ctx,x,2+hover,2.4,i%2?c.color:c.light,2);
      ctx.save();ctx.globalAlpha=.45+.55*blink;pxCircle(ctx,x,2+hover,1.25,c.light,1);ctx.restore();
    }
    for(let i=0;i<3;i++)rect(ctx,-9+i*9,11+hover,4,2,pulse>.5?c.light:c.dark);
    // Three tiny landing lights pulse beneath the rim.
    ctx.save();ctx.globalAlpha=.25+.35*pulse;rect(ctx,-20,15+hover,40,2,c.light);ctx.restore();
  }

  function speciesFor(scene) { return scene === 'land' ? LAND_SPECIES : SEA_SPECIES; }
  function visualScale(level, scene, growth) {
    const spec = speciesFor(scene)[level];
    return spec.sizeScale * (growth || 1);
  }

  function drawOrganism(ctx, level, x, y, scale, t, options) {
    const opts=options||{}; const scene=opts.scene==='land'?'land':'sea';
    const baseSpec=speciesFor(scene)[level]; if(!baseSpec) return;
    // The controlled organism keeps its species silhouette, but uses a consistent signature palette.
    const spec=opts.player
      ? {...baseSpec, color:'#ff7092', dark:'#762b4a', light:'#fff0c4'}
      : baseSpec;
    ctx.save(); ctx.translate(Math.round(x),Math.round(y)); ctx.scale(scale * (opts.facing === -1 ? -1 : 1), scale);
    if(scene==='sea') {
      switch(level){
        case 0:drawRNA(ctx,t,spec);break;case 1:drawBacterium(ctx,t,spec);break;case 2:drawCyanobacteria(ctx,t,spec);break;
        case 3:drawAmoeba(ctx,t,spec);break;case 4:drawChoano(ctx,t,spec);break;case 5:drawDickinsonia(ctx,t,spec);break;
        case 6:drawTrilobite(ctx,t,spec);break;case 7:drawDunkleosteus(ctx,t,spec);break;case 8:drawIchthyostega(ctx,t,spec);break;
      }
    } else {
      switch(level){
        case 0:drawIchthyostega(ctx,t,spec);break;case 1:drawArthropleura(ctx,t,spec);break;case 2:drawDimetrodon(ctx,t,spec);break;
        case 3:drawTritylodon(ctx,t,spec);break;case 4:drawArchaeopteryx(ctx,t,spec);break;case 5:drawQuetzalcoatlus(ctx,t,spec);break;
        case 6:drawTyrannosaurus(ctx,t,spec);break;case 7:drawMammoth(ctx,t,spec);break;case 8:drawUFO(ctx,t,spec);break;
      }
    }
    if(opts.player){ctx.save();ctx.globalAlpha=.9;rect(ctx,-2,-12,3,2,spec.light);rect(ctx,2,-12,3,2,spec.light);ctx.restore();}
    ctx.restore();
  }

  function chooseOrganismLevel(playerLevel,totalLevels,scene) {
    const n=totalLevels||9, candidates=[];
    for(let level=0;level<n;level++){
      const delta=level-playerLevel;
      let weight=Math.exp(-0.5*Math.pow((delta+1.25)/1.12,2));
      // A thin probability tail allows rare creatures far above the player's level.
      if(delta>=3) weight=Math.max(weight,0.0012*Math.pow(0.22,delta-3));
      if(playerLevel<2 && delta>0) weight*=(scene==='land'?0.78:0.42);
      if(scene==='land'){
        if(delta===0) weight*=0.018;       // avoid dense same-rank clusters around the landfall spawn
        else if(delta>0) weight*=Math.pow(0.78,delta)*1.28; // more frequent higher-rank land wildlife
        else weight*=1.06;                 // keep smaller, edible land organisms common
      }
      candidates.push({level,weight});
    }
    const total=candidates.reduce((a,b)=>a+b.weight,0)||1;
    let roll=Math.random()*total;
    for(const item of candidates){roll-=item.weight;if(roll<=0)return item.level;}
    return candidates[candidates.length-1].level;
  }

  function drawPanel(ctx, x, y, w, h, fill, edge) {
    ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = edge || '#335c70';
    ctx.fillRect(x, y, w, 1.5); ctx.fillRect(x, y + h - 1.5, w, 1.5);
    ctx.fillRect(x, y, 1.5, h); ctx.fillRect(x + w - 1.5, y, 1.5, h);
    ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + 4, y + 4, Math.max(1,w - 8), 1);
  }

  function mount(target, opts) {
    const root=typeof target==='string'?document.querySelector(target):target;
    if(!root) throw new Error('EvolutionGame.mount: game container not found.');
    const canvas=root.querySelector('canvas');
    if(!canvas) throw new Error('EvolutionGame.mount: add a canvas element inside the container.');
    const ctx=canvas.getContext('2d',{alpha:false});
    canvas.width=W*DPR;canvas.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);ctx.imageSmoothingEnabled=false;

    let state,raf=0,lastTime=0,destroyed=false,audioCtx=null,musicNext=0,musicStep=0,musicScene='sea';
    const keys={up:false,down:false,left:false,right:false};
    const zhStarts=(document.documentElement.lang||'zh-CN').toLowerCase().startsWith('zh');
    let language=zhStarts?'zh':'en';
    let musicEnabled=true;
    // 网站等级换算后的开局生物阶段（0-indexed）与起始能量比例（0–1）。
    // startEnergy=1 表示"满能量开局"：能量取到 need-1，视觉上是满条、再吃一口即进化。
    let startLevel=clamp(Math.round(Number(opts&&opts.startLevel)||0),0,SEA_SPECIES.length-1);
    let startEnergy=clamp(Number(opts&&opts.startEnergy)||0,0,1);
    // 全屏由外层页面（pixel-avatar-v16.html）实现：游戏只负责按钮与状态，
    // 真实 requestFullscreen / iOS 伪全屏都由宿主回调处理，然后回写 setFullscreenState。
    let fullscreenRequest=opts&&typeof opts.onFullscreenRequest==='function'?opts.onFullscreenRequest:null;

    const words=()=>UI[language];
    const getSpecies=()=>speciesFor(state.scene);
    const requiredEnergy=(level)=>Math.round(8*Math.pow(state.scene==='land'?1.61:1.58,level));
    const currentSpec=()=>getSpecies()[state.player.level];
    const BODY_BOUNDS={
      sea:{w:[18,32,31,21,29,25,25,35,49],h:[12,10,14,13,17,13,13,16,20]},
      land:{w:[40,78,31,62,52,90,76,59,56],h:[20,23,23,25,28,46,32,32,36]}
    };
    function playerBodyBounds(){
      const p=state.player,scale=visualScale(p.level,state.scene,p.r/getSpecies()[p.level].baseR),b=BODY_BOUNDS[state.scene];
      return {halfW:b.w[p.level]*scale,halfH:b.h[p.level]*scale};
    }
    const LAND_LOWER_HABITAT=new Set([0,2,3,6,7]);
    const LAND_UPPER_HABITAT=new Set([4,5]);
    function landHabitatBounds(level,halfH){
      const pad=Math.max(13,halfH||0);
      let min=PLAY.top+pad, max=GROUND_Y-pad;
      if(LAND_LOWER_HABITAT.has(level)) min=Math.max(min,H*.4+pad);
      else if(LAND_UPPER_HABITAT.has(level)) max=Math.min(max,H*.6-pad);
      return {min:Math.min(min,max),max:Math.max(min,max)};
    }
    function landCreatureHalfH(level,growth){
      return BODY_BOUNDS.land.h[level]*visualScale(level,'land',growth===undefined?1:growth);
    }
    function constrainLandCreatureY(level,y,halfH){
      const b=landHabitatBounds(level,halfH);
      return clamp(y,b.min,b.max);
    }
    const clampPlayer=()=>{
      const p=state.player,b=playerBodyBounds();
      const bottom=state.scene==='land'?GROUND_Y:SEA_FLOOR_Y;
      const mx=Math.min((PLAY.right-PLAY.left)/2-2,Math.max(15,b.halfW+3));
      // Keep the creature's silhouette visible while allowing its upper/lower edge to cross the HUD band slightly.
      let minY=PLAY.top+Math.max(13,b.halfH-7),maxY=bottom-Math.max(13,b.halfH);
      if(state.scene==='land'){
        const habitat=landHabitatBounds(p.level,b.halfH);
        minY=Math.max(minY,habitat.min);maxY=Math.min(maxY,habitat.max);
      }
      p.x=clamp(p.x,PLAY.left+mx,PLAY.right-mx);
      p.y=clamp(p.y,minY,maxY);
    };
    function createState(){
      return {scene:'sea',player:{x:290,y:155,vx:0,vy:0,facing:1,level:0,energy:0,progress:0,r:SEA_SPECIES[0].baseR,sameHit:0},
        entities:[],particles:[],popups:[],elapsed:0,spawnTimer:.35,score:0,shieldTime:0,shieldCD:0,over:false,won:false,endingReady:false,endingComplete:false,finalBlackHole:false,debugEnabled:false,debugDragging:false,paused:false,
        toast:'',toastTime:0,flash:0,bumpFlash:0,transition:null,
        fullscreen:false,
        discovered:{sea:new Set([0]),land:new Set()},cardDetail:null};
    }
    function applyStartLevel(){
      const p=state.player;startLevel=clamp(startLevel,0,getSpecies().length-1);
      const sp=getSpecies()[startLevel];
      const need=requiredEnergy(startLevel);
      // ratio=1 → 停在 need-1，避免开局首帧就自动进化掉这一档
      p.energy=Math.max(0,Math.min(need-1,need*startEnergy));
      p.progress=clamp(need>0?p.energy/need:0,0,1);
      p.level=startLevel;p.r=sp.baseR*(1+.07*p.progress);
      if(state.scene==='sea')state.discovered.sea=new Set();else state.discovered.land=new Set();
      for(let i=0;i<=startLevel;i++)discover(i);
      state.startLevel=startLevel;
      state.startEnergy=startEnergy;
    }
    function reset(){state=createState();clearKeys();applyStartLevel();ensureHigherLevelPresence();}
    function setStartLevel(level,energy){
      const next=clamp(Math.round(Number(level)||0),0,SEA_SPECIES.length-1);
      const nextE=energy===undefined?startEnergy:clamp(Number(energy)||0,0,1);
      if(next===startLevel&&nextE===startEnergy)return startLevel;
      startLevel=next;startEnergy=nextE;reset();return startLevel;
    }
    function setDebugEnabled(on){state.debugEnabled=!!on;state.debugDragging=false;return state.debugEnabled;}
    function setDebugLevel(level){
      if(!state.debugEnabled)return state.player.level;
      const p=state.player,next=clamp(Math.round(Number(level)||0),0,getSpecies().length-1);
      if(next===p.level)return next;
      p.level=next;p.energy=0;p.progress=0;p.r=getSpecies()[next].baseR;
      for(let i=0;i<=next;i++)discover(i);
      state.cardDetail=null;state.endingReady=false;state.toast='';state.toastTime=0;
      addParticles(p.x,p.y,getSpecies()[next].light,14);addFloatingText(p.x,p.y,'LV '+String(next+1).padStart(2,'0'),'#f6d58a');state.flash=.22;
      ensureHigherLevelPresence();
      return next;
    }
    function updateDebugSlider(x){
      const b=CONTROL.debugSlider,ratio=clamp((x-b.x1)/(b.x2-b.x1),0,1);
      setDebugLevel(Math.round(ratio*(getSpecies().length-1)));
    }
    function setPaused(on){state.paused=!!on;state.debugDragging=false;clearKeys();releaseStick();return state.paused;}
    function togglePause(){return setPaused(!state.paused);}
    function setFullscreenState(on){const next=!!on;if(state.fullscreen===next)return next;state.fullscreen=next;clearKeys();releaseStick();return next;}
    function toggleFullscreen(){
      const next=!state.fullscreen;
      if(fullscreenRequest){try{fullscreenRequest(next);}catch(_){setFullscreenState(next);}}
      else setFullscreenState(next);
      return next;
    }
    function clearKeys(){keys.up=keys.down=keys.left=keys.right=false;}
    function addParticles(x,y,color,count){for(let i=0;i<(count||8);i++)state.particles.push({x,y,vx:rand(-42,42),vy:rand(-42,42),life:rand(.3,.8),max:.8,color,size:rand(1.5,3.5)});}
    function addFloatingText(x,y,label,color){state.popups.push({x,y,label,color:color||'#d9f5b0',life:.78,max:.78,vy:-25});}
    function discover(level){state.discovered[state.scene].add(level);}
    function spawnEntity(forceFood,forcedLevel){
      if(state.entities.length>=30)return;
      const p=state.player,species=getSpecies();
      const landOpening=state.scene==='land'&&p.level===0;
      const foodCount=state.entities.reduce((n,e)=>n+(e.type==='food'?1:0),0);
      const creatureCount=state.entities.length-foodCount;
      const foodChance=state.scene==='land'?(p.level===0?.35:(p.level===1?.30:.18)):(p.level===0?.34:.17);
      // Maintain a visible insect reserve, but cap the opening ecology to avoid food/creature clutter.
      if(landOpening&&foodCount>=15&&creatureCount>=5&&!forceFood)return;
      const isFood=forcedLevel===undefined && (forceFood===true || (landOpening&&foodCount<12) || (landOpening&&creatureCount>=5&&foodCount<15) || Math.random()<foodChance);
      const level=isFood?-1:(Number.isInteger(forcedLevel)?clamp(forcedLevel,p.level+1,species.length-1):chooseOrganismLevel(p.level,species.length,state.scene));
      if(!isFood)discover(level);
      const side=Math.floor(Math.random()*4);let x,y,vx,vy;
      if(forceFood===true&&state.scene==='land'){
        // Seed insects throughout the visible clearing instead of hiding them at the screen edge.
        x=rand(45,W-45);y=rand(74,GROUND_Y-36);vx=rand(-15,15);vy=rand(-9,9);
      }else if(side===0){x=-35;y=rand(PLAY.top+12,PLAY.bottom-10);vx=rand(18,39);vy=rand(-13,13);}
      else if(side===1){x=W+35;y=rand(PLAY.top+12,PLAY.bottom-10);vx=-rand(18,39);vy=rand(-13,13);}
      else if(side===2){x=rand(PLAY.left+10,PLAY.right-10);y=PLAY.top-30;vx=rand(-13,13);vy=rand(12,25);}
      else{x=rand(PLAY.left+10,PLAY.right-10);y=(state.scene==='land'?GROUND_Y:SEA_FLOOR_Y)+28;vx=rand(-13,13);vy=-rand(12,25);}
      if(Math.hypot(x-p.x,y-p.y)<125){
        if(forceFood===true&&state.scene==='land'){x=x<W/2?rand(365,W-40):rand(40,275);y=rand(PLAY.top+42,GROUND_Y-42);vx=rand(-12,12);vy=rand(-7,7);}
        else{x=x<W/2?-36:W+36;y=rand(PLAY.top+10,PLAY.bottom-10);vx=x<0?rand(22,37):-rand(22,37);}
      }
      const facing=vx<0?-1:1;
      if(isFood){state.entities.push({type:'food',x,y,vx,vy,facing,r:rand(state.scene==='land'?1.55:2.7,state.scene==='land'?2.4:4.2),phase:rand(0,8),bumpCD:0});}
      else{
        const sp=species[level],moveMult=state.scene==='land'?(sp.moveSpeed||1):1,r=sp.baseR*rand(1.00,1.03);
        if(state.scene==='land'){
          const halfH=landCreatureHalfH(level,r/sp.baseR);
          y=constrainLandCreatureY(level,y,halfH);
          const habitat=landHabitatBounds(level,halfH);
          if(y<=habitat.min+.5&&vy<0)vy=Math.abs(vy);
          if(y>=habitat.max-.5&&vy>0)vy=-Math.abs(vy);
        }
        vx*=moveMult;vy*=moveMult;state.entities.push({type:'creature',level,x,y,vx,vy,facing,r,phase:rand(0,8),bumpCD:0,flash:0,moveMult});
      }
    }
    function ensureHigherLevelPresence(){
      const p=state.player,species=getSpecies();
      if(p.level>=species.length-1)return;
      const floor=state.scene==='land'?GROUND_Y:SEA_FLOOR_Y;
      const visible=state.entities.some(e=>e.type==='creature'&&e.level>p.level&&e.x>=8&&e.x<=W-8&&e.y>=PLAY.top-4&&e.y<=floor+10);
      if(visible)return;
      if(state.entities.length>=30){
        let discard=state.entities.findIndex(e=>e.type==='food');
        if(discard<0)discard=state.entities.findIndex(e=>e.type==='creature'&&e.level<=p.level);
        if(discard<0)discard=state.entities.findIndex(e=>e.type==='creature'&&(e.x<8||e.x>W-8||e.y<PLAY.top||e.y>floor+10));
        if(discard<0){
          let farthest=-1,best=-1;
          state.entities.forEach((e,i)=>{if(e.type==='creature'&&e.level>p.level){const d=Math.hypot(e.x-p.x,e.y-p.y);if(d>best){best=d;farthest=i;}}});
          discard=farthest;
        }
        if(discard>=0)state.entities.splice(discard,1);else return;
      }
      const remaining=species.length-1-p.level,roll=Math.random();
      const offset=remaining>=3?(roll<.76?1:(roll<.95?2:3)):(remaining===2?(roll<.78?1:2):1);
      const level=Math.min(species.length-1,p.level+offset),sp=species[level];discover(level);
      // Place the guaranteed predator visibly across the clearing from the player.
      const x=p.x<W*.52?rand(W*.66,W-75):rand(75,W*.34);
      let y=state.scene==='land'?rand(94,Math.max(110,GROUND_Y-58)):rand(74,SEA_FLOOR_Y-48);
      const r=sp.baseR*rand(1,1.02);
      if(state.scene==='land')y=constrainLandCreatureY(level,y,landCreatureHalfH(level,r/sp.baseR));
      const dir=x<p.x?1:-1,speed=(state.scene==='land'?18:21)*(sp.moveSpeed||1);
      state.entities.push({type:'creature',level,x,y,vx:dir*speed,vy:rand(-7,7),facing:dir,r,phase:rand(0,8),bumpCD:0,flash:0,moveMult:sp.moveSpeed||1});
    }


    function addGrowth(e,multiplier){
      const p=state.player;
      const amount=(e.type==='food'?(state.scene==='land'?1.45:1.25):(2.2*Math.pow(1.22,e.level)))*(multiplier===undefined?1:multiplier);
      p.energy+=amount;p.progress=clamp(p.energy/requiredEnergy(p.level),0,1);
      p.r=getSpecies()[p.level].baseR*(1+.07*p.progress);
      state.score+=e.type==='food'?4:Math.round(8+amount*2);
      addFloatingText(e.x,e.y,'+'+amount.toFixed(1),e.type==='food'?'#ffe59a':'#c8f4b0');
      const needed=requiredEnergy(p.level);
      if(p.level===getSpecies().length-1){
        p.energy=Math.min(needed,p.energy);p.progress=clamp(p.energy/needed,0,1);
        p.r=getSpecies()[p.level].baseR*(1+.07*p.progress);
        if(state.scene==='sea'){
          if(p.energy>=needed&&state.toast!==words().shoreReady){state.toast=words().shoreReady;state.toastTime=3.6;}
        }else if(p.energy>=needed&&!state.endingReady){
          state.endingReady=true;state.toast=words().launchReady;state.toastTime=5;state.flash=.3;
        }
        return;
      }
      if(p.energy>=needed){
        p.energy-=needed;
        if(p.level<getSpecies().length-1){
          const old=p.level;p.level++;p.energy=0;p.progress=0;p.r=getSpecies()[p.level].baseR;discover(p.level);
          state.toast=words().newStage+' · '+getSpecies()[p.level].name;state.toastTime=2.4;
          addParticles(p.x,p.y,getSpecies()[p.level].light,24);state.flash=.42;
        }
      }else{
        addParticles(e.x,e.y,e.type==='food'?'#f4e68c':getSpecies()[e.level].light,5);
      }
    }
    function activateShield(){
      if(state.over||state.won||state.transition||state.shieldCD>0)return;
      state.shieldTime=3.2;state.shieldCD=11.5;addParticles(state.player.x,state.player.y,'#8de9ff',12);
    }
    function die(){state.over=true;state.toast=words().gameOver;addParticles(state.player.x,state.player.y,'#ff8b81',30);}
    function startShoreTransition(){
      if(state.transition||state.scene!=='sea'||state.player.level!==8)return;
      state.transition={kind:'shore',time:0,duration:3.2,startX:state.player.x,startY:state.player.y};
      clearKeys();state.entities=[];state.toast=words().shore;state.toastTime=4;
    }
    function startSpaceTransition(){
      if(state.transition||state.scene!=='land'||state.player.level!==8||state.player.energy<requiredEnergy(8))return;
      const p=state.player;
      state.transition={kind:'space',time:0,duration:14.5,startX:p.x,startY:p.y,avatarScale:1};
      state.entities=[];state.particles=[];state.popups=[];state.shieldTime=0;state.toast='';state.toastTime=0;
      clearKeys();musicScene='space';musicStep=0;
    }

    function updateSpaceFlight(tr){
      const p=state.player,k=clamp(tr.time/tr.duration,0,1);
      const points=[
        [0,tr.startX,tr.startY,1],
        [.16,Math.max(W+12,tr.startX+36),tr.startY-52,.94],
        [.36,545,62,.76],
        [.57,425,46,.53],
        [.78,478,128,.23],
        [1,514,146,.012]
      ];
      let a=points[0],b=points[points.length-1];
      for(let i=0;i<points.length-1;i++){if(k>=points[i][0]&&k<=points[i+1][0]){a=points[i];b=points[i+1];break;}}
      const u=clamp((k-a[0])/(b[0]-a[0]),0,1),ease=u*u*(3-2*u);
      p.x=a[1]+(b[1]-a[1])*ease;p.y=a[2]+(b[2]-a[2])*ease;
      tr.avatarScale=a[3]+(b[3]-a[3])*ease;
      p.facing=k<.18?1:-1;
      if(tr.time>=tr.duration){
        state.transition=null;state.won=true;state.endingComplete=true;state.finalBlackHole=true;
        state.toast=words().win;state.toastTime=0;addParticles(514,146,'#b8dfff',24);
      }
    }

    function finishShoreTransition(){
      state.scene='land';state.transition=null;state.entities=[];state.player.level=0;state.player.energy=0;state.player.progress=0;
      state.player.r=LAND_SPECIES[0].baseR;state.player.x=82;state.player.y=GROUND_Y-18;state.player.vx=0;state.player.vy=0;state.player.facing=1;
      state.discovered.land.add(0);state.spawnTimer=.18;
      for(let i=0;i<12;i++)spawnEntity(true);
      ensureHigherLevelPresence();
      state.elapsed+=0;state.toast=words().landed;state.toastTime=3.5;state.flash=.5;
      musicScene='land';musicStep=0;
    }
    function update(dt){
      const p=state.player;state.elapsed+=dt;
      state.shieldTime=Math.max(0,state.shieldTime-dt);state.shieldCD=Math.max(0,state.shieldCD-dt);
      state.flash=Math.max(0,state.flash-dt);state.bumpFlash=Math.max(0,state.bumpFlash-dt);state.toastTime=Math.max(0,state.toastTime-dt);p.sameHit=Math.max(0,p.sameHit-dt);
      if(state.transition){
        state.transition.time+=dt;
        if(state.transition.kind==='space')updateSpaceFlight(state.transition);
        else{
          const k=clamp(state.transition.time/state.transition.duration,0,1);
          p.x=state.transition.startX+k*52;p.y=state.transition.startY-Math.sin(k*Math.PI)*22;
          if(state.transition.time>=state.transition.duration)finishShoreTransition();
        }
        return;
      }
      const dx=(keys.right?1:0)-(keys.left?1:0),dy=(keys.down?1:0)-(keys.up?1:0),len=Math.hypot(dx,dy)||1;
      const stageMotion=state.scene==='land'?(currentSpec().moveSpeed||1):1;
      const speed=(state.scene==='land'?104-p.level*1.3:106-p.level*1.4)*stageMotion*.95;
      const wx=dx/len*speed,wy=dy/len*speed;
      p.vx+=(wx-p.vx)*Math.min(1,dt*9);p.vy+=(wy-p.vy)*Math.min(1,dt*9);
      if(Math.abs(p.vx)>2.2)p.facing=p.vx<0?-1:1;
      if(!dx)p.vx*=Math.max(0,1-dt*2.6);if(!dy)p.vy*=Math.max(0,1-dt*2.6);
      const prevX=p.x;p.x+=p.vx*dt;p.y+=p.vy*dt;
      if(state.scene==='sea'&&p.level===8&&p.energy>=requiredEnergy(8)&&keys.right&&p.x>=PLAY.right-playerBodyBounds().halfW-6){startShoreTransition();return;}
      if(state.scene==='land'&&p.level===8&&state.endingReady&&keys.right&&p.x>=PLAY.right-playerBodyBounds().halfW-6){startSpaceTransition();return;}
      clampPlayer();
      state.spawnTimer-=dt;if(state.spawnTimer<=0){spawnEntity();state.spawnTimer=state.scene==='land'&&p.level===0?rand(.46,.68):rand(.52,.82);}
      for(let i=state.entities.length-1;i>=0;i--){
        const e=state.entities[i];e.bumpCD=Math.max(0,e.bumpCD-dt);e.flash=Math.max(0,(e.flash||0)-dt);
        e.phase+=dt*(e.type==='food'?2.5:1.4);
        const moveMult=e.type==='creature'?(e.moveMult||1):1;
        e.x+=(e.vx+Math.sin(e.phase*1.2)*5*moveMult)*dt;e.y+=(e.vy+Math.sin(e.phase*2.1)*7*moveMult)*dt;
        if(Math.abs(e.vx)>2.2)e.facing=e.vx<0?-1:1;
        if(state.scene==='land'&&e.type==='creature'){
          const growth=e.r/getSpecies()[e.level].baseR,eh=landCreatureHalfH(e.level,growth),habitat=landHabitatBounds(e.level,eh);
          e.y=constrainLandCreatureY(e.level,e.y,eh);
          if(e.y<=habitat.min+.5&&e.vy<0)e.vy=Math.abs(e.vy)*.55;else if(e.y>=habitat.max-.5&&e.vy>0)e.vy=-Math.abs(e.vy)*.55;
        }
        else if(state.scene==='sea'&&e.type==='creature'){const es=visualScale(e.level,'sea',e.r/getSpecies()[e.level].baseR),eh=BODY_BOUNDS.sea.h[e.level]*es;const floorY=SEA_FLOOR_Y-eh+3;if(e.y>floorY){e.y=floorY;if(e.vy>0)e.vy*=-.22;}}
        else if(state.scene==='sea'&&e.type==='food'&&e.y>SEA_FLOOR_Y-2){e.y=SEA_FLOOR_Y-2;if(e.vy>0)e.vy*=-.3;}
        if(e.type==='creature'&&e.level>p.level){e.vx+=Math.sign(p.x-e.x)*4.5*dt*moveMult;e.vy+=Math.sign(p.y-e.y)*2.2*dt*moveMult;e.vx=clamp(e.vx,-55*moveMult,55*moveMult);e.vy=clamp(e.vy,-34*moveMult,34*moveMult);}
        if(e.x<-70||e.x>W+70||e.y<PLAY.top-60||e.y>(state.scene==='land'?GROUND_Y:SEA_FLOOR_Y)+60){state.entities.splice(i,1);continue;}
        const dist=Math.hypot(e.x-p.x,e.y-p.y);if(dist>=p.r+e.r)continue;
        if(e.type==='food'||e.level<p.level){state.entities.splice(i,1);addGrowth(e);addParticles(e.x,e.y,e.type==='food'?'#f4e68c':getSpecies()[e.level].light,5);}
        else if(e.level===p.level){
          if(e.bumpCD<=0&&p.sameHit<=0){let nx=(p.x-e.x)/(dist||1),ny=(p.y-e.y)/(dist||1);if(dist<1){nx=1;ny=rand(-.2,.2);}if(!Number.isFinite(nx))nx=1;
            p.x+=nx*(state.shieldTime>0?15:18);p.y+=ny*(state.shieldTime>0?15:18);clampPlayer();
            p.vx+=nx*(state.shieldTime>0?58:68);p.vy+=ny*(state.shieldTime>0?58:68);p.sameHit=.45;state.bumpFlash=.25;
            if(state.shieldTime>0){
              // Shield turns an equal-rank collision into a counterattack: half prey energy, no damage penalty.
              state.entities.splice(i,1);
              addGrowth(e,.5);
              addParticles((p.x+e.x)/2,(p.y+e.y)/2,'#8de9ff',11);
            }else{
              e.vx-=nx*29;e.vy-=ny*29;e.bumpCD=.95;
              const lost=p.energy*.18;
              p.energy=Math.max(0,p.energy-lost);p.progress=clamp(p.energy/requiredEnergy(p.level),0,1);
              p.r=getSpecies()[p.level].baseR*(1+.07*p.progress);
              if(lost>0.01)addFloatingText(p.x,p.y,'-'+lost.toFixed(1),'#ffcb8a');
              addParticles((p.x+e.x)/2,(p.y+e.y)/2,'#b5e8ff',5);
            }
          }
        } else if(e.level>p.level){
          if(state.shieldTime>0){const nx=(e.x-p.x)/(dist||1),ny=(e.y-p.y)/(dist||1);e.x+=nx*12;e.y+=ny*12;e.vx+=nx*90;e.vy+=ny*60;e.bumpCD=.8;e.flash=.3;addParticles((p.x+e.x)/2,(p.y+e.y)/2,'#8de9ff',9);}
          else{die();break;}
        }
      }
      ensureHigherLevelPresence();
      for(let i=state.particles.length-1;i>=0;i--){const q=state.particles[i];q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.98;q.vy*=.98;if(q.life<=0)state.particles.splice(i,1);}
      for(let i=state.popups.length-1;i>=0;i--){const q=state.popups[i];q.life-=dt;q.y+=q.vy*dt;if(q.life<=0)state.popups.splice(i,1);}
    }

    function drawSeaBackground(t){
      const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#08253b');g.addColorStop(.56,'#0b4659');g.addColorStop(1,'#102f43');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
      for(let i=0;i<6;i++){const x=40+i*112+Math.sin(t*.25+i)*8;ctx.globalAlpha=.05;poly(ctx,[[x,52],[x+24,52],[x+72,242],[x+10,242]],'#b7f0dd');}ctx.globalAlpha=1;
      for(let i=0;i<36;i++){const x=(i*83+t*(5+(i%3)*2))%W,y=62+((i*43+Math.sin(t+i)*13)%178);rect(ctx,x,y,i%5===0?2:1,i%5===0?2:1,i%4===0?'rgba(173,235,217,.45)':'rgba(141,205,222,.22)');}
      rect(ctx,0,SEA_FLOOR_Y,W,5,'#214c5e');rect(ctx,0,SEA_FLOOR_Y+5,W,H-SEA_FLOOR_Y-5,'#102a3a');
      for(let i=0;i<20;i++){const x=i*34+4;rect(ctx,x,335+(i%3)*4,13,3,'#18394b');rect(ctx,x+5,344+(i%4)*3,6,2,'#1d4456');}
      for(let i=0;i<8;i++){const x=6+i*18,sway=Math.sin(t*1.6+i)*3;pixelLine(ctx,[[x,SEA_FLOOR_Y],[x+sway,SEA_FLOOR_Y-13],[x-2+sway,SEA_FLOOR_Y-27],[x+3+sway,SEA_FLOOR_Y-36]],'#286b63',2);}
    }
    function drawLandBackground(t){
      // Upper half: open prehistoric sky framed by tall forest trees and hanging vines.
      // Lower half: a readable river bend, fern banks and a grassy foreground.
      const sky=ctx.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,'#69a9c9');sky.addColorStop(.34,'#9bcbbd');sky.addColorStop(.58,'#b6d39a');sky.addColorStop(1,'#557f4f');
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      // Soft, broken clouds leave a broad, quiet flight lane through the upper center.
      ctx.save();ctx.globalAlpha=.27;
      for(let i=0;i<5;i++){
        const x=(i*151+t*2.5)%760-60,y=35+(i%3)*26;
        rect(ctx,x,y,34,3,'#e7f4e8');rect(ctx,x+8,y-3,21,3,'#e7f4e8');rect(ctx,x+27,y+2,18,2,'#d6e9df');
      }
      ctx.restore();
      const sun=ctx.createRadialGradient(510,58,3,510,58,126);
      sun.addColorStop(0,'rgba(255,246,188,.38)');sun.addColorStop(1,'rgba(255,246,188,0)');ctx.fillStyle=sun;ctx.fillRect(375,0,265,190);
      // Distant tree wall and layered canopy masses are intentionally low contrast.
      poly(ctx,[[0,145],[35,120],[72,139],[111,106],[151,137],[196,115],[237,144],[282,120],[327,143],[372,116],[416,142],[462,112],[505,140],[550,110],[592,138],[640,116],[640,262],[0,262]],'#568773');
      poly(ctx,[[0,177],[42,151],[86,173],[126,140],[171,173],[217,148],[260,179],[305,151],[348,180],[395,151],[438,178],[480,145],[524,174],[570,145],[608,174],[640,153],[640,278],[0,278]],'#699b70');
      // A clear central opening provides sky contrast behind airborne creatures.
      poly(ctx,[[155,0],[485,0],[505,118],[466,151],[411,135],[362,157],[304,139],[249,155],[194,130]],'rgba(190,222,204,.18)');
      // Tall trunks at the edges rise beyond the frame, giving the forest a larger scale.
      function tallTree(x,base,scale,bark,canopy,highlight){
        const trunkW=13*scale,top=base-245*scale;
        poly(ctx,[[x-trunkW*.55,base],[x-trunkW*.42,top+28*scale],[x-trunkW*.95,top+12*scale],[x-trunkW*.18,top+18*scale],[x+trunkW*.55,top],[x+trunkW*.42,base]],bark);
        rect(ctx,x-2.2*scale,top+35*scale,2.2*scale,Math.max(2,base-top-37*scale),'rgba(198,181,119,.32)');
        // Broad, high crowns with irregular layered foliage.
        pxCircle(ctx,x,top+3*scale,39*scale,canopy,6*scale);
        pxCircle(ctx,x-25*scale,top+19*scale,27*scale,canopy,5*scale);
        pxCircle(ctx,x+25*scale,top+18*scale,29*scale,canopy,5*scale);
        pxCircle(ctx,x-9*scale,top-19*scale,21*scale,highlight,5*scale);
        pxCircle(ctx,x+21*scale,top-4*scale,17*scale,highlight,5*scale);
        // Roots flare into the darker understory.
        poly(ctx,[[x-7*scale,base-22*scale],[x-25*scale,base],[x-10*scale,base-5*scale],[x,base-18*scale],[x+12*scale,base-4*scale],[x+25*scale,base],[x+8*scale,base-23*scale]],bark);
      }
      tallTree(7,270,1.08,'#594f3e','#285f4d','#4b8960');
      tallTree(80,246,.76,'#66543c','#367354','#5c9866');
      tallTree(566,250,.82,'#5b4e3b','#2d694f','#5c9862');
      tallTree(635,275,1.12,'#514a38','#245b47','#4b865b');
      // Hanging vines drape from the upper canopy; the middle remains mostly clear.
      function vine(x,y,len,phase,tint){
        const sway=Math.sin(t*1.15+phase)*5;
        ctx.save();ctx.strokeStyle=tint;ctx.lineWidth=2;ctx.lineCap='square';ctx.beginPath();
        ctx.moveTo(x,y);ctx.bezierCurveTo(x-4+sway,y+len*.32,x+7+sway,y+len*.66,x+2+sway,y+len);ctx.stroke();ctx.restore();
        for(let j=1;j<=4;j++){
          const yy=y+len*j/5,xx=x+sway*j/5;
          poly(ctx,[[xx,yy],[xx-7,yy-2],[xx-3,yy+3]],j%2?'#6fb06a':'#8ac27a');
          poly(ctx,[[xx,yy+4],[xx+6,yy+1],[xx+3,yy+7]],j%2?'#4e9562':'#74ad6c');
        }
      }
      vine(43,8,91,.2,'#39775a');vine(112,0,67,1.4,'#4b875e');vine(526,4,82,2.1,'#3f8059');vine(594,0,108,3.2,'#397451');
      // The river flows across the lower half in a gentle S-curve, edged by readable banks.
      const riverPath=(ctx)=>{ctx.beginPath();ctx.moveTo(-28,247);ctx.bezierCurveTo(80,222,141,257,240,251);ctx.bezierCurveTo(338,244,363,222,438,245);ctx.bezierCurveTo(512,270,558,258,668,231);};
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
      ctx.strokeStyle='rgba(54,83,53,.65)';ctx.lineWidth=65;riverPath(ctx);ctx.stroke();
      ctx.strokeStyle='#367f91';ctx.lineWidth=53;riverPath(ctx);ctx.stroke();
      ctx.strokeStyle='#55aeb0';ctx.lineWidth=40;riverPath(ctx);ctx.stroke();
      ctx.strokeStyle='rgba(194,235,211,.66)';ctx.lineWidth=2.2;riverPath(ctx);ctx.stroke();
      // Quiet, staggered highlights suggest current without filling the play lane with noise.
      for(let i=0;i<10;i++){
        const x=(i*73+t*(8+(i%3)*2))%690-25,y=244+Math.sin(i*1.7)*12;
        rect(ctx,x,y,9+(i%4)*3,1.4,'rgba(220,250,227,.58)');
      }
      ctx.restore();
      // Ferns with paired leaflets frame the lower river bank and grassy floor.
      function fern(x,y,scale,tint,phase){
        const sway=Math.sin(t*1.6+phase)*2.2;
        pixelLine(ctx,[[x,y],[x+sway,y-18*scale],[x+3+sway,y-37*scale],[x+8+sway,y-53*scale]],'#426d45',2.1*scale);
        for(let j=0;j<7;j++){
          const yy=y-(8+j*6.3)*scale,xx=x+sway*(j/7)+j*1.05*scale;
          const len=(9-j*.45)*scale;
          poly(ctx,[[xx,yy],[xx-len,yy-3*scale],[xx-4*scale,yy+2*scale]],j%2?tint:'#8dc46e');
          poly(ctx,[[xx+1,yy],[xx+len*.8,yy-4*scale],[xx+5*scale,yy+2*scale]],j%2?'#76ad62':tint);
        }
        pixelLine(ctx,[[x,y],[x-8*scale,y+3*scale],[x-13*scale,y+2*scale]],'#4b7847',2*scale);
      }
      fern(13,310,1.08,'#5f9e58',.3);fern(62,307,.82,'#7eb866',1.1);fern(132,312,.72,'#6ea75d',2.2);
      fern(505,311,.78,'#82b965',2.8);fern(578,309,1.0,'#5e9d57',3.8);fern(625,311,.9,'#7db363',4.5);
      // Grassy banks form an explicit, gently undulating ground baseline.
      const ground=ctx.createLinearGradient(0,278,0,360);
      ground.addColorStop(0,'rgba(129,171,91,.72)');ground.addColorStop(.18,'#78a957');ground.addColorStop(.56,'#507d43');ground.addColorStop(1,'#345c3b');
      ctx.fillStyle=ground;ctx.fillRect(0,278,W,H-278);
      // A few grass blades and seed heads, mostly near the bottom edge.
      for(let i=0;i<40;i++){
        const x=(i*47+13)%W,y=GROUND_Y-2+(i%4)*.6,h=3+(i%5)*1.1;
        pixelLine(ctx,[[x,y],[x-2,y-h],[x-5,y-h-1.5]],i%2?'#3d7945':'#b8d078',1.25);
        if(i%3===0)pixelLine(ctx,[[x+2,y],[x+4,y-h+1],[x+7,y-h-1]],'#78ad58',1.1);
      }
      rect(ctx,0,GROUND_Y,W,2,'#c8d985');rect(ctx,0,GROUND_Y+2,W,2,'#557f43');
    }
    function drawEarthDisc(t,alpha){
      ctx.save();ctx.globalAlpha=alpha;
      // The planet recedes below the frame, with an illuminated atmospheric rim.
      ctx.fillStyle='#173e54';ctx.beginPath();ctx.arc(210,510,315,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.beginPath();ctx.arc(210,510,311,0,Math.PI*2);ctx.clip();
      ctx.fillStyle='#2c796d';poly(ctx,[[-70,300],[4,256],[72,274],[126,249],[189,278],[245,251],[304,277],[375,255],[470,302],[505,370],[-75,380]],'#2b7669');
      ctx.fillStyle='rgba(124,170,128,.75)';poly(ctx,[[36,270],[86,239],[134,261],[163,288],[119,305],[64,301]],'#6a9b78');
      ctx.fillStyle='rgba(80,143,158,.7)';poly(ctx,[[214,246],[274,260],[326,291],[300,324],[238,311],[198,281]],'#4a98a2');
      for(let i=0;i<13;i++){const x=(i*47+t*3)%600-30,y=289+(i%4)*23;rect(ctx,x,y,randStatic(i,5,16),2,'rgba(220,239,221,.12)');}
      ctx.restore();
      ctx.strokeStyle='rgba(123,221,237,.35)';ctx.lineWidth=8;ctx.beginPath();ctx.arc(210,510,311,Math.PI*1.17,Math.PI*1.94);ctx.stroke();
      ctx.strokeStyle='rgba(225,249,255,.55)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(210,510,307,Math.PI*1.17,Math.PI*1.94);ctx.stroke();
      ctx.restore();
    }
    function randStatic(i,a,b){return a+((i*37)%100)/100*(b-a);}
    function drawBlackHole(t,alpha){
      ctx.save();ctx.globalAlpha=alpha;ctx.translate(514,146);ctx.rotate(-.13);
      // Luminous accretion disc, blue on the far edge and amber on the near edge.
      ctx.save();ctx.shadowBlur=18;ctx.shadowColor='#8ed9ff';ctx.strokeStyle='rgba(119,205,255,.68)';ctx.lineWidth=9;ctx.beginPath();ctx.ellipse(0,0,59,20,0,0,Math.PI*2);ctx.stroke();
      ctx.shadowColor='#ffc47b';ctx.strokeStyle='rgba(255,181,103,.86)';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(0,2,51,15,0,0,Math.PI);ctx.stroke();ctx.restore();
      ctx.strokeStyle='rgba(205,180,255,.65)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,-1,41,13,0,Math.PI,Math.PI*2);ctx.stroke();
      const glow=ctx.createRadialGradient(0,0,11,0,0,52);glow.addColorStop(0,'rgba(0,0,0,1)');glow.addColorStop(.55,'rgba(2,4,15,.98)');glow.addColorStop(.78,'rgba(25,22,49,.94)');glow.addColorStop(1,'rgba(78,89,137,0)');
      ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,52,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#02030a';ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(192,220,255,.58)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,27,Math.PI*1.05,Math.PI*1.92);ctx.stroke();
      ctx.restore();
    }
    function drawSpaceTransitionBackground(t,tr){
      const k=clamp(tr.time/tr.duration,0,1);
      if(k<.26)drawLandBackground(t);
      else{ctx.fillStyle='#050b1d';ctx.fillRect(0,0,W,H);}
      const darken=clamp((k-.04)/.38,0,.96);
      const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'rgba(4,10,34,.96)');sky.addColorStop(.56,'rgba(11,26,62,.62)');sky.addColorStop(1,'rgba(6,15,34,.18)');
      ctx.save();ctx.globalAlpha=darken;ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);ctx.restore();
      // Thin atmospheric bands sweep past the saucer as it climbs.
      const streakAlpha=clamp(1-Math.abs(k-.25)*3,0,1)*.55;
      ctx.save();ctx.globalAlpha=streakAlpha;
      for(let i=0;i<10;i++){const y=52+i*22+Math.sin(t*2+i)*3;const x=(i*91+t*(36+i*4))%760-80;rect(ctx,x,y,42+(i%3)*17,1.2,'rgba(197,232,246,.42)');}
      ctx.restore();
      // Stars emerge progressively as the blue atmosphere fades away.
      const starAlpha=clamp((k-.32)/.3,0,1);
      ctx.save();ctx.globalAlpha=starAlpha;
      for(let i=0;i<95;i++){
        const x=(i*137+Math.sin(t*.4+i)*11)%W,y=(i*71+Math.sin(t*.7+i*1.3)*17)%H;
        const blink=.35+.65*(.5+.5*Math.sin(t*2+i));rect(ctx,x,y,i%11===0?2:1,i%11===0?2:1,blink>.72?'#e6edff':'#90a9d4');
      }
      ctx.restore();
      const earthAlpha=clamp((k-.38)/.23,0,1)*(1-clamp((k-.82)/.15,0,1)*.3);
      if(earthAlpha>0)drawEarthDisc(t,earthAlpha);
      const holeAlpha=clamp((k-.57)/.22,0,1);
      if(holeAlpha>0)drawBlackHole(t,holeAlpha);
      // A faint violet nebula keeps the deep-space scene atmospheric without clutter.
      if(k>.48){ctx.save();ctx.globalAlpha=.10*clamp((k-.48)/.25,0,1);const neb=ctx.createRadialGradient(270,95,8,270,95,190);neb.addColorStop(0,'rgba(128,82,180,.4)');neb.addColorStop(1,'rgba(30,35,80,0)');ctx.fillStyle=neb;ctx.fillRect(70,0,420,270);ctx.restore();}
    }
    function drawSpaceCaption(tr){
      const k=clamp(tr.time/tr.duration,0,1),captions=[
        [.10,.27,words().space1], [.34,.49,words().space2], [.58,.74,words().space3], [.80,.98,words().space4]
      ];
      const c=captions.find(v=>k>=v[0]&&k<=v[1]);if(!c)return;
      const mid=(c[0]+c[1])/2,fade=Math.min(1,(k-c[0])/.045,(c[1]-k)/.045);
      ctx.save();ctx.globalAlpha=clamp(fade,0,1);text(c[2],320,282,10,'#e1f2ff','center');ctx.restore();
    }

    function drawBackground(t){
      if(state.transition&&state.transition.kind==='space'){drawSpaceTransitionBackground(t,state.transition);return;}
      if(state.finalBlackHole){drawSpaceTransitionBackground(t,{time:14.5,duration:14.5});return;}
      drawSeaBackground(t);
      if(state.scene==='land')drawLandBackground(t);
      else if(state.transition){const a=clamp(state.transition.time/state.transition.duration,0,1);ctx.save();ctx.globalAlpha=a;drawLandBackground(t);ctx.restore();}
    }
    function drawFood(e,t){
      const bob=Math.sin(t*4+e.phase)*2;ctx.save();ctx.translate(Math.round(e.x),Math.round(e.y+bob));ctx.scale((e.facing===-1?-1:1)*(state.scene==='land'?.5:1),state.scene==='land'?.5:1);
      if(state.scene==='sea'){
        ctx.fillStyle='rgba(247,227,140,.16)';ctx.fillRect(-6,-6,12,12);rect(ctx,-2,-3,5,6,'#bd9950');rect(ctx,-3,-2,6,4,'#f3df91');rect(ctx,-1,-4,3,2,'#fff5c5');
      }else{
        // A tiny mosquito-like food sprite: abdomen, wings and long legs.
        pixelLine(ctx,[[-7,2],[0,0],[6,-1],[10,-5]],'#523f3b',1.3);pxCircle(ctx,-2,1,2,'#715447',2);rect(ctx,2,-2,4,3,'#b78d58');
        pixelLine(ctx,[[1,-1],[-2,-6],[-6,-8]],'#d9f0e8',1);pixelLine(ctx,[[4,-1],[6,-7],[10,-8]],'#d9f0e8',1);
        pixelLine(ctx,[[0,2],[-3,7],[-6,9]],'#4d4941',1);pixelLine(ctx,[[3,1],[5,6],[8,8]],'#4d4941',1);
      }
      ctx.restore();
    }
    function drawRankAura(e,s,t){
      if(e.level<2)return;
      const landColors=['','#55d6a4','#53c9ec','#ed6b72','#f6b94f','#8e9cff','#8bd65f','#c17be8','#8df1ff'];
      const aura=state.scene==='land'?landColors[e.level]:(e.level>=8?'#fff0a0':(e.level>=6?'#c6a5ff':(e.level>=4?'#8fe0ed':'#f4c76e')));
      const rankBoost=state.scene==='land'&&e.level>=5?.12:0;
      const pulse=.15+rankBoost+.09*(.5+.5*Math.sin(t*3.2+e.phase));
      ctx.save();ctx.globalAlpha=pulse;ctx.strokeStyle=aura;ctx.lineWidth=e.level>=7?2.2:1.25;
      ctx.setLineDash(e.level>=6?[2,3]:[3,4]);ctx.beginPath();ctx.ellipse(e.x,e.y,e.r+5*s,e.r*.72+5*s,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      if(e.level>=5){const count=e.level>=8?8:5;for(let i=0;i<count;i++){const a=t*1.1+i*Math.PI*2/count;const px=e.x+Math.cos(a)*(e.r+8*s),py=e.y+Math.sin(a)*(e.r*.72+8*s);rect(ctx,px,py,2.3,2.3,aura);}}
      if(e.level>=7){ctx.globalAlpha=pulse*.42;ctx.fillStyle=aura;ctx.beginPath();ctx.arc(e.x,e.y,e.r+11*s,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }
    function drawEntity(e,t){
      if(e.type==='food'){drawFood(e,t);return;}
      const spec=getSpecies()[e.level],s=visualScale(e.level,state.scene)*(e.r/spec.baseR)*(1+Math.sin(t*2+e.phase)*.02);
      drawRankAura(e,s,t);
      if(e.flash>0){ctx.save();ctx.globalAlpha=.35;rect(ctx,e.x-25*s,e.y-17*s,50*s,34*s,'#e9ffff');ctx.restore();}
      drawOrganism(ctx,e.level,e.x,e.y+Math.sin(t*2+e.phase)*1.2,s,t+e.phase,{scene:state.scene,facing:e.facing});
    }
    function drawPlayer(t){
      if(state.endingComplete)return;
      const p=state.player,s=visualScale(p.level,state.scene,p.r/getSpecies()[p.level].baseR)*(state.transition&&state.transition.kind==='space'?state.transition.avatarScale:1);
      if(s<.025)return;
      if(state.shieldTime>0){const pulse=1+Math.sin(t*9)*.035;ctx.save();ctx.globalAlpha=.15+Math.sin(t*8)*.035;ctx.fillStyle='#74dfff';ctx.beginPath();ctx.arc(p.x,p.y,(p.r+18)*pulse,0,Math.PI*2);ctx.fill();ctx.globalAlpha=.82;ctx.strokeStyle='#a9f4ff';ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.beginPath();ctx.arc(p.x,p.y,p.r+14+Math.sin(t*7)*2,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();}
      if(state.bumpFlash>0){ctx.save();ctx.globalAlpha=state.bumpFlash*2;ctx.strokeStyle='#d8f6ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y,p.r+7,0,Math.PI*2);ctx.stroke();ctx.restore();}
      drawOrganism(ctx,p.level,p.x,p.y+Math.sin(t*3.2)*1.2,s,t,{scene:state.scene,player:true,facing:p.facing});
    }
    function text(str,x,y,size,color,align,maxWidth){ctx.save();ctx.font='600 '+size+'px "Microsoft YaHei","Noto Sans CJK SC",system-ui,Consolas,sans-serif';ctx.fillStyle=color||'#e8f7f4';ctx.textAlign=align||'left';ctx.textBaseline='middle';if(maxWidth>0)ctx.fillText(String(str),x,y,maxWidth);else ctx.fillText(String(str),x,y);ctx.restore();}
    function drawHUD(t){
      const p=state.player,sp=currentSpec(),sceneName=state.scene==='sea'?words().sea:words().land;
      ctx.fillStyle='rgba(4,22,37,.28)';ctx.fillRect(7,5,626,40);
      text(words().title,17,15,8.5,'#c4e9e8');
      text(sceneName+' · '+words().stage+' '+String(p.level+1).padStart(2,'0')+'/09',17,32,6.5,'#8cbac7');
      const label=language==='zh'?sp.name:sp.en;
      // maxWidth 150：物种名最长者也不许压到右侧的全屏键
      text(label,158,15,9.5,'#fff3c7','left',150);
      text(language==='zh'?sp.era:sp.eraEn,158,32,6.2,'#9bc7d0');
      text(words().energy,420,12,6.2,'#a9cbd2');
      text(Math.floor(p.energy)+'/'+requiredEnergy(p.level),620,12,6.2,'#e9d59b','right');
      drawPanel(ctx,420,21,200,7,'#17384d','#54798a');
      rect(ctx,422,23,196*clamp(p.energy/requiredEnergy(p.level),0,1),3,'#eac879');
      text(words().score+' '+String(state.score).padStart(4,'0'),420,37,6.2,'rgba(220,244,240,.82)');
      text(words().time+' '+Math.floor(state.elapsed)+'s',620,37,6.2,'rgba(220,244,240,.82)','right');
      drawPauseButton();
      if(state.debugEnabled){
        const b=CONTROL.debugSlider,track=b.x2-b.x1,knob=b.x1+track*(p.level/8);
        drawPanel(ctx,174,49,322,39,'rgba(5,24,39,.94)','#d1b86e');
        text(words().debugLevel+'  '+(p.level+1)+'/09',188,59,6.2,'#f7e7ae');
        rect(ctx,b.x1,b.y-1,track,2,'#527888');
        for(let i=0;i<9;i++){const x=b.x1+track*i/8;rect(ctx,x-1,b.y-3,2,6,i<=p.level?'#f3d17c':'#638495');}
        ctx.save();ctx.fillStyle='#ffe39a';ctx.strokeStyle='#fff5ce';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(knob,b.y,5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
        text(language==='zh'?'拖动滑块切换等级':'DRAG TO SET RANK',b.x1,b.y2-2,4.8,'#a8c8cb');
      }
    }
    function drawPauseButton(){
      const b=CONTROL.pause,on=state.paused;ctx.save();
      drawPanel(ctx,b.x-b.w/2,b.y-b.h/2,b.w,b.h,on?'rgba(61,91,104,.96)':'rgba(12,37,53,.84)',on?'#f3cf79':'#587989');
      if(on){poly(ctx,[[b.x-3,b.y-4.5],[b.x+4.5,b.y],[b.x-3,b.y+4.5]],'#ffe4a1');}
      else{rect(ctx,b.x-3.5,b.y-4,2.5,8,'#9fbdc6');rect(ctx,b.x+1,b.y-4,2.5,8,'#9fbdc6');}
      ctx.restore();
    }
    function drawPauseOverlay(){
      ctx.save();
      ctx.fillStyle='rgba(3,12,20,.62)';ctx.fillRect(0,0,W,H);
      rect(ctx,320-14,152-13,4,26,'#f7e7ae');rect(ctx,320+8,152-13,4,26,'#f7e7ae');
      text(words().paused,320,190,16,'#f7e7ae','center');
      text(words().pausedHint,320,207,6.6,'#b9d8dc','center');
      ctx.restore();
    }
    function drawMusicButton(){
      const b=CONTROL.music;ctx.save();
      drawPanel(ctx,b.x-b.w/2,b.y-b.h/2,b.w,b.h,musicEnabled?'rgba(23,73,89,.95)':'rgba(12,37,53,.84)',musicEnabled?'#8edfcf':'#587989');
      text(musicEnabled?'♪':'×',b.x,b.y+1,7.6,musicEnabled?'#d4fff0':'#9fbdc6','center');ctx.restore();
    }
    // 手机端全屏键：比暂停/音乐键大一圈，图标=四角外扩/内收，下面补一行小字说明当前状态
    function drawFullscreenButton(){
      const b=CONTROL.fullscreen,on=!!state.fullscreen,ix=b.x,iy=b.y-4,s=8,k=4.2;
      ctx.save();
      drawPanel(ctx,b.x-b.w/2,b.y-b.h/2,b.w,b.h,on?'rgba(42,96,108,.96)':'rgba(15,44,62,.9)',on?'#f3cf79':'#7fc9d6');
      // 四角括号：未全屏朝外（展开），已全屏朝内（还原）
      const c=[];
      if(!on)c.push([ix-s,iy-s,1,1],[ix+s,iy-s,-1,1],[ix-s,iy+s,1,-1],[ix+s,iy+s,-1,-1]);
      else c.push([ix-k,iy-k,-1,-1],[ix+k,iy-k,1,-1],[ix-k,iy+k,-1,1],[ix+k,iy+k,1,1]);
      ctx.strokeStyle=on?'#ffe4a1':'#bdeef4';ctx.lineWidth=1.7;ctx.lineCap='square';
      c.forEach(([x,y,dx,dy])=>{ctx.beginPath();ctx.moveTo(x+dx*5,y);ctx.lineTo(x,y);ctx.lineTo(x,y+dy*5);ctx.stroke();});
      text(language==='zh'?(on?'还原':'全屏'):(on?'EXIT':'FULL'),b.x,b.y+13,5.4,on?'#ffe4a1':'#c8eef2','center');
      ctx.restore();
    }
    function drawSpeciesCards(){
      const S=CARD_STRIP;
      drawPanel(ctx,S.x,S.y,S.w,S.h,'rgba(3,18,31,.62)','#315a70');
      const list=Array.from(state.discovered[state.scene]).sort((a,b)=>a-b);
      // 9 cards start at the left edge of the strip; slot 9 holds the shield key
      list.slice(0,S.count).forEach((level,i)=>{
        const x=CARD_FIRST_X+i*S.slotW,y=311,sp=getSpecies()[level],selected=state.cardDetail===level;
        drawPanel(ctx,x,y,S.cardW,S.cardH,selected?'rgba(49,94,102,.92)':(level===state.player.level?'rgba(36,78,96,.9)':'rgba(20,47,66,.78)'),selected?'#e8d18a':(level===state.player.level?'#8ddbd5':'#34586a'));
        const rawWidth=(state.scene==='sea'?[36,64,60,42,52,50,50,70,83]:[83,157,61,123,104,178,150,117,112])[level];
        drawOrganism(ctx,level,x+10,y+19,12/rawWidth,tNow,{scene:state.scene});
        text(String(level+1).padStart(2,'0'),x+20,y+9,5.2,'#9ec5cf');
        const nm=language==='zh'?sp.short:sp.shortEn;
        text(nm.length>7?nm.slice(0,6)+'…':nm,x+19,y+31,4.7,selected?'#fff0b9':'#d5e8e3');
      });
    }
    let tNow=0;
    function drawShieldSlot(){
      const sh=CONTROL.shield,cx=sh.x,cy=sh.y-3,on=state.shieldTime>0,ready=state.shieldCD<=0;
      ctx.save();
      drawPanel(ctx,sh.x-sh.w/2,sh.y-sh.h/2,sh.w,sh.h,on?'rgba(22,78,104,.95)':(ready?'rgba(36,83,106,.92)':'rgba(37,59,74,.9)'),on?'#a8f1ff':(ready?'#72cfe3':'#526b78'));
      const k=.46;
      poly(ctx,[[cx,cy-20*k],[cx+18*k,cy-11*k],[cx+14*k,cy+9*k],[cx,cy+20*k],[cx-14*k,cy+9*k],[cx-18*k,cy-11*k]],on?'#efffff':'#b6e8ee');
      poly(ctx,[[cx,cy-12*k],[cx+10*k,cy-7*k],[cx+10*k,cy+6*k],[cx,cy+14*k],[cx-10*k,cy+6*k],[cx-10*k,cy-7*k]],'#26627c');
      if(state.shieldCD>0){ctx.strokeStyle='#f4cc79';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,10.6,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-Math.min(1,state.shieldCD/11.5)));ctx.stroke();}
      text(on?words().shieldOn:(ready?words().shieldReady:state.shieldCD.toFixed(1)),cx,sh.y+13,5.4,ready?'#c8f3ed':'#efcf88','center');
      ctx.restore();
    }
    function drawJoystick(){
      const s=CONTROL.stick,on=STICK.active;
      ctx.save();
      const g=ctx.createRadialGradient(s.x,s.y,s.r*.28,s.x,s.y,s.r);
      g.addColorStop(0,'rgba(13,48,67,.30)');g.addColorStop(1,'rgba(8,34,50,.60)');
      ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      ctx.strokeStyle=on?'#9fe7e0':'#5f8fa3';ctx.lineWidth=2.4;ctx.stroke();
      ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(s.x,s.y,s.r-11,0,Math.PI*2);ctx.strokeStyle='rgba(61,106,125,.9)';ctx.lineWidth=1;ctx.stroke();ctx.setLineDash([]);
      [[0,-1,'up'],[0,1,'down'],[-1,0,'left'],[1,0,'right']].forEach(([ux,uy,dir])=>{
        const tx=s.x+ux*(s.r-7),ty=s.y+uy*(s.r-7),lit=keys[dir];
        poly(ctx,[[tx+ux*5,ty+uy*5],[tx-uy*4.5-ux*2.5,ty+ux*4.5-uy*2.5],[tx+uy*4.5-ux*2.5,ty-ux*4.5-uy*2.5]],lit?'#effff2':'rgba(143,196,205,.5)');
      });
      const kx=s.x+STICK.dx,ky=s.y+STICK.dy;
      ctx.beginPath();ctx.arc(kx,ky,s.knob,0,Math.PI*2);ctx.fillStyle=on?'rgba(42,108,134,.96)':'rgba(29,76,98,.92)';ctx.fill();
      ctx.strokeStyle=on?'#bdf3ec':'#a8ece6';ctx.lineWidth=2.4;ctx.stroke();
      ctx.beginPath();ctx.arc(kx,ky,s.knob*.45,0,Math.PI*2);ctx.fillStyle='rgba(45,107,131,.9)';ctx.fill();
      ctx.restore();
    }
    function drawControls(){drawShieldSlot();drawJoystick();}
    function drawShoreMarker(t){
      const p=state.player;
      if(state.scene!=='sea'||p.level!==8||p.energy<requiredEnergy(8))return;
      if(state.transition||state.over||state.won)return;
      const pulse=.55+.45*Math.sin(t*3.6);
      ctx.save();ctx.globalAlpha=.3+.5*pulse;
      ctx.strokeStyle='#f2d489';ctx.lineWidth=2.2;ctx.setLineDash([6,4]);ctx.beginPath();ctx.moveTo(631,52);ctx.lineTo(631,198);ctx.stroke();ctx.setLineDash([]);
      poly(ctx,[[637,116],[625,106],[625,126]],'#ffdf9b');
      ctx.globalAlpha=.5+.4*pulse;text(language==='zh'?'上岸':'LAND',616,144,7.2,'#ffdf9b','center');
      ctx.restore();
    }
    function drawCardDetail(){
      if(state.cardDetail===null)return;
      const level=state.cardDetail,sp=getSpecies()[level];if(!sp)return;
      ctx.save();ctx.fillStyle='rgba(1,9,18,.68)';ctx.fillRect(0,0,W,H);drawPanel(ctx,118,91,404,160,'#102e40','#a4c5c2');
      drawOrganism(ctx,level,165,166,0.72*visualScale(level,state.scene),tNow,{scene:state.scene,glow:true});
      const name=language==='zh'?sp.name:sp.en,era=language==='zh'?sp.era:sp.eraEn,desc=language==='zh'?sp.description:sp.descriptionEn;
      text(String(level+1).padStart(2,'0')+' / 09',210,115,8,'#9ccbd0');text(name,210,139,13,'#fff0bd');text(era,210,159,8,'#93bdc4');
      const lines=wrapText(desc,32);lines.slice(0,3).forEach((line,i)=>text(line,210,181+i*15,8,'#d4e7dc'));
      drawPanel(ctx,482,101,28,22,'#315a70','#9ac8c7');text('×',496,112,12,'#fff4d2','center');ctx.restore();
    }
    function wrapText(str,max){const arr=[];let line='';for(const ch of String(str)){if(line.length>=max){arr.push(line);line='';}line+=ch;}if(line)arr.push(line);return arr;}
    function drawToast(){if(state.toastTime<=0||!state.toast||state.over||state.won)return;const y=state.debugEnabled?98:61;ctx.save();ctx.globalAlpha=Math.min(1,state.toastTime*1.6);drawPanel(ctx,166,y,308,22,'rgba(5,27,43,.78)','#47788b');text(state.toast,320,y+11,7.8,'#fff0bd','center');ctx.restore();}
    function drawEndScreen(){
      ctx.fillStyle='rgba(2,12,23,.78)';ctx.fillRect(0,0,W,H);drawPanel(ctx,145,102,350,158,'#0b293d','#7d9eaa');
      text(state.won?words().win:words().gameOver,320,133,15,state.won?'#c5f4cf':'#ffb39a','center');
      text(state.won?(language==='zh'?'你穿越海洋、陆地与大气层，最终消失在黑洞深处。':'You crossed the sea, land and atmosphere, then vanished into a distant black hole.'):words().eaten,320,163,8.5,'#e4f1ed','center');
      text(words().final+'：'+(language==='zh'?currentSpec().name:currentSpec().en),320,188,8,'#b1d2d7','center');
      drawPanel(ctx,CONTROL.restart.x-CONTROL.restart.w/2,CONTROL.restart.y-CONTROL.restart.h/2,CONTROL.restart.w,CONTROL.restart.h,'#286077','#a4e8e7');text(words().restart,CONTROL.restart.x,CONTROL.restart.y,9,'#fff4ca','center');
    }
    function render(t){
      tNow=t;ctx.imageSmoothingEnabled=false;drawBackground(t);
      const cinematic=!!(state.transition&&state.transition.kind==='space')||state.endingComplete;
      if(!cinematic){state.entities.forEach(e=>drawEntity(e,t));}
      drawPlayer(t);
      if(!cinematic){
        state.particles.forEach(q=>{ctx.save();ctx.globalAlpha=clamp(q.life/q.max,0,1);rect(ctx,q.x,q.y,q.size,q.size,q.color);ctx.restore();});
        drawHUD(t);drawSpeciesCards();drawControls();drawMusicButton();drawShoreMarker(t);drawToast();
        state.popups.forEach(q=>{ctx.save();ctx.globalAlpha=clamp(q.life/q.max,0,1);text(q.label,q.x,q.y,8.5,q.color,'center');ctx.restore();});
        drawCardDetail();
      }else if(state.transition&&state.transition.kind==='space')drawSpaceCaption(state.transition);
      if(state.flash>0&&!cinematic){ctx.save();ctx.globalAlpha=state.flash*.3;ctx.fillStyle='#e6fff1';ctx.fillRect(0,0,W,H);ctx.restore();}
      if(state.paused&&!cinematic)drawPauseOverlay();
      if(state.over||state.won)drawEndScreen();
      // 全屏键画在最上层：暂停/结算覆盖层上也保持可见、可点
      if(!cinematic)drawFullscreenButton();
    }

    function playTone(freq,when,duration,volume,type){
      if(!audioCtx||!musicEnabled||!freq)return;
      const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();
      osc.type=type||'triangle';osc.frequency.setValueAtTime(freq,when);
      gain.gain.setValueAtTime(.0001,when);gain.gain.linearRampToValueAtTime(volume||.025,when+.025);gain.gain.exponentialRampToValueAtTime(.0001,when+duration);
      osc.connect(gain);gain.connect(audioCtx.destination);osc.start(when);osc.stop(when+duration+.03);
    }
    function ensureAudio(){
      if(!musicEnabled)return;
      try{if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audioCtx=new AC();musicNext=audioCtx.currentTime+.05;}if(audioCtx.state==='suspended')audioCtx.resume();}catch(_){/* audio is an optional enhancement */}
    }
    const music={sea:[146.83,174.61,220,196,130.81,164.81,196,174.61,146.83,196,220,261.63],land:[261.63,293.66,329.63,392,349.23,329.63,293.66,261.63,392,440,392,329.63],space:[110,164.81,220,261.63,196,146.83,174.61,130.81,110,164.81,246.94,293.66]};
    function updateMusic(){
      if(!musicEnabled||!audioCtx||audioCtx.state!=='running')return;
      const musicKey=state.finalBlackHole||(state.transition&&state.transition.kind==='space')?'space':state.scene;
      if(musicScene!==musicKey){musicScene=musicKey;musicStep=0;musicNext=audioCtx.currentTime+.05;}
      const seq=music[musicKey];
      while(musicNext<audioCtx.currentTime+.35){const f=seq[musicStep%seq.length],when=musicNext;
        playTone(f,when,.34,.018,state.scene==='sea'?'sine':'triangle');
        if(musicStep%3===0)playTone(f/2,when,.55,.009,'sine');
        musicStep++;musicNext+=state.scene==='sea'?.34:.29;
      }
    }
    function setLanguage(value){
      const v=String(value||'').toLowerCase();language=(v==='en'||v.startsWith('en-')||v==='english')?'en':'zh';
      canvas.setAttribute('aria-label',language==='zh'?'生命进化史游戏画面':'Life Evolution game canvas');
      return language;
    }
    function onLanguageEvent(ev){const d=ev&&ev.detail;setLanguage((d&&typeof d==='object'&&(d.language||d.lang||d.locale))||d||document.documentElement.lang);}
    function setMusicEnabled(on){musicEnabled=!!on;if(!musicEnabled&&audioCtx){musicNext=0;}else ensureAudio();return musicEnabled;}
    function frame(now){if(destroyed)return;const dt=lastTime?Math.min(.033,(now-lastTime)/1000):.016;lastTime=now;if(!state.over&&!state.won&&!state.paused)update(dt);if(!state.paused)updateMusic();render(now/1000);raf=requestAnimationFrame(frame);}
    function pointFromEvent(ev){const r=canvas.getBoundingClientRect();return{x:(ev.clientX-r.left)*W/r.width,y:(ev.clientY-r.top)*H/r.height};}
    function inRect(p,b){return p.x>=b.x-b.w/2&&p.x<=b.x+b.w/2&&p.y>=b.y-b.h/2&&p.y<=b.y+b.h/2;}
    function stickHit(q){const s=CONTROL.stick;return Math.hypot(q.x-s.x,q.y-s.y)<=s.r+8;}
    function hitBox(q,b,pad){const px=pad||0;return q.x>=b.x-b.w/2-px&&q.x<=b.x+b.w/2+px&&q.y>=b.y-b.h/2-px&&q.y<=b.y+b.h/2+px;}
    function updateStick(q){
      const s=CONTROL.stick;let dx=q.x-s.x,dy=q.y-s.y;const len=Math.hypot(dx,dy)||0,max=s.r-s.knob*.5;
      if(len>max){dx=dx/len*max;dy=dy/len*max;}
      STICK.dx=dx;STICK.dy=dy;
      const t=Math.max(7,s.r*.22),live=Math.hypot(dx,dy)>=14;
      keys.left=live&&dx<-t;keys.right=live&&dx>t;keys.up=live&&dy<-t;keys.down=live&&dy>t;
    }
    function releaseStick(){STICK.active=false;STICK.id=null;STICK.dx=0;STICK.dy=0;clearKeys();}
    function pointerDown(ev){
      ev.preventDefault();ensureAudio();const q=pointFromEvent(ev);if(canvas.setPointerCapture)canvas.setPointerCapture(ev.pointerId);
      if(hitBox(q,CONTROL.fullscreen,4)){toggleFullscreen();return;}
      if(state.over||state.won){if(inRect(q,CONTROL.restart))reset();return;}
      if(hitBox(q,CONTROL.pause,6)){togglePause();return;}
      if(hitBox(q,CONTROL.music,7)){setMusicEnabled(!musicEnabled);return;}
      if(state.paused)return;
      if(state.debugEnabled&&q.x>=CONTROL.debugSlider.x1-12&&q.x<=CONTROL.debugSlider.x2+12&&q.y>=CONTROL.debugSlider.y1&&q.y<=CONTROL.debugSlider.y2){state.debugDragging=true;updateDebugSlider(q.x);return;}
      if(state.cardDetail!==null){if(q.x>=480&&q.y<=130||q.y<90||q.y>253){state.cardDetail=null;}return;}
      if(inRect(q,CONTROL.shield)){activateShield();return;}
      if(q.y>=311&&q.y<=352&&q.x>=8&&q.x<=480){const list=Array.from(state.discovered[state.scene]).sort((a,b)=>a-b);const idx=Math.floor((q.x-CARD_FIRST_X)/CARD_STRIP.slotW);if(idx>=0&&idx<list.length)state.cardDetail=list[idx];return;}
      if(stickHit(q)){STICK.active=true;STICK.id=ev.pointerId;updateStick(q);return;}
      if(q.y<307){const dx=q.x-state.player.x,dy=q.y-state.player.y;clearKeys();if(Math.abs(dx)>12)keys[dx>0?'right':'left']=true;if(Math.abs(dy)>12)keys[dy>0?'down':'up']=true;}
    }
    function pointerMove(ev){
      const draggingStick=STICK.active&&ev.pointerId===STICK.id;
      if(!state.debugDragging&&!draggingStick)return;
      const q=pointFromEvent(ev);
      if(state.debugDragging){updateDebugSlider(q.x);return;}
      updateStick(q);
    }
    function pointerUp(ev){
      if(STICK.active){if(!ev||STICK.id===null||ev.pointerId===STICK.id)releaseStick();}
      else clearKeys();
      state.debugDragging=false;
      if(ev&&canvas.releasePointerCapture&&canvas.hasPointerCapture&&canvas.hasPointerCapture(ev.pointerId)){try{canvas.releasePointerCapture(ev.pointerId);}catch(_){}}
    }
    const keyMap={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
    function keyDown(ev){ensureAudio();if(ev.shiftKey&&(ev.key==='p'||ev.key==='P')){togglePause();ev.preventDefault();return;}if(ev.shiftKey&&(ev.key==='d'||ev.key==='D')){setDebugEnabled(!state.debugEnabled);ev.preventDefault();return;}if(keyMap[ev.key]){keys[keyMap[ev.key]]=true;ev.preventDefault();}if(ev.code==='Space'){activateShield();ev.preventDefault();}if((state.over||state.won)&&(ev.key==='Enter'||ev.code==='Space'))reset();}
    function keyUp(ev){if(keyMap[ev.key])keys[keyMap[ev.key]]=false;}
    function onRootLangChange(){const attr=root.getAttribute('lang')||root.getAttribute('data-language');if(attr)setLanguage(attr);else if(document.documentElement.lang)setLanguage(document.documentElement.lang);}
    const observer=typeof MutationObserver!=='undefined'?new MutationObserver(onRootLangChange):null;
    if(observer){observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});observer.observe(root,{attributes:true,attributeFilter:['lang','data-language']});}
    window.addEventListener('app-language-change',onLanguageEvent);window.addEventListener('app:languagechange',onLanguageEvent);document.addEventListener('app-language-change',onLanguageEvent);
    window.addEventListener('languagechange',onRootLangChange);canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('lostpointercapture',pointerUp);
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',clearKeys);
    setLanguage(language);reset();raf=requestAnimationFrame(frame);
    return {
      destroy(){destroyed=true;cancelAnimationFrame(raf);if(observer)observer.disconnect();window.removeEventListener('app-language-change',onLanguageEvent);window.removeEventListener('app:languagechange',onLanguageEvent);document.removeEventListener('app-language-change',onLanguageEvent);window.removeEventListener('languagechange',onRootLangChange);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('lostpointercapture',pointerUp);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',clearKeys);if(audioCtx){audioCtx.close();audioCtx=null;}},
      restart:reset,getState(){return state;},setLanguage,setMusicEnabled,setDebugEnabled,setDebugLevel,
      setPaused,togglePause,isPaused(){return !!state.paused;},setStartLevel,getStartLevel(){return startLevel;},getStartEnergy(){return startEnergy;},
      toggleFullscreen,setFullscreenState,isFullscreen(){return !!state.fullscreen;},
      setFullscreenHandler(fn){fullscreenRequest=typeof fn==='function'?fn:null;return !!fullscreenRequest;},
      getLanguage(){return language;},getSpecies(){return getSpecies();}
    };
  }

  global.EvolutionGame = { mount, SPECIES:SEA_SPECIES, LAND_SPECIES, drawOrganism, chooseOrganismLevel, requiredEnergy(level,scene){return Math.round(8*Math.pow(scene==='land'?1.61:1.58,level));} };
})(window);
