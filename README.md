# Caderno do Ateliê

PWA para gestão de ateliê de moda: agenda de provas e entregas, pedidos por etapa, clientes com histórico de medidas, fotos e pagamentos.

- Front estático (HTML + JS, sem build), publicado no GitHub Pages.
- Backend: Supabase (Postgres + Auth + Storage). Acesso controlado por Row Level Security.
- A chave no `app.js` é a *publishable key* do Supabase, pública por design. Sem login, o banco não devolve nada.
