/* Caderno do Atelie - app (Supabase) */
(function(){
'use strict';

/* ---------- config ---------- */
var SUPABASE_URL='https://hxqukmghuxboxtwygedr.supabase.co';
var SUPABASE_KEY='sb_publishable_J9AVSLNVxvx3amkS5ykGUg_U7HmKpGC'; // chave publica; acesso controlado por RLS
var sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

/* ---------- constantes ---------- */
var STATUS=[
  {k:'orcamento',l:'Orçamento',c:'muted'},{k:'aprovado',l:'Aprovado',c:'info'},{k:'corte',l:'Corte',c:'info'},
  {k:'costura',l:'Costura',c:'accent'},{k:'prova',l:'Prova',c:'warn'},{k:'ajuste',l:'Ajuste',c:'warn'},
  {k:'pronto',l:'Pronto',c:'ok'},{k:'entregue',l:'Entregue',c:'muted'}
];
var TIPOS=[['sob_medida','Sob medida'],['ajuste','Ajuste'],['colecao','Coleção'],['aluguel','Aluguel']];
var EVT=[{k:'prova',l:'Prova',c:'accent'},{k:'entrega',l:'Entrega',c:'ok'},{k:'medicao',l:'Medição',c:'info'},{k:'orcamento',l:'Orçamento',c:'warn'},{k:'outro',l:'Outro',c:'muted'}];
var FORMAS=[['pix','Pix'],['dinheiro','Dinheiro'],['cartao','Cartão'],['outro','Outro']];
var PERMS=[
  ['ver_todos_pedidos','Ver todos os pedidos','Desligado: vê só as peças em que ela é a responsável, com a cliente e as medidas delas.'],
  ['criar_pedidos','Criar pedidos','Abrir pedido novo.'],
  ['gerenciar_clientes','Cadastrar clientes','Cadastrar e editar clientes.'],
  ['ver_contatos','Ver contatos','Telefone e Instagram das clientes.'],
  ['ver_financeiro','Ver valores','Preço das peças e pagamentos.'],
  ['excluir','Excluir','Apagar pedidos, clientes, fotos e compromissos.']
];
var MEDIDAS=[
  {g:'Tronco',f:['Pescoço','Ombro a ombro','Ombro','Busto','Abaixo do busto','Altura do busto','Separação do busto','Cintura','Quadril','Altura cintura-quadril','Largura costas','Comprimento frente','Comprimento costas','Cava']},
  {g:'Braços',f:['Comprimento manga','Braço','Cotovelo','Punho']},
  {g:'Comprimentos',f:['Comprimento blusa','Comprimento saia','Comprimento vestido','Comprimento calça','Gancho']},
  {g:'Pernas',f:['Coxa','Joelho','Panturrilha','Boca da calça']},
  {g:'Geral',f:['Altura']}
];
var MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
var MESL=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
var DIA=['dom','seg','ter','qua','qui','sex','sáb'];
var DIAL=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];

/* ---------- utils ---------- */
function $(s){return document.querySelector(s)}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function uuid(){return crypto.randomUUID()}
function pad(n){return String(n).padStart(2,'0')}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function fromIso(s){var p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2])}
function addDays(d,n){var x=new Date(d);x.setDate(x.getDate()+n);return x}
function today(){return iso(new Date())}
function diffDays(a,b){return Math.round((fromIso(a)-fromIso(b))/864e5)}
function fmtD(s){if(!s)return '—';var d=fromIso(s);return d.getDate()+' '+MES[d.getMonth()]}
function relD(s){var n=diffDays(s,today());if(n===0)return 'hoje';if(n===1)return 'amanhã';if(n===-1)return 'ontem';return DIA[fromIso(s).getDay()]+', '+fmtD(s)}
function money(v){return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function cm(v){return String(v).replace('.',',')+' cm'}
function norm(s){return String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase()}
function initials(n){return String(n||'?').trim().split(/\s+/).slice(0,2).map(function(w){return w[0]}).join('').toUpperCase()}
function num(v){if(v==null||v==='')return null;var n=parseFloat(String(v).replace(/\./g,'').replace(',','.'));if(String(v).indexOf(',')<0)n=parseFloat(v);return isNaN(n)?null:n}
function stInfo(k){return STATUS.find(function(s){return s.k===k})||STATUS[0]}
function evInfo(k){return EVT.find(function(s){return s.k===k})||EVT[4]}
function tipoL(k){var t=TIPOS.find(function(x){return x[0]===k});return t?t[1]:k}
function formaL(k){var t=FORMAS.find(function(x){return x[0]===k});return t?t[1]:k}
function pill(k){var s=stInfo(k);return '<span class="pill c-'+s.c+'">'+s.l+'</span>'}
function ucfirst(s){return s.replace(/^./,function(c){return c.toUpperCase()})}

/* ---------- estado ---------- */
var me=null;           // profile do usuario logado
var db={clientes:[],pedidos:[],eventos:[],equipe:[]};
var st={view:'hoje',agMode:'dia',agDate:today(),pedFiltro:'ativos',pedBusca:'',cliBusca:'',sheet:null,medSel:{},busy:false};
var gateMode='entrar';

function can(k){return !!me&&(me.papel==='dona'||(me.permissoes&&me.permissoes[k]===true))}
function isDona(){return !!me&&me.papel==='dona'}
function cli(id){return db.clientes.find(function(c){return c.id===id})}
function ped(id){return db.pedidos.find(function(p){return p.id===id})}
function evt(id){return db.eventos.find(function(e){return e.id===id})}
function membro(id){return db.equipe.find(function(m){return m.id===id})}
function pago(p){return (p.pagamentos||[]).reduce(function(a,x){return a+(Number(x.valor)||0)},0)}
function saldo(p){return Math.max(0,(Number(p.valor)||0)-pago(p))}
function ativos(){return db.pedidos.filter(function(p){return p.status!=='entregue'})}
function byHora(a,b){return (a.data+(a.hora||'00:00')).localeCompare(b.data+(b.hora||'00:00'))}
function byPrazo(a,b){return (a.prazo||'9999').localeCompare(b.prazo||'9999')}

/* ---------- erros ---------- */
function msgErro(e){
  var m=(e&&(e.message||e.error_description))||String(e||'Erro');
  if(/Invalid login credentials/i.test(m))return 'E-mail ou senha incorretos.';
  if(/Email not confirmed/i.test(m))return 'Confirme seu e-mail antes de entrar. Veja a caixa de entrada (e o spam).';
  if(/already registered|already been registered/i.test(m))return 'Já existe uma conta com esse e-mail. Use "Entrar".';
  if(/Password should be at least/i.test(m))return 'A senha precisa ter pelo menos 6 caracteres.';
  if(/rate limit|too many/i.test(m))return 'Muitas tentativas. Espere alguns minutos e tente de novo.';
  if(/row-level security|permission denied|violates row-level/i.test(m))return 'Sua conta não tem permissão para isso.';
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return 'Sem conexão com a internet.';
  if(/JWT expired|invalid JWT/i.test(m))return 'Sua sessão expirou. Entre de novo.';
  return m;
}
async function q(promise){var r=await promise;if(r.error)throw r.error;return r.data}

/* ---------- carga de dados ---------- */
async function loadAll(){
  var res=await Promise.all([
    q(sb.from('profiles').select('id,nome,papel,ativo,permissoes,created_at').order('created_at')),
    q(sb.from('clientes').select('id,nome,obs,created_at')),
    can('ver_contatos')?q(sb.from('cliente_contatos').select('cliente_id,telefone,instagram,email')):[],
    q(sb.from('medicoes').select('id,cliente_id,data,valores,obs').order('data')),
    q(sb.from('pedidos').select('id,cliente_id,peca,tipo,descricao,status,prazo,costureira_id,created_at')),
    can('ver_financeiro')?q(sb.from('pedido_financeiro').select('pedido_id,valor')):[],
    can('ver_financeiro')?q(sb.from('pagamentos').select('id,pedido_id,data,valor,forma').order('data')):[],
    q(sb.from('fotos').select('id,pedido_id,path,created_at').order('created_at')),
    q(sb.from('eventos').select('id,tipo,titulo,data,hora,duracao_min,lembrete_min,cliente_id,pedido_id,feito,obs,created_by'))
  ]);
  var profiles=res[0],clientes=res[1],contatos=res[2],medicoes=res[3],pedidos=res[4],fin=res[5],pags=res[6],fotos=res[7],eventos=res[8];
  db.equipe=profiles;
  var meNovo=profiles.find(function(p){return p.id===me.id});if(meNovo)me=meNovo;
  var urls={};
  if(fotos.length){
    try{var su=await q(sb.storage.from('fotos').createSignedUrls(fotos.map(function(f){return f.path}),3600));
      su.forEach(function(x){if(x.signedUrl)urls[x.path]=x.signedUrl})}catch(e){console.warn(e)}
  }
  db.clientes=clientes.map(function(c){
    var ct=contatos.find(function(x){return x.cliente_id===c.id})||{};
    return {id:c.id,nome:c.nome,obs:c.obs||'',telefone:ct.telefone||'',instagram:ct.instagram||'',email:ct.email||'',
      medidas:medicoes.filter(function(m){return m.cliente_id===c.id}).map(function(m){return {id:m.id,data:m.data,valores:m.valores||{},obs:m.obs||''}})};
  });
  db.pedidos=pedidos.map(function(p){
    var f=fin.find(function(x){return x.pedido_id===p.id});
    return {id:p.id,clienteId:p.cliente_id,peca:p.peca,tipo:p.tipo,descricao:p.descricao||'',status:p.status,prazo:p.prazo,
      costureiraId:p.costureira_id,criado:(p.created_at||'').slice(0,10),valor:f?Number(f.valor):0,temFin:!!f,
      pagamentos:pags.filter(function(x){return x.pedido_id===p.id}),
      fotos:fotos.filter(function(x){return x.pedido_id===p.id}).map(function(x){return {id:x.id,path:x.path,url:urls[x.path]||''}})};
  });
  db.eventos=eventos.map(function(e){
    return {id:e.id,tipo:e.tipo,titulo:e.titulo,data:e.data,hora:e.hora?e.hora.slice(0,5):'',dur:e.duracao_min,lembrete:e.lembrete_min,
      clienteId:e.cliente_id,pedidoId:e.pedido_id,feito:e.feito,obs:e.obs||'',createdBy:e.created_by};
  });
}
async function refresh(){
  try{await loadAll()}catch(e){toast(msgErro(e));return}
  if(!me||!me.ativo){showPending();return}
  render();if(st.sheet)openSheet(st.sheet.type,st.sheet.id,st.sheet.opts,true);
}
// executa mutacao, recarrega e re-renderiza
async function mutate(fn,okMsg){
  if(st.busy)return false;st.busy=true;
  try{await fn();await loadAll();render();if(st.sheet)openSheet(st.sheet.type,st.sheet.id,st.sheet.opts,true);if(okMsg)toast(okMsg);return true}
  catch(e){toast(msgErro(e));return false}
  finally{st.busy=false}
}

/* ---------- autenticacao ---------- */
function showGate(html){$('#shell').hidden=true;closeSheet();var g=$('#gate');g.className='gate';g.hidden=false;g.innerHTML=html}
function brand(sub){return '<div class="brand"><div class="mark">A</div><h1>Caderno do Ateliê</h1><p>'+esc(sub)+'</p></div>'}

function showLogin(msg,okMsg){
  var m=gateMode,h=brand(m==='criar'?'Crie sua conta para usar o app.':m==='esqueci'?'Vamos mandar um link para você criar uma senha nova.':'Entre com seu e-mail e senha.');
  if(m!=='esqueci')h+='<div class="seg">'+[['entrar','Entrar'],['criar','Criar conta']].map(function(x){return '<button type="button" class="'+(m===x[0]?'on':'')+'" data-g="'+x[0]+'">'+x[1]+'</button>'}).join('')+'</div>';
  h+='<form class="form" id="authForm" data-mode="'+m+'" novalidate>';
  if(msg)h+='<div class="err" role="alert">'+esc(msg)+'</div>';
  if(okMsg)h+='<div class="ok-msg" role="status">'+esc(okMsg)+'</div>';
  if(m==='criar')h+='<label class="field"><span>Seu nome</span><input id="auNome" name="nome" autocomplete="name" required></label>';
  h+='<label class="field"><span>E-mail</span><input id="auEmail" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" required></label>';
  if(m!=='esqueci')h+='<label class="field"><span>Senha'+(m==='criar'?' <em>(mínimo 6 caracteres)</em>':'')+'</span><input id="auSenha" name="senha" type="password" autocomplete="'+(m==='criar'?'new-password':'current-password')+'" minlength="6" required></label>';
  h+='<button class="btn primary" type="submit">'+(m==='criar'?'Criar conta':m==='esqueci'?'Enviar link':'Entrar')+'</button>';
  h+=m==='entrar'?'<button type="button" class="link" data-g="esqueci">Esqueci minha senha</button>':m==='esqueci'?'<button type="button" class="link" data-g="entrar">Voltar para entrar</button>':'';
  h+='</form>';
  showGate(h);
}
function showNewPassword(msg){
  showGate(brand('Escolha uma senha nova.')+'<form class="form" id="newPassForm">'+(msg?'<div class="err" role="alert">'+esc(msg)+'</div>':'')+
    '<label class="field"><span>Senha nova <em>(mínimo 6 caracteres)</em></span><input id="npSenha" name="senha" type="password" autocomplete="new-password" minlength="6" required></label>'+
    '<button class="btn primary" type="submit">Salvar senha</button></form>');
}
function showPending(){
  showGate(brand('Conta criada.')+'<div class="note" style="margin-top:0"><b>Falta a liberação.</b> Avise a dona do ateliê que você criou a conta'+(me?' como <b>'+esc(me.nome)+'</b>':'')+'. Assim que ela liberar, o app abre normalmente.</div>'+
    '<div class="actions"><button class="btn primary" data-g="recheck">Já fui liberada</button><button class="btn ghost" data-g="sair">Sair</button></div>');
}

async function boot(session){
  if(!session){showLogin();return}
  try{
    var p=await q(sb.from('profiles').select('id,nome,papel,ativo,permissoes,created_at').eq('id',session.user.id).maybeSingle());
    if(!p){showGate(brand('Algo deu errado.')+'<div class="err">Seu perfil não foi encontrado. Fale com quem configurou o app.</div><button class="btn ghost" data-g="sair">Sair</button>');return}
    me=p;
    if(!me.ativo){showPending();return}
    await loadAll();
  }catch(e){showGate(brand('Não foi possível carregar.')+'<div class="err">'+esc(msgErro(e))+'</div><div class="actions"><button class="btn primary" data-g="recheck">Tentar de novo</button><button class="btn ghost" data-g="sair">Sair</button></div>');return}
  $('#gate').hidden=true;$('#shell').hidden=false;render();
}

document.addEventListener('submit',async function(ev){
  var f=ev.target;
  if(f.id==='authForm'){
    ev.preventDefault();
    var mode=f.dataset.mode,email=(f.email.value||'').trim(),senha=f.senha?f.senha.value:'',nome=f.nome?f.nome.value.trim():'';
    if(!email){showLogin('Informe o e-mail.');return}
    if(mode!=='esqueci'&&senha.length<6){showLogin('A senha precisa ter pelo menos 6 caracteres.');return}
    if(mode==='criar'&&!nome){showLogin('Informe seu nome.');return}
    var btn=f.querySelector('[type=submit]');btn.disabled=true;btn.textContent='Aguarde…';
    try{
      if(mode==='entrar'){await q(sb.auth.signInWithPassword({email:email,password:senha}))}
      else if(mode==='criar'){
        var r=await q(sb.auth.signUp({email:email,password:senha,options:{data:{nome:nome},emailRedirectTo:location.origin+location.pathname}}));
        if(!r.session){gateMode='entrar';showLogin(null,'Conta criada. Enviamos um e-mail para '+email+'. Toque no link do e-mail e depois entre aqui.')}
      }else{
        await q(sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}));
        gateMode='entrar';showLogin(null,'Se existir conta com '+email+', enviamos um link para criar senha nova.');
      }
    }catch(e){showLogin(msgErro(e))}
    return;
  }
  if(f.id==='newPassForm'){
    ev.preventDefault();
    var s=f.senha.value;if(s.length<6){showNewPassword('A senha precisa ter pelo menos 6 caracteres.');return}
    try{await q(sb.auth.updateUser({password:s}));recovering=false;history.replaceState(null,'',location.pathname);toast('Senha alterada');var se=(await sb.auth.getSession()).data.session;boot(se)}
    catch(e){showNewPassword(msgErro(e))}
  }
},true);

