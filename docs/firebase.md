Auth:
https://console.firebase.google.com/project/gen-lang-client-0206982864/authentication/users

Firestore Database (Onde os dados das telas e hotspots são salvos):

https://console.firebase.google.com/project/gen-lang-client-0206982864/firestore/databases/ai-studio-bf42b197-f37f-447f-8878-944b3eaccdfc/data

## Fluxo atual de imagens (sem Firebase Storage)

- As imagens são compactadas/redimensionadas no navegador.
- O resultado é salvo em `imageUrl` como Base64 no Firestore (`apps/{appId}/screens/{screenId}`).
- O endpoint `/api/upload` ficou desativado.

## Como validar no console do navegador

Ao adicionar uma tela, abra o DevTools (F12) e procure por:

- `[Screens][prepare-base64]` → mostra tamanho original e tamanho final compactado.
- `[Screens][submit]` → mostra payload enviado ao salvar.
- `[Firestore][screens][send]` → confirma envio para `apps/{appId}/screens`.
- `[Firestore][screens][ok]` → confirma sucesso com o `screenId` gravado.

Se aparecer `[Firestore][screens][ok]`, a tela foi persistida no Firestore com sucesso.