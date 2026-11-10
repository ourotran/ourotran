// Viaturas da OuroTran em 3D, montadas no próprio Three.js (sem arquivos .glb):
// - a carroceria é feita de cortes transversais arredondados (superelipses) ao longo do comprimento, com caixas de roda,
//   capô, caçamba aberta nas picapes e a cabine com caimento das laterais;
// - a plotagem oficial (amarelo-limão, faixas em onda, xadrez, brasão, prefixo, "118") é pintada em canvas;
// - faróis, grade, lanternas, retrovisores, rodas, giroflex e placas são peças separadas;
// - a pintura tem verniz e reflexo do ambiente (RoomEnvironment), como carro de verdade.
// A placa e o prefixo vêm do banco e são desenhados na hora: nenhuma placa fica escrita neste arquivo.
// Medidas em metros, tiradas das fichas técnicas: VW Polo 2023 e Chevrolet S10 2025 (cabine dupla e simples).
// Eixos: x = comprimento (frente em +x), y = altura, z = largura (lado direito do motorista em +z).
(function() {
  'use strict';
  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/';
  var URL_THREE = CDN + 'build/three.min.js';
  var EXTRAS = ['examples/js/controls/OrbitControls.js', 'examples/js/environments/RoomEnvironment.js', 'examples/js/geometries/RoundedBoxGeometry.js'];
  var COR = { lima: '#cfe31d', preto: '#141414', branco: '#f5f5f0', vermelho: '#d3221c', farol: '#e9eef2', plastico: '#1d1e20' };

  // ---------- carregamento sob demanda (só quando a aba abre) ----------
  var carregando = null, brasao = null;
  function script(src) {
    return new Promise(function(ok, erro) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = erro; document.head.appendChild(s); });
  }
  function preparar() {
    if (!carregando) {
      var img = new Promise(function(ok) { var i = new Image(); i.onload = function() { brasao = i; ok(); }; i.onerror = function() { ok(); }; i.src = 'brasao-ourotran.png'; });
      var three = script(URL_THREE).then(function() { return Promise.all(EXTRAS.map(function(e) { return script(CDN + e); })); });
      carregando = Promise.all([three, img]);
      carregando.catch(function() { carregando = null; });
    }
    return carregando;
  }
  function temWebGL() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; }
  }

  // ---------- funções de forma ----------
  function lim(t) { return Math.min(Math.max(t, 0), 1); }
  function suave(t) { t = lim(t); return t * t * (3 - 2 * t); }
  function rampa(x, a, b) { return suave((x - a) / (b - a)); }
  function misturar(a, b, t) { return a + (b - a) * t; }
  // superelipse: n alto = mais quadrado, n baixo = mais redondo
  function se(c, n) { return (c < 0 ? -1 : 1) * Math.pow(Math.abs(c), 2 / n); }
  // perfil por pontos [x, y]: curva cúbica monótona (Fritsch-Carlson) que passa por todos os pontos sem criar ondas.
  // (Uma transição "suave" em cada trecho deixaria a inclinação zero em cada ponto e o teto sairia ondulado.)
  function perfil(pts) {
    var p = pts.slice().sort(function(a, b) { return a[0] - b[0]; }), n = p.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d.push((p[i + 1][1] - p[i][1]) / (p[i + 1][0] - p[i][0]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b;
      if (q > 9) { var t = 3 / Math.sqrt(q); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return function(x) {
      if (x <= p[0][0]) return p[0][1];
      if (x >= p[n - 1][0]) return p[n - 1][1];
      for (var k = 0; x > p[k + 1][0]; k++) {}
      var h = p[k + 1][0] - p[k][0], t = (x - p[k][0]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * p[k][1] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * p[k + 1][1] + (t3 - t2) * h * m[k + 1];
    };
  }

  // ---------- modelos ----------
  // baixo: carroceria até a linha de cintura (capô, laterais, caçamba); cabine: a parte de cima, com os vidros.
  var MODELOS = {
    POLO: function() {
      var L = 4.079, h = L / 2;
      var sp = { nome: 'POLO', L: L, A0: 0.873, xf: 1.2, xr: -1.366, r: 0.31, R: 0.37, largPneu: 0.185, nB: 10, picape: false, caimento: 0.03, ombro: [0.1, 0.07] };
      sp.yb = function(x) { return 0.18 + 0.12 * rampa(x, 1.5, h) + 0.15 * rampa(-x, 1.55, h); };
      sp.ym = function(x) { return 0.5 - 0.06 * rampa(x, 1.6, h); };
      sp.cintura = perfil([[h, 0.78], [1.75, 0.84], [1.2, 0.885], [0.88, 0.905], [-1.0, 0.965], [-1.85, 1.0], [-h, 0.99]]);
      sp.topo = function(x) { return sp.cintura(x) + 0.008 + 0.03 * rampa(x, 0.85, 1.05) * (1 - rampa(x, 1.9, h)); };
      sp.A = function(x) { return sp.A0 - 0.14 * Math.pow(rampa(x, 1.5, h), 1.8) - 0.08 * Math.pow(rampa(-x, 1.7, h), 1.8); };
      sp.cab = { xFrente: 0.9, xTras: -1.99, xParabrisa: -0.12, xTeto: -1.74, n: 6,
        teto: perfil([[0.9, 0.905], [0.35, 1.22], [-0.12, 1.42], [-0.8, 1.468], [-1.6, 1.44], [-1.74, 1.4], [-1.99, 1.02]]),
        larguraTeto: function(x) { return 0.62 - 0.05 * rampa(x, -0.2, 0.4) - 0.05 * rampa(-x, 1.5, 1.96); },
        janelas: [[0.84, -0.38], [-0.45, -1.2]], pilares: [-0.415], painelBranco: [-1.2, -1.99], vidroTras: true };
      sp.portas = [0.86, -0.415, -1.2]; sp.xC = -1.2;
      sp.xadrez = [-1.12, -0.5]; sp.logoX = 0.2; sp.farolY = 0.6; sp.lanternaY = 0.88;
      sp.prefixoX = 1.3; sp.para118 = 'cabine';
      return sp;
    },
    S10: function() { return s10(false); },
    S10_CABINE_SIMPLES: function() { return s10(true); }
  };
  function s10(simples) {
    var L = 5.4, h = L / 2;
    var sp = { nome: simples ? 'S10_CS' : 'S10_CD', L: L, A0: 0.905, xf: 1.76, xr: -1.336, r: 0.39, R: 0.465, largPneu: 0.265, nB: 12, picape: true, paralamas: true, caimento: 0.015, ombro: [0.075, 0.05] };
    var xCab = simples ? -0.55 : -1.33; // traseira da cabine
    sp.yb = function(x) { return 0.42 + 0.05 * rampa(x, 2.3, h) + 0.09 * rampa(-x, 2.35, h); };
    sp.ym = function() { return 0.82; };
    sp.cintura = perfil([[h, 1.23], [2.3, 1.255], [1.05, 1.285], [xCab + 0.05, 1.3], [xCab - 0.04, 1.255], [-h, 1.25]]);
    sp.topo = function(x) { return sp.cintura(x) + 0.008 * rampa(x, xCab - 0.06, xCab) + 0.027 * rampa(x, 1.0, 1.15) * (1 - rampa(x, 2.6, h)); };
    sp.A = function(x) { return sp.A0 - 0.06 * Math.pow(rampa(x, 2.25, h), 1.5) - 0.03 * rampa(-x, 2.5, h); };
    sp.cab = { xFrente: 1.07, xTras: xCab, xParabrisa: 0.3, xTeto: xCab + 0.12, n: 9, fundo: true,
      teto: perfil([[1.07, 1.29], [0.6, 1.63], [0.3, 1.805], [-0.4, 1.83], [xCab + 0.1, 1.815], [xCab, 1.78]]),
      larguraTeto: function(x) { return 0.73 - 0.06 * rampa(x, 0.2, 0.9); },
      janelas: simples ? [[1.0, -0.42]] : [[1.0, -0.12], [-0.2, -1.2]], pilares: simples ? [] : [-0.16] };
    sp.cacamba = { frente: xCab - 0.05, tras: -h, interna: 0.775, piso: 0.82 };
    sp.portas = simples ? [1.05, -0.5] : [1.05, -0.16, -1.3]; sp.xC = xCab;
    sp.xadrez = simples ? [-0.4, 0.4] : [-1.15, -0.25]; sp.logoX = simples ? 0.3 : 0.45;
    sp.farolY = 1.08; sp.lanternaY = 1.05; sp.prefixoX = 1.6; sp.para118 = 'lateral';
    return sp;
  }

  // ---------- malha por cortes transversais ----------
  // corte do "baixo" no ponto x: metade direita, do centro de baixo (t = -90°) ao centro de cima (t = +90°)
  // Pontos de cada metade: 13 no fundo + 9 na lateral + 8 no ombro + 11 no capô/teto = 41 (sempre o mesmo número,
  // para os cortes vizinhos se ligarem ponto a ponto).
  var M_CAB = 24;
  function larguraOmbro(sp, x) { return sp.A(x) * (1 - sp.caimento); } // largura da lateral na linha de cintura
  function corteBaixo(sp, x) {
    var yb = sp.yb(x), ys = sp.cintura(x), yt = sp.topo(x), A = sp.A(x), Aw = larguraOmbro(sp, x);
    var rz = sp.ombro[0], ry = sp.ombro[1], ym = Math.min(sp.ym(x), ys - ry - 0.03), pts = [], k;
    var arco = null;
    [sp.xf, sp.xr].forEach(function(xw) { var d = x - xw; if (Math.abs(d) < sp.R) arco = sp.r + Math.sqrt(sp.R * sp.R - d * d); });
    function poe(z, y, roda) { if (roda && arco !== null && y < arco) y = arco; pts.push([z, y]); } // caixa de roda
    for (k = 0; k <= 12; k++) { var t = -Math.PI / 2 + (Math.PI / 2) * k / 12; poe(A * se(Math.cos(t), sp.nB), ym + (ym - yb) * se(Math.sin(t), sp.nB), true); }
    for (k = 1; k <= 9; k++) { var f = k / 9; poe(A - (A - Aw) * f, ym + (ys - ry - ym) * f, true); }
    for (k = 1; k <= 8; k++) { var a = (Math.PI / 2) * k / 8; poe(Aw - rz + rz * se(Math.cos(a), 4), ys - ry + ry * se(Math.sin(a), 4), false); }
    for (k = 1; k <= 11; k++) { var u = 1 - k / 11; poe((Aw - rz) * u, ys + (yt - ys) * (1 - u * u), false); }
    return pts;
  }
  // corte da cabine: da cintura direita ao centro do teto e espelhado até a cintura esquerda.
  // A primeira metade dos pontos de cada lado sobe a lateral (vidros) em passos iguais de altura; a outra faz a curva do teto.
  // Assim a faixa dos vidros fica sempre na mesma parte da textura: v de 0 a V_BORDA (direita) e de 1 - V_BORDA a 1 (esquerda).
  var E_BORDA = 0.86, V_BORDA = 0.25;
  function corteCabine(sp, x) {
    var c = sp.cab, yb = sp.cintura(x), H = Math.max(c.teto(x) - yb, 0.004);
    var wb = larguraOmbro(sp, x) - sp.ombro[0] * 0.75, wt = Math.min(c.larguraTeto(x), wb), meio = [], K = M_CAB / 2;
    var tE = Math.asin(Math.pow(E_BORDA, c.n / 2));
    for (var i = 0; i <= M_CAB; i++) {
      var t = i <= K ? Math.asin(Math.pow(E_BORDA * i / K, c.n / 2)) : tE + (Math.PI / 2 - tE) * (i - K) / K;
      var ey = se(Math.sin(t), c.n), ez = se(Math.cos(t), c.n);
      meio.push([misturar(wb, wt, ey) * ez, yb + H * ey]);
    }
    var esq = meio.slice(0, -1).reverse().map(function(p) { return [-p[0], p[1]]; });
    return meio.concat(esq);
  }
  function estacoes(x0, x1, passo) {
    var n = Math.max(2, Math.ceil((x1 - x0) / passo)), xs = [];
    for (var i = 0; i <= n; i++) xs.push(x0 + (x1 - x0) * i / n);
    return xs;
  }
  // junta os cortes numa malha; anel = lista de [z, y]; fechado = o último ponto liga no primeiro
  function malhaCortes(xs, cortes, fechado, uvFn) {
    var n = cortes[0].length, pos = [], uv = [], idx = [];
    xs.forEach(function(x, i) { cortes[i].forEach(function(p, j) { pos.push(x, p[1], p[0]); if (uvFn) uv.push.apply(uv, uvFn(x, p[1], p[0], j, n)); }); });
    var segs = fechado ? n : n - 1;
    for (var i = 0; i < xs.length - 1; i++) {
      for (var j = 0; j < segs; j++) {
        var a = i * n + j, b = i * n + (j + 1) % n, c = (i + 1) * n + j, d = (i + 1) * n + (j + 1) % n;
        idx.push(a, c, b, b, c, d);
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uvFn) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    return geo;
  }
  function normalFace(p, a, b, c) {
    var v = function(i) { return new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)); };
    var A = v(a), B = v(b), C = v(c);
    return B.sub(A).cross(C.sub(A)).normalize();
  }
  // garante normais para fora: testa um triângulo cujo lado já se conhece
  function orientar(geo, teste) {
    var idx = geo.index.array, p = geo.attributes.position;
    for (var k = 0; k < idx.length; k += 3) {
      var n = normalFace(p, idx[k], idx[k + 1], idx[k + 2]), cen = new THREE.Vector3();
      [0, 1, 2].forEach(function(o) { cen.x += p.getX(idx[k + o]) / 3; cen.y += p.getY(idx[k + o]) / 3; cen.z += p.getZ(idx[k + o]) / 3; });
      var r = teste(cen, n);
      if (r === null) continue;
      if (!r) { for (var q = 0; q < idx.length; q += 3) { var tmp = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = tmp; } }
      return;
    }
  }
  // separa os triângulos em grupos (um material por grupo) conforme a função escolher(centro, normal) -> índice ou -1
  function agrupar(geo, escolher, nGrupos) {
    var idx = geo.index.array, p = geo.attributes.position, listas = [];
    for (var g = 0; g < nGrupos; g++) listas.push([]);
    for (var k = 0; k < idx.length; k += 3) {
      var n = normalFace(p, idx[k], idx[k + 1], idx[k + 2]), cen = new THREE.Vector3();
      [0, 1, 2].forEach(function(o) { cen.x += p.getX(idx[k + o]) / 3; cen.y += p.getY(idx[k + o]) / 3; cen.z += p.getZ(idx[k + o]) / 3; });
      var gi = escolher(cen, n);
      if (gi >= 0) listas[gi].push(idx[k], idx[k + 1], idx[k + 2]);
    }
    var tudo = [], ini = 0;
    listas.forEach(function(l, gi) { tudo = tudo.concat(l); geo.addGroup(ini, l.length, gi); ini += l.length; });
    geo.setIndex(tudo);
    geo.computeVertexNormals();
    return geo;
  }
  // tampa plana na ponta de uma malha fechada (frente, traseira, fundo da cabine)
  function tampa(x, anel, uvFn, paraFrente) {
    var contorno = anel.map(function(p) { return new THREE.Vector2(p[0], p[1]); });
    if (THREE.ShapeUtils.isClockWise(contorno)) contorno.reverse();
    var faces = THREE.ShapeUtils.triangulateShape(contorno, []), pos = [], uv = [], idx = [];
    contorno.forEach(function(p) { pos.push(x, p.y, p.x); uv.push.apply(uv, uvFn(p.x, p.y)); });
    faces.forEach(function(f) { idx.push(f[0], f[1], f[2]); });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    orientar(geo, function(c, n) { return Math.abs(n.x) < 0.5 ? null : (n.x > 0) === paraFrente; });
    geo.computeVertexNormals();
    return geo;
  }

  // ---------- pintura (canvas) ----------
  function novoCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function texturaDe(cv, flipY) {
    var t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    if (flipY === false) t.flipY = false;
    return t;
  }
  // desenha em metros: (x, y) do carro -> pixel, com y para cima
  function emMetros(g, b, escX, escY) { g.setTransform(escX, 0, 0, -escY, -b.x0 * escX, (b.y0 + b.h) * escY); }
  function local(g, x, y, kx, ky, fn) { g.save(); g.translate(x, y); g.scale(kx, ky); fn(); g.restore(); }
  function textoM(g, txt, x, y, alt, espelho, cor) {
    local(g, x, y, (espelho ? -1 : 1) * alt / 100, -alt / 100, function() {
      g.font = 'bold 100px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = cor || COR.preto; g.fillText(txt, 0, 0);
    });
  }
  function retArred(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  function iconeTel(g, x, y, alt, espelho) {
    g.beginPath(); g.arc(x, y, alt * 0.36, Math.PI * (espelho ? 1.1 : -0.1), Math.PI * (espelho ? 2.4 : 1.2), !!espelho);
    g.strokeStyle = COR.preto; g.lineWidth = alt * 0.2; g.lineCap = 'round'; g.stroke();
  }

  // lateral do "baixo": faixas em onda, xadrez, brasão, prefixo, portas
  function caixaLateral(sp) { var h = sp.L / 2; return { x0: -h - 0.06, w: sp.L + 0.12, y0: 0, h: sp.cab.teto(sp.cab.xTeto) + 0.1 }; }
  function pintarLateral(sp, v, espelho) {
    var h = sp.L / 2, b = caixaLateral(sp), esc = 2048 / b.w, cv = novoCanvas(2048, Math.round(b.h * esc)), g = cv.getContext('2d');
    emMetros(g, b, esc, esc);
    var soleira = sp.yb(0) + 0.06, cintRef = sp.cintura(sp.portas[1]), k = (cintRef - soleira) / 0.75;
    g.fillStyle = COR.lima; g.fillRect(b.x0, b.y0, b.w, b.h);

    var xIni = -h, xFim = h - 0.1;
    var yTras = sp.cintura(-h + 0.3) - 0.14 * k, yMeio = soleira + (cintRef - soleira) * 0.36, yFrente = sp.farolY - 0.03;
    function cx(t) { return xIni + t * (xFim - xIni); }
    function cy(t) { return yTras + (yMeio - yTras) * suave(t / 0.28) + (yFrente - yMeio) * suave((t - 0.76) / 0.24); }
    function afina(t) { return 1 - 0.88 * suave((t - 0.7) / 0.3); }
    function tDe(x) { return lim((x - xIni) / (xFim - xIni)); }
    function faixa(baixo, alto, cor) {
      var n = 80, i, t; g.beginPath();
      for (i = 0; i <= n; i++) { t = i / n; g.lineTo(cx(t), cy(t) + alto * k * afina(t)); }
      for (i = n; i >= 0; i--) { t = i / n; g.lineTo(cx(t), cy(t) + baixo * k * afina(t)); }
      g.closePath(); g.fillStyle = cor; g.fill();
    }
    // painel branco atrás da coluna C, descendo até a faixa
    g.beginPath(); g.moveTo(b.x0, b.h); g.lineTo(sp.xC, b.h);
    for (var x = sp.xC; x >= xIni; x -= 0.02) { var t = tDe(x); g.lineTo(x, cy(t) + 0.2 * k * afina(t)); }
    g.lineTo(b.x0, cy(0) + 0.2 * k); g.closePath(); g.fillStyle = COR.branco; g.fill();
    faixa(0.06, 0.2, COR.branco);
    faixa(-0.06, 0.06, COR.preto);
    faixa(-0.14, -0.06, COR.branco);
    faixa(-0.185, -0.155, COR.preto);
    g.beginPath(); g.moveTo(sp.xC - 0.03, sp.cintura(sp.xC) + 0.02);
    g.quadraticCurveTo(sp.xC - 0.22, sp.cintura(sp.xC) - 0.2, cx(0.2), cy(0.2) + 0.02);
    g.strokeStyle = COR.preto; g.lineWidth = 0.075 * k; g.lineCap = 'round'; g.stroke();

    // xadrez (2 fileiras) logo abaixo das janelas
    var q = 0.055 * k;
    for (var lin = 0; lin < 2; lin++) {
      for (var i = 0, xq = sp.xadrez[0]; xq < sp.xadrez[1] - 0.001; i++, xq += q) {
        g.fillStyle = (i + lin) % 2 ? COR.branco : COR.preto;
        g.fillRect(xq, sp.cintura(xq) - 0.05 - (lin + 1) * q, Math.min(q, sp.xadrez[1] - xq), q);
      }
    }
    // soleira preta e luzes que dobram para a lateral
    g.beginPath(); g.moveTo(b.x0, 0);
    for (x = -h; x <= h; x += 0.02) g.lineTo(x, sp.yb(x) + (sp.picape ? 0.07 : 0.04));
    g.lineTo(b.x0 + b.w, 0); g.closePath(); g.fillStyle = sp.picape ? COR.plastico : '#2a2b1a'; g.fill();
    g.fillStyle = COR.vermelho; retArred(g, -h - 0.06, sp.lanternaY - (sp.picape ? 0.16 : 0.05), 0.13, sp.picape ? 0.3 : 0.1, 0.02); g.fill();
    g.fillStyle = '#c9ced3'; retArred(g, h - 0.12, sp.farolY - 0.035, 0.2, 0.07, 0.02); g.fill();

    // vãos das portas e maçanetas
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 0.007;
    sp.portas.forEach(function(xp) { g.beginPath(); g.moveTo(xp, sp.yb(xp) + 0.05); g.lineTo(xp - 0.01, sp.cintura(xp) + 0.02); g.stroke(); });
    for (var p = 0; p < sp.portas.length - 1; p++) {
      var xm = sp.portas[p + 1] + 0.1, ym = sp.cintura(xm) - 0.16;
      g.fillStyle = 'rgba(0,0,0,.75)'; retArred(g, xm, ym, 0.17, 0.035, 0.012); g.fill();
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(xm + 0.02, ym + 0.025, 0.13, 0.006);
    }
    // vinco da lateral (luz e sombra)
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 0.012; g.beginPath();
    for (x = -h + 0.1; x <= h - 0.15; x += 0.05) g.lineTo(x, sp.cintura(x) - 0.03);
    g.stroke();

    if (sp.para118 === 'lateral') {
      var x118 = -h + 0.42, y118 = sp.cintura(x118) - 0.11, lado = espelho ? -1 : 1;
      textoM(g, '118', x118 - lado * 0.05, y118, 0.11, espelho);
      iconeTel(g, x118 + lado * 0.13, y118, 0.11, espelho);
    }
    if (brasao) {
      var bh = 0.44 * k, bw = bh * brasao.width / brasao.height;
      local(g, sp.logoX, soleira + (cintRef - soleira) * 0.43, espelho ? -1 : 1, -1, function() { g.drawImage(brasao, -bw / 2, -bh / 2, bw, bh); });
    }
    if (v.prefixo) textoM(g, String(v.prefixo).toUpperCase(), sp.prefixoX, sp.cintura(sp.prefixoX) - 0.1, 0.075, espelho);
    return { tex: texturaDe(cv), b: b };
  }

  // cabine "desenrolada": horizontal = x do carro; vertical = volta do corte (lateral direita, teto, lateral esquerda)
  function pintarCabine(sp) {
    var c = sp.cab, W = 2048, H = 1024, cv = novoCanvas(W, H), g = cv.getContext('2d');
    var X = function(x) { return (x - c.xTras) / (c.xFrente - c.xTras) * W; };
    var vE = V_BORDA, R = function(v) { return v * H; };
    g.fillStyle = COR.lima; g.fillRect(0, 0, W, H);
    function vidroRet(xa, xb, va, vb, desce) {
      var gr = g.createLinearGradient(0, R(va), 0, R(vb));
      gr.addColorStop(0, desce ? '#070a0c' : '#1f2930'); gr.addColorStop(1, desce ? '#1f2930' : '#070a0c');
      g.fillStyle = COR.preto; g.fillRect(X(xa) - 6, R(va) - 6, X(xb) - X(xa) + 12, R(vb) - R(va) + 12);
      g.fillStyle = gr; g.fillRect(X(xa), R(va), X(xb) - X(xa), R(vb) - R(va));
    }
    // laterais: janelas (direita: v sobe do 0 até a borda; esquerda: espelhada)
    [[0.012, vE - 0.015, true], [1 - vE + 0.015, 0.988, false]].forEach(function(f) {
      c.janelas.forEach(function(j) { vidroRet(j[1], j[0], f[0], f[1], f[2]); });
      c.pilares.forEach(function(xp) { g.fillStyle = COR.preto; g.fillRect(X(xp) - 26, R(f[0]) - 6, 52, R(f[1]) - R(f[0]) + 12); });
    });
    // coluna A também por cima da borda do teto
    g.fillStyle = COR.preto;
    g.fillRect(X(c.xParabrisa) - 4, R(vE - 0.035), X(c.xFrente) - X(c.xParabrisa), R(0.07));
    g.fillRect(X(c.xParabrisa) - 4, R(1 - vE - 0.035), X(c.xFrente) - X(c.xParabrisa), R(0.07));
    // painel branco da coluna C com "118" (Polo)
    if (c.painelBranco) {
      [[0, vE + 0.01, false], [1 - vE - 0.01, 1, true]].forEach(function(f) {
        g.fillStyle = COR.branco; g.fillRect(X(c.painelBranco[1]), R(f[0]), X(c.painelBranco[0]) - X(c.painelBranco[1]) + 2, R(f[1]) - R(f[0]));
        var xm = (c.painelBranco[0] + c.painelBranco[1]) / 2 + 0.06, vm = f[2] ? 1 - 0.13 : 0.13;
        var sx = W / (c.xFrente - c.xTras), sy = (vE * H) / (c.teto(xm) - sp.cintura(xm));
        g.save(); g.translate(X(xm), R(vm)); g.scale(f[2] ? -sx : sx, f[2] ? -sy : sy);
        textoM(g, '118', -0.06, 0, 0.1, false); iconeTel(g, 0.1, 0, 0.1, false);
        g.restore();
      });
    }
    // para-brisa e vidro traseiro (no teto)
    var va = vE + 0.015, vb = 1 - vE - 0.015;
    g.fillStyle = COR.preto; g.fillRect(X(c.xParabrisa) - 4, R(va), X(c.xFrente) - X(c.xParabrisa) + 8, R(vb) - R(va));
    var gr = g.createLinearGradient(X(c.xFrente), 0, X(c.xParabrisa), 0);
    gr.addColorStop(0, '#080c0f'); gr.addColorStop(1, '#26313a');
    g.fillStyle = gr; g.fillRect(X(c.xParabrisa) + 18, R(va + 0.03), X(c.xFrente) - X(c.xParabrisa) - 40, R(vb - va - 0.06));
    if (c.vidroTras) {
      g.fillStyle = COR.preto; g.fillRect(X(c.xTras), R(va), X(c.xTeto) - X(c.xTras), R(vb) - R(va));
      g.fillStyle = '#1a2329'; g.fillRect(X(c.xTras) + 30, R(va + 0.04), X(c.xTeto) - X(c.xTras) - 50, R(vb - va - 0.08));
      g.fillStyle = COR.vermelho; g.fillRect(X(c.xTeto) - 26, R(0.47), 14, R(0.06)); // brake light
    }
    return texturaDe(cv, false);
  }

  // frente, traseira e fundo da cabine: projeção (z, y) vista de fora
  function pintarFace(largura, y0, y1, desenho) {
    var b = { x0: -largura, w: 2 * largura, y0: y0, h: y1 - y0 }, esc = 1024 / b.w, cv = novoCanvas(1024, Math.round(b.h * esc)), g = cv.getContext('2d');
    emMetros(g, b, esc, esc);
    g.fillStyle = COR.lima; g.fillRect(b.x0, b.y0, b.w, b.h);
    desenho(g);
    return { tex: texturaDe(cv), b: b };
  }
  function grade(g, x, y, w, h, passo, cor) {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = '#0a0a0a'; g.fillRect(x, y, w, h);
    g.strokeStyle = cor || '#2a2c2e'; g.lineWidth = passo * 0.18;
    for (var i = -h; i < w + h; i += passo) { g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i + h, y + h); g.stroke(); g.beginPath(); g.moveTo(x + i + h, y); g.lineTo(x + i, y + h); g.stroke(); }
    g.restore();
  }
  function gravata(g, x, y, s) { // emblema dourado (Chevrolet)
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#c8a24a'; g.strokeStyle = '#e9e2cc'; g.lineWidth = 0.08;
    g.beginPath(); g.moveTo(-1, 0.25); g.lineTo(-0.3, 0.25); g.lineTo(-0.25, 0.45); g.lineTo(0.25, 0.45); g.lineTo(0.3, 0.25); g.lineTo(1, 0.25);
    g.lineTo(0.85, -0.25); g.lineTo(0.3, -0.25); g.lineTo(0.25, -0.45); g.lineTo(-0.25, -0.45); g.lineTo(-0.3, -0.25); g.lineTo(-0.85, -0.25); g.closePath();
    g.fill(); g.stroke(); g.restore();
  }
  function emblemaVW(g, x, y, r) {
    g.save(); g.lineWidth = r * 0.14; g.strokeStyle = '#d9dde0';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x - r * 0.62, y + r * 0.62); g.lineTo(x - r * 0.3, y - r * 0.6); g.lineTo(x, y + r * 0.1); g.lineTo(x + r * 0.3, y - r * 0.6); g.lineTo(x + r * 0.62, y + r * 0.62);
    g.moveTo(x - r * 0.35, y + r * 0.8); g.lineTo(x, y + r * 0.1); g.lineTo(x + r * 0.35, y + r * 0.8); g.stroke(); g.restore();
  }
  var FRENTES = {
    POLO: function(g) {
      g.fillStyle = '#0b0b0b'; retArred(g, -0.52, 0.56, 1.04, 0.1, 0.03); g.fill();      // grade fina
      g.fillStyle = '#dfe9f2'; g.fillRect(-0.5, 0.645, 1.0, 0.008);                       // filete de LED
      grade(g, -0.42, 0.25, 0.84, 0.17, 0.035);                                           // entrada de ar de baixo
      g.fillStyle = COR.preto; g.beginPath(); g.moveTo(-0.62, 0.26); g.lineTo(-0.5, 0.22); g.lineTo(-0.5, 0.3); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0.62, 0.26); g.lineTo(0.5, 0.22); g.lineTo(0.5, 0.3); g.closePath(); g.fill();
      emblemaVW(g, 0, 0.61, 0.045);
    },
    S10: function(g) {
      g.fillStyle = '#101112'; retArred(g, -0.52, 0.66, 1.04, 0.5, 0.05); g.fill();
      grade(g, -0.47, 0.7, 0.94, 0.36, 0.05, '#34373a');
      g.fillStyle = '#9da3a8'; g.fillRect(-0.84, 1.075, 1.68, 0.03);                     // barra cromada
      [-1, 1].forEach(function(l) { g.fillStyle = '#0d0f10'; retArred(g, l * 0.67 - 0.19, 1.04, 0.38, 0.14, 0.03); g.fill(); });
      gravata(g, 0, 0.9, 0.09);
      g.fillStyle = COR.plastico; g.fillRect(-0.9, 0.42, 1.8, 0.2);                       // para-choque inferior
      g.fillStyle = '#7d8388'; g.beginPath(); g.moveTo(-0.38, 0.44); g.lineTo(0.38, 0.44); g.lineTo(0.3, 0.56); g.lineTo(-0.3, 0.56); g.closePath(); g.fill(); // protetor
      [-1, 1].forEach(function(l) { g.fillStyle = '#0d0d0d'; retArred(g, l * 0.72 - 0.08, 0.5, 0.16, 0.08, 0.02); g.fill(); g.fillStyle = '#dfe6ea'; g.fillRect(l * 0.72 - 0.05, 0.53, 0.1, 0.02); });
    }
  };
  var TRASEIRAS = {
    POLO: function(g) {
      g.fillStyle = COR.plastico; g.fillRect(-0.9, 0.2, 1.8, 0.18);
      g.fillStyle = '#2b2b2b'; retArred(g, -0.27, 0.58, 0.54, 0.16, 0.02); g.fill();       // vão da placa
      emblemaVW(g, 0, 0.86, 0.06);
      textoM(g, 'POLO', 0.45, 0.78, 0.045, false, '#e8e8e8');
    },
    S10: function(g) {
      g.fillStyle = '#25272a'; retArred(g, -0.12, 1.1, 0.24, 0.05, 0.015); g.fill();       // puxador da tampa
      textoM(g, 'S10', 0, 0.92, 0.08, false, '#d7dadd');
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-0.86, 0.66, 1.72, 0.012);
    }
  };

  // placa Mercosul desenhada com o texto que vem do banco
  function texturaPlaca(placa) {
    var cv = novoCanvas(512, 166), g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 166);
    g.fillStyle = '#0a3d9c'; g.fillRect(0, 0, 512, 36);
    g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BRASIL', 256, 19);
    g.fillStyle = '#1d9a3c'; g.fillRect(452, 8, 34, 22);
    g.fillStyle = '#f5d000'; g.beginPath(); g.moveTo(469, 10); g.lineTo(484, 19); g.lineTo(469, 28); g.lineTo(454, 19); g.closePath(); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 96px "Arial Black", Arial, sans-serif'; g.fillText(String(placa || '').toUpperCase(), 256, 104);
    g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(4, 4, 504, 158);
    return texturaDe(cv);
  }
  // calota preta (Polo): desenho dos raios em canvas
  function texturaCalota() {
    var cv = novoCanvas(512, 512), g = cv.getContext('2d'), c = 256;
    var gr = g.createRadialGradient(c, c, 20, c, c, 256); gr.addColorStop(0, '#3a3c3f'); gr.addColorStop(1, '#141516');
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, 256, 0, Math.PI * 2); g.fill();
    for (var i = 0; i < 10; i++) {
      g.save(); g.translate(c, c); g.rotate(i * Math.PI / 5);
      g.fillStyle = '#060606'; g.beginPath(); g.moveTo(-14, 95); g.lineTo(14, 95); g.lineTo(34, 225); g.lineTo(-20, 225); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(16, 95, 5, 125);
      g.restore();
    }
    g.fillStyle = '#2b2d30'; g.beginPath(); g.arc(c, c, 60, 0, Math.PI * 2); g.fill();
    g.save(); g.translate(c, c); g.scale(1, -1); emblemaVW(g, 0, 0, 34); g.restore();
    g.strokeStyle = '#333'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, 250, 0, Math.PI * 2); g.stroke();
    return texturaDe(cv);
  }

  // ---------- materiais ----------
  function cor(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function tinta(o) {
    var p = { color: cor('#ffffff'), roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06 };
    for (var k in o) p[k] = o[k];
    if (typeof p.color === 'string') p.color = cor(p.color);
    return new THREE.MeshPhysicalMaterial(p);
  }
  function mat(hex, o) {
    var p = { color: cor(hex), metalness: 0, roughness: 0.6 };
    for (var k in o) p[k] = o[k];
    if (p.emissive) p.emissive = cor(p.emissive);
    return new THREE.MeshStandardMaterial(p);
  }
  function malha(geo, m, sombra) { var me = new THREE.Mesh(geo, m); me.castShadow = sombra !== false; me.receiveShadow = true; return me; }
  function rbox(w, h, d, r) { return new THREE.RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999); }

  // ---------- rodas ----------
  function pneu(r, rAro, larg, m) {
    var w = larg / 2, rr = Math.min(0.05, (r - rAro) * 0.45);
    // perfil: talão -> flanco abaulado -> banda -> flanco -> talão
    var perfilP = [[rAro, -w * 0.9], [rAro + (r - rAro) * 0.5, -w * 1.02], [r - rr, -w], [r, -w + rr], [r, w - rr], [r - rr, w], [rAro + (r - rAro) * 0.5, w * 1.02], [rAro, w * 0.9]];
    var curva = new THREE.SplineCurve(perfilP.map(function(p) { return new THREE.Vector2(p[0], p[1]); }));
    var geo = new THREE.LatheGeometry(curva.getPoints(40), 48);
    geo.rotateX(Math.PI / 2);
    return malha(geo, m);
  }
  function roda(sp, M) {
    var g = new THREE.Group(), r = sp.r, larg = sp.largPneu, rAro = sp.picape ? r * 0.56 : r * 0.62;
    g.add(pneu(r, rAro, larg, M.borracha));
    // disco de freio e fundo do aro
    var fundo = new THREE.Mesh(new THREE.CylinderGeometry(rAro * 0.98, rAro * 0.98, larg * 0.8, 36), M.freio);
    fundo.rotation.x = Math.PI / 2; fundo.position.z = -0.02; g.add(fundo);
    if (sp.picape) {
      // aro de liga leve com 6 raios duplos
      var aro = new THREE.Mesh(new THREE.TorusGeometry(rAro * 0.93, rAro * 0.07, 10, 48), M.aro);
      aro.position.z = larg * 0.38; g.add(aro);
      for (var i = 0; i < 12; i++) {
        var raio = new THREE.Mesh(rbox(rAro * 0.78, rAro * 0.1, 0.04, 0.012), i % 2 ? M.aro : M.aroEscuro);
        var a = (i * Math.PI) / 6 + (i % 2 ? 0.12 : 0);
        raio.geometry.translate(rAro * 0.47, 0, 0);
        raio.rotation.z = a; raio.position.z = larg * 0.36; g.add(raio);
      }
      var cubo = new THREE.Mesh(new THREE.CylinderGeometry(rAro * 0.28, rAro * 0.3, 0.05, 24), M.aroEscuro);
      cubo.rotation.x = Math.PI / 2; cubo.position.z = larg * 0.4; g.add(cubo);
      for (i = 0; i < 6; i++) {
        var p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), M.aro);
        p.rotation.x = Math.PI / 2; p.position.set(Math.cos(i * Math.PI / 3) * rAro * 0.2, Math.sin(i * Math.PI / 3) * rAro * 0.2, larg * 0.43); g.add(p);
      }
    } else {
      var calota = new THREE.Mesh(new THREE.CircleGeometry(rAro, 48), M.calota);
      calota.position.z = larg * 0.42; g.add(calota);
      var borda = new THREE.Mesh(new THREE.TorusGeometry(rAro * 0.99, 0.012, 8, 48), M.aroEscuro);
      borda.position.z = larg * 0.42; g.add(borda);
    }
    g.traverse(function(o) { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ---------- montagem ----------
  function montarCarro(v) {
    var sp = (MODELOS[v.tipo] || MODELOS.POLO)(), h = sp.L / 2, c = sp.cab, carro = new THREE.Group();
    var tipoFace = sp.picape ? 'S10' : 'POLO';
    var M = {
      lima: tinta({ color: COR.lima }),
      plastico: mat(COR.plastico, { roughness: 0.75 }),
      preto: mat('#0c0c0c', { roughness: 0.5 }),
      fundo: mat('#0b0b0b', { roughness: 0.95 }),
      borracha: mat('#1a1a1a', { roughness: 0.92 }),
      freio: mat('#3b3d40', { metalness: 0.6, roughness: 0.5 }),
      aro: mat('#d8dcdf', { metalness: 1, roughness: 0.22 }),
      aroEscuro: mat('#3c3f43', { metalness: 0.8, roughness: 0.35 }),
      cromo: mat('#e6e9eb', { metalness: 1, roughness: 0.12 }),
      lente: new THREE.MeshPhysicalMaterial({ color: cor('#0f1418'), roughness: 0.05, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.03 }),
      led: mat('#ffffff', { emissive: '#e8f2ff', roughness: 0.2 }),
      lanterna: new THREE.MeshPhysicalMaterial({ color: cor('#b0120c'), emissive: cor('#5a0604'), roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.95 }),
      giroflex: new THREE.MeshPhysicalMaterial({ color: cor('#ff2a1f'), emissive: cor('#b80f08'), roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.9 }),
      cacamba: mat('#1b1c1d', { roughness: 0.95, side: THREE.BackSide }),
      calota: new THREE.MeshStandardMaterial({ map: texturaCalota(), roughness: 0.45, metalness: 0.2 })
    };

    // "baixo": cortes ao longo do carro, com a lateral pintada nos dois lados
    var dir = pintarLateral(sp, v, false), esq = pintarLateral(sp, v, true), b = dir.b;
    var xsB = estacoes(-h, h, 0.02), cortesB = xsB.map(function(x) { return corteBaixo(sp, x); });
    var aneis = cortesB.map(function(pts) { // anel completo: metade direita + esquerda espelhada
      var esqP = pts.slice(1, -1).reverse().map(function(p) { return [-p[0], p[1]]; });
      return pts.concat(esqP);
    });
    var geoB = malhaCortes(xsB, aneis, true, function(x, y) { return [(x - b.x0) / b.w, (y - b.y0) / b.h]; });
    orientar(geoB, function(cen, n) { return Math.abs(n.z) > 0.8 && cen.z > 0.3 ? n.z > 0 : null; });
    var cac = sp.cacamba;
    agrupar(geoB, function(cen, n) {
      if (cac && n.y > 0.5 && cen.x > cac.tras + 0.06 && cen.x < cac.frente && Math.abs(cen.z) < cac.interna) return -1; // abre a caçamba
      if (Math.abs(n.z) >= Math.abs(n.y) * 0.9) return n.z > 0 ? 0 : 1;
      return n.y > 0 ? 2 : 3;
    }, 4);
    var ladoD = tinta({ map: dir.tex }), ladoE = tinta({ map: esq.tex });
    carro.add(malha(geoB, [ladoD, ladoE, M.lima, M.fundo]));

    // frente e traseira (tampas planas pintadas)
    var anF = aneis[aneis.length - 1], anT = aneis[0];
    var lf = sp.A(h), lt = sp.A(-h);
    var pf = pintarFace(lf, sp.yb(h), sp.topo(h), FRENTES[tipoFace]);
    var pt = pintarFace(lt, sp.yb(-h), sp.topo(-h), TRASEIRAS[tipoFace]);
    carro.add(malha(tampa(h, anF, function(z, y) { return [(-z - pf.b.x0) / pf.b.w, (y - pf.b.y0) / pf.b.h]; }, true), tinta({ map: pf.tex })));
    carro.add(malha(tampa(-h, anT, function(z, y) { return [(z - pt.b.x0) / pt.b.w, (y - pt.b.y0) / pt.b.h]; }, false), tinta({ map: pt.tex })));

    // cabine
    var texCab = pintarCabine(sp);
    var xsC = estacoes(c.xTras, c.xFrente, 0.015), cortesC = xsC.map(function(x) { return corteCabine(sp, x); });
    var geoC = malhaCortes(xsC, cortesC, false, function(x, y, z, j, n) { return [(x - c.xTras) / (c.xFrente - c.xTras), j / (n - 1)]; });
    orientar(geoC, function(cen, n) { return Math.abs(n.y) > 0.8 && cen.y > 1.1 ? n.y > 0 : null; });
    geoC.computeVertexNormals();
    carro.add(malha(geoC, tinta({ map: texCab, envMapIntensity: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.15 })));
    if (c.fundo) { // parede de trás da cabine, com o vidro traseiro
      var anelC = corteCabine(sp, c.xTras), yc = sp.cintura(c.xTras), wc = anelC[0][0];
      var pc = pintarFace(wc + 0.02, yc - 0.02, c.teto(c.xTras) + 0.04, function(g) {
        g.fillStyle = COR.preto; retArred(g, -0.6, yc + 0.08, 1.2, c.teto(c.xTras) - yc - 0.18, 0.06); g.fill();
        var gr = g.createLinearGradient(0, c.teto(c.xTras), 0, yc); gr.addColorStop(0, '#41505a'); gr.addColorStop(1, '#0b1014');
        g.fillStyle = gr; retArred(g, -0.56, yc + 0.11, 1.12, c.teto(c.xTras) - yc - 0.24, 0.05); g.fill();
        g.fillStyle = COR.vermelho; g.fillRect(-0.12, c.teto(c.xTras) - 0.06, 0.24, 0.025);
      });
      carro.add(malha(tampa(c.xTras, anelC, function(z, y) { return [(z - pc.b.x0) / pc.b.w, (y - pc.b.y0) / pc.b.h]; }, false), tinta({ map: pc.tex, envMapIntensity: 0.35, clearcoat: 0.7 })));
    } else { // fecha a ponta de trás da cabine (Polo: a fresta acima da tampa traseira)
      carro.add(malha(tampa(c.xTras, corteCabine(sp, c.xTras), function() { return [0, 0]; }, false), M.lima));
    }

    // caçamba (por dentro) e chassi aparente
    if (cac) {
      var comp = cac.frente - cac.tras - 0.06, alt = sp.cintura(cac.tras + 0.5) - cac.piso;
      var forro = new THREE.Mesh(new THREE.BoxGeometry(comp, alt, cac.interna * 2), M.cacamba);
      forro.position.set(cac.tras + 0.06 + comp / 2, cac.piso + alt / 2 - 0.002, 0); forro.receiveShadow = true; carro.add(forro);
      var chassi = new THREE.Mesh(new THREE.BoxGeometry(sp.L * 0.8, 0.16, 1.0), M.fundo);
      chassi.position.set(-0.1, 0.36, 0); carro.add(chassi);
      // estribos laterais
      [-1, 1].forEach(function(l) {
        var e = malha(rbox(sp.xf - sp.xr - 2 * sp.R - 0.12, 0.05, 0.16, 0.02), M.plastico);
        e.position.set((sp.xf + sp.xr) / 2, 0.36, l * (sp.A0 - 0.02)); carro.add(e);
      });
    }

    // caixas de roda: forro escuro atrás de cada roda e para-lamas de plástico (S10)
    [sp.xf, sp.xr].forEach(function(x) {
      [-1, 1].forEach(function(l) {
        var forroR = new THREE.Mesh(new THREE.CylinderGeometry(sp.R, sp.R, 0.04, 32), M.fundo);
        forroR.rotation.x = Math.PI / 2; forroR.position.set(x, sp.r, l * (sp.A0 - sp.largPneu - 0.1)); carro.add(forroR);
        if (sp.paralamas) {
          var f = new THREE.Shape(), ri = sp.R - 0.005, re = sp.R + 0.075, a0 = -0.22, a1 = Math.PI + 0.22;
          f.absarc(0, 0, re, a0, a1, false); f.absarc(0, 0, ri, a1, a0, true);
          var geo = new THREE.ExtrudeGeometry(f, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 40 });
          geo.translate(0, 0, -0.035);
          var pl = malha(geo, M.plastico); pl.position.set(x, sp.r, l * (sp.A(x) - 0.012)); carro.add(pl);
        }
      });
    });

    // rodas
    [sp.xf, sp.xr].forEach(function(x) {
      [-1, 1].forEach(function(l) {
        var rd = roda(sp, M);
        rd.position.set(x, sp.r, l * (sp.A0 - sp.largPneu / 2 - (sp.paralamas ? 0.0 : 0.02)));
        if (l < 0) rd.rotation.y = Math.PI;
        carro.add(rd);
      });
    });

    // faróis e lanternas
    var fr = h + 0.004, tr = -h - 0.004;
    [-1, 1].forEach(function(l) {
      if (sp.picape) {
        var fa = malha(rbox(0.05, 0.12, 0.34, 0.03), M.lente); fa.position.set(fr, 1.11, l * 0.67); carro.add(fa);
        var led = malha(rbox(0.012, 0.02, 0.3, 0.008), M.led, false); led.position.set(fr + 0.024, 1.15, l * 0.67); carro.add(led);
        var le = malha(rbox(0.05, 0.36, 0.12, 0.03), M.lanterna); le.position.set(tr, sp.lanternaY, l * (sp.A(-h) - 0.07)); carro.add(le);
      } else {
        var fp = malha(rbox(0.05, 0.08, 0.36, 0.03), M.lente); fp.position.set(fr - 0.03, sp.farolY + 0.02, l * 0.5); fp.rotation.y = l * 0.25; carro.add(fp);
        var lp = malha(rbox(0.012, 0.012, 0.3, 0.005), M.led, false); lp.position.set(fr - 0.005, sp.farolY + 0.005, l * 0.5); lp.rotation.y = l * 0.25; carro.add(lp);
        var lt2 = malha(rbox(0.06, 0.1, 0.34, 0.03), M.lanterna); lt2.position.set(tr + 0.02, sp.lanternaY, l * 0.55); lt2.rotation.y = -l * 0.25; carro.add(lt2);
      }
    });
    // para-choques com volume
    if (sp.picape) {
      var pcT = malha(rbox(0.16, 0.16, sp.A(-h) * 2 - 0.04, 0.03), M.plastico); pcT.position.set(tr - 0.04, sp.yb(-h) + 0.1, 0); carro.add(pcT);
    }

    // placas
    var placaMat = new THREE.MeshStandardMaterial({ map: texturaPlaca(v.placa), roughness: 0.45 });
    var placas = sp.picape ? [[fr + 0.012, 0.56, 1], [tr - 0.125, sp.yb(-h) + 0.1, -1]] : [[fr + 0.01, 0.4, 1], [tr - 0.01, 0.66, -1]];
    placas.forEach(function(p) {
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.13), placaMat);
      pl.position.set(p[0], p[1], 0); pl.rotation.y = p[2] * Math.PI / 2; carro.add(pl);
    });

    // retrovisores
    [-1, 1].forEach(function(l) {
      var xm = c.xFrente - 0.2, ym = sp.cintura(xm) + (sp.picape ? 0.1 : 0.08), lado = larguraOmbro(sp, xm) - 0.03;
      var larg = sp.picape ? 0.24 : 0.2, zm = l * (lado + 0.05 + larg / 2);
      var capa = malha(rbox(0.09, sp.picape ? 0.17 : 0.12, larg, 0.04), M.preto);
      capa.position.set(xm, ym, zm); capa.rotation.y = l * 0.12; carro.add(capa);
      var haste = malha(rbox(0.12, 0.05, 0.1, 0.02), M.preto);
      haste.position.set(xm + 0.03, ym - 0.04, l * (lado + 0.03)); carro.add(haste);
      var espelho = new THREE.Mesh(new THREE.PlaneGeometry(larg * 0.82, sp.picape ? 0.13 : 0.09), M.cromo);
      espelho.position.set(xm - 0.046, ym, zm); espelho.rotation.y = -Math.PI / 2 + l * 0.12; carro.add(espelho);
    });

    // giroflex no teto (logo atrás do para-brisa)
    var xg = c.xParabrisa - 0.22, yg = c.teto(xg);
    var baseG = malha(rbox(0.26, 0.05, 1.0, 0.02), M.preto); baseG.position.set(xg, yg + 0.02, 0); carro.add(baseG);
    var lenteG = malha(rbox(0.22, 0.08, 0.96, 0.035), M.giroflex); lenteG.position.set(xg, yg + 0.08, 0); carro.add(lenteG);
    if (!sp.picape) { var ant = malha(rbox(0.16, 0.06, 0.04, 0.02), M.preto); ant.position.set(c.xTeto + 0.15, c.teto(c.xTeto + 0.15) + 0.02, 0); carro.add(ant); }

    return { grupo: carro, sp: sp, alto: c.teto(c.xParabrisa - 0.4) };
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

  // sombra suave de contato embaixo do carro
  function sombraContato(L, W) {
    var cv = novoCanvas(256, 256), g = cv.getContext('2d');
    var gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(0.6, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.15, W * 1.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.004;
    return m;
  }

  function criarCena(vt, v) {
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; renderer.domElement.style.display = 'block';
    renderer.domElement.setAttribute('aria-label', 'Viatura em 3D: arraste para girar');

    var cena = new THREE.Scene();
    var pmrem = new THREE.PMREMGenerator(renderer);
    cena.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    var c = montarCarro(v), L = c.sp.L;
    cena.add(c.grupo);
    cena.add(new THREE.HemisphereLight(0xffffff, 0x303030, 0.6));
    var sol = new THREE.DirectionalLight(0xffffff, 2.2);
    sol.position.set(4, 8, 5); sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0005; sol.shadow.radius = 3;
    var sc = sol.shadow.camera; sc.left = sc.bottom = -L * 0.75; sc.right = sc.top = L * 0.75; sc.near = 1; sc.far = 20;
    cena.add(sol);

    // base giratória escura com aro dourado
    var base = new THREE.Mesh(new THREE.CylinderGeometry(L * 0.62, L * 0.62, 0.04, 96), mat('#1c1c1c', { roughness: 0.85 }));
    base.position.y = -0.02; base.receiveShadow = true; cena.add(base);
    var aro = new THREE.Mesh(new THREE.RingGeometry(L * 0.6, L * 0.62, 96), new THREE.MeshBasicMaterial({ color: cor('#c9a84c') }));
    aro.rotation.x = -Math.PI / 2; aro.position.y = 0.002; cena.add(aro);
    cena.add(sombraContato(L, c.sp.A0 * 2));

    var camera = new THREE.PerspectiveCamera(30, 1.6, 0.1, 60);
    var d = L * 1.55;
    camera.position.set(d * 0.66, L * 0.3, d * 0.76);
    // a rolagem do mouse continua rolando a página; zoom só com Ctrl + rolagem (no celular, pinça)
    renderer.domElement.addEventListener('wheel', function(e) { if (!e.ctrlKey) e.stopImmediatePropagation(); }, true);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(0, c.alto * 0.42, 0);
    controls.enablePan = false; controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = L * 0.8; controls.maxDistance = L * 2.4;
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
      (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).forEach(function(m) { if (m.map) m.map.dispose(); m.dispose(); });
    });
    if (vt.cena.environment) vt.cena.environment.dispose();
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

  window.Viaturas3D = { montar: montar, manter: manter, limparTudo: limparTudo, chave: chave, _vistas: vistas }; // _vistas: só para testes
})();