document.addEventListener('click',async function(ev){
  var b=ev.target.closest('[data-g]');if(!b)return;ev.preventDefault();
  var g=b.dataset.g;
  if(g==='entrar'||g==='criar'||g==='esqueci'){gateMode=g;showLogin();return}
  if(g==='sair'){await sb.auth.signOut();return}
  if(g==='recheck'){var se=(await sb.auth.getSession()).data.session;showGate('<div class="loading">Verificando…</div>');boot(se)}
});

var recovering=false;
sb.auth.onAuthStateChange(function(event,session){
  // nao chamar supabase direto dentro do callback (deadlock conhecido); agenda
  setTimeout(function(){
    if(event==='PASSWORD_RECOVERY'){recovering=true;showNewPassword();return}
    if(recovering&&event!=='SIGNED_OUT')return;
    if(event==='SIGNED_OUT'){recovering=false;me=null;db={clientes:[],pedidos:[],eventos:[],equipe:[]};gateMode='entrar';showLogin();return}
    if(event==='INITIAL_SESSION'||event==='SIGNED_IN'){if(!me||(session&&me.id!==session.user.id))boot(session)}
  },0);
});

/* ---------- UI comum ---------- */
function empty(t,s){return '<div class="empty"><b>'+esc(t)+'</b>'+(s?'<span>'+esc(s)+'</span>':'')+'</div>'}
function evRow(e,showDay){
  var c=cli(e.clienteId),i=evInfo(e.tipo);
  var sub=[i.l];if(c)sub.push(c.nome);if(showDay)sub.unshift(relD(e.data));
  return '<button class="row" data-a="evento" data-id="'+e.id+'"><span class="time'+(e.feito?' done':'')+'">'+(e.hora||'—')+'</span>'+
    '<span class="main"><span class="t">'+esc(e.titulo)+'</span><span class="s">'+esc(sub.join(' · '))+'</span></span>'+
    '<span class="pill c-'+(e.feito?'muted':i.c)+'">'+(e.feito?'Feito':i.l)+'</span></button>';
}
function prazoTxt(p){
  if(p.status==='entregue')return {t:'Entregue',c:''};
  if(!p.prazo)return {t:'Sem prazo',c:''};
  var n=diffDays(p.prazo,today());
  if(n<0)return {t:'Atrasado '+(-n)+(n===-1?' dia':' dias'),c:'txt-bad'};
  if(n===0)return {t:'Entrega hoje',c:'txt-warn'};
  if(n===1)return {t:'Entrega amanhã',c:'txt-warn'};
  return {t:'Entrega '+DIA[fromIso(p.prazo).getDay()]+', '+fmtD(p.prazo),c:''};
}
function pedRow(p,hideCli){
  var c=cli(p.clienteId),pr=prazoTxt(p),m=membro(p.costureiraId);
  var sub=[];if(!hideCli)sub.push(c?c.nome:'Sem cliente');sub.push(tipoL(p.tipo));if(m)sub.push(m.nome.split(' ')[0]);
  var extra=(can('ver_financeiro')&&p.status!=='orcamento'&&saldo(p)>0)?' · falta '+money(saldo(p)):'';
  return '<button class="row" data-a="pedido" data-id="'+p.id+'"><span class="main"><span class="t">'+esc(p.peca)+'</span>'+
    '<span class="s">'+esc(sub.join(' · '))+'</span><span class="s"><span class="'+pr.c+'">'+pr.t+'</span>'+extra+'</span></span>'+pill(p.status)+'</button>';
}

