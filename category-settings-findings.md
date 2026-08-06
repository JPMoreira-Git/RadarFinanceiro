# Validação das configurações

A tela de categorias e subcategorias foi validada em viewport mobile de 390x844 e desktop de 1280x720. Em ambos os formatos, os controles de edição, exclusão e arraste permanecem acessíveis; no desktop o painel de categorias e o painel de pagamentos ficam lado a lado, enquanto no mobile são empilhados sem overflow horizontal. A ordem é armazenada pelo mesmo estado persistente usado pelas configurações, portanto a sequência reorganizada é preservada entre recarregamentos do navegador.

A suíte automatizada cobre reordenação de categorias, reordenação de subcategorias, movimentos inválidos e bloqueio de exclusão quando existem lançamentos relacionados. A checagem TypeScript e os testes Vitest passaram com 16 testes aprovados.
