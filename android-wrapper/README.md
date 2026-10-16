# Excursão Brasília — Android

O sistema usa TanStack Start com renderização no servidor. Não copie o build SSR para um WebView local.

Para criar um APK, use um projeto Android nativo com WebView apontando para https://propostabsb.excursaobrasilia.com.br, habilitando JavaScript, DOM storage e cookies necessários à autenticação. Restrinja navegação interna ao domínio oficial, encaminhe links externos ao navegador, implemente upload/download de arquivos e teste login, PDFs, links compartilhados e botão voltar. Gere um APK assinado no Android Studio antes de distribuir.

O PWA é independente do APK e exige HTTPS, ícones adequados (192x192 e 512x512) e testes de instalação. O manifesto inicial reaproveita favicon.png e ainda precisa de ícones nas dimensões exigidas.