/* ---------- views ---------- */
function vHoje(){
  var t=today(),d=new Date();
  var evs=db.eventos.filter(function(e){return e.data===t}).sort(byHora);
  var atras=ativos().filter(function(p){return p.prazo&&p.prazo<t}).sort(byPrazo);
  var semana=ativos().filter(function(p){if(!p.prazo)return false;var n=diffDays(p.prazo,t);return n>=0&&n<=7}).sort(byPrazo);
  var prodN=ativos().filter(function(p){return p.status!=='orcamento'}).length;
  var receber=db.pedidos.filter(function(p){return p.status!=='orcamento'}).reduce(function(a,p){return a+saldo(p)},0);
  var stages=STATUS.filter(function(s){return s.k!=='entregue'}).map(function(s){return {s:s,n:db.pedidos.filter(function(p){return p.status===s.k}).length}});
  var max=Math.max.apply(null,stages.map(function(x){return x.n}).concat([1]));
  var h='<p class="eyebrow" style="margin-top:6px">'+DIAL[d.getDay()]+', '+d.getDate()+' de '+MESL[d.getMonth()]+'</p>';
  var pend=isDona()?db.equipe.filter(function(m){return !m.ativo}).length:0;
  if(pend)h+='<button class="note" style="display:block;width:100%;text-align:left;border:0" data-a="equipe"><b>'+pend+(pend>1?' pessoas aguardando':' pessoa aguardando')+' liberação.</b> Toque para abrir a equipe.</button>';
  h+='<div class="stats"><button class="stat" data-a="filtro" data-id="ativos"><b>'+prodN+'</b><span>peças em produção</span></button>'+
     (can('ver_financeiro')?'<div class="stat"><b>'+money(receber).replace(/,00$/,'')+'</b><span>a receber de clientes</span></div>'
       :'<button class="stat'+(atras.length?' alert':'')+'" data-a="filtro" data-id="atrasados"><b>'+atras.length+'</b><span>pedidos atrasados</span></button>')+'</div>';
  h+='<section class="block"><div class="sec-h"><h2>Na agenda hoje</h2><button class="link" data-a="go" data-id="agenda">Ver agenda</button></div>'+
     (evs.length?'<div class="list">'+evs.map(function(e){return evRow(e)}).join('')+'</div>':empty('Nada marcado para hoje','Toque em + para marcar uma prova ou entrega.'))+'</section>';
  if(atras.length)h+='<section class="block"><div class="sec-h"><h2>Atrasados</h2><button class="link" data-a="filtro" data-id="atrasados">Ver todos</button></div><div class="list">'+atras.map(function(p){return pedRow(p)}).join('')+'</div></section>';
  h+='<section class="block"><div class="sec-h"><h2>Entregas da semana</h2></div>'+
     (semana.length?'<div class="list">'+semana.map(function(p){return pedRow(p)}).join('')+'</div>':empty('Nenhuma entrega nos próximos 7 dias',''))+'</section>';
  h+='<section class="block"><div class="sec-h"><h2>Bancada</h2><span class="eyebrow">peças por etapa</span></div><div class="line-prod">'+
     stages.map(function(x){return '<button class="lp" data-a="filtro" data-id="'+x.s.k+'"><span class="l">'+x.s.l+'</span><span class="bar"><i style="width:'+(x.n?Math.max(6,x.n/max*100):0)+'%"></i></span><span class="n">'+x.n+'</span></button>'}).join('')+'</div></section>';
  return h;
}
function weekStart(d){var x=new Date(d);var wd=(x.getDay()+6)%7;return addDays(x,-wd)}
function vAgenda(){
  var m=st.agMode,d=fromIso(st.agDate),t=today(),lbl='';
  if(m==='dia')lbl=(st.agDate===t?'Hoje, ':DIAL[d.getDay()]+', ')+d.getDate()+' de '+MESL[d.getMonth()];
  else if(m==='semana'){var s=weekStart(d),e=addDays(s,6);lbl=s.getDate()+(s.getMonth()!==e.getMonth()?' '+MES[s.getMonth()]:'')+' a '+e.getDate()+' de '+MESL[e.getMonth()]}
  else lbl=MESL[d.getMonth()]+' '+d.getFullYear();
  var h='<div class="seg" style="margin-top:14px">'+['dia','semana','mes'].map(function(k){return '<button class="'+(m===k?'on':'')+'" data-a="agMode" data-id="'+k+'">'+{dia:'Dia',semana:'Semana',mes:'Mês'}[k]+'</button>'}).join('')+'</div>';
  h+='<div class="agnav"><button class="iconbtn" data-a="agMove" data-id="-1" aria-label="Anterior"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg></button>'+
     '<span class="lbl">'+esc(lbl)+'</span>'+(st.agDate!==t?'<button class="today-btn" data-a="agHoje">Hoje</button>':'')+
     '<button class="iconbtn" data-a="agMove" data-id="1" aria-label="Próximo"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg></button></div>';
  return h+(m==='dia'?agDia():m==='semana'?agSemana():agMes());
}
function agDia(){
  var day=st.agDate,evs=db.eventos.filter(function(e){return e.data===day}).sort(byHora);
  var semHora=evs.filter(function(e){return !e.hora}),com=evs.filter(function(e){return e.hora});
  var H0=7,H1=21,h='';
  com.forEach(function(e){var hh=parseInt(e.hora,10);if(hh<H0)H0=hh;if(hh>=H1)H1=hh+1});
  if(semHora.length)h+='<div class="allday"><span class="eyebrow">Sem horário</span><div class="list">'+semHora.map(function(e){return evRow(e)}).join('')+'</div></div>';
  h+='<div class="tl" style="height:'+((H1-H0)*60)+'px">';
  for(var i=H0;i<H1;i++)h+='<div class="hr"><span>'+pad(i)+':00</span></div>';
  com.forEach(function(e){
    var p=e.hora.split(':').map(Number),top=(p[0]-H0)*60+p[1],ht=Math.max(34,(e.dur||60)-4),inf=evInfo(e.tipo),c=cli(e.clienteId);
    h+='<button class="ev c-'+(e.feito?'muted':inf.c)+'" style="top:'+(top+2)+'px;height:'+ht+'px" data-a="evento" data-id="'+e.id+'"><b>'+esc(e.hora+' · '+e.titulo)+'</b>'+(c&&ht>40?'<span>'+esc(c.nome)+'</span>':'')+'</button>';
  });
  if(day===today()){var n=new Date(),mins=(n.getHours()-H0)*60+n.getMinutes();if(mins>=0&&mins<=(H1-H0)*60)h+='<div class="now" style="top:'+mins+'px"></div>'}
  h+='</div>';
  if(!evs.length)h='<div style="margin-top:12px">'+empty('Dia livre','Toque em + para marcar algo neste dia.')+'</div>'+h;
  return h;
}
function agSemana(){
  var s=weekStart(fromIso(st.agDate)),t=today(),h='<div class="wk">';
  for(var i=0;i<7;i++){
    var d=addDays(s,i),k=iso(d),evs=db.eventos.filter(function(e){return e.data===k}).sort(byHora);
    h+='<div><div class="dh'+(k===t?' hoje':'')+'"><b>'+d.getDate()+'</b><span>'+DIAL[d.getDay()]+(k===t?' · hoje':'')+'</span></div>'+
       (evs.length?'<div class="list">'+evs.map(function(e){return evRow(e)}).join('')+'</div>':'<div class="none">Nada marcado</div>')+'</div>';
  }
  return h+'</div>';
}
function agMes(){
  var d=fromIso(st.agDate),first=new Date(d.getFullYear(),d.getMonth(),1),start=addDays(first,-first.getDay()),t=today();
  var h='<div class="cal">'+DIA.map(function(w){return '<div class="wd">'+w+'</div>'}).join('');
  for(var i=0;i<42;i++){
    var x=addDays(start,i),k=iso(x);
    if(i===35&&x.getMonth()!==d.getMonth())break;
    var evs=db.eventos.filter(function(e){return e.data===k});
    var cls='dcell'+(x.getMonth()!==d.getMonth()?' out':'')+(k===t?' hoje':'')+(k===st.agDate?' sel':'');
    h+='<button class="'+cls+'" data-a="agSel" data-id="'+k+'" aria-label="'+x.getDate()+' de '+MESL[x.getMonth()]+', '+evs.length+' compromissos"><span>'+x.getDate()+'</span><span class="dots">'+
       evs.slice(0,3).map(function(e){return '<i class="dot" style="color:var(--'+evInfo(e.tipo).c+')"></i>'}).join('')+'</span></button>';
  }
  h+='</div>';
  var sel=db.eventos.filter(function(e){return e.data===st.agDate}).sort(byHora);
  return h+'<section class="block"><div class="sec-h"><h2>'+esc(ucfirst(relD(st.agDate)))+'</h2></div>'+
     (sel.length?'<div class="list">'+sel.map(function(e){return evRow(e)}).join('')+'</div>':empty('Nada marcado neste dia',''))+'</section>';
}
function vPedidos(){
  var t=today();
  var cnt={ativos:ativos().length,atrasados:ativos().filter(function(p){return p.prazo&&p.prazo<t}).length,todos:db.pedidos.length};
  STATUS.forEach(function(s){cnt[s.k]=db.pedidos.filter(function(p){return p.status===s.k}).length});
  var fs=[['ativos','Em aberto'],['atrasados','Atrasados']].concat(STATUS.map(function(s){return [s.k,s.l]})).concat([['todos','Todos']]);
  return searchBox('pedBusca','Buscar por peça ou cliente',st.pedBusca)+
    '<div class="chips" style="margin-top:12px">'+fs.map(function(f){return '<button class="chip'+(st.pedFiltro===f[0]?' on':'')+'" data-a="filtro" data-id="'+f[0]+'">'+f[1]+'<small>'+cnt[f[0]]+'</small></button>'}).join('')+'</div>'+
    (!can('ver_todos_pedidos')?'<div class="note" style="margin-top:6px">Mostrando só as peças em que você é a responsável.</div>':'')+
    '<div id="plist" style="margin-top:8px">'+listPedidos()+'</div>';
}
function listPedidos(){
  var t=today(),qq=norm(st.pedBusca),f=st.pedFiltro,l=db.pedidos.slice();
  if(f==='ativos')l=l.filter(function(p){return p.status!=='entregue'});
  else if(f==='atrasados')l=l.filter(function(p){return p.status!=='entregue'&&p.prazo&&p.prazo<t});
  else if(f!=='todos')l=l.filter(function(p){return p.status===f});
  if(qq)l=l.filter(function(p){var c=cli(p.clienteId);return norm(p.peca+' '+(c?c.nome:'')+' '+tipoL(p.tipo)).indexOf(qq)>=0});
  l.sort(f==='entregue'||f==='todos'?function(a,b){return byPrazo(b,a)}:byPrazo);
  return l.length?'<div class="list">'+l.map(function(p){return pedRow(p)}).join('')+'</div>':empty(qq?'Nada encontrado':'Nenhum pedido aqui',qq?'Tente outro nome.':(can('criar_pedidos')?'Toque em + para criar um pedido.':''));
}
function vClientes(){
  return searchBox('cliBusca','Buscar cliente',st.cliBusca)+
    (can('gerenciar_clientes')?'<div class="actions" style="margin-top:12px"><button class="btn ghost small" data-a="formCliente">Nova cliente</button></div>':'')+
    '<div id="clist" style="margin-top:12px">'+listClientes()+'</div>';
}
function listClientes(){
  var qq=norm(st.cliBusca),l=db.clientes.slice().sort(function(a,b){return a.nome.localeCompare(b.nome,'pt-BR')});
  if(qq)l=l.filter(function(c){return norm(c.nome+' '+c.telefone+' '+c.instagram).indexOf(qq)>=0});
  if(!l.length)return empty(qq?'Ninguém com esse nome':'Nenhuma cliente ainda',can('gerenciar_clientes')?'Toque em "Nova cliente".':'');
  return '<div class="list">'+l.map(function(c){
    var ps=db.pedidos.filter(function(p){return p.clienteId===c.id}),ab=ps.filter(function(p){return p.status!=='entregue'}).length;
    var med=c.medidas.length?'medidas de '+fmtD(c.medidas[c.medidas.length-1].data):'sem medidas';
    return '<button class="row" data-a="cliente" data-id="'+c.id+'"><span class="ini">'+esc(initials(c.nome))+'</span><span class="main"><span class="t">'+esc(c.nome)+'</span>'+
      '<span class="s">'+(ab?ab+(ab>1?' pedidos em aberto':' pedido em aberto'):ps.length+(ps.length===1?' pedido':' pedidos'))+' · '+med+'</span></span></button>';
  }).join('')+'</div>';
}
function searchBox(key,ph,val){
  return '<div class="search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'+
    '<input id="'+key+'" type="search" data-search="'+key+'" placeholder="'+esc(ph)+'" value="'+esc(val)+'" autocomplete="off" aria-label="'+esc(ph)+'"></div>';
}

