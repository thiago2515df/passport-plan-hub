# Excursão Brasília — instalação Android e PWA

## Android APK de teste
O código-fonte Android está em `android-app/` e abre exclusivamente a aplicação hospedada em https://propostabsb.excursaobrasilia.com.br dentro de uma WebView. Isso preserva o backend TanStack Start/Supabase no servidor.

1. Abra a aba [Actions](https://github.com/thiago2515df/passport-plan-hub/actions).
2. Selecione **Android APK de teste**. Caso a rotina não apareça, o GitHub pode exigir que o workflow exista na branch padrão; nesse caso abra um PR da branch de desenvolvimento, revise e integre o workflow antes de executá-lo manualmente.
3. Execute o workflow para a branch `feature/android-pwa-excursao-brasilia`, quando disponível.
4. Após execução **bem-sucedida**, baixe o artifact **Excursao-Brasilia-APK-Teste**, descompacte e instale `app-debug.apk` em um Android de teste.

O APK de debug é assinado com chave de desenvolvimento gerada pelo ambiente de build. **Não distribua como versão definitiva**: para atualizações estáveis é necessário assinar builds release com uma chave privada persistente e protegida.

## PWA
Manifesto e service worker estão na branch, mas só passam a funcionar no domínio depois de deploy. É necessário verificar HTTPS, ícones 192/512px, instalação no Android e comportamento em atualização. O `favicon.png` existente foi referenciado provisoriamente no manifesto; sua resolução ainda deve ser validada.

## Layout mobile e versão 1.0.1

- O cabeçalho mobile não exibe a logo e ocupa seu espaço no fluxo da página, sem sobrepor os campos.
- No celular, quartos e hóspedes abrem em uma janela com rolagem própria, botões de toque e confirmação sempre visível. No desktop, o seletor continua em um popover.
- O Android reserva espaço para barras do sistema, recortes da tela e teclado, mantendo a WebView dentro da área visível.
- Os ajustes de interface chegam pelo site hospedado após sua publicação. A correção das barras do Android exige instalar o APK 1.0.1.
- O workflow compila o APK nos PRs que alteram o Android e nas alterações correspondentes da `main`.

## Testes obrigatórios
- Login e logout, incluindo possíveis redirecionamentos externos de autenticação
- Acesso às propostas e navegação por rotas
- Geração e download de PDF; links `blob:` exigem tratamento específico
- Upload de anexos e seleção de arquivos
- Compartilhamento de links, WhatsApp e botão Voltar
- Comportamento sem internet, sessões expiradas e permissões
- Identidade visual: o ícone Android atual é provisório; substituir pela logo oficial antes da distribuição

## Atenção
A branch de desenvolvimento não altera o site em produção. O build e a instalação não foram validados até que a execução do GitHub Actions e os testes em um dispositivo sejam concluídos.
