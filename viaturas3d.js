// Viaturas da OuroTran em 3D: modelos estilizados montados no próprio Three.js (sem arquivos .glb),
// com a plotagem oficial pintada em canvas: amarelo-limão, faixas em onda, xadrez, brasão, prefixo e "118".
// A placa e o prefixo vêm do banco e são desenhados na hora — nenhuma placa fica escrita neste arquivo.
(function() {
  'use strict';
  var URL_THREE = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
  var URL_ORBIT = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
  var COR = { lima: '#cfe31d', preto: '#141414', branco: '#f5f5f0', vidroAlto: '#33434e', vidroBaixo: '#0f1519', borracha: '#1a1a1a', roda: '#2c2e31', vermelho: '#d3221c', farol: '#e9eef2' };

  // ---------- carregamento sob demanda (só quando a aba abre) ----------
  var carregando = null, brasao = null;
  function script(src) {
    return new Promise(function(ok, erro) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
  }
  function preparar() {
    if (!carregando) {
      var img = new Promise(function(ok) { var i = new Image(); i.onload = function() { brasao = i; ok(); }; i.onerror = function() { ok(); }; i.src = 'brasao-ourotran.png'; });
      carregando = Promise.all([script(URL_THREE).then(function() { return script(URL_ORBIT); }), img]);
      carregando.catch(function() { carregando = null; });
    }
    return carregando;
  }
  function temWebGL() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; }
  }

  // ---------- formas dos carros (vista lateral, em metros: x = comprimento com a frente em +x, y = altura) ----------
  // assoalho de trás para frente, subindo em arco sobre cada roda
  function assoalho(s, sp) {
    [sp.xr, sp.xf].forEach(function(x) {
      s.lineTo(x - sp.R, sp.yb); s.lineTo(x - sp.R, sp.r);
      s.absarc(x, sp.r, sp.R, Math.PI, 0, true);
      s.lineTo(x + sp.R, sp.yb);
    });
  }
  function picape(sp, xParabrisa, frenteCapo) {
    var h = sp.L / 2, s = new THREE.Shape();
    s.moveTo(-h + 0.06, sp.yb);
    assoalho(s, sp);
    s.lineTo(h - 0.06, sp.yb);
    s.quadraticCurveTo(h + 0.01, sp.yb + 0.06, h, 0.55);
    s.lineTo(h, 0.95);
    s.quadraticCurveTo(h - 0.01, 1.06, h - 0.25, 1.08);
    s.quadraticCurveTo(frenteCapo, 1.12, xParabrisa, 1.17);
    s.lineTo(-h + 0.05, 1.2);
    s.lineTo(-h, 1.12);
    s.lineTo(-h, 0.45);
    s.quadraticCurveTo(-h, sp.yb + 0.02, -h + 0.06, sp.yb);
    return s;
  }
  function cabine(pts) {
    var c = new THREE.Shape(); c.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(function(p) { c.lineTo(p[0], p[1]); });
    c.lineTo(pts[0][0], pts[0][1]);
    return c;
  }

  var MODELOS = {
    POLO: function() {
      var sp = { L: 4.07, W: 1.75, Wc: 1.46, r: 0.31, R: 0.38, yb: 0.17, xf: 1.215, xr: -1.345 };
      var h = sp.L / 2, s = new THREE.Shape();
      s.moveTo(-h + 0.07, sp.yb);
      assoalho(s, sp);
      s.lineTo(h - 0.06, sp.yb + 0.02);
      s.quadraticCurveTo(h + 0.01, sp.yb + 0.1, h, 0.45);
      s.lineTo(h - 0.01, 0.62);
      s.quadraticCurveTo(h - 0.02, 0.77, h - 0.3, 0.81);
      s.quadraticCurveTo(1.05, 0.87, 0.6, 0.93);
      s.lineTo(-1.55, 1.0);
      s.quadraticCurveTo(-h + 0.02, 1.0, -h + 0.01, 0.86);
      s.lineTo(-h, 0.4);
      s.quadraticCurveTo(-h, sp.yb + 0.02, -h + 0.07, sp.yb);
      sp.baixo = s;
      sp.cabine = cabine([[0.62, 0.89], [-0.2, 1.4], [-0.6, 1.465], [-1.0, 1.46], [-1.5, 1.43], [-1.94, 1.02], [-1.94, 0.93]]);
      sp.parabrisa = [[0.62, 0.89], [-0.2, 1.4]];
      sp.vidroTras = [[-1.5, 1.43], [-1.94, 1.02]];
      sp.cintura = function(x) { return 0.93 + Math.min(Math.max((0.6 - x) / 2.15, 0), 1) * 0.07; };
      sp.xA = 0.6; sp.portas = [0.52, -0.42, -1.18]; sp.xB = -0.42; sp.xC = -1.18; sp.xTras = -1.94;
      sp.logoX = -0.8; sp.xadrez = [-1.12, -0.47]; sp.tetoY = 1.465; sp.giroflexX = -0.55;
      sp.placaFrente = 0.36; sp.placaTras = 0.6; sp.farolY = 0.7; sp.lanternaY = 0.88;
      return sp;
    },
    S10_CABINE_SIMPLES: function() {
      var sp = { L: 5.2, W: 1.87, Wc: 1.66, r: 0.39, R: 0.47, yb: 0.3, xf: 1.68, xr: -1.42 };
      sp.baixo = picape(sp, 1.0, 1.6);
      sp.cabine = cabine([[1.03, 1.13], [0.28, 1.78], [-0.42, 1.8], [-0.55, 1.76], [-0.58, 1.14]]);
      sp.parabrisa = [[1.03, 1.13], [0.28, 1.78]];
      sp.vidroTras = [[-0.55, 1.76], [-0.58, 1.14]];
      sp.cintura = function(x) { return 1.17 + Math.min(Math.max((1.0 - x) / 3.55, 0), 1) * 0.03; };
      sp.xA = 1.0; sp.portas = [0.95, -0.28]; sp.xB = -0.28; sp.xC = -0.28; sp.xTras = -0.58;
      sp.logoX = 0.32; sp.xadrez = [-0.24, 0.62]; sp.tetoY = 1.8; sp.giroflexX = -0.08;
      sp.placaFrente = 0.45; sp.placaTras = 0.64; sp.farolY = 0.92; sp.lanternaY = 0.96;
      sp.cacamba = [-0.64, -sp.L / 2 + 0.06, 1.19];
      return sp;
    },
    S10: function() {
      var sp = { L: 5.36, W: 1.87, Wc: 1.66, r: 0.39, R: 0.47, yb: 0.3, xf: 1.76, xr: -1.34 };
      sp.baixo = picape(sp, 1.08, 1.68);
      sp.cabine = cabine([[1.11, 1.13], [0.36, 1.78], [-1.25, 1.8], [-1.38, 1.76], [-1.41, 1.14]]);
      sp.parabrisa = [[1.11, 1.13], [0.36, 1.78]];
      sp.vidroTras = [[-1.38, 1.76], [-1.41, 1.14]];
      sp.cintura = function(x) { return 1.17 + Math.min(Math.max((1.08 - x) / 3.71, 0), 1) * 0.03; };
      sp.xA = 1.08; sp.portas = [1.03, -0.12, -1.0]; sp.xB = -0.12; sp.xC = -1.0; sp.xTras = -1.41;
      sp.logoX = -0.56; sp.xadrez = [-0.96, -0.16]; sp.tetoY = 1.8; sp.giroflexX = -0.35;
      sp.placaFrente = 0.45; sp.placaTras = 0.64; sp.farolY = 0.92; sp.lanternaY = 0.96;
      sp.cacamba = [-1.47, -sp.L / 2 + 0.06, 1.19];
      return sp;
    }
  };

  // ---------- plotagem (pintada em canvas no mesmo sistema de metros da forma) ----------
  function caminho(g, forma) {
    var pts = forma.getPoints(24);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
  }
  function lim(t) { return Math.min(Math.max(t, 0), 1); }
  function suave(t) { t = lim(t); return t * t * (3 - 2 * t); }
  // texto e imagens "desviram" o eixo y do canvas; no lado esquerdo do carro também desespelham o x
  function local(g, x, y, k, espelho, fn) {
    g.save(); g.translate(x, y); g.scale((espelho ? -1 : 1) * k, -k); fn(); g.restore();
  }
  function texto(g, txt, x, y, alt, espelho) {
    local(g, x, y, alt / 100, espelho, function() {
      g.font = 'bold 100px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = COR.preto; g.fillText(txt, 0, 0);
    });
  }

  function pintarLateral(sp, v, espelho) {
    var h = sp.L / 2, b = { x0: -h - 0.05, w: sp.L + 0.1, y0: 0, h: sp.tetoY + 0.1 };
    var esc = 2048 / b.w, cv = document.createElement('canvas');
    cv.width = 2048; cv.height = Math.round(b.h * esc);
    var g = cv.getContext('2d');
    g.setTransform(esc, 0, 0, -esc, -b.x0 * esc, (b.y0 + b.h) * esc);
    var soleira = sp.yb + 0.06, cintRef = sp.cintura(sp.xB), k = (cintRef - soleira) / 0.75;

    g.fillStyle = COR.lima; g.fillRect(b.x0, b.y0, b.w, b.h);

    // vidros e colunas (só dentro da cabine)
    g.save(); caminho(g, sp.cabine); g.clip();
    var grad = g.createLinearGradient(0, sp.tetoY, 0, cintRef);
    grad.addColorStop(0, COR.vidroAlto); grad.addColorStop(1, COR.vidroBaixo);
    g.fillStyle = grad; g.fillRect(b.x0, cintRef - 0.1, b.w, b.h);
    caminho(g, sp.cabine); g.strokeStyle = COR.lima; g.lineWidth = 0.1; g.stroke();
    g.beginPath(); g.moveTo(sp.parabrisa[0][0], sp.parabrisa[0][1]); g.lineTo(sp.parabrisa[1][0], sp.parabrisa[1][1]);
    g.strokeStyle = COR.preto; g.lineWidth = 0.11; g.stroke();
    g.fillStyle = COR.preto; g.fillRect(sp.xB - 0.045, 0, 0.09, b.h);
    if (sp.xC !== sp.xB) g.fillRect(sp.xC - 0.03, 0, 0.06, b.h);
    g.restore();

    // faixas em onda: nascem altas na traseira, descem pela lateral e afinam no para-lama dianteiro
    var xIni = -h, xFim = h - 0.12;
    var yTras = sp.cintura(-h + 0.3) - 0.14 * k, yMeio = soleira + (cintRef - soleira) * 0.36, yFrente = sp.farolY - 0.03;
    function cx(t) { return xIni + t * (xFim - xIni); }
    function cy(t) { return yTras + (yMeio - yTras) * suave(t / 0.28) + (yFrente - yMeio) * suave((t - 0.76) / 0.24); }
    function afina(t) { return 1 - 0.88 * suave((t - 0.7) / 0.3); }
    function tDe(x) { return lim((x - xIni) / (xFim - xIni)); }
    function faixa(baixo, alto, cor) {
      var n = 60, i, t;
      g.beginPath();
      for (i = 0; i <= n; i++) { t = i / n; g.lineTo(cx(t), cy(t) + alto * k * afina(t)); }
      for (i = n; i >= 0; i--) { t = i / n; g.lineTo(cx(t), cy(t) + baixo * k * afina(t)); }
      g.closePath(); g.fillStyle = cor; g.fill();
    }
    // painel branco da coluna traseira, que desce até a faixa
    g.beginPath(); g.moveTo(b.x0, b.h); g.lineTo(sp.xC, b.h);
    for (var x = sp.xC; x >= xIni; x -= 0.02) { var t = tDe(x); g.lineTo(x, cy(t) + 0.2 * k * afina(t)); }
    g.lineTo(b.x0, cy(0) + 0.2 * k); g.closePath(); g.fillStyle = COR.branco; g.fill();
    faixa(0.06, 0.2, COR.branco);
    faixa(-0.06, 0.06, COR.preto);
    faixa(-0.14, -0.06, COR.branco);
    faixa(-0.185, -0.155, COR.preto);
    // traço preto que desce da coluna traseira e entra na faixa
    g.beginPath(); g.moveTo(sp.xC - 0.04, sp.cintura(sp.xC) + 0.26);
    g.quadraticCurveTo(sp.xC - 0.22, sp.cintura(sp.xC) - 0.06, cx(0.2), cy(0.2) + 0.02);
    g.strokeStyle = COR.preto; g.lineWidth = 0.075 * k; g.lineCap = 'round'; g.stroke();

    // xadrez preto e branco (2 fileiras) logo abaixo das janelas
    var q = 0.055 * k;
    for (var lin = 0; lin < 2; lin++) {
      for (var i = 0, xq = sp.xadrez[0]; xq < sp.xadrez[1] - 0.001; i++, xq += q) {
        g.fillStyle = (i + lin) % 2 ? COR.branco : COR.preto;
        g.fillRect(xq, sp.cintura(xq) - 0.035 - (lin + 1) * q, Math.min(q, sp.xadrez[1] - xq), q);
      }
    }

    // soleira, para-choques e luzes vistas de lado
    g.fillStyle = COR.preto;
    g.fillRect(-h, sp.yb - 0.05, sp.L, 0.1);
    g.fillRect(h - 0.28, sp.yb - 0.05, 0.3, 0.19);
    g.fillRect(-h - 0.02, sp.yb - 0.05, 0.28, 0.2);
    g.fillStyle = COR.vermelho; g.fillRect(-h - 0.02, sp.lanternaY - 0.08, 0.12, 0.15);
    g.fillStyle = COR.farol; g.fillRect(h - 0.2, sp.farolY - 0.04, 0.22, 0.08);

    // vãos das portas e maçanetas
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 0.008;
    sp.portas.forEach(function(xp) { g.beginPath(); g.moveTo(xp, soleira + 0.02); g.lineTo(xp, sp.cintura(xp)); g.stroke(); });
    g.fillStyle = 'rgba(0,0,0,.7)';
    for (var p = 0; p < sp.portas.length - 1; p++) {
      var xm = sp.portas[p + 1] + 0.12;
      g.fillRect(xm, sp.cintura(xm) - 0.15, 0.14, 0.03);
    }

    // "118" com telefone na coluna traseira
    var xc = (sp.xC + sp.xTras) / 2, yc = sp.cintura(sp.xC) + 0.17;
    var alt = Math.min(0.09, Math.abs(sp.xTras - sp.xC) * 0.27), lado = espelho ? -1 : 1;
    texto(g, '118', xc - lado * alt * 0.45, yc, alt, espelho);
    g.beginPath(); g.arc(xc + lado * alt * 1.35, yc, alt * 0.38, Math.PI * 0.6, Math.PI * 1.9);
    g.strokeStyle = COR.preto; g.lineWidth = alt * 0.22; g.lineCap = 'round'; g.stroke();

    // brasão da OuroTran na porta
    if (brasao) {
      var bh = 0.44 * k, bw = bh * brasao.width / brasao.height;
      local(g, sp.logoX, soleira + (cintRef - soleira) * 0.42, 1, espelho, function() { g.drawImage(brasao, -bw / 2, -bh / 2, bw, bh); });
    }
    // prefixo da viatura no para-lama dianteiro
    if (v.prefixo) texto(g, String(v.prefixo).toUpperCase(), sp.xf + 0.02, sp.cintura(sp.xf) - 0.11, 0.075, espelho);

    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.repeat.set(1 / b.w, 1 / b.h);
    tex.offset.set(-b.x0 / b.w, -b.y0 / b.h);
    return tex;
  }

  // placa Mercosul desenhada com o texto que vem do banco
  function texturaPlaca(placa) {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 166;
    var g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 166);
    g.fillStyle = '#0a3d9c'; g.fillRect(0, 0, 512, 36);
    g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BRASIL', 256, 19);
    g.fillStyle = '#1d9a3c'; g.fillRect(452, 8, 34, 22);
    g.fillStyle = '#f5d000'; g.beginPath(); g.moveTo(469, 10); g.lineTo(484, 19); g.lineTo(469, 28); g.lineTo(454, 19); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 96px "Arial Black", Arial, sans-serif'; g.fillText(String(placa || '').toUpperCase(), 256, 104);
    g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 158);
    var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // ---------- montagem do carro ----------
  function cor(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function mat(hex, o) {
    var p = { color: cor(hex), metalness: 0.25, roughness: 0.4 };
    for (var k in o) p[k] = o[k];
    if (p.emissive) p.emissive = cor(p.emissive);
    return new THREE.MeshStandardMaterial(p);
  }
  function caixa(grupo, sx, sy, sz, x, y, z, m) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m);
    mesh.position.set(x, y, z); mesh.castShadow = true; grupo.add(mesh);
    return mesh;
  }
  // estreita a largura nas pontas (frente e traseira arredondadas) e no alto da cabine,
  // para o carro não parecer uma caixa; f(x, y) = fração da largura naquele ponto
  function deformar(geo, f, zFixo) {
    var p = geo.attributes.position;
    for (var i = 0; i < p.count; i++) {
      var x = p.getX(i), y = p.getY(i);
      p.setZ(i, (zFixo === undefined ? p.getZ(i) : zFixo) * f(x, y));
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  }
  function extrudar(forma, largura, chanfro, f, m) {
    var prof = largura - 2 * chanfro;
    var geo = new THREE.ExtrudeGeometry(forma, { depth: prof, bevelEnabled: true, bevelThickness: chanfro, bevelSize: chanfro * 0.8, bevelSegments: 3, curveSegments: 24 });
    geo.translate(0, 0, -prof / 2);
    deformar(geo, f);
    var mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  // a plotagem fica numa película colada em cada lateral; a do lado esquerdo é espelhada
  function pelicula(grupo, forma, largura, f, texDir, texEsq) {
    var geo = new THREE.ShapeGeometry(forma, 24);
    deformar(geo, f, largura / 2 + 0.003);
    [[texDir, 1], [texEsq, -1]].forEach(function(par) {
      var m = new THREE.MeshStandardMaterial({ map: par[0], metalness: 0.25, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
      var mesh = new THREE.Mesh(geo, m);
      mesh.scale.z = par[1];
      grupo.add(mesh);
    });
  }
  function vidro(grupo, seg, largura, folga, m) {
    var dx = seg[1][0] - seg[0][0], dy = seg[1][1] - seg[0][1], comp = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    var nx = -dy / comp, ny = dx / comp;
    if (ny < 0) { nx = -nx; ny = -ny; }
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(comp, 0.012, largura), m);
    mesh.position.set((seg[0][0] + seg[1][0]) / 2 + nx * folga, (seg[0][1] + seg[1][1]) / 2 + ny * folga, 0);
    mesh.rotation.z = ang;
    grupo.add(mesh);
  }

  function montarCarro(v) {
    var sp = (MODELOS[v.tipo] || MODELOS.POLO)();
    var h = sp.L / 2, carro = new THREE.Group();
    var M = {
      lataria: mat(COR.lima, { metalness: 0.3, roughness: 0.35 }),
      preto: mat(COR.preto, { roughness: 0.6 }),
      vidro: mat('#0c1216', { metalness: 0.6, roughness: 0.08 }),
      borracha: mat(COR.borracha, { metalness: 0, roughness: 0.9 }),
      roda: mat(COR.roda, { metalness: 0.6, roughness: 0.35 }),
      farol: mat(COR.farol, { emissive: '#8a9096', roughness: 0.1 }),
      lanterna: mat(COR.vermelho, { emissive: '#5a0806', roughness: 0.2 }),
      giroflex: mat('#ff2a1f', { emissive: '#c4120a', roughness: 0.2, transparent: true, opacity: 0.92 })
    };
    var dir = pintarLateral(sp, v, false), esq = pintarLateral(sp, v, true);

    var pontas = function(x) { return 1 - 0.11 * suave((x - (h - 0.5)) / 0.5) - 0.07 * suave((-x - (h - 0.4)) / 0.4); };
    var yBase = sp.cintura(sp.xB) - 0.05;
    var fCab = function(x, y) { return pontas(x) * (1 - 0.13 * lim((y - yBase) / (sp.tetoY - yBase))); };
    carro.add(extrudar(sp.baixo, sp.W, 0.06, pontas, M.lataria));
    carro.add(extrudar(sp.cabine, sp.Wc, 0.05, fCab, M.lataria));
    pelicula(carro, sp.baixo, sp.W, pontas, dir, esq);
    pelicula(carro, sp.cabine, sp.Wc, fCab, dir, esq);
    vidro(carro, sp.parabrisa, sp.Wc * 0.82, 0.05, M.vidro);
    vidro(carro, sp.vidroTras, sp.Wc * 0.82, 0.05, M.vidro);

    // rodas, com a caixa de roda escura atrás
    [sp.xf, sp.xr].forEach(function(x) {
      var caixaRoda = new THREE.Mesh(new THREE.CylinderGeometry(sp.R * 0.97, sp.R * 0.97, sp.W - 0.28, 24), M.preto);
      caixaRoda.rotation.x = Math.PI / 2; caixaRoda.position.set(x, sp.r, 0); carro.add(caixaRoda);
      [-1, 1].forEach(function(lado) {
        var roda = new THREE.Group();
        var pneu = new THREE.Mesh(new THREE.CylinderGeometry(sp.r, sp.r, 0.22, 36), M.borracha);
        var aro = new THREE.Mesh(new THREE.CylinderGeometry(sp.r * 0.64, sp.r * 0.64, 0.226, 30), M.roda);
        pneu.castShadow = true; roda.add(pneu); roda.add(aro);
        for (var i = 0; i < 6; i++) {
          var raio = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.232, sp.r * 1.1), M.preto);
          raio.rotation.y = i * Math.PI / 3; roda.add(raio);
        }
        roda.rotation.x = Math.PI / 2;
        roda.position.set(x, sp.r, lado * (sp.W / 2 - 0.12));
        carro.add(roda);
      });
    });

    // frente e traseira (o chanfro da lataria avança uns 5 cm além do desenho lateral)
    var W = sp.W, fr = h + 0.048, tr = -h - 0.048;
    caixa(carro, 0.04, 0.22, W * 0.6, fr + 0.005, sp.farolY - 0.2, 0, M.preto);
    caixa(carro, 0.06, 0.15, W * 0.84, fr, sp.yb + 0.09, 0, M.preto);
    caixa(carro, 0.06, 0.16, W * 0.86, tr, sp.yb + 0.12, 0, M.preto);
    [-1, 1].forEach(function(lado) {
      caixa(carro, 0.06, 0.11, W * 0.22, fr - 0.02, sp.farolY, lado * W * 0.3, M.farol);
      caixa(carro, 0.05, 0.14, W * 0.2, tr + 0.01, sp.lanternaY, lado * W * 0.34, M.lanterna);
      caixa(carro, 0.1, 0.09, 0.16, sp.xA - 0.1, sp.cintura(sp.xA) + 0.08, lado * (sp.Wc / 2 + 0.12), M.preto);
    });
    var placaMat = new THREE.MeshStandardMaterial({ map: texturaPlaca(v.placa), roughness: 0.5 });
    [[fr + 0.04, sp.placaFrente, Math.PI / 2], [tr - 0.04, sp.placaTras, -Math.PI / 2]].forEach(function(p) {
      var placa = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.13), placaMat);
      placa.position.set(p[0], p[1], 0); placa.rotation.y = p[2]; carro.add(placa);
    });

    // giroflex no teto
    caixa(carro, 0.32, 0.04, sp.Wc * 0.74, sp.giroflexX, sp.tetoY + 0.03, 0, M.preto);
    caixa(carro, 0.26, 0.07, sp.Wc * 0.7, sp.giroflexX, sp.tetoY + 0.085, 0, M.giroflex);

    // caçamba das picapes, com capota preta
    if (sp.cacamba) {
      var c = sp.cacamba, comp = c[0] - c[1];
      caixa(carro, comp, 0.03, W - 0.16, (c[0] + c[1]) / 2, c[2] + 0.015, 0, M.preto);
    }
    return { grupo: carro, sp: sp };
  }

  // ---------- cena, interação e desempenho ----------
  var vistas = {};
  var observador = null, quadro = null;

  function loop() {
    quadro = null;
    var algum = false;
    Object.keys(vistas).forEach(function(k) {
      var vt = vistas[k];
      if (!vt.renderer || !vt.visivel) return;
      algum = true;
      vt.controls.update();
      vt.renderer.render(vt.cena, vt.camera);
    });
    if (algum) quadro = requestAnimationFrame(loop);
  }
  function animar() { if (!quadro) quadro = requestAnimationFrame(loop); }

  function obs() {
    if (!observador) {
      observador = new IntersectionObserver(function(itens) {
        itens.forEach(function(it) {
          Object.keys(vistas).forEach(function(k) { if (vistas[k].el === it.target) vistas[k].visivel = it.isIntersecting; });
        });
        animar();
      });
    }
    return observador;
  }

  function ajustar(vt) {
    var w = vt.el.clientWidth, h = vt.el.clientHeight;
    if (!w || !h || !vt.renderer) return;
    vt.renderer.setSize(w, h, false);
    vt.camera.aspect = w / h; vt.camera.updateProjectionMatrix();
  }

  function criarCena(vt, v) {
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; renderer.domElement.style.display = 'block';
    renderer.domElement.setAttribute('aria-label', 'Viatura em 3D: arraste para girar');

    var cena = new THREE.Scene();
    var c = montarCarro(v), L = c.sp.L;
    cena.add(c.grupo);
    cena.add(new THREE.HemisphereLight(0xffffff, 0x2a2a2a, 0.85));
    var sol = new THREE.DirectionalLight(0xffffff, 1.05);
    sol.position.set(4, 7, 5); sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    var sc = sol.shadow.camera; sc.left = sc.bottom = -L * 0.75; sc.right = sc.top = L * 0.75; sc.near = 1; sc.far = 20;
    cena.add(sol);
    var contra = new THREE.DirectionalLight(0xfff4d6, 0.45); contra.position.set(-5, 3, -4); cena.add(contra);

    // base giratória escura com aro dourado
    var base = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.62, L * 0.62, 0.04, 72), mat('#1c1c1c', { metalness: 0, roughness: 0.9 }));
    base.position.y = -0.02; base.receiveShadow = true; cena.add(base);
    var aro = new THREE.Mesh(new THREE.RingGeometry(L * 0.6, L * 0.62, 72), new THREE.MeshBasicMaterial({ color: cor('#c9a84c') }));
    aro.rotation.x = -Math.PI / 2; aro.position.y = 0.002; cena.add(aro);

    var camera = new THREE.PerspectiveCamera(32, 1.6, 0.1, 60);
    var d = L * 1.5;
    camera.position.set(d * 0.66, L * 0.34, d * 0.76);
    // a rolagem do mouse continua rolando a página; zoom só com Ctrl + rolagem (no celular, pinça)
    renderer.domElement.addEventListener('wheel', function(e) { if (!e.ctrlKey) e.stopImmediatePropagation(); }, true);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, c.sp.tetoY * 0.42, 0);
    controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = L * 0.85; controls.maxDistance = L * 2.4;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.autoRotate = true; controls.autoRotateSpeed = 1.4;
    var retomar = null;
    controls.addEventListener('start', function() { clearTimeout(retomar); controls.autoRotate = false; });
    controls.addEventListener('end', function() { clearTimeout(retomar); retomar = setTimeout(function() { controls.autoRotate = true; }, 4000); });
    controls.update();

    vt.renderer = renderer; vt.cena = cena; vt.camera = camera; vt.controls = controls;
    if (window.ResizeObserver) { vt.ro = new ResizeObserver(function() { ajustar(vt); }); }
  }

  function anexar(vt, el) {
    if (vt.el && vt.el !== el) { obs().unobserve(vt.el); if (vt.ro) vt.ro.unobserve(vt.el); }
    vt.el = el;
    if (!vt.renderer) return;
    el.innerHTML = '';
    el.appendChild(vt.renderer.domElement);
    obs().observe(el);
    if (vt.ro) vt.ro.observe(el);
    ajustar(vt); animar();
  }

  function semWebGL(el) {
    el.innerHTML = '<div class="v3d-msg"><img src="brasao-ourotran.png" alt="" width="56"><div>Visualização 3D indisponível neste aparelho</div></div>';
  }

  function descartar(k) {
    var vt = vistas[k]; delete vistas[k];
    if (!vt || !vt.renderer) return;
    obs().unobserve(vt.el); if (vt.ro) vt.ro.disconnect();
    vt.controls.dispose();
    vt.cena.traverse(function(o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    });
    vt.renderer.dispose(); vt.renderer.forceContextLoss();
    if (vt.renderer.domElement.parentNode) vt.renderer.domElement.parentNode.removeChild(vt.renderer.domElement);
  }

  function chave(v) { return [v.id, v.tipo, v.placa, v.prefixo].join('|'); }

  // monta (ou reaproveita) a viatura dentro de el; v = { id, tipo, placa, prefixo }
  function montar(el, v) {
    var k = chave(v), vt = vistas[k];
    if (vt) { anexar(vt, el); if (!vt.renderer) el.innerHTML = '<div class="v3d-msg">Carregando 3D…</div>'; return; }
    if (!temWebGL()) { semWebGL(el); return; }
    el.innerHTML = '<div class="v3d-msg">Carregando 3D…</div>';
    vistas[k] = vt = { el: el, visivel: false };
    preparar().then(function() {
      if (vistas[k] !== vt) return;
      criarCena(vt, v);
      anexar(vt, vt.el);
    }).catch(function(e) {
      console.error(e);
      if (vistas[k] === vt) delete vistas[k];
      semWebGL(vt.el);
    });
  }
  // descarta as viaturas que saíram da tela (excluídas, placa ou modelo trocado)
  function manter(chaves) {
    Object.keys(vistas).forEach(function(k) { if (chaves.indexOf(k) === -1) descartar(k); });
  }
  function limparTudo() { manter([]); }

  window.Viaturas3D = { montar: montar, manter: manter, limparTudo: limparTudo, chave: chave };
})();