var VIEWS={hoje:vHoje,agenda:vAgenda,pedidos:vPedidos,clientes:vClientes};
var TITLES={hoje:'Hoje',agenda:'Agenda',pedidos:'Pedidos',clientes:'Clientes'};
function render(){
  if(!me)return;
  $('#title').textContent=TITLES[st.view];
  $('#main').innerHTML=VIEWS[st.view]();
  document.querySelectorAll('.tab').forEach(function(b){b.classList.toggle('on',b.dataset.id===st.view)});
  $('#roleLbl').textContent=isDona()?'':me.nome.split(' ')[0];
  $('#avatar').textContent=initials(me.nome).slice(0,1);
}

/* ---------- sheets ---------- */
var SHEETS={};
function openSheet(type,id,opts,keepScroll){
  var sh=$('#sheet'),top=keepScroll?sh.scrollTop:0;
  st.sheet={type:type,id:id,opts:opts||{}};
  sh.innerHTML='<div class="grab"></div>'+SHEETS[type](id,opts||{});
  $('#scrim').hidden=false;document.body.style.overflow='hidden';sh.scrollTop=top;
}
function closeSheet(){$('#scrim').hidden=true;$('#sheet').innerHTML='';st.sheet=null;document.body.style.overflow=''}
function head(eyebrow,title){return '<div class="sheet-h"><div>'+(eyebrow?'<p class="eyebrow">'+esc(eyebrow)+'</p>':'')+'<h3>'+esc(title)+'</h3></div><button class="x" data-a="close" aria-label="Fechar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>'}

SHEETS.novo=function(){
  function opt(a,c,t,s,ic){return '<button data-a="'+a+'"><span class="ic c-'+c+'">'+ic+'</span><span><b>'+t+'</b><span>'+s+'</span></span></button>'}
  var h=head('','Adicionar')+'<div class="novo">';
  if(can('criar_pedidos'))h+=opt('formPedido','accent','Novo pedido','Sob medida, ajuste, coleção ou aluguel','<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8 3l-5 4 3 4 2-1v11h8V10l2 1 3-4-5-4c-.5 1.7-2 3-4 3S8.5 4.7 8 3z"/></svg>');
  h+=opt('formEvento','ok','Marcar na agenda','Prova, entrega, medição ou orçamento','<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>');
  if(can('gerenciar_clientes'))h+=opt('formCliente','info','Nova cliente','Nome, contato e observações','<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6"/></svg>');
  return h+'</div>';
};

SHEETS.pedido=function(id,o){
  var p=ped(id);if(!p)return head('','Pedido não encontrado');
  var c=cli(p.clienteId),idx=STATUS.findIndex(function(s){return s.k===p.status}),pr=prazoTxt(p),m=membro(p.costureiraId);
  var h=head(tipoL(p.tipo)+(c?' · '+c.nome:''),p.peca);
  h+='<div class="steps">'+STATUS.map(function(s,i){return '<button class="step'+(i<idx?' done':'')+(i===idx?' cur':'')+'" data-a="status" data-id="'+p.id+'" data-s="'+s.k+'"><i></i>'+s.l+'</button>'}).join('')+'</div>';
  if(idx<STATUS.length-1)h+='<div class="actions" style="margin-top:10px"><button class="btn primary" data-a="status" data-id="'+p.id+'" data-s="'+STATUS[idx+1].k+'">Avançar para '+STATUS[idx+1].l+'</button></div>';
  h+='<div class="kv" style="margin-top:16px"><div><span>Entrega</span><b class="'+pr.c+'">'+(p.status==='entregue'||!p.prazo?fmtD(p.prazo):pr.t.replace('Entrega ',''))+'</b></div>'+
     '<div><span>Responsável</span><b>'+esc(m?m.nome:'Não definida')+'</b></div>'+
     '<div><span>Cliente</span>'+(c?'<button data-a="cliente" data-id="'+c.id+'">'+esc(c.nome)+'</button>':'<b>—</b>')+'</div>'+
     '<div><span>Aberto em</span><b>'+fmtD(p.criado)+'</b></div></div>';
  if(p.descricao)h+='<div class="sec"><p class="eyebrow">Descrição</p><div style="white-space:pre-wrap">'+esc(p.descricao)+'</div></div>';
  if(c&&c.medidas.length)h+='<div class="sec"><button class="link" data-a="cliente" data-id="'+c.id+'">Ver medidas de '+esc(c.nome.split(' ')[0])+' ('+fmtD(c.medidas[c.medidas.length-1].data)+')</button></div>';
  h+='<div class="sec"><p class="eyebrow">Fotos · referência, tecido, prova</p><div class="photos">'+
     p.fotos.map(function(f,i){return '<button data-a="foto" data-id="'+p.id+'" data-i="'+i+'" aria-label="Ver foto '+(i+1)+'">'+(f.url?'<img src="'+esc(f.url)+'" alt="" loading="lazy">':'')+'</button>'}).join('')+
     '<label>+ Adicionar foto<input type="file" accept="image/*" data-photo="'+p.id+'"></label></div></div>';
  var evs=db.eventos.filter(function(e){return e.pedidoId===p.id}).sort(byHora);
  h+='<div class="sec"><div class="sec-h"><p class="eyebrow">Agenda da peça</p><button class="link" data-a="formEvento" data-p="'+p.id+'" data-c="'+(p.clienteId||'')+'" data-t="prova">Marcar prova</button></div>'+
     (evs.length?'<div class="list">'+evs.map(function(e){return evRow(e,true)}).join('')+'</div>':'<div class="note">Nenhuma prova ou entrega marcada.</div>')+'</div>';
  if(can('ver_financeiro')){
    var pg=pago(p),sd=saldo(p);
    h+='<div class="sec"><p class="eyebrow">Pagamento</p><div class="money"><div><span>Valor</span><b>'+money(p.valor)+'</b></div><div><span>Pago</span><b>'+money(pg)+'</b></div>'+
       '<div class="'+(sd>0?'falta':'quit')+'"><span>'+(sd>0?'Falta':'Situação')+'</span><b>'+(sd>0?money(sd):(p.valor?'Quitado':'—'))+'</b></div></div>';
    if(p.pagamentos.length)h+='<div class="list" style="margin-top:10px">'+p.pagamentos.map(function(x){return '<div class="row"><span class="time">'+fmtD(x.data)+'</span><span class="main"><span class="t">'+money(x.valor)+'</span><span class="s">'+esc(formaL(x.forma))+'</span></span><button class="link" data-a="delPag" data-id="'+x.id+'" aria-label="Remover pagamento">Remover</button></div>'}).join('')+'</div>';
    if(sd>0||!p.valor)h+='<form class="pay-form" data-form="pag" data-id="'+p.id+'"><label class="field"><span>Recebi (R$)</span><input id="payV" name="valor" inputmode="decimal" placeholder="'+(sd>0?String(sd).replace('.',','):'0,00')+'" required></label>'+
       '<label class="field"><span>Forma</span><select id="payF" name="forma">'+FORMAS.map(function(f){return '<option value="'+f[0]+'">'+f[1]+'</option>'}).join('')+'</select></label><button class="btn primary small" type="submit">Registrar</button></form>';
    h+='</div>';
  }
  h+='<div class="actions" style="margin-top:24px"><button class="btn ghost" data-a="formPedido" data-id="'+p.id+'">Editar</button>'+
     (can('excluir')?'<button class="btn danger" data-a="del" data-k="pedido" data-id="'+p.id+'">'+(o.confirm?'Toque de novo para excluir':'Excluir')+'</button>':'')+'</div>';
  return h;
};

SHEETS.cliente=function(id,o){
  var c=cli(id);if(!c)return head('','Cliente não encontrada');
  var h=head('Cliente',c.nome);
  if(can('ver_contatos'))h+='<div class="kv"><div><span>Telefone</span>'+(c.telefone?'<button data-a="copy" data-v="'+esc(c.telefone)+'">'+esc(c.telefone)+'</button>':'<b>—</b>')+'</div>'+
     '<div><span>Instagram</span><b>'+esc(c.instagram||'—')+'</b></div></div>';
  if(c.obs)h+='<div class="note"><b>Obs.</b> '+esc(c.obs)+'</div>';
  h+='<div class="sec"><div class="sec-h"><p class="eyebrow">Medidas</p><button class="link" data-a="formMedidas" data-id="'+c.id+'">'+(c.medidas.length?'Nova medição':'Tirar medidas')+'</button></div>';
  if(!c.medidas.length)h+='<div class="note">Nenhuma medida registrada ainda.</div>';
  else{
    var m=c.medidas.find(function(x){return x.id===st.medSel[c.id]})||c.medidas[c.medidas.length-1];
    var prev=c.medidas[c.medidas.indexOf(m)-1];
    if(c.medidas.length>1)h+='<div class="chips" style="margin-bottom:6px">'+c.medidas.slice().reverse().map(function(x,i){return '<button class="chip'+(x.id===m.id?' on':'')+'" data-a="medSel" data-id="'+c.id+'" data-m="'+x.id+'">'+fmtD(x.data)+(i===0?' · atual':'')+'</button>'}).join('')+'</div>';
    h+='<div class="tape" aria-hidden="true"></div>';
    MEDIDAS.forEach(function(g){
      var fs=g.f.filter(function(f){return m.valores[f]!=null});if(!fs.length)return;
      h+='<div class="mgroup"><h4>'+g.g+'</h4><div class="meas">'+fs.map(function(f){
        var v=m.valores[f],dv=prev&&prev.valores[f]!=null?Math.round((v-prev.valores[f])*10)/10:0;
        return '<div class="mrow"><span>'+esc(f)+'</span><b>'+cm(v)+(dv?' <small style="color:var(--muted)">('+(dv>0?'+':'')+String(dv).replace('.',',')+')</small>':'')+'</b></div>'}).join('')+'</div></div>';
    });
    if(m.obs)h+='<div class="note"><b>Na medição:</b> '+esc(m.obs)+'</div>';
  }
  h+='</div>';
  var ps=db.pedidos.filter(function(p){return p.clienteId===c.id}).sort(function(a,b){return (b.criado||'').localeCompare(a.criado||'')});
  h+='<div class="sec"><div class="sec-h"><p class="eyebrow">Pedidos</p>'+(can('criar_pedidos')?'<button class="link" data-a="formPedido" data-c="'+c.id+'">Novo pedido</button>':'')+'</div>'+
     (ps.length?'<div class="list">'+ps.map(function(p){return pedRow(p,true)}).join('')+'</div>':'<div class="note">Nenhum pedido ainda.</div>')+'</div>';
  var evs=db.eventos.filter(function(e){return e.clienteId===c.id&&e.data>=today()}).sort(byHora);
  h+='<div class="sec"><div class="sec-h"><p class="eyebrow">Próximos horários</p><button class="link" data-a="formEvento" data-c="'+c.id+'">Marcar</button></div>'+
     (evs.length?'<div class="list">'+evs.map(function(e){return evRow(e,true)}).join('')+'</div>':'<div class="note">Nada marcado.</div>')+'</div>';
  var acts='';
  if(can('gerenciar_clientes'))acts+='<button class="btn ghost" data-a="formCliente" data-id="'+c.id+'">Editar</button>';
  if(can('excluir'))acts+='<button class="btn danger" data-a="del" data-k="cliente" data-id="'+c.id+'">'+(o.confirm?'Toque de novo para excluir':'Excluir')+'</button>';
  if(acts)h+='<div class="actions" style="margin-top:24px">'+acts+'</div>';
  return h;
};

SHEETS.evento=function(id,o){
  var e=evt(id);if(!e)return head('','Compromisso não encontrado');
  var c=cli(e.clienteId),p=ped(e.pedidoId),i=evInfo(e.tipo);
  var lem={0:'Sem lembrete',15:'15 min antes',60:'1 hora antes',1440:'1 dia antes'}[e.lembrete||0]||'—';
  var h=head(i.l+' · '+relD(e.data),e.titulo);
  h+='<div class="kv"><div><span>Horário</span><b>'+(e.hora||'Sem horário')+(e.hora&&e.dur?' · '+e.dur+' min':'')+'</b></div><div><span>Lembrete</span><b>'+lem+'</b></div>'+
     '<div><span>Cliente</span>'+(c?'<button data-a="cliente" data-id="'+c.id+'">'+esc(c.nome)+'</button>':'<b>—</b>')+'</div>'+
     '<div><span>Pedido</span>'+(p?'<button data-a="pedido" data-id="'+p.id+'">'+esc(p.peca)+'</button>':'<b>—</b>')+'</div></div>';
  if(e.obs)h+='<div class="note">'+esc(e.obs)+'</div>';
  h+='<div class="actions" style="margin-top:20px"><button class="btn '+(e.feito?'ghost':'primary')+'" data-a="feito" data-id="'+e.id+'">'+(e.feito?'Desmarcar como feito':'Marcar como feito')+'</button></div>'+
     '<div class="actions" style="margin-top:10px"><button class="btn ghost" data-a="formEvento" data-id="'+e.id+'">Editar</button>'+
     ((can('excluir')||e.createdBy===me.id)?'<button class="btn danger" data-a="del" data-k="evento" data-id="'+e.id+'">'+(o.confirm?'Toque de novo para excluir':'Excluir')+'</button>':'')+'</div>';
  return h;
};

SHEETS.foto=function(id,o){
  var p=ped(id),f=p&&p.fotos[o.i];if(!f)return head('','Foto não encontrada');
  return head(p.peca,'Foto '+(o.i+1)+' de '+p.fotos.length)+(f.url?'<img class="bigimg" src="'+esc(f.url)+'" alt="Foto do pedido">':'<div class="note">Não foi possível carregar a foto.</div>')+
    '<div class="actions" style="margin-top:14px"><button class="btn ghost" data-a="pedido" data-id="'+p.id+'">Voltar ao pedido</button>'+
    (can('excluir')?'<button class="btn danger" data-a="delFoto" data-id="'+p.id+'" data-i="'+o.i+'">'+(o.confirm?'Toque de novo para remover':'Remover foto')+'</button>':'')+'</div>';
};

SHEETS.menu=function(){
  var h=head(isDona()?'Dona do ateliê':'Equipe',me.nome);
  h+='<div class="novo">';
  if(isDona()){
    var pend=db.equipe.filter(function(m){return !m.ativo}).length;
    h+='<button data-a="equipe"><span class="ic c-accent">E</span><span><b>Equipe'+(pend?' · '+pend+' aguardando':'')+'</b><span>Liberar costureiras e escolher o que cada uma vê.</span></span></button>';
  }
  h+='<button data-a="sair"><span class="ic c-muted">↩</span><span><b>Sair</b><span>Desconectar desta conta neste aparelho.</span></span></button></div>';
  if(!isDona()){
    var on=PERMS.filter(function(x){return can(x[0])}).map(function(x){return x[1].toLowerCase()});
    h+='<div class="note" style="margin-top:16px"><b>Seu acesso:</b> '+(on.length?on.join(', '):'agenda, peças sob sua responsabilidade e medidas das clientes delas')+'. Para mudar, fale com a dona.</div>';
  }
  return h;
};

SHEETS.equipe=function(){
  var h=head('Configurações','Equipe');
  var link=location.origin+location.pathname;
  h+='<div class="note" style="margin-top:0"><b>Para adicionar uma costureira:</b> mande o link do app para ela. Ela toca em "Criar conta" e aparece aqui para você liberar.<br><button class="link" data-a="copy" data-v="'+esc(link)+'">Copiar link do app</button></div>';
  var l=db.equipe.slice().sort(function(a,b){return (a.ativo===b.ativo?0:a.ativo?1:-1)||(a.papel==='dona'?-1:b.papel==='dona'?1:0)||a.nome.localeCompare(b.nome,'pt-BR')});
  h+='<div class="sec">'+l.map(function(m){
    var isMe=m.id===me.id,pend=!m.ativo;
    var s='<div class="member'+(pend?' pending':'')+'"><div class="member-h"><span class="ini">'+esc(initials(m.nome))+'</span><span class="main"><span class="t">'+esc(m.nome)+(isMe?' (você)':'')+'</span>'+
      '<span class="s">'+(m.papel==='dona'?'Dona · acesso total':pend?'Aguardando liberação':'Costureira')+'</span></span>';
    if(m.papel!=='dona')s+='<button class="sw" role="switch" aria-checked="'+m.ativo+'" aria-label="Liberar acesso de '+esc(m.nome)+'" data-a="toggleAtivo" data-id="'+m.id+'"></button>';
    s+='</div>';
    if(m.papel!=='dona'&&m.ativo){
      s+=PERMS.map(function(x){var on=!!(m.permissoes&&m.permissoes[x[0]]);
        return '<div class="perm"><span class="txt"><b>'+x[1]+'</b><span>'+x[2]+'</span></span><button class="sw" role="switch" aria-checked="'+on+'" aria-label="'+esc(x[1])+' para '+esc(m.nome)+'" data-a="togglePerm" data-id="'+m.id+'" data-p="'+x[0]+'"></button></div>'}).join('');
    }else if(pend){
      s+='<div class="s" style="font-size:13px;color:var(--muted)">Ligue a chave para liberar. Ela começa sem ver valores, contatos nem peças de outras costureiras; ajuste depois.</div>';
    }
    return s+'</div>';
  }).join('')+'</div>';
  return h;
};

/* ---------- formularios ---------- */
function optList(arr,sel,blank){return (blank!=null?'<option value="">'+esc(blank)+'</option>':'')+arr.map(function(x){return '<option value="'+esc(x[0])+'"'+(String(x[0])===String(sel)?' selected':'')+'>'+esc(x[1])+'</option>'}).join('')}
function radios(name,arr,sel){return '<div class="radios" role="radiogroup">'+arr.map(function(x,i){return '<label><input type="radio" id="'+name+'_'+i+'" name="'+name+'" value="'+esc(x[0])+'"'+(x[0]===sel?' checked':'')+'><span>'+esc(x[1])+'</span></label>'}).join('')+'</div>'}
function clienteOpts(sel,blank){return optList(db.clientes.slice().sort(function(a,b){return a.nome.localeCompare(b.nome,'pt-BR')}).map(function(c){return [c.id,c.nome]}),sel,blank)}
function formBtns(){return '<div class="actions" style="margin-top:6px"><button type="button" class="btn ghost" data-a="close">Cancelar</button><button type="submit" class="btn primary">Salvar</button></div>'}

SHEETS.formPedido=function(id,o){
  var p=id?ped(id):null,cid=p?p.clienteId:(o.c||'');
  var restrita=!can('ver_todos_pedidos');
  var resp=p?p.costureiraId:(restrita?me.id:'');
  var equipe=db.equipe.filter(function(m){return m.ativo}).map(function(m){return [m.id,m.nome+(m.papel==='dona'?' (dona)':'')]});
  var h=head(p?'Editar pedido':'Novo pedido',p?p.peca:'O que vamos fazer?');
  h+='<form class="form" data-form="pedido" data-id="'+(id||'')+'">'+
    '<label class="field"><span>Cliente</span><select id="fpCli" name="cliente_id" required>'+clienteOpts(cid,'Escolha a cliente')+'</select></label>'+
    '<label class="field"><span>Peça</span><input id="fpPeca" name="peca" required placeholder="Ex.: vestido de madrinha" value="'+esc(p?p.peca:'')+'"></label>'+
    '<div class="field"><span>Tipo</span>'+radios('tipo',TIPOS,p?p.tipo:'sob_medida')+'</div>'+
    '<label class="field"><span>Descrição <em>(tecido, modelo, detalhes)</em></span><textarea id="fpDesc" name="descricao">'+esc(p?p.descricao:'')+'</textarea></label>'+
    '<div class="grid2"><label class="field"><span>Entrega</span><input id="fpPrazo" type="date" name="prazo" required value="'+(p?(p.prazo||''):iso(addDays(new Date(),14)))+'"></label>'+
    '<label class="field"><span>Responsável</span><select id="fpCost" name="costureira_id"'+(restrita?' disabled':'')+'>'+optList(equipe,resp,'Não definida')+'</select></label></div>'+
    (p?'<label class="field"><span>Etapa</span><select id="fpSt" name="status">'+optList(STATUS.map(function(s){return [s.k,s.l]}),p.status)+'</select></label>':'');
  if(can('ver_financeiro'))h+='<div class="grid2"><label class="field"><span>Valor total (R$)</span><input id="fpVal" name="valor" inputmode="decimal" placeholder="0,00" value="'+(p&&p.valor?String(p.valor).replace('.',','):'')+'"></label>'+
    (p?'':'<label class="field"><span>Sinal recebido (R$)</span><input id="fpSinal" name="sinal" inputmode="decimal" placeholder="0,00"></label>')+'</div>';
  return h+formBtns()+'</form>';
};
SHEETS.formEvento=function(id,o){
  var e=id?evt(id):null;
  var tipo=e?e.tipo:(o.t||'prova'),cid=e?e.clienteId:(o.c||''),pid=e?e.pedidoId:(o.p||'');
  var data=e?e.data:(st.view==='agenda'?st.agDate:today());
  var h=head(e?'Editar':'Marcar na agenda',e?e.titulo:'Novo compromisso');
  h+='<form class="form" data-form="evento" data-id="'+(id||'')+'">'+
    '<div class="field"><span>Tipo</span>'+radios('tipo',EVT.map(function(x){return [x.k,x.l]}),tipo)+'</div>'+
    '<label class="field"><span>Título <em>(opcional)</em></span><input id="feTit" name="titulo" placeholder="Ex.: 1ª prova" value="'+esc(e?e.titulo:'')+'"></label>'+
    '<div class="grid2"><label class="field"><span>Dia</span><input id="feData" type="date" name="data" required value="'+data+'"></label>'+
    '<label class="field"><span>Horário</span><input id="feHora" type="time" name="hora" value="'+(e?e.hora:'')+'"></label></div>'+
    '<div class="grid2"><label class="field"><span>Duração</span><select id="feDur" name="dur">'+optList([[30,'30 min'],[45,'45 min'],[60,'1 hora'],[90,'1h30'],[120,'2 horas']],e?e.dur:60)+'</select></label>'+
    '<label class="field"><span>Lembrete</span><select id="feLem" name="lembrete">'+optList([[0,'Nenhum'],[15,'15 min antes'],[60,'1 hora antes'],[1440,'1 dia antes']],e?e.lembrete:60)+'</select></label></div>'+
    '<label class="field"><span>Cliente <em>(opcional)</em></span><select id="feCli" name="cliente_id">'+clienteOpts(cid,'Nenhuma')+'</select></label>'+
    '<label class="field"><span>Pedido <em>(opcional)</em></span><select id="fePed" name="pedido_id">'+optList(db.pedidos.filter(function(p){return p.status!=='entregue'||p.id===pid}).map(function(p){var c=cli(p.clienteId);return [p.id,p.peca+(c?' · '+c.nome:'')]}),pid,'Nenhum')+'</select></label>'+
    '<label class="field"><span>Observação</span><textarea id="feObs" name="obs">'+esc(e?e.obs:'')+'</textarea></label>';
  return h+formBtns()+'</form>';
};
SHEETS.formCliente=function(id){
  var c=id?cli(id):null;
  var h=head(c?'Editar cliente':'Nova cliente',c?c.nome:'Quem é?')+'<form class="form" data-form="cliente" data-id="'+(id||'')+'">'+
    '<label class="field"><span>Nome</span><input id="fcNome" name="nome" required value="'+esc(c?c.nome:'')+'"></label>';
  if(can('ver_contatos'))h+='<div class="grid2"><label class="field"><span>Telefone / WhatsApp</span><input id="fcTel" name="telefone" inputmode="tel" value="'+esc(c?c.telefone:'')+'"></label>'+
    '<label class="field"><span>Instagram</span><input id="fcIg" name="instagram" placeholder="@" value="'+esc(c?c.instagram:'')+'"></label></div>';
  return h+'<label class="field"><span>Observações</span><textarea id="fcObs" name="obs" placeholder="Preferências, evento, indicação…">'+esc(c?c.obs:'')+'</textarea></label>'+formBtns()+'</form>';
};
SHEETS.formMedidas=function(id){
  var c=cli(id),last=c.medidas[c.medidas.length-1],v=last?last.valores:{};
  var h=head(c.nome,'Nova medição')+'<form class="form" data-form="medidas" data-id="'+id+'">'+
    '<label class="field"><span>Data</span><input id="fmData" type="date" name="_data" value="'+today()+'" required></label>'+
    (last?'<div class="note">Preenchido com a medição de '+fmtD(last.data)+'. Altere só o que mudou.</div>':'');
  MEDIDAS.forEach(function(g,gi){
    h+='<div class="mgroup"><h4>'+g.g+'</h4><div class="minputs">'+g.f.map(function(f,fi){
      return '<label class="field"><span>'+esc(f)+'</span><span class="unit"><input id="fm_'+gi+'_'+fi+'" name="'+esc(f)+'" inputmode="decimal" value="'+(v[f]!=null?String(v[f]).replace('.',','):'')+'"></span></label>'}).join('')+'</div></div>';
  });
  return h+'<label class="field"><span>Observação</span><textarea id="fmObs" name="_obs" placeholder="Ex.: usará salto 9 cm"></textarea></label>'+formBtns()+'</form>';
};

/* ---------- acoes ---------- */
var A={
  go:function(b){st.view=b.dataset.id;closeSheet();render();window.scrollTo(0,0)},
  novo:function(){openSheet('novo')},
  menu:function(){openSheet('menu')},
  equipe:function(){openSheet('equipe')},
  sair:function(){closeSheet();sb.auth.signOut()},
  close:function(){closeSheet()},
  pedido:function(b){openSheet('pedido',b.dataset.id)},
  cliente:function(b){openSheet('cliente',b.dataset.id)},
  evento:function(b){openSheet('evento',b.dataset.id)},
  foto:function(b){openSheet('foto',b.dataset.id,{i:Number(b.dataset.i)})},
  formPedido:function(b){
    if(!b.dataset.id&&!db.clientes.length){toast(can('gerenciar_clientes')?'Cadastre uma cliente primeiro.':'Nenhuma cliente disponível.');return}
    openSheet('formPedido',b.dataset.id,{c:b.dataset.c})},
  formEvento:function(b){openSheet('formEvento',b.dataset.id,{c:b.dataset.c,p:b.dataset.p,t:b.dataset.t})},
  formCliente:function(b){openSheet('formCliente',b.dataset.id)},
  formMedidas:function(b){openSheet('formMedidas',b.dataset.id)},
  filtro:function(b){st.pedFiltro=b.dataset.id;if(st.view!=='pedidos'){st.view='pedidos';window.scrollTo(0,0)}closeSheet();render()},
  agMode:function(b){st.agMode=b.dataset.id;render()},
  agHoje:function(){st.agDate=today();render()},
  agSel:function(b){st.agDate=b.dataset.id;render()},
  agMove:function(b){var n=Number(b.dataset.id),d=fromIso(st.agDate);
    if(st.agMode==='dia')d=addDays(d,n);else if(st.agMode==='semana')d=addDays(d,7*n);else d=new Date(d.getFullYear(),d.getMonth()+n,1);
    st.agDate=iso(d);render()},
  medSel:function(b){st.medSel[b.dataset.id]=b.dataset.m;openSheet('cliente',b.dataset.id,{},true)},
  copy:function(b){var v=b.dataset.v;try{navigator.clipboard.writeText(v).then(function(){toast('Copiado')},function(){toast(v)})}catch(e){toast(v)}},
  status:function(b){var id=b.dataset.id,s=b.dataset.s;
    mutate(function(){return q(sb.from('pedidos').update({status:s}).eq('id',id))},stInfo(s).l).then(function(ok){
      var p=ped(id);if(ok&&p&&s==='entregue'&&can('ver_financeiro')&&saldo(p)>0)toast('Entregue. Ainda falta receber '+money(saldo(p))+'.')})},
  feito:function(b){var e=evt(b.dataset.id);mutate(function(){return q(sb.from('eventos').update({feito:!e.feito}).eq('id',e.id))})},
  delPag:function(b){mutate(function(){return q(sb.from('pagamentos').delete().eq('id',b.dataset.id))},'Pagamento removido')},
  delFoto:function(b){
    if(!st.sheet.opts.confirm){openSheet('foto',b.dataset.id,{i:Number(b.dataset.i),confirm:true},true);return}
    var p=ped(b.dataset.id),f=p.fotos[Number(b.dataset.i)];
    mutate(async function(){await q(sb.from('fotos').delete().eq('id',f.id));await sb.storage.from('fotos').remove([f.path])},'Foto removida').then(function(ok){if(ok)openSheet('pedido',p.id)})},
  del:function(b){
    var k=b.dataset.k,id=b.dataset.id;
    if(!(st.sheet&&st.sheet.opts.confirm)){openSheet(k,id,{confirm:true},true);return}
    var tbl={pedido:'pedidos',cliente:'clientes',evento:'eventos'}[k];
    var paths=k==='pedido'?(ped(id).fotos.map(function(f){return f.path})):[];
    closeSheet();
    mutate(async function(){await q(sb.from(tbl).delete().eq('id',id));if(paths.length)await sb.storage.from('fotos').remove(paths)},'Excluído');
  },
  toggleAtivo:function(b){var m=membro(b.dataset.id);mutate(function(){return q(sb.from('profiles').update({ativo:!m.ativo}).eq('id',m.id))},m.ativo?'Acesso de '+m.nome+' bloqueado':m.nome+' liberada')},
  togglePerm:function(b){var m=membro(b.dataset.id),k=b.dataset.p,perms=Object.assign({},m.permissoes||{});perms[k]=!perms[k];
    mutate(function(){return q(sb.from('profiles').update({permissoes:perms}).eq('id',m.id))})}
};

document.addEventListener('click',function(ev){
  if(ev.target.id==='scrim'){closeSheet();return}
  var b=ev.target.closest('[data-a]');if(!b)return;
  var fn=A[b.dataset.a];if(fn){ev.preventDefault();fn(b)}
});
document.addEventListener('input',function(ev){
  var k=ev.target.dataset&&ev.target.dataset.search;if(!k)return;
  st[k]=ev.target.value;
  if(k==='pedBusca')$('#plist').innerHTML=listPedidos();else $('#clist').innerHTML=listClientes();
});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&st.sheet)closeSheet()});

document.addEventListener('submit',function(ev){
  var f=ev.target,kind=f.dataset.form;if(!kind)return;ev.preventDefault();
  var fd=new FormData(f),g=function(k){var v=fd.get(k);return v==null?'':String(v).trim()},id=f.dataset.id;
  if(kind==='pedido'){
    var isNew=!id,pid=id||uuid();
    var row={cliente_id:g('cliente_id')||null,peca:g('peca'),tipo:g('tipo')||'sob_medida',descricao:g('descricao')||null,prazo:g('prazo')||null,
      costureira_id:can('ver_todos_pedidos')?(g('costureira_id')||null):(isNew?me.id:ped(id).costureiraId)};
    if(!row.peca){toast('Informe a peça.');return}
    if(!isNew&&fd.has('status'))row.status=g('status');
    var valor=num(g('valor')),sinal=num(g('sinal'));
    if(isNew&&sinal)row.status='aprovado';
    st.sheet=null;closeSheet();
    mutate(async function(){
      if(isNew){row.id=pid;await q(sb.from('pedidos').insert(row))}else await q(sb.from('pedidos').update(row).eq('id',pid));
      if(can('ver_financeiro')&&(valor!=null||isNew))await q(sb.from('pedido_financeiro').upsert({pedido_id:pid,valor:valor||0}));
      if(can('ver_financeiro')&&isNew&&sinal)await q(sb.from('pagamentos').insert({id:uuid(),pedido_id:pid,valor:sinal,forma:'pix'}));
    },isNew?'Pedido criado':'Pedido salvo').then(function(ok){if(ok&&ped(pid))openSheet('pedido',pid)});
  }
  else if(kind==='evento'){
    var eid=id||uuid(),nw=!id;
    var r={tipo:g('tipo')||'outro',data:g('data'),hora:g('hora')||null,duracao_min:Number(g('dur'))||60,lembrete_min:Number(g('lembrete'))||0,
      cliente_id:g('cliente_id')||null,pedido_id:g('pedido_id')||null,obs:g('obs')||null};
    if(r.pedido_id&&!r.cliente_id){var pp=ped(r.pedido_id);if(pp)r.cliente_id=pp.clienteId}
    var c=cli(r.cliente_id);r.titulo=g('titulo')||(evInfo(r.tipo).l+(c?', '+c.nome.split(' ')[0]:''));
    if(!r.data){toast('Informe o dia.');return}
    st.sheet=null;closeSheet();if(st.view==='agenda')st.agDate=r.data;
    mutate(function(){if(nw){r.id=eid;return q(sb.from('eventos').insert(r))}return q(sb.from('eventos').update(r).eq('id',eid))},nw?'Marcado na agenda':'Salvo')
      .then(function(ok){if(ok&&evt(eid))openSheet('evento',eid)});
  }
  else if(kind==='cliente'){
    var cid=id||uuid(),n2=!id,nome=g('nome');
    if(!nome){toast('Informe o nome.');return}
    st.sheet=null;closeSheet();
    mutate(async function(){
      if(n2)await q(sb.from('clientes').insert({id:cid,nome:nome,obs:g('obs')||null}));
      else await q(sb.from('clientes').update({nome:nome,obs:g('obs')||null}).eq('id',cid));
      if(can('ver_contatos'))await q(sb.from('cliente_contatos').upsert({cliente_id:cid,telefone:g('telefone')||null,instagram:g('instagram')||null}));
    },n2?'Cliente cadastrada':'Salvo').then(function(ok){if(ok&&cli(cid))openSheet('cliente',cid)});
  }
  else if(kind==='medidas'){
    var vals={};
    MEDIDAS.forEach(function(gr){gr.f.forEach(function(k){var v=num(fd.get(k));if(v!=null)vals[k]=v})});
    if(!Object.keys(vals).length){toast('Preencha ao menos uma medida.');return}
    var mid=uuid();st.medSel[id]=mid;st.sheet=null;closeSheet();
    mutate(function(){return q(sb.from('medicoes').insert({id:mid,cliente_id:id,data:g('_data')||today(),valores:vals,obs:g('_obs')||null}))},'Medidas salvas')
      .then(function(ok){if(ok)openSheet('cliente',id)});
  }
  else if(kind==='pag'){
    var v=num(g('valor'));if(!v||v<=0){toast('Informe o valor recebido.');return}
    var p=ped(id);
    mutate(async function(){
      if(!p.temFin)await q(sb.from('pedido_financeiro').upsert({pedido_id:id,valor:p.valor||0}));
      await q(sb.from('pagamentos').insert({id:uuid(),pedido_id:id,valor:v,forma:g('forma')||'pix'}));
      if(p.status==='orcamento')await q(sb.from('pedidos').update({status:'aprovado'}).eq('id',id));
    },'Pagamento registrado');
  }
});

/* ---------- fotos ---------- */
document.addEventListener('change',function(ev){
  var pid=ev.target.dataset&&ev.target.dataset.photo;if(!pid||!ev.target.files||!ev.target.files[0])return;
  var file=ev.target.files[0];toast('Enviando foto…');
  compress(file).then(function(blob){
    var path=pid+'/'+uuid()+'.jpg';
    return mutate(async function(){
      await q(sb.storage.from('fotos').upload(path,blob,{contentType:'image/jpeg',upsert:false}));
      await q(sb.from('fotos').insert({id:uuid(),pedido_id:pid,path:path}));
    },'Foto adicionada');
  },function(){toast('Não consegui abrir essa imagem.')});
});
function compress(file){return new Promise(function(res,rej){
  var r=new FileReader();r.onerror=rej;
  r.onload=function(){var img=new Image();img.onerror=rej;img.onload=function(){
    var max=1600,s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
    c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    c.toBlob(function(b){b?res(b):rej(new Error('blob'))},'image/jpeg',0.78)};img.src=r.result};
  r.readAsDataURL(file)})}

var tt;function toast(m){var t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(function(){t.hidden=true},2800)}

/* ---------- ciclo de vida ---------- */
// ao voltar para o app, busca dados novos (outra pessoa pode ter mudado algo)
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&me&&me.ativo&&!st.busy)refresh()});
setInterval(function(){if(me&&st.view==='agenda'&&st.agMode==='dia'&&!st.sheet)render()},60000);

if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1')){
  navigator.serviceWorker.register('sw.js').catch(function(e){console.warn('SW',e)});
}
})();
